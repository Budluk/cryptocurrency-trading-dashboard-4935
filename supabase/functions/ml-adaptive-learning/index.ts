import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { userId, minTrades = 20 } = await req.json();

    console.log(`🧠 Iniciando análise ML para user ${userId}`);

    // 1. BUSCAR HISTÓRICO DE TRADES
    const { data: trades, error: tradesError } = await supabase
      .from('auto_trader_positions')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'CLOSED')
      .order('closed_at', { ascending: false })
      .limit(100);

    if (tradesError) {
      throw new Error(`Erro ao buscar trades: ${tradesError.message}`);
    }

    if (!trades || trades.length < minTrades) {
      console.log(`⚠️ Poucos trades (${trades?.length || 0}/${minTrades}) - ML não ativado`);
      return new Response(JSON.stringify({
        success: false,
        message: `Necessário pelo menos ${minTrades} trades fechados. Atual: ${trades?.length || 0}`,
        tradesCount: trades?.length || 0
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 2. ANÁLISE ESTATÍSTICA BÁSICA
    const winners = trades.filter(t => (t.realized_pnl || 0) > 0);
    const losers = trades.filter(t => (t.realized_pnl || 0) <= 0);
    const winRate = (winners.length / trades.length) * 100;
    
    const totalPnL = trades.reduce((sum, t) => sum + (t.realized_pnl || 0), 0);
    const avgWin = winners.length > 0 
      ? winners.reduce((sum, t) => sum + (t.realized_pnl || 0), 0) / winners.length 
      : 0;
    const avgLoss = losers.length > 0
      ? Math.abs(losers.reduce((sum, t) => sum + (t.realized_pnl || 0), 0) / losers.length)
      : 0;
    const profitFactor = avgLoss > 0 ? (avgWin * winners.length) / (avgLoss * losers.length) : 0;

    // 3. ANÁLISE POR ALAVANCAGEM
    const leverageAnalysis = new Map<number, { wins: number, losses: number, pnl: number }>();
    
    for (const trade of trades) {
      const leverage = trade.leverage || 10;
      const key = Math.floor(leverage / 5) * 5; // Agrupar em blocos de 5x
      
      if (!leverageAnalysis.has(key)) {
        leverageAnalysis.set(key, { wins: 0, losses: 0, pnl: 0 });
      }
      
      const stats = leverageAnalysis.get(key)!;
      if ((trade.realized_pnl || 0) > 0) {
        stats.wins++;
      } else {
        stats.losses++;
      }
      stats.pnl += (trade.realized_pnl || 0);
    }

    // 4. ANÁLISE POR SÍMBOLO
    const symbolStats = new Map<string, { wins: number, total: number, pnl: number }>();
    
    for (const trade of trades) {
      const symbol = trade.symbol;
      if (!symbolStats.has(symbol)) {
        symbolStats.set(symbol, { wins: 0, total: 0, pnl: 0 });
      }
      
      const stats = symbolStats.get(symbol)!;
      stats.total++;
      if ((trade.realized_pnl || 0) > 0) stats.wins++;
      stats.pnl += (trade.realized_pnl || 0);
    }

    // 5. ANÁLISE POR HORÁRIO (UTC)
    const hourlyStats = new Map<number, { wins: number, total: number }>();
    
    for (const trade of trades) {
      const hour = new Date(trade.opened_at).getUTCHours();
      if (!hourlyStats.has(hour)) {
        hourlyStats.set(hour, { wins: 0, total: 0 });
      }
      
      const stats = hourlyStats.get(hour)!;
      stats.total++;
      if ((trade.realized_pnl || 0) > 0) stats.wins++;
    }

    // 6. ENCONTRAR MELHOR ALAVANCAGEM (AGRESSIVO)
    let bestLeverage = 45; // Padrão agressivo para perfil escolhido
    let bestWinRate = 0;
    
    for (const [leverage, stats] of leverageAnalysis.entries()) {
      if (stats.wins + stats.losses >= 5) { // Mínimo 5 trades
        const rate = (stats.wins / (stats.wins + stats.losses)) * 100;
        if (rate > bestWinRate && stats.pnl > 0) {
          bestWinRate = rate;
          bestLeverage = leverage;
        }
      }
    }

    // Ajustar alavancagem baseado em performance global (AGRESSIVO)
    if (winRate >= 60 && profitFactor > 1.5) {
      bestLeverage = Math.min(bestLeverage + 10, 50); // Aumentar até 50x se performance excelente
    } else if (winRate < 45 || profitFactor < 1.2) {
      bestLeverage = Math.max(bestLeverage - 5, 35); // Reduzir até 35x se performance fraca (ainda agressivo)
    }

    // 7. ENCONTRAR MELHORES SÍMBOLOS (Top 5)
    const topSymbols = Array.from(symbolStats.entries())
      .filter(([_, stats]) => stats.total >= 3) // Mínimo 3 trades
      .sort((a, b) => {
        const winRateA = (a[1].wins / a[1].total) * 100;
        const winRateB = (b[1].wins / b[1].total) * 100;
        return (winRateB + b[1].pnl) - (winRateA + a[1].pnl); // Win rate + PnL
      })
      .slice(0, 5)
      .map(([symbol]) => symbol);

    // 8. ENCONTRAR MELHORES HORÁRIOS (Top 3)
    const bestHours = Array.from(hourlyStats.entries())
      .filter(([_, stats]) => stats.total >= 2)
      .sort((a, b) => {
        const winRateA = (a[1].wins / a[1].total) * 100;
        const winRateB = (b[1].wins / b[1].total) * 100;
        return winRateB - winRateA;
      })
      .slice(0, 3)
      .map(([hour]) => hour);

    // 9. ANÁLISE AVANÇADA COM LOVABLE AI
    const aiPrompt = `Você é um especialista em trading algorítmico agressivo focado em CRESCER BANCA RAPIDAMENTE com gestão de risco inteligente. Analise este histórico de trades e forneça recomendações AGRESSIVAS para maximizar lucros:

PERFORMANCE ATUAL:
- Total de trades: ${trades.length}
- Win Rate: ${winRate.toFixed(1)}%
- Profit Factor: ${profitFactor.toFixed(2)}
- PnL Total: $${totalPnL.toFixed(2)}
- Média de Ganho: $${avgWin.toFixed(2)}
- Média de Perda: $${avgLoss.toFixed(2)}

ANÁLISE POR ALAVANCAGEM:
${Array.from(leverageAnalysis.entries())
  .map(([lev, stats]) => {
    const rate = ((stats.wins / (stats.wins + stats.losses)) * 100).toFixed(1);
    return `${lev}x: ${stats.wins}W/${stats.losses}L (${rate}% win rate, $${stats.pnl.toFixed(2)})`;
  })
  .join('\n')}

TOP SÍMBOLOS:
${Array.from(symbolStats.entries())
  .sort((a, b) => {
    const rateA = (a[1].wins / a[1].total) * 100;
    const rateB = (b[1].wins / b[1].total) * 100;
    return rateB - rateA;
  })
  .slice(0, 10)
  .map(([symbol, stats]) => {
    const rate = ((stats.wins / stats.total) * 100).toFixed(1);
    return `${symbol}: ${stats.wins}/${stats.total} (${rate}% win rate, $${stats.pnl.toFixed(2)})`;
  })
  .join('\n')}

PERFIL DO TRADER: AGRESSIVO
- Objetivo: Crescimento rápido de banca
- Alavancagem: 40-50x
- Risco: Alto mas controlado
- Estratégia: Pyramiding (scaling de posições vencedoras)

Baseado nestes dados, forneça em JSON:
{
  "recommendedLeverage": <número 40-50, baseado na melhor performance>,
  "recommendedStopLossPct": <número 0.6-1.5, mais apertado para agressivo>,
  "recommendedTakeProfitPct": <número 2.5-4.5, agressivo>,
  "pyramidingThreshold": <número 1.0-2.0, % de lucro para adicionar à posição>,
  "maxPyramidingLevels": <número 2-3, quantas vezes adicionar>,
  "optimalPatterns": ["padrão1", "padrão2", "padrão3"],
  "avoidSymbols": ["símbolo1", "símbolo2"],
  "preferredTimeRanges": ["00:00-08:00", "14:00-20:00"],
  "recommendations": "Principais recomendações em português para crescer banca rapidamente mas com stops inteligentes"
}`;

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: 'Você é um especialista em trading algorítmico agressivo focado em maximizar lucros com gestão de risco inteligente. Sempre responda em JSON válido.' },
          { role: 'user', content: aiPrompt }
        ],
      }),
    });

    if (!aiResponse.ok) {
      console.error('Erro na chamada Lovable AI:', aiResponse.status);
      throw new Error(`AI API error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const aiContent = aiData.choices[0].message.content;
    
    // Extrair JSON da resposta (pode vir com markdown)
    let aiRecommendations;
    try {
      const jsonMatch = aiContent.match(/\{[\s\S]*\}/);
      aiRecommendations = jsonMatch ? JSON.parse(jsonMatch[0]) : {
        recommendedLeverage: bestLeverage,
        recommendedStopLossPct: 1.0,
        recommendedTakeProfitPct: 3.0,
        pyramidingThreshold: 1.5,
        maxPyramidingLevels: 2,
        optimalPatterns: [],
        recommendations: "Análise em progresso"
      };
    } catch (e) {
      console.error('Erro ao parsear resposta AI:', e);
      aiRecommendations = {
        recommendedLeverage: bestLeverage,
        recommendedStopLossPct: 1.0,
        recommendedTakeProfitPct: 3.0,
        pyramidingThreshold: 1.5,
        maxPyramidingLevels: 2,
        optimalPatterns: [],
        recommendations: "Usando valores padrão agressivos"
      };
    }

    // 10. SALVAR CONFIGURAÇÃO ML NO BANCO
    const mlConfig = {
      user_id: userId,
      is_enabled: true,
      recommended_leverage: Math.floor(aiRecommendations.recommendedLeverage || bestLeverage),
      recommended_stop_loss_pct: aiRecommendations.recommendedStopLossPct || 1.0,
      recommended_take_profit_pct: aiRecommendations.recommendedTakeProfitPct || 3.0,
      win_rate_by_leverage: Object.fromEntries(leverageAnalysis),
      optimal_patterns: {
        bestSymbols: topSymbols,
        bestHours: bestHours,
        avoidSymbols: aiRecommendations.avoidSymbols || [],
        preferredTimeRanges: aiRecommendations.preferredTimeRanges || [],
        optimalPatterns: aiRecommendations.optimalPatterns || [],
        pyramiding: {
          threshold: aiRecommendations.pyramidingThreshold || 1.5,
          maxLevels: aiRecommendations.maxPyramidingLevels || 2,
          sizeMultiplier: 0.5 // Adicionar 50% da posição original
        }
      },
      confidence_score: Math.min(winRate, 100),
      trades_analyzed: trades.length,
      last_analysis_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { error: upsertError } = await supabase
      .from('ml_adaptive_config')
      .upsert(mlConfig, { onConflict: 'user_id' });

    if (upsertError) {
      throw new Error(`Erro ao salvar config ML: ${upsertError.message}`);
    }

    console.log(`✅ ML AGRESSIVO Configurado: ${mlConfig.recommended_leverage}x alavancagem, ${winRate.toFixed(1)}% win rate, pyramiding ${mlConfig.optimal_patterns.pyramiding.maxLevels}x`);

    return new Response(JSON.stringify({
      success: true,
      message: 'ML adaptativo AGRESSIVO configurado com sucesso!',
      analysis: {
        tradesAnalyzed: trades.length,
        currentWinRate: winRate.toFixed(1),
        profitFactor: profitFactor.toFixed(2),
        totalPnL: totalPnL.toFixed(2),
      },
      recommendations: {
        leverage: mlConfig.recommended_leverage,
        stopLoss: mlConfig.recommended_stop_loss_pct,
        takeProfit: mlConfig.recommended_take_profit_pct,
        pyramiding: mlConfig.optimal_patterns.pyramiding,
        topSymbols: topSymbols,
        bestHours: bestHours,
        aiInsights: aiRecommendations.recommendations,
      },
      config: mlConfig,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('❌ Erro no ML adaptive learning:', error);
    return new Response(JSON.stringify({ 
      success: false,
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
