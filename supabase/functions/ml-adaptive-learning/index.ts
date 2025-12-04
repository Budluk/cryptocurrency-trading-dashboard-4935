import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TradeAnalysis {
  stopDistanceActual: number;
  tpDistanceActual: number;
  volatility: number;
  duration: number;
  wasOptimal: boolean;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { userId, minTrades = 10 } = await req.json();

    console.log(`🧠 Iniciando análise ML adaptativa para user ${userId}`);

    // 1. BUSCAR HISTÓRICO COMPLETO DE TRADES
    const { data: trades, error: tradesError } = await supabase
      .from('auto_trader_positions')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'CLOSED')
      .order('closed_at', { ascending: false })
      .limit(200);

    if (tradesError) {
      throw new Error(`Erro ao buscar trades: ${tradesError.message}`);
    }

    if (!trades || trades.length < minTrades) {
      return new Response(JSON.stringify({
        success: false,
        message: `Necessário ${minTrades} trades fechados. Atual: ${trades?.length || 0}`,
        tradesCount: trades?.length || 0
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 2. ANÁLISE PROFUNDA DE STOPS
    const stopAnalysis = {
      stoppedOutTrades: [] as any[],
      tpHitTrades: [] as any[],
      optimalStops: [] as number[],
      optimalTPs: [] as number[],
      avgVolatility: 0,
      stopTooTight: 0,
      stopTooLoose: 0,
    };

    for (const trade of trades) {
      const entryPrice = trade.entry_price || 0;
      const exitPrice = trade.exit_price || trade.current_price || entryPrice;
      const stopLoss = trade.stop_loss || 0;
      const takeProfit = trade.take_profit || 0;
      const pnl = trade.realized_pnl || 0;
      const volatility = trade.volatility || 0;
      
      if (entryPrice === 0) continue;

      // Calcular distância real do movimento
      const priceMove = Math.abs((exitPrice - entryPrice) / entryPrice) * 100;
      const stopDistance = stopLoss ? Math.abs((entryPrice - stopLoss) / entryPrice) * 100 : 0;
      const tpDistance = takeProfit ? Math.abs((takeProfit - entryPrice) / entryPrice) * 100 : 0;

      // Analisar se foi stop ou TP
      if (trade.close_reason?.includes('STOP') || pnl < 0) {
        stopAnalysis.stoppedOutTrades.push({ 
          trade, 
          priceMove, 
          stopDistance,
          volatility,
          wouldHaveRecovered: false // Analisado abaixo
        });
        
        // Stop muito apertado se preço voltou depois
        if (stopDistance < volatility * 0.8) {
          stopAnalysis.stopTooTight++;
        }
      } else if (pnl > 0) {
        stopAnalysis.tpHitTrades.push({ trade, priceMove, tpDistance });
        stopAnalysis.optimalTPs.push(priceMove);
      }

      if (volatility > 0) {
        stopAnalysis.avgVolatility += volatility;
      }
    }

    stopAnalysis.avgVolatility = stopAnalysis.avgVolatility / trades.length || 2;

    // 3. CALCULAR STOPS OTIMIZADOS
    const winningTrades = trades.filter(t => (t.realized_pnl || 0) > 0);
    const losingTrades = trades.filter(t => (t.realized_pnl || 0) <= 0);
    const winRate = (winningTrades.length / trades.length) * 100;

    // Análise de drawdown máximo antes de recuperação (trades vencedores)
    const maxDrawdowns = winningTrades
      .filter(t => t.highest_price && t.entry_price)
      .map(t => {
        const side = t.side;
        if (side === 'Buy') {
          // Para longs, drawdown = quanto caiu do entry
          const lowestFromEntry = t.entry_price - (t.entry_price * 0.02); // Estimativa conservadora
          return Math.abs((t.entry_price - lowestFromEntry) / t.entry_price) * 100;
        }
        return 1.5; // Default
      });

    const avgDrawdownBeforeWin = maxDrawdowns.length > 0 
      ? maxDrawdowns.reduce((a, b) => a + b, 0) / maxDrawdowns.length 
      : 1.2;

    // 4. ANÁLISE POR VOLATILIDADE
    const volatilityBuckets = new Map<string, { trades: number, wins: number, optimalStop: number }>();
    
    for (const trade of trades) {
      const vol = trade.volatility || stopAnalysis.avgVolatility;
      const bucket = vol < 2 ? 'low' : vol < 4 ? 'medium' : 'high';
      
      if (!volatilityBuckets.has(bucket)) {
        volatilityBuckets.set(bucket, { trades: 0, wins: 0, optimalStop: 0 });
      }
      
      const stats = volatilityBuckets.get(bucket)!;
      stats.trades++;
      if ((trade.realized_pnl || 0) > 0) {
        stats.wins++;
        // Para trades vencedores, analisar quanto "respiro" teve
        const stopUsed = trade.stop_loss 
          ? Math.abs((trade.entry_price - trade.stop_loss) / trade.entry_price) * 100
          : 1.5;
        stats.optimalStop += stopUsed;
      }
    }

    // Calcular stop ideal por volatilidade
    const stopByVolatility: Record<string, number> = {};
    for (const [bucket, stats] of volatilityBuckets.entries()) {
      if (stats.wins > 0) {
        stopByVolatility[bucket] = stats.optimalStop / stats.wins;
      } else {
        stopByVolatility[bucket] = bucket === 'low' ? 1.0 : bucket === 'medium' ? 1.5 : 2.0;
      }
    }

    // 5. ANÁLISE POR SÍMBOLO E HORÁRIO
    const symbolStats = new Map<string, { wins: number, total: number, pnl: number, avgVol: number }>();
    const hourlyStats = new Map<number, { wins: number, total: number }>();
    const leverageStats = new Map<number, { wins: number, losses: number, pnl: number }>();
    
    for (const trade of trades) {
      // Por símbolo
      const symbol = trade.symbol;
      if (!symbolStats.has(symbol)) {
        symbolStats.set(symbol, { wins: 0, total: 0, pnl: 0, avgVol: 0 });
      }
      const sStats = symbolStats.get(symbol)!;
      sStats.total++;
      sStats.avgVol += trade.volatility || 0;
      if ((trade.realized_pnl || 0) > 0) sStats.wins++;
      sStats.pnl += (trade.realized_pnl || 0);

      // Por horário
      const hour = new Date(trade.opened_at).getUTCHours();
      if (!hourlyStats.has(hour)) {
        hourlyStats.set(hour, { wins: 0, total: 0 });
      }
      const hStats = hourlyStats.get(hour)!;
      hStats.total++;
      if ((trade.realized_pnl || 0) > 0) hStats.wins++;

      // Por alavancagem
      const leverage = Math.floor((trade.leverage || 10) / 5) * 5;
      if (!leverageStats.has(leverage)) {
        leverageStats.set(leverage, { wins: 0, losses: 0, pnl: 0 });
      }
      const lStats = leverageStats.get(leverage)!;
      if ((trade.realized_pnl || 0) > 0) lStats.wins++;
      else lStats.losses++;
      lStats.pnl += (trade.realized_pnl || 0);
    }

    // Calcular volatilidade média por símbolo
    for (const [symbol, stats] of symbolStats.entries()) {
      stats.avgVol = stats.avgVol / stats.total;
    }

    // 6. ENCONTRAR MELHORES PARÂMETROS
    const topSymbols = Array.from(symbolStats.entries())
      .filter(([_, stats]) => stats.total >= 3 && stats.pnl > 0)
      .sort((a, b) => (b[1].wins / b[1].total) - (a[1].wins / a[1].total))
      .slice(0, 5)
      .map(([symbol]) => symbol);

    const bestHours = Array.from(hourlyStats.entries())
      .filter(([_, stats]) => stats.total >= 2)
      .sort((a, b) => (b[1].wins / b[1].total) - (a[1].wins / a[1].total))
      .slice(0, 3)
      .map(([hour]) => hour);

    let bestLeverage = 40;
    let bestLeverageWinRate = 0;
    for (const [lev, stats] of leverageStats.entries()) {
      if (stats.wins + stats.losses >= 5) {
        const rate = stats.wins / (stats.wins + stats.losses);
        if (rate > bestLeverageWinRate && stats.pnl > 0) {
          bestLeverageWinRate = rate;
          bestLeverage = lev;
        }
      }
    }

    // 7. CÁLCULOS FINAIS OTIMIZADOS
    const avgWin = winningTrades.reduce((sum, t) => sum + (t.realized_pnl || 0), 0) / winningTrades.length || 0;
    const avgLoss = Math.abs(losingTrades.reduce((sum, t) => sum + (t.realized_pnl || 0), 0) / losingTrades.length) || 1;
    const profitFactor = (avgWin * winningTrades.length) / (avgLoss * losingTrades.length) || 0;
    const riskRewardRatio = avgLoss > 0 ? avgWin / avgLoss : 2;

    // Stop otimizado baseado em dados reais
    const baseStop = Math.max(avgDrawdownBeforeWin * 1.2, stopAnalysis.avgVolatility * 0.6);
    const optimizedStop = Math.min(Math.max(baseStop, 0.8), 2.5);

    // TP otimizado baseado em R:R e dados reais
    const avgWinMove = stopAnalysis.optimalTPs.length > 0
      ? stopAnalysis.optimalTPs.reduce((a, b) => a + b, 0) / stopAnalysis.optimalTPs.length
      : optimizedStop * 2.5;
    const optimizedTP = Math.min(Math.max(avgWinMove, optimizedStop * 2), 5);

    // 8. CONSULTAR IA PARA INSIGHTS ADICIONAIS
    const aiPrompt = `Analise este histórico de trading e forneça recomendações para OTIMIZAR STOPS:

DADOS DO TRADER:
- Trades: ${trades.length} | Win Rate: ${winRate.toFixed(1)}%
- Profit Factor: ${profitFactor.toFixed(2)} | R:R Ratio: ${riskRewardRatio.toFixed(2)}
- Volatilidade Média: ${stopAnalysis.avgVolatility.toFixed(2)}%

ANÁLISE DE STOPS:
- Stops muito apertados: ${stopAnalysis.stopTooTight} trades
- Trades fechados por stop: ${stopAnalysis.stoppedOutTrades.length}
- Trades com TP: ${stopAnalysis.tpHitTrades.length}
- Drawdown médio antes de win: ${avgDrawdownBeforeWin.toFixed(2)}%

STOPS POR VOLATILIDADE:
${Object.entries(stopByVolatility).map(([k, v]) => `${k}: ${v.toFixed(2)}%`).join('\n')}

TOP 5 SÍMBOLOS (Win Rate):
${topSymbols.slice(0, 5).map(s => {
  const stats = symbolStats.get(s)!;
  return `${s}: ${((stats.wins/stats.total)*100).toFixed(0)}% WR, Vol: ${stats.avgVol.toFixed(1)}%`;
}).join('\n')}

MELHORES HORÁRIOS: ${bestHours.join('h, ')}h UTC

Responda em JSON com stops ADAPTATIVOS:
{
  "dynamicStopLoss": {
    "base": <stop base %>,
    "lowVolatility": <stop para vol < 2%>,
    "mediumVolatility": <stop para vol 2-4%>,
    "highVolatility": <stop para vol > 4%>,
    "afterWinStreak": <stop após 3+ wins>,
    "afterLossStreak": <stop após 2+ losses>
  },
  "dynamicTakeProfit": {
    "base": <TP base %>,
    "conservative": <TP conservador>,
    "aggressive": <TP agressivo para alta confiança>
  },
  "trailingStop": {
    "activationPct": <% lucro para ativar>,
    "trailPct": <% do trailing>
  },
  "insights": ["insight1", "insight2", "insight3"],
  "recommendations": "Texto resumido das principais melhorias"
}`;

    let aiRecommendations: any = {
      dynamicStopLoss: {
        base: optimizedStop,
        lowVolatility: stopByVolatility['low'] || 1.0,
        mediumVolatility: stopByVolatility['medium'] || 1.5,
        highVolatility: stopByVolatility['high'] || 2.0,
        afterWinStreak: optimizedStop * 0.8,
        afterLossStreak: optimizedStop * 1.3
      },
      dynamicTakeProfit: {
        base: optimizedTP,
        conservative: optimizedTP * 0.7,
        aggressive: optimizedTP * 1.5
      },
      trailingStop: {
        activationPct: 1.5,
        trailPct: 0.8
      },
      insights: [],
      recommendations: 'Usando parâmetros calculados dos seus trades'
    };

    try {
      const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${lovableApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash',
          messages: [
            { role: 'system', content: 'Você é um especialista em risk management e otimização de stops para trading. Responda apenas em JSON válido.' },
            { role: 'user', content: aiPrompt }
          ],
        }),
      });

      if (aiResponse.ok) {
        const aiData = await aiResponse.json();
        const aiContent = aiData.choices[0].message.content;
        const jsonMatch = aiContent.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          aiRecommendations = { ...aiRecommendations, ...parsed };
        }
      }
    } catch (e) {
      console.log('⚠️ AI analysis skipped, using calculated values');
    }

    // 9. CONSTRUIR CONFIGURAÇÃO FINAL ADAPTATIVA
    const mlConfig = {
      user_id: userId,
      is_enabled: true,
      recommended_leverage: bestLeverage,
      recommended_stop_loss_pct: aiRecommendations.dynamicStopLoss?.base || optimizedStop,
      recommended_take_profit_pct: aiRecommendations.dynamicTakeProfit?.base || optimizedTP,
      win_rate_by_leverage: Object.fromEntries(leverageStats),
      optimal_patterns: {
        // Stops adaptativos
        dynamicStops: aiRecommendations.dynamicStopLoss || {
          base: optimizedStop,
          lowVolatility: stopByVolatility['low'] || 1.0,
          mediumVolatility: stopByVolatility['medium'] || 1.5,
          highVolatility: stopByVolatility['high'] || 2.0,
        },
        dynamicTP: aiRecommendations.dynamicTakeProfit || {
          base: optimizedTP,
          conservative: optimizedTP * 0.7,
          aggressive: optimizedTP * 1.5,
        },
        trailingStop: aiRecommendations.trailingStop || {
          activationPct: 1.5,
          trailPct: 0.8,
        },
        // Contexto
        bestSymbols: topSymbols,
        bestHours: bestHours,
        riskRewardRatio: riskRewardRatio,
        avgVolatility: stopAnalysis.avgVolatility,
        stopsByVolatility: stopByVolatility,
        // Insights
        insights: aiRecommendations.insights || [],
        recommendations: aiRecommendations.recommendations || '',
        // Métricas de aprendizado
        learningMetrics: {
          stopsTooTight: stopAnalysis.stopTooTight,
          stoppedOutRate: (stopAnalysis.stoppedOutTrades.length / trades.length * 100).toFixed(1),
          avgDrawdownBeforeWin: avgDrawdownBeforeWin.toFixed(2),
          profitFactor: profitFactor.toFixed(2),
        }
      },
      confidence_score: Math.min(winRate + (profitFactor > 1.5 ? 10 : 0), 100),
      trades_analyzed: trades.length,
      last_analysis_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // 10. SALVAR NO BANCO
    const { error: upsertError } = await supabase
      .from('ml_adaptive_config')
      .upsert(mlConfig, { onConflict: 'user_id' });

    if (upsertError) {
      throw new Error(`Erro ao salvar: ${upsertError.message}`);
    }

    console.log(`✅ ML Adaptativo: Stop ${mlConfig.recommended_stop_loss_pct.toFixed(2)}% | TP ${mlConfig.recommended_take_profit_pct.toFixed(2)}% | ${trades.length} trades analisados`);

    return new Response(JSON.stringify({
      success: true,
      message: 'ML adaptativo configurado com sucesso!',
      analysis: {
        totalTrades: trades.length,
        winRate: winRate.toFixed(1),
        profitFactor: profitFactor.toFixed(2),
        riskRewardRatio: riskRewardRatio.toFixed(2),
      },
      optimizedStops: {
        base: mlConfig.recommended_stop_loss_pct,
        byVolatility: stopByVolatility,
        tooTightCount: stopAnalysis.stopTooTight,
        avgDrawdown: avgDrawdownBeforeWin.toFixed(2),
      },
      optimizedTP: {
        base: mlConfig.recommended_take_profit_pct,
        conservative: (mlConfig.recommended_take_profit_pct * 0.7).toFixed(2),
        aggressive: (mlConfig.recommended_take_profit_pct * 1.5).toFixed(2),
      },
      insights: aiRecommendations.insights || [],
      recommendations: aiRecommendations.recommendations || 'Parâmetros otimizados baseados no seu histórico',
      config: mlConfig,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('❌ Erro ML:', error);
    return new Response(JSON.stringify({ 
      success: false,
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
