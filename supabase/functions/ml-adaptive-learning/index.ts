import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Bybit API Config
const BYBIT_API_KEY = Deno.env.get('BYBIT_API_KEY') || '';
const BYBIT_API_SECRET = Deno.env.get('BYBIT_API_SECRET') || '';
const RECV_WINDOW = "30000";
const BASE_URL = "https://api.bybit.com";

interface BybitTrade {
  symbol: string;
  orderId: string;
  side: string;
  qty: string;
  orderPrice: string;
  execPrice: string;
  closedSize: string;
  cumEntryValue: string;
  avgEntryPrice: string;
  avgExitPrice: string;
  closedPnl: string;
  fillCount: string;
  leverage: string;
  createdTime: string;
  updatedTime: string;
}

// Bybit API Helper Functions
async function getBybitServerTime(): Promise<number> {
  try {
    const response = await fetch(`${BASE_URL}/v5/market/time`);
    const data = await response.json();
    if (data.retCode === 0 && data.time) {
      return Math.floor(Number(data.time));
    }
    throw new Error('Invalid server time response');
  } catch (error) {
    console.error('Server time fetch error:', error);
    return Math.floor(Date.now() - 1000);
  }
}

async function generateSignature(params: string, timestamp: number): Promise<string> {
  const encoder = new TextEncoder();
  const key = encoder.encode(BYBIT_API_SECRET);
  const message = encoder.encode(`${timestamp}${BYBIT_API_KEY}${RECV_WINDOW}${params}`);
  
  const cryptoKey = await crypto.subtle.importKey(
    "raw", key, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  
  const signature = await crypto.subtle.sign("HMAC", cryptoKey, message);
  return Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

async function makeBybitRequest(
  method: string,
  endpoint: string,
  params: Record<string, any> = {}
): Promise<any> {
  const timestamp = await getBybitServerTime();
  
  let url = `${BASE_URL}${endpoint}`;
  let paramsStr = '';

  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      searchParams.append(key, String(value));
    }
  });
  paramsStr = searchParams.toString();
  if (paramsStr) url += `?${paramsStr}`;

  const signature = await generateSignature(paramsStr, timestamp);
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-BAPI-API-KEY': BYBIT_API_KEY,
    'X-BAPI-SIGN': signature,
    'X-BAPI-SIGN-TYPE': '2',
    'X-BAPI-TIMESTAMP': String(timestamp),
    'X-BAPI-RECV-WINDOW': RECV_WINDOW,
  };

  const response = await fetch(url, { method, headers });
  const data = await response.json();
  
  if (data.retCode !== 0) {
    console.error(`Bybit API Error:`, JSON.stringify(data));
    throw new Error(`Bybit API Error: ${data.retMsg}`);
  }

  return data.result;
}

async function fetchBybitClosedPnL(startTime: number, limit: number = 100, cursor?: string): Promise<{ list: BybitTrade[], nextPageCursor: string | null }> {
  const params: Record<string, any> = { 
    category: 'linear', 
    limit,
    startTime: String(startTime),
  };
  if (cursor) params.cursor = cursor;
  
  const result = await makeBybitRequest('GET', '/v5/position/closed-pnl', params);
  return { list: result?.list || [], nextPageCursor: result?.nextPageCursor || null };
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

    console.log(`🧠 Iniciando análise ML com dados BYBIT REAL para user ${userId}`);
    console.log(`🔑 API Key configurada: ${BYBIT_API_KEY ? 'SIM' : 'NÃO'}`);
    console.log(`🔑 API Secret configurada: ${BYBIT_API_SECRET ? 'SIM' : 'NÃO'}`);

    // ========================
    // 1. BUSCAR HISTÓRICO COMPLETO DA BYBIT (Últimos 180 dias - limite Bybit)
    // ========================
    let bybitTrades: BybitTrade[] = [];
    let cursor: string | undefined = undefined;
    let hasMore = true;
    // Bybit só permite consultar até 2 anos, mas na prática funciona melhor com 180 dias
    const sixMonthsAgo = Date.now() - (180 * 24 * 60 * 60 * 1000);
    
    console.log('📊 Buscando histórico da Bybit (últimos 180 dias)...');

    // Paginar através de todo o histórico
    while (hasMore) {
      try {
        const result = await fetchBybitClosedPnL(sixMonthsAgo, 100, cursor);
        console.log(`📥 Resposta Bybit: ${result.list.length} trades, cursor: ${result.nextPageCursor ? 'sim' : 'não'}`);

        if (result.list && result.list.length > 0) {
          bybitTrades = [...bybitTrades, ...result.list];
          cursor = result.nextPageCursor || undefined;
          hasMore = !!cursor && bybitTrades.length < 2000;
          console.log(`📥 Carregados ${bybitTrades.length} trades da Bybit...`);
        } else {
          console.log('📭 Sem mais trades da Bybit');
          hasMore = false;
        }
      } catch (fetchError: any) {
        console.log('⚠️ Erro fetch Bybit:', fetchError.message);
        break;
      }
    }

    console.log(`✅ Total de trades Bybit: ${bybitTrades.length}`);

    // ========================
    // 2. BUSCAR TAMBÉM DADOS INTERNOS DO SUPABASE
    // ========================
    const { data: internalTrades, error: tradesError } = await supabase
      .from('auto_trader_positions')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'CLOSED')
      .order('closed_at', { ascending: false })
      .limit(500);

    if (tradesError) {
      console.log('⚠️ Erro trades internos:', tradesError.message);
    }

    // ========================
    // 3. COMBINAR E NORMALIZAR DADOS
    // ========================
    const allTrades: any[] = [];

    // Normalizar trades da Bybit
    for (const bt of bybitTrades) {
      const entryPrice = parseFloat(bt.avgEntryPrice) || 0;
      const exitPrice = parseFloat(bt.avgExitPrice) || 0;
      const pnl = parseFloat(bt.closedPnl) || 0;
      const leverage = parseFloat(bt.leverage) || 10;
      
      if (entryPrice === 0) continue;

      // Calcular volatilidade implícita do trade
      const priceMove = Math.abs((exitPrice - entryPrice) / entryPrice) * 100;
      
      allTrades.push({
        source: 'bybit',
        symbol: bt.symbol,
        side: bt.side,
        entry_price: entryPrice,
        exit_price: exitPrice,
        realized_pnl: pnl,
        leverage: leverage,
        qty: parseFloat(bt.qty) || 0,
        opened_at: new Date(parseInt(bt.createdTime)).toISOString(),
        closed_at: new Date(parseInt(bt.updatedTime)).toISOString(),
        volatility: priceMove, // Usar movimento como proxy de volatilidade
        close_reason: pnl > 0 ? 'TP_HIT' : 'STOP_LOSS',
      });
    }

    // Adicionar trades internos (sem duplicar)
    const bybitOrderIds = new Set(bybitTrades.map(t => t.orderId));
    for (const it of (internalTrades || [])) {
      if (!bybitOrderIds.has(it.exchange_order_id)) {
        allTrades.push({
          source: 'internal',
          ...it,
        });
      }
    }

    console.log(`📊 Total combinado: ${allTrades.length} trades (Bybit: ${bybitTrades.length}, Interno: ${internalTrades?.length || 0})`);

    if (allTrades.length < minTrades) {
      return new Response(JSON.stringify({
        success: false,
        message: `Necessário ${minTrades} trades. Encontrados: ${allTrades.length}`,
        tradesCount: allTrades.length,
        bybitTrades: bybitTrades.length,
        internalTrades: internalTrades?.length || 0,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ========================
    // 4. ANÁLISE PROFUNDA DE STOPS
    // ========================
    const stopAnalysis = {
      stoppedOutTrades: [] as any[],
      tpHitTrades: [] as any[],
      optimalStops: [] as number[],
      optimalTPs: [] as number[],
      avgVolatility: 0,
      stopTooTight: 0,
      stopTooLoose: 0,
    };

    for (const trade of allTrades) {
      const entryPrice = trade.entry_price || 0;
      const exitPrice = trade.exit_price || trade.current_price || entryPrice;
      const pnl = trade.realized_pnl || 0;
      const volatility = trade.volatility || 0;
      
      if (entryPrice === 0) continue;

      const priceMove = Math.abs((exitPrice - entryPrice) / entryPrice) * 100;

      if (pnl < 0) {
        stopAnalysis.stoppedOutTrades.push({ 
          trade, 
          priceMove, 
          volatility,
        });
        
        // Stop muito apertado se movimento foi pequeno
        if (priceMove < 1.0) {
          stopAnalysis.stopTooTight++;
        }
      } else if (pnl > 0) {
        stopAnalysis.tpHitTrades.push({ trade, priceMove });
        stopAnalysis.optimalTPs.push(priceMove);
      }

      if (volatility > 0) {
        stopAnalysis.avgVolatility += volatility;
      }
    }

    stopAnalysis.avgVolatility = stopAnalysis.avgVolatility / allTrades.length || 2;

    // ========================
    // 5. CALCULAR MÉTRICAS PRINCIPAIS
    // ========================
    const winningTrades = allTrades.filter(t => (t.realized_pnl || 0) > 0);
    const losingTrades = allTrades.filter(t => (t.realized_pnl || 0) <= 0);
    const winRate = (winningTrades.length / allTrades.length) * 100;

    // Análise de movimentos antes de lucro
    const winMoves = winningTrades.map(t => {
      const entry = t.entry_price || 0;
      const exit = t.exit_price || entry;
      return Math.abs((exit - entry) / entry) * 100;
    });
    const avgWinMove = winMoves.length > 0 ? winMoves.reduce((a, b) => a + b, 0) / winMoves.length : 2;

    // Análise de movimentos antes de loss
    const lossMoves = losingTrades.map(t => {
      const entry = t.entry_price || 0;
      const exit = t.exit_price || entry;
      return Math.abs((exit - entry) / entry) * 100;
    });
    const avgLossMove = lossMoves.length > 0 ? lossMoves.reduce((a, b) => a + b, 0) / lossMoves.length : 1;

    // ========================
    // 6. ANÁLISE POR VOLATILIDADE
    // ========================
    const volatilityBuckets = new Map<string, { trades: number, wins: number, losses: number, totalPnl: number, avgMove: number }>();
    
    for (const trade of allTrades) {
      const vol = trade.volatility || stopAnalysis.avgVolatility;
      const bucket = vol < 1 ? 'very_low' : vol < 2 ? 'low' : vol < 3 ? 'medium' : vol < 5 ? 'high' : 'very_high';
      
      if (!volatilityBuckets.has(bucket)) {
        volatilityBuckets.set(bucket, { trades: 0, wins: 0, losses: 0, totalPnl: 0, avgMove: 0 });
      }
      
      const stats = volatilityBuckets.get(bucket)!;
      stats.trades++;
      stats.avgMove += vol;
      stats.totalPnl += (trade.realized_pnl || 0);
      if ((trade.realized_pnl || 0) > 0) {
        stats.wins++;
      } else {
        stats.losses++;
      }
    }

    // Calcular stop ideal por volatilidade
    const stopByVolatility: Record<string, number> = {};
    for (const [bucket, stats] of volatilityBuckets.entries()) {
      const avgMov = stats.avgMove / stats.trades;
      const winRateBucket = stats.wins / stats.trades;
      
      // Stop deve ser ~60-80% do movimento médio, ajustado pelo win rate
      stopByVolatility[bucket] = Math.max(avgMov * (winRateBucket > 0.5 ? 0.6 : 0.8), 0.5);
    }

    // ========================
    // 7. ANÁLISE POR SÍMBOLO, HORÁRIO E ALAVANCAGEM
    // ========================
    const symbolStats = new Map<string, { wins: number, total: number, pnl: number, avgLeverage: number }>();
    const hourlyStats = new Map<number, { wins: number, total: number, pnl: number }>();
    const leverageStats = new Map<number, { wins: number, losses: number, pnl: number }>();
    
    for (const trade of allTrades) {
      // Por símbolo
      const symbol = trade.symbol;
      if (!symbolStats.has(symbol)) {
        symbolStats.set(symbol, { wins: 0, total: 0, pnl: 0, avgLeverage: 0 });
      }
      const sStats = symbolStats.get(symbol)!;
      sStats.total++;
      sStats.avgLeverage += trade.leverage || 10;
      if ((trade.realized_pnl || 0) > 0) sStats.wins++;
      sStats.pnl += (trade.realized_pnl || 0);

      // Por horário
      const hour = new Date(trade.opened_at || trade.closed_at).getUTCHours();
      if (!hourlyStats.has(hour)) {
        hourlyStats.set(hour, { wins: 0, total: 0, pnl: 0 });
      }
      const hStats = hourlyStats.get(hour)!;
      hStats.total++;
      hStats.pnl += (trade.realized_pnl || 0);
      if ((trade.realized_pnl || 0) > 0) hStats.wins++;

      // Por alavancagem (agrupado em buckets de 10)
      const leverage = Math.floor((trade.leverage || 10) / 10) * 10;
      if (!leverageStats.has(leverage)) {
        leverageStats.set(leverage, { wins: 0, losses: 0, pnl: 0 });
      }
      const lStats = leverageStats.get(leverage)!;
      if ((trade.realized_pnl || 0) > 0) lStats.wins++;
      else lStats.losses++;
      lStats.pnl += (trade.realized_pnl || 0);
    }

    // Calcular média de alavancagem por símbolo
    for (const [_, stats] of symbolStats.entries()) {
      stats.avgLeverage = stats.avgLeverage / stats.total;
    }

    // ========================
    // 8. ENCONTRAR MELHORES PARÂMETROS
    // ========================
    const topSymbols = Array.from(symbolStats.entries())
      .filter(([_, stats]) => stats.total >= 3)
      .sort((a, b) => {
        const wrA = b[1].wins / b[1].total;
        const wrB = a[1].wins / a[1].total;
        if (Math.abs(wrA - wrB) < 0.1) {
          return b[1].pnl - a[1].pnl; // Se win rate similar, ordenar por PnL
        }
        return wrA - wrB;
      })
      .slice(0, 10)
      .map(([symbol, stats]) => ({
        symbol,
        winRate: ((stats.wins / stats.total) * 100).toFixed(1),
        pnl: stats.pnl.toFixed(2),
        trades: stats.total,
        avgLeverage: stats.avgLeverage.toFixed(0),
      }));

    const worstSymbols = Array.from(symbolStats.entries())
      .filter(([_, stats]) => stats.total >= 3 && stats.pnl < 0)
      .sort((a, b) => a[1].pnl - b[1].pnl)
      .slice(0, 5)
      .map(([symbol]) => symbol);

    const bestHours = Array.from(hourlyStats.entries())
      .filter(([_, stats]) => stats.total >= 3)
      .sort((a, b) => (b[1].wins / b[1].total) - (a[1].wins / a[1].total))
      .slice(0, 6)
      .map(([hour, stats]) => ({
        hour,
        winRate: ((stats.wins / stats.total) * 100).toFixed(1),
        pnl: stats.pnl.toFixed(2),
      }));

    const worstHours = Array.from(hourlyStats.entries())
      .filter(([_, stats]) => stats.total >= 3 && (stats.wins / stats.total) < 0.4)
      .sort((a, b) => (a[1].wins / a[1].total) - (b[1].wins / b[1].total))
      .slice(0, 3)
      .map(([hour]) => hour);

    // Melhor alavancagem baseada em PnL positivo e win rate
    let bestLeverage = 40;
    let bestLeverageStats = { winRate: 0, pnl: 0 };
    for (const [lev, stats] of leverageStats.entries()) {
      const totalTrades = stats.wins + stats.losses;
      if (totalTrades >= 5) {
        const rate = stats.wins / totalTrades;
        if (rate > bestLeverageStats.winRate && stats.pnl > 0) {
          bestLeverageStats = { winRate: rate, pnl: stats.pnl };
          bestLeverage = lev;
        }
      }
    }

    // ========================
    // 9. CÁLCULOS FINAIS OTIMIZADOS
    // ========================
    const avgWin = winningTrades.reduce((sum, t) => sum + (t.realized_pnl || 0), 0) / winningTrades.length || 0;
    const avgLoss = Math.abs(losingTrades.reduce((sum, t) => sum + (t.realized_pnl || 0), 0) / losingTrades.length) || 1;
    const profitFactor = (avgWin * winningTrades.length) / (avgLoss * losingTrades.length) || 0;
    const riskRewardRatio = avgLoss > 0 ? avgWin / avgLoss : 2;
    const totalPnl = allTrades.reduce((sum, t) => sum + (t.realized_pnl || 0), 0);

    // Stop otimizado baseado nos dados reais
    const baseStop = Math.max(avgLossMove * 0.8, stopAnalysis.avgVolatility * 0.5);
    const optimizedStop = Math.min(Math.max(baseStop, 0.5), 2.5);

    // TP otimizado baseado em R:R e dados reais
    const optimizedTP = Math.min(Math.max(avgWinMove, optimizedStop * 2.5), 6);

    // ========================
    // 10. CONSULTAR IA PARA INSIGHTS
    // ========================
    const aiPrompt = `Analise este histórico REAL de ${allTrades.length} trades da Bybit e forneça recomendações:

PERFORMANCE GERAL:
- Total Trades: ${allTrades.length} (${bybitTrades.length} Bybit + ${internalTrades?.length || 0} interno)
- Win Rate: ${winRate.toFixed(1)}% | Profit Factor: ${profitFactor.toFixed(2)}
- Total PnL: $${totalPnl.toFixed(2)}
- R:R Ratio: ${riskRewardRatio.toFixed(2)}
- Avg Win Move: ${avgWinMove.toFixed(2)}% | Avg Loss Move: ${avgLossMove.toFixed(2)}%

ANÁLISE DE STOPS:
- Stops muito apertados: ${stopAnalysis.stopTooTight} trades (${((stopAnalysis.stopTooTight/allTrades.length)*100).toFixed(1)}%)
- Taxa de stop-out: ${((stopAnalysis.stoppedOutTrades.length / allTrades.length) * 100).toFixed(1)}%

VOLATILIDADE:
${Array.from(volatilityBuckets.entries()).map(([k, v]) => {
  return `${k}: ${v.trades} trades, WR ${((v.wins/v.trades)*100).toFixed(0)}%, Stop ideal: ${stopByVolatility[k]?.toFixed(2)}%`;
}).join('\n')}

TOP SÍMBOLOS:
${topSymbols.slice(0, 5).map(s => `${s.symbol}: WR ${s.winRate}%, PnL $${s.pnl}, ${s.trades} trades`).join('\n')}

SÍMBOLOS A EVITAR: ${worstSymbols.join(', ')}

MELHORES HORÁRIOS (UTC):
${bestHours.slice(0, 4).map(h => `${h.hour}h: WR ${h.winRate}%, PnL $${h.pnl}`).join('\n')}

HORÁRIOS A EVITAR: ${worstHours.join('h, ')}h

ALAVANCAGEM:
${Array.from(leverageStats.entries()).map(([lev, stats]) => {
  const wr = ((stats.wins / (stats.wins + stats.losses)) * 100).toFixed(0);
  return `${lev}x: WR ${wr}%, PnL $${stats.pnl.toFixed(2)}`;
}).join('\n')}

Responda em JSON:
{
  "dynamicStopLoss": {
    "base": <stop base otimizado %>,
    "veryLowVol": <stop para volatilidade < 1%>,
    "lowVol": <stop para 1-2%>,
    "mediumVol": <stop para 2-3%>,
    "highVol": <stop para 3-5%>,
    "veryHighVol": <stop para > 5%>,
    "afterWinStreak": <stop após 3+ wins>,
    "afterLossStreak": <stop após 2+ losses>
  },
  "dynamicTakeProfit": {
    "base": <TP base %>,
    "scalping": <TP para scalping rápido>,
    "swing": <TP para swing trades>,
    "aggressive": <TP agressivo para alta confiança>
  },
  "leverageRecommendations": {
    "optimal": <alavancagem ótima>,
    "conservative": <alavancagem conservadora>,
    "aggressive": <alavancagem máxima recomendada>
  },
  "symbolsToFocus": ["symbol1", "symbol2"],
  "symbolsToAvoid": ["symbol1", "symbol2"],
  "bestTradingHours": [hora1, hora2],
  "hoursToAvoid": [hora1, hora2],
  "insights": ["insight crítico 1", "insight 2", "insight 3"],
  "criticalWarnings": ["aviso importante 1"],
  "actionPlan": "Plano de ação resumido para melhorar performance"
}`;

    let aiRecommendations: any = {
      dynamicStopLoss: {
        base: optimizedStop,
        veryLowVol: stopByVolatility['very_low'] || 0.5,
        lowVol: stopByVolatility['low'] || 0.8,
        mediumVol: stopByVolatility['medium'] || 1.2,
        highVol: stopByVolatility['high'] || 1.8,
        veryHighVol: stopByVolatility['very_high'] || 2.5,
        afterWinStreak: optimizedStop * 0.8,
        afterLossStreak: optimizedStop * 1.4
      },
      dynamicTakeProfit: {
        base: optimizedTP,
        scalping: optimizedTP * 0.5,
        swing: optimizedTP * 1.5,
        aggressive: optimizedTP * 2
      },
      leverageRecommendations: {
        optimal: bestLeverage,
        conservative: Math.max(bestLeverage - 20, 10),
        aggressive: Math.min(bestLeverage + 20, 100)
      },
      symbolsToFocus: topSymbols.slice(0, 5).map(s => s.symbol),
      symbolsToAvoid: worstSymbols,
      bestTradingHours: bestHours.slice(0, 4).map(h => h.hour),
      hoursToAvoid: worstHours,
      insights: [],
      criticalWarnings: [],
      actionPlan: 'Parâmetros calculados do histórico real'
    };

    try {
      console.log('🤖 Consultando IA para insights...');
      const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${lovableApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash',
          messages: [
            { role: 'system', content: 'Você é um quant expert em otimização de trading algorítmico. Analise dados reais e forneça recomendações precisas em JSON.' },
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
          console.log('✅ Insights da IA recebidos');
        }
      }
    } catch (e) {
      console.log('⚠️ AI analysis skipped, usando valores calculados');
    }

    // ========================
    // 11. CONSTRUIR CONFIGURAÇÃO FINAL
    // ========================
    const mlConfig = {
      user_id: userId,
      is_enabled: true,
      recommended_leverage: aiRecommendations.leverageRecommendations?.optimal || bestLeverage,
      recommended_stop_loss_pct: aiRecommendations.dynamicStopLoss?.base || optimizedStop,
      recommended_take_profit_pct: aiRecommendations.dynamicTakeProfit?.base || optimizedTP,
      win_rate_by_leverage: Object.fromEntries(leverageStats),
      optimal_patterns: {
        // Fonte dos dados
        dataSource: {
          bybitTrades: bybitTrades.length,
          internalTrades: internalTrades?.length || 0,
          totalAnalyzed: allTrades.length,
        },
        // Stops adaptativos
        dynamicStops: aiRecommendations.dynamicStopLoss,
        dynamicTP: aiRecommendations.dynamicTakeProfit,
        // Alavancagem
        leverageRecommendations: aiRecommendations.leverageRecommendations,
        // Símbolos
        topSymbols: topSymbols,
        symbolsToFocus: aiRecommendations.symbolsToFocus,
        symbolsToAvoid: aiRecommendations.symbolsToAvoid || worstSymbols,
        // Horários
        bestHours: bestHours,
        hoursToAvoid: aiRecommendations.hoursToAvoid || worstHours,
        // Volatilidade
        stopsByVolatility: stopByVolatility,
        avgVolatility: stopAnalysis.avgVolatility,
        // Performance
        riskRewardRatio: riskRewardRatio,
        profitFactor: profitFactor,
        totalPnl: totalPnl,
        // Insights
        insights: aiRecommendations.insights || [],
        criticalWarnings: aiRecommendations.criticalWarnings || [],
        actionPlan: aiRecommendations.actionPlan || '',
        // Métricas de aprendizado
        learningMetrics: {
          stopsTooTight: stopAnalysis.stopTooTight,
          stoppedOutRate: ((stopAnalysis.stoppedOutTrades.length / allTrades.length) * 100).toFixed(1),
          avgWinMove: avgWinMove.toFixed(2),
          avgLossMove: avgLossMove.toFixed(2),
          profitFactor: profitFactor.toFixed(2),
        }
      },
      confidence_score: Math.min(
        winRate + 
        (profitFactor > 1.5 ? 15 : profitFactor > 1 ? 5 : 0) + 
        (allTrades.length > 100 ? 10 : allTrades.length > 50 ? 5 : 0),
        100
      ),
      trades_analyzed: allTrades.length,
      last_analysis_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // ========================
    // 12. SALVAR NO BANCO
    // ========================
    const { error: upsertError } = await supabase
      .from('ml_adaptive_config')
      .upsert(mlConfig, { onConflict: 'user_id' });

    if (upsertError) {
      throw new Error(`Erro ao salvar: ${upsertError.message}`);
    }

    console.log(`✅ ML BYBIT: ${allTrades.length} trades | Stop ${mlConfig.recommended_stop_loss_pct.toFixed(2)}% | TP ${mlConfig.recommended_take_profit_pct.toFixed(2)}% | Lev ${mlConfig.recommended_leverage}x`);

    return new Response(JSON.stringify({
      success: true,
      message: `ML treinado com ${allTrades.length} trades reais da Bybit!`,
      dataSource: {
        bybitTrades: bybitTrades.length,
        internalTrades: internalTrades?.length || 0,
        totalAnalyzed: allTrades.length,
      },
      performance: {
        totalPnl: totalPnl.toFixed(2),
        winRate: winRate.toFixed(1),
        profitFactor: profitFactor.toFixed(2),
        riskRewardRatio: riskRewardRatio.toFixed(2),
      },
      optimizedStops: {
        base: mlConfig.recommended_stop_loss_pct.toFixed(2),
        byVolatility: stopByVolatility,
        tooTightCount: stopAnalysis.stopTooTight,
      },
      optimizedTP: {
        base: mlConfig.recommended_take_profit_pct.toFixed(2),
        scalping: (mlConfig.recommended_take_profit_pct * 0.5).toFixed(2),
        swing: (mlConfig.recommended_take_profit_pct * 1.5).toFixed(2),
      },
      leverage: {
        optimal: mlConfig.recommended_leverage,
        byLevel: Object.fromEntries(leverageStats),
      },
      symbols: {
        top: topSymbols.slice(0, 5),
        avoid: worstSymbols,
      },
      hours: {
        best: bestHours.slice(0, 4),
        avoid: worstHours,
      },
      insights: aiRecommendations.insights || [],
      criticalWarnings: aiRecommendations.criticalWarnings || [],
      actionPlan: aiRecommendations.actionPlan || 'Parâmetros otimizados do seu histórico real',
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
