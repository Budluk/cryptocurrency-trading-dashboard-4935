import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';


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
  // Bybit closed-pnl endpoint precisa de startTime em ms
  const params: Record<string, any> = { 
    category: 'linear', 
    limit,
  };
  
  // Se não tiver cursor, buscar por tempo
  if (!cursor) {
    params.startTime = String(startTime);
  }
  if (cursor) params.cursor = cursor;
  
  console.log(`🔍 Chamando closed-pnl com params:`, JSON.stringify(params));
  
  try {
    const result = await makeBybitRequest('GET', '/v5/position/closed-pnl', params);
    console.log(`📤 Resultado closed-pnl: list=${result?.list?.length || 0}, cursor=${result?.nextPageCursor ? 'sim' : 'não'}`);
    return { list: result?.list || [], nextPageCursor: result?.nextPageCursor || null };
  } catch (error: any) {
    console.error(`❌ Erro closed-pnl:`, error.message);
    return { list: [], nextPageCursor: null };
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY')!;

    // Create client with service role for data access
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Parse request body
    const { userId: requestUserId, minTrades = 10 } = await req.json();

    // Auth strategy:
    // - If a real user JWT is present, use its user.id
    // - Otherwise, only allow the dedicated anonymous user id
    const ANONYMOUS_USER_ID = '00000000-0000-0000-0000-000000000000';

    let userId: string | null = null;

    const authHeader = req.headers.get('Authorization');
    if (authHeader?.startsWith('Bearer ')) {
      const jwt = authHeader.slice('Bearer '.length);
      const { data: { user } } = await supabase.auth.getUser(jwt);
      if (user?.id) {
        userId = user.id;
      }
    }

    if (!userId) {
      if (requestUserId === ANONYMOUS_USER_ID) {
        userId = ANONYMOUS_USER_ID;
      } else {
        return new Response(
          JSON.stringify({ error: 'Unauthorized' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    console.log(`🧠 Iniciando análise ML...`);
    // Security: Do not log user IDs or API key configuration status

    // ========================
    // 1. BUSCAR HISTÓRICO COMPLETO DA BYBIT (Últimos 180 dias - limite Bybit)
    // ========================
    let bybitTrades: BybitTrade[] = [];
    let cursor: string | undefined = undefined;
    let hasMore = true;
    // Bybit só permite consultar até 2 anos, mas na prática funciona melhor com 180 dias
    // Buscar últimos 2 anos (730 dias)
    const twoYearsAgo = Date.now() - (730 * 24 * 60 * 60 * 1000);
    
    console.log('📊 Buscando histórico da Bybit (últimos 200 trades)...');

    // Buscar apenas uma página de trades para evitar timeout (máximo 200 trades)
    const maxPages = 2;
    let pageCount = 0;
    
    while (hasMore && pageCount < maxPages) {
      try {
        const params: any = { category: 'linear', limit: 100 };
        if (cursor) {
          params.cursor = cursor;
        }
        
        console.log(`🔍 Página ${pageCount + 1}: chamando closed-pnl`);
        const result = await makeBybitRequest('GET', '/v5/position/closed-pnl', params);
        console.log(`📥 Resposta: ${result.list?.length || 0} trades`);

        if (result.list && result.list.length > 0) {
          bybitTrades = [...bybitTrades, ...result.list];
          cursor = result.nextPageCursor || undefined;
          hasMore = !!cursor;
          pageCount++;
        } else {
          hasMore = false;
        }
      } catch (fetchError: any) {
        console.log('⚠️ Erro fetch Bybit:', fetchError.message);
        break;
      }
    }
    
    console.log(`✅ Carregados ${bybitTrades.length} trades da Bybit`);

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
    // 4. ANÁLISE PROFUNDA DE STOPS E PADRÕES DE PERDA
    // ========================
    const stopAnalysis = {
      stoppedOutTrades: [] as any[],
      tpHitTrades: [] as any[],
      optimalStops: [] as number[],
      optimalTPs: [] as number[],
      avgVolatility: 0,
      stopTooTight: 0,
      stopTooLoose: 0,
      // Novos campos de análise
      consecutiveLosses: [] as number[],
      lossPatterns: [] as { symbol: string; hour: number; leverage: number; volatility: number }[],
      winStreaks: [] as number[],
      avgTimeInTrade: 0,
    };

    let currentLossStreak = 0;
    let currentWinStreak = 0;
    let totalTradeTime = 0;

    for (const trade of allTrades) {
      const entryPrice = trade.entry_price || 0;
      const exitPrice = trade.exit_price || trade.current_price || entryPrice;
      const pnl = trade.realized_pnl || 0;
      const volatility = trade.volatility || 0;
      
      if (entryPrice === 0) continue;

      const priceMove = Math.abs((exitPrice - entryPrice) / entryPrice) * 100;

      // Calcular tempo no trade
      if (trade.opened_at && trade.closed_at) {
        const duration = new Date(trade.closed_at).getTime() - new Date(trade.opened_at).getTime();
        totalTradeTime += duration;
      }

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
        
        // Rastrear padrões de perda
        currentLossStreak++;
        currentWinStreak = 0;
        
        if (currentLossStreak >= 2) {
          stopAnalysis.consecutiveLosses.push(currentLossStreak);
          stopAnalysis.lossPatterns.push({
            symbol: trade.symbol,
            hour: new Date(trade.opened_at || trade.closed_at).getUTCHours(),
            leverage: trade.leverage || 10,
            volatility: volatility,
          });
        }
      } else if (pnl > 0) {
        stopAnalysis.tpHitTrades.push({ trade, priceMove });
        stopAnalysis.optimalTPs.push(priceMove);
        
        // Rastrear sequências de vitórias
        currentWinStreak++;
        if (currentLossStreak > 0) {
          stopAnalysis.consecutiveLosses.push(currentLossStreak);
        }
        currentLossStreak = 0;
        
        if (currentWinStreak >= 3) {
          stopAnalysis.winStreaks.push(currentWinStreak);
        }
      }

      if (volatility > 0) {
        stopAnalysis.avgVolatility += volatility;
      }
    }

    stopAnalysis.avgVolatility = stopAnalysis.avgVolatility / allTrades.length || 2;
    stopAnalysis.avgTimeInTrade = allTrades.length > 0 ? totalTradeTime / allTrades.length / 60000 : 0; // em minutos

    // ========================
    // 4.5 DETECTAR REGIME DE MERCADO
    // ========================
    const recentTrades = allTrades.slice(0, 20);
    const recentWinRate = recentTrades.filter(t => (t.realized_pnl || 0) > 0).length / recentTrades.length * 100;
    const recentAvgVol = recentTrades.reduce((sum, t) => sum + (t.volatility || 2), 0) / recentTrades.length;
    
    let marketRegime: 'trending' | 'ranging' | 'volatile' | 'calm' = 'ranging';
    if (recentAvgVol > 5) marketRegime = 'volatile';
    else if (recentAvgVol < 1.5) marketRegime = 'calm';
    else if (recentWinRate > 60) marketRegime = 'trending';

    // ========================
    // 5. ANÁLISE POR VOLATILIDADE
    // ========================
    const volatilityBuckets = new Map<string, { trades: number, wins: number, losses: number, totalPnl: number, avgMove: number, avgDuration: number }>();
    
    for (const trade of allTrades) {
      const vol = trade.volatility || stopAnalysis.avgVolatility;
      const bucket = vol < 1 ? 'very_low' : vol < 2 ? 'low' : vol < 3 ? 'medium' : vol < 5 ? 'high' : 'very_high';
      
      if (!volatilityBuckets.has(bucket)) {
        volatilityBuckets.set(bucket, { trades: 0, wins: 0, losses: 0, totalPnl: 0, avgMove: 0, avgDuration: 0 });
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

    // Calcular stop ideal por volatilidade com ajustes dinâmicos
    const stopByVolatility: Record<string, number> = {};
    for (const [bucket, stats] of volatilityBuckets.entries()) {
      const avgMov = stats.avgMove / stats.trades;
      const winRateBucket = stats.wins / stats.trades;
      
      // Stop adaptativo: mais apertado em alta volatilidade com bom win rate
      let multiplier = winRateBucket > 0.55 ? 0.5 : winRateBucket > 0.45 ? 0.7 : 0.9;
      
      // Ajuste baseado no regime de mercado
      if (marketRegime === 'volatile') multiplier *= 1.2;
      if (marketRegime === 'calm') multiplier *= 0.8;
      
      stopByVolatility[bucket] = Math.max(avgMov * multiplier, 0.3);
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
    // Filtrar trades vencedores e perdedores
    const winningTrades = allTrades.filter(t => (t.realized_pnl || 0) > 0);
    const losingTrades = allTrades.filter(t => (t.realized_pnl || 0) < 0);

    const winRate = allTrades.length > 0 ? (winningTrades.length / allTrades.length) * 100 : 0;
    const avgWin = winningTrades.length > 0 
      ? winningTrades.reduce((sum, t) => sum + (t.realized_pnl || 0), 0) / winningTrades.length 
      : 0;
    const avgLoss = losingTrades.length > 0 
      ? Math.abs(losingTrades.reduce((sum, t) => sum + (t.realized_pnl || 0), 0) / losingTrades.length) 
      : 1;
    const profitFactor = losingTrades.length > 0 
      ? (avgWin * winningTrades.length) / (avgLoss * losingTrades.length) 
      : winningTrades.length > 0 ? 999 : 0;
    const riskRewardRatio = avgLoss > 0 ? avgWin / avgLoss : 2;
    const totalPnl = allTrades.reduce((sum, t) => sum + (t.realized_pnl || 0), 0);

    // Calcular média de movimentos de preço para stops e TPs
    const avgLossMove = stopAnalysis.stoppedOutTrades.length > 0 
      ? stopAnalysis.stoppedOutTrades.reduce((sum, t) => sum + (t.priceMove || 0), 0) / stopAnalysis.stoppedOutTrades.length 
      : 0.3;
    const avgWinMove = stopAnalysis.optimalTPs.length > 0 
      ? stopAnalysis.optimalTPs.reduce((sum, val) => sum + val, 0) / stopAnalysis.optimalTPs.length 
      : 0.5;

    // Stop otimizado baseado nos dados reais
    const baseStop = Math.max(avgLossMove * 0.8, stopAnalysis.avgVolatility * 0.5);
    const optimizedStop = Math.min(Math.max(baseStop, 0.5), 2.5);

    // TP otimizado baseado em R:R e dados reais
    const optimizedTP = Math.min(Math.max(avgWinMove, optimizedStop * 2.5), 6);

    // ========================
    // 10. CONSULTAR IA PARA INSIGHTS
    // ========================
    // ========================
    // ANÁLISE DE PADRÕES DE PERDA
    // ========================
    const lossPatternAnalysis = {
      commonLossHours: [] as number[],
      commonLossSymbols: [] as string[],
      highLeverageLosses: 0,
      lowVolLosses: 0,
      highVolLosses: 0,
    };

    // Analisar padrões nas perdas
    const lossHourCount = new Map<number, number>();
    const lossSymbolCount = new Map<string, number>();
    
    for (const pattern of stopAnalysis.lossPatterns) {
      lossHourCount.set(pattern.hour, (lossHourCount.get(pattern.hour) || 0) + 1);
      lossSymbolCount.set(pattern.symbol, (lossSymbolCount.get(pattern.symbol) || 0) + 1);
      if (pattern.leverage > 50) lossPatternAnalysis.highLeverageLosses++;
      if (pattern.volatility < 1.5) lossPatternAnalysis.lowVolLosses++;
      if (pattern.volatility > 5) lossPatternAnalysis.highVolLosses++;
    }

    lossPatternAnalysis.commonLossHours = Array.from(lossHourCount.entries())
      .filter(([_, count]) => count >= 2)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([hour]) => hour);

    lossPatternAnalysis.commonLossSymbols = Array.from(lossSymbolCount.entries())
      .filter(([_, count]) => count >= 2)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([symbol]) => symbol);

    const aiPrompt = `Você é um quant expert. Analise este histórico REAL de ${allTrades.length} trades da Bybit.

📊 PERFORMANCE GERAL:
- Total Trades: ${allTrades.length} (${bybitTrades.length} Bybit + ${internalTrades?.length || 0} interno)
- Win Rate: ${winRate.toFixed(1)}% | Profit Factor: ${profitFactor.toFixed(2)}
- Total PnL: $${totalPnl.toFixed(2)}
- R:R Ratio: ${riskRewardRatio.toFixed(2)}
- Tempo médio no trade: ${stopAnalysis.avgTimeInTrade.toFixed(1)} minutos

🎯 REGIME DE MERCADO ATUAL: ${marketRegime.toUpperCase()}
- Win Rate últimos 20 trades: ${recentWinRate.toFixed(1)}%
- Volatilidade média recente: ${recentAvgVol.toFixed(2)}%

🚨 PADRÕES DE PERDA IDENTIFICADOS:
- Sequências de perdas consecutivas: ${stopAnalysis.consecutiveLosses.length} ocorrências
- Maior sequência de perdas: ${Math.max(...stopAnalysis.consecutiveLosses, 0)}
- Perdas em alta alavancagem (>50x): ${lossPatternAnalysis.highLeverageLosses}
- Perdas em baixa volatilidade: ${lossPatternAnalysis.lowVolLosses}
- Perdas em alta volatilidade: ${lossPatternAnalysis.highVolLosses}
- Horários com mais perdas: ${lossPatternAnalysis.commonLossHours.join('h, ')}h
- Símbolos problemáticos: ${lossPatternAnalysis.commonLossSymbols.join(', ')}

⚠️ ANÁLISE DE STOPS:
- Stops muito apertados: ${stopAnalysis.stopTooTight} trades (${((stopAnalysis.stopTooTight/allTrades.length)*100).toFixed(1)}%)
- Taxa de stop-out: ${((stopAnalysis.stoppedOutTrades.length / allTrades.length) * 100).toFixed(1)}%
- Avg Win Move: ${avgWinMove.toFixed(2)}% | Avg Loss Move: ${avgLossMove.toFixed(2)}%

📈 VOLATILIDADE:
${Array.from(volatilityBuckets.entries()).map(([k, v]) => {
  return `${k}: ${v.trades} trades, WR ${((v.wins/v.trades)*100).toFixed(0)}%, Stop ideal: ${stopByVolatility[k]?.toFixed(2)}%`;
}).join('\n')}

🏆 TOP SÍMBOLOS:
${topSymbols.slice(0, 5).map(s => `${s.symbol}: WR ${s.winRate}%, PnL $${s.pnl}, ${s.trades} trades, Lev média ${s.avgLeverage}x`).join('\n')}

❌ SÍMBOLOS A EVITAR: ${worstSymbols.join(', ')}

⏰ MELHORES HORÁRIOS (UTC):
${bestHours.slice(0, 4).map(h => `${h.hour}h: WR ${h.winRate}%, PnL $${h.pnl}`).join('\n')}

⛔ HORÁRIOS A EVITAR: ${worstHours.join('h, ')}h

💪 ALAVANCAGEM:
${Array.from(leverageStats.entries()).map(([lev, stats]) => {
  const wr = ((stats.wins / (stats.wins + stats.losses)) * 100).toFixed(0);
  return `${lev}x: WR ${wr}%, PnL $${stats.pnl.toFixed(2)}`;
}).join('\n')}

🎖️ SEQUÊNCIAS DE VITÓRIAS: ${stopAnalysis.winStreaks.length} ocorrências de 3+ wins seguidos

Com base nesses dados REAIS, forneça recomendações ESPECÍFICAS e ACIONÁVEIS em JSON:
{
  "marketRegimeAdaptations": {
    "currentRegime": "${marketRegime}",
    "recommendedLeverage": <número>,
    "recommendedRiskPercent": <% do capital por trade>,
    "shouldBeAggressive": <true/false>
  },
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
    "aggressive": <alavancagem máxima recomendada>,
    "byRegime": {
      "trending": <lev para mercado em tendência>,
      "ranging": <lev para mercado lateral>,
      "volatile": <lev para mercado volátil>,
      "calm": <lev para mercado calmo>
    }
  },
  "lossPatternMitigation": {
    "avoidHighLeverage": <true/false>,
    "avoidLowVolatility": <true/false>,
    "dangerousHours": [<horários a evitar>],
    "dangerousSymbols": [<símbolos a evitar>],
    "maxConsecutiveLosses": <número de perdas antes de pausar>
  },
  "symbolsToFocus": ["symbol1", "symbol2"],
  "symbolsToAvoid": ["symbol1", "symbol2"],
  "bestTradingHours": [hora1, hora2],
  "hoursToAvoid": [hora1, hora2],
  "positionSizing": {
    "basePercent": <% do capital>,
    "afterWinStreak": <% após sequência de vitórias>,
    "afterLossStreak": <% após sequência de perdas>,
    "highConfidence": <% para sinais de alta confiança>
  },
  "insights": ["insight crítico 1", "insight 2", "insight 3"],
  "criticalWarnings": ["aviso importante 1"],
  "actionPlan": "Plano de ação resumido para melhorar performance",
  "confidenceLevel": <0-100 baseado na qualidade dos dados>
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
    // 11. CONSTRUIR CONFIGURAÇÃO FINAL COM TODOS OS NOVOS DADOS
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
        // Regime de mercado
        marketRegime: {
          current: marketRegime,
          recentWinRate: recentWinRate,
          recentVolatility: recentAvgVol,
          adaptations: aiRecommendations.marketRegimeAdaptations || {},
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
        // NOVO: Padrões de perda
        lossPatterns: {
          consecutiveLosses: stopAnalysis.consecutiveLosses,
          maxLossStreak: Math.max(...stopAnalysis.consecutiveLosses, 0),
          winStreaks: stopAnalysis.winStreaks,
          commonLossHours: lossPatternAnalysis.commonLossHours,
          commonLossSymbols: lossPatternAnalysis.commonLossSymbols,
          highLeverageLosses: lossPatternAnalysis.highLeverageLosses,
          mitigation: aiRecommendations.lossPatternMitigation || {},
        },
        // NOVO: Position sizing dinâmico
        positionSizing: aiRecommendations.positionSizing || {
          basePercent: 10,
          afterWinStreak: 15,
          afterLossStreak: 5,
          highConfidence: 20,
        },
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
          avgTimeInTrade: stopAnalysis.avgTimeInTrade.toFixed(1),
        }
      },
      confidence_score: aiRecommendations.confidenceLevel || Math.min(
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
