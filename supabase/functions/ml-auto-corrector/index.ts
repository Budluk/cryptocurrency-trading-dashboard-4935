import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Bybit API Config
const BYBIT_API_KEY = Deno.env.get('BYBIT_API_KEY') || '';
const BYBIT_API_SECRET = Deno.env.get('BYBIT_API_SECRET') || '';
const RECV_WINDOW = "30000";
const BASE_URL = "https://api.bybit.com";

interface CorrectionAction {
  type: 'adjust_sl' | 'adjust_tp' | 'reduce_leverage' | 'block_symbol' | 'block_hour' | 'change_strategy';
  reason: string;
  oldValue?: number | string;
  newValue?: number | string;
  confidence: number;
}

interface AutoCorrectionResult {
  corrections: CorrectionAction[];
  newConfig: {
    stopLossPct: number;
    takeProfitPct: number;
    maxLeverage: number;
    blockedSymbols: string[];
    blockedHours: number[];
    minConfidence: number;
    positionSizeMultiplier: number;
  };
  analysis: {
    tradesAnalyzed: number;
    winRate: number;
    profitFactor: number;
    avgRR: number;
    consecutiveLosses: number;
    criticalIssues: string[];
  };
}

// Bybit API Helpers
async function getBybitServerTime(): Promise<number> {
  try {
    const response = await fetch(`${BASE_URL}/v5/market/time`);
    const data = await response.json();
    if (data.retCode === 0 && data.time) {
      return Math.floor(Number(data.time));
    }
    throw new Error('Invalid server time response');
  } catch {
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

async function makeBybitRequest(method: string, endpoint: string, params: Record<string, any> = {}): Promise<any> {
  const timestamp = await getBybitServerTime();
  
  let url = `${BASE_URL}${endpoint}`;
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      searchParams.append(key, String(value));
    }
  });
  const paramsStr = searchParams.toString();
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
    throw new Error(`Bybit API Error: ${data.retMsg}`);
  }

  return data.result;
}

// Detectar padrões perdedores e gerar correções automáticas
function analyzeAndCorrect(
  trades: any[],
  currentConfig: any
): AutoCorrectionResult {
  const corrections: CorrectionAction[] = [];
  const criticalIssues: string[] = [];
  
  // Calcular métricas atuais
  const winningTrades = trades.filter(t => (t.pnl || t.closedPnl || 0) > 0);
  const losingTrades = trades.filter(t => (t.pnl || t.closedPnl || 0) < 0);
  const winRate = trades.length > 0 ? (winningTrades.length / trades.length) * 100 : 50;
  
  const totalWin = winningTrades.reduce((sum, t) => sum + Math.abs(t.pnl || t.closedPnl || 0), 0);
  const totalLoss = losingTrades.reduce((sum, t) => sum + Math.abs(t.pnl || t.closedPnl || 0), 0);
  const profitFactor = totalLoss > 0 ? totalWin / totalLoss : winningTrades.length > 0 ? 10 : 0;
  
  // Calcular R:R médio
  const avgWin = winningTrades.length > 0 ? totalWin / winningTrades.length : 0;
  const avgLoss = losingTrades.length > 0 ? totalLoss / losingTrades.length : 1;
  const avgRR = avgLoss > 0 ? avgWin / avgLoss : 2;
  
  // Detectar perdas consecutivas
  let maxConsecutiveLosses = 0;
  let currentStreak = 0;
  for (const trade of trades) {
    if ((trade.pnl || trade.closedPnl || 0) < 0) {
      currentStreak++;
      maxConsecutiveLosses = Math.max(maxConsecutiveLosses, currentStreak);
    } else {
      currentStreak = 0;
    }
  }
  
  // Configuração base (ou atual)
  let stopLossPct = currentConfig?.recommended_stop_loss_pct || 1.5;
  let takeProfitPct = currentConfig?.recommended_take_profit_pct || 3.0;
  let maxLeverage = currentConfig?.recommended_leverage || 20;
  let minConfidence = currentConfig?.min_confidence || 80;
  let positionSizeMultiplier = 1.0;
  const blockedSymbols: string[] = [];
  const blockedHours: number[] = [];
  
  // ===========================
  // CORREÇÕES AUTOMÁTICAS
  // ===========================
  
  // 1. PROFIT FACTOR MUITO BAIXO (< 1.0 = perdendo dinheiro)
  if (profitFactor < 1.0 && trades.length >= 10) {
    criticalIssues.push(`Profit Factor crítico: ${profitFactor.toFixed(2)}`);
    
    // Aumentar SL para evitar stops prematuros
    const oldSL = stopLossPct;
    stopLossPct = Math.min(stopLossPct * 1.3, 3.0);
    corrections.push({
      type: 'adjust_sl',
      reason: 'Profit Factor < 1.0 indica stops muito apertados',
      oldValue: oldSL,
      newValue: stopLossPct,
      confidence: 90
    });
    
    // Aumentar TP para melhor R:R
    const oldTP = takeProfitPct;
    takeProfitPct = Math.max(stopLossPct * 2.5, takeProfitPct);
    corrections.push({
      type: 'adjust_tp',
      reason: 'TP aumentado para R:R mínimo 2.5:1',
      oldValue: oldTP,
      newValue: takeProfitPct,
      confidence: 90
    });
    
    // Reduzir alavancagem
    const oldLev = maxLeverage;
    maxLeverage = Math.max(Math.floor(maxLeverage * 0.6), 5);
    corrections.push({
      type: 'reduce_leverage',
      reason: 'Reduzir risco durante período perdedor',
      oldValue: oldLev,
      newValue: maxLeverage,
      confidence: 85
    });
    
    // Reduzir tamanho das posições
    positionSizeMultiplier = 0.5;
  }
  
  // 2. R:R MUITO BAIXO (< 1.5)
  if (avgRR < 1.5 && trades.length >= 10) {
    criticalIssues.push(`R:R Ratio baixo: ${avgRR.toFixed(2)}`);
    
    // Aumentar TP
    const oldTP = takeProfitPct;
    takeProfitPct = Math.max(stopLossPct * 2.5, takeProfitPct * 1.5);
    corrections.push({
      type: 'adjust_tp',
      reason: `R:R ${avgRR.toFixed(2)} < 1.5, TP precisa ser maior`,
      oldValue: oldTP,
      newValue: takeProfitPct,
      confidence: 88
    });
  }
  
  // 3. WIN RATE MUITO BAIXO (< 40%)
  if (winRate < 40 && trades.length >= 10) {
    criticalIssues.push(`Win Rate baixo: ${winRate.toFixed(1)}%`);
    
    // Aumentar confiança mínima
    const oldConf = minConfidence;
    minConfidence = Math.min(minConfidence + 5, 90);
    corrections.push({
      type: 'change_strategy',
      reason: `Win Rate ${winRate.toFixed(1)}% exige sinais mais confiáveis`,
      oldValue: oldConf,
      newValue: minConfidence,
      confidence: 85
    });
    
    // Stop mais largo
    const oldSL = stopLossPct;
    stopLossPct = Math.min(stopLossPct * 1.2, 2.5);
    corrections.push({
      type: 'adjust_sl',
      reason: 'SL mais largo para dar espaço ao trade',
      oldValue: oldSL,
      newValue: stopLossPct,
      confidence: 80
    });
  }
  
  // 4. MUITAS PERDAS CONSECUTIVAS (>= 3)
  if (maxConsecutiveLosses >= 3) {
    criticalIssues.push(`${maxConsecutiveLosses} perdas consecutivas`);
    
    // Reduzir alavancagem
    const oldLev = maxLeverage;
    maxLeverage = Math.max(Math.floor(maxLeverage * 0.7), 5);
    corrections.push({
      type: 'reduce_leverage',
      reason: `${maxConsecutiveLosses} perdas seguidas, reduzir exposição`,
      oldValue: oldLev,
      newValue: maxLeverage,
      confidence: 92
    });
    
    positionSizeMultiplier = Math.max(positionSizeMultiplier * 0.7, 0.3);
  }
  
  // 5. IDENTIFICAR SÍMBOLOS PROBLEMÁTICOS
  const symbolStats = new Map<string, { wins: number; losses: number; pnl: number }>();
  for (const trade of trades) {
    const symbol = trade.symbol;
    if (!symbolStats.has(symbol)) {
      symbolStats.set(symbol, { wins: 0, losses: 0, pnl: 0 });
    }
    const stats = symbolStats.get(symbol)!;
    const pnl = trade.pnl || trade.closedPnl || 0;
    stats.pnl += pnl;
    if (pnl > 0) stats.wins++;
    else stats.losses++;
  }
  
  for (const [symbol, stats] of symbolStats.entries()) {
    const totalTrades = stats.wins + stats.losses;
    const symbolWinRate = totalTrades > 0 ? (stats.wins / totalTrades) * 100 : 50;
    
    // Bloquear símbolo com win rate < 30% e mais de 5 trades
    if (symbolWinRate < 30 && totalTrades >= 5 && stats.pnl < 0) {
      blockedSymbols.push(symbol);
      corrections.push({
        type: 'block_symbol',
        reason: `${symbol} com ${symbolWinRate.toFixed(0)}% win rate e PnL $${stats.pnl.toFixed(2)}`,
        oldValue: 'ativo',
        newValue: 'bloqueado',
        confidence: 90
      });
    }
  }
  
  // 6. IDENTIFICAR HORÁRIOS PROBLEMÁTICOS
  const hourStats = new Map<number, { wins: number; losses: number }>();
  for (const trade of trades) {
    const hour = new Date(trade.opened_at || trade.createdTime).getUTCHours();
    if (!hourStats.has(hour)) {
      hourStats.set(hour, { wins: 0, losses: 0 });
    }
    const stats = hourStats.get(hour)!;
    if ((trade.pnl || trade.closedPnl || 0) > 0) stats.wins++;
    else stats.losses++;
  }
  
  for (const [hour, stats] of hourStats.entries()) {
    const totalTrades = stats.wins + stats.losses;
    const hourWinRate = totalTrades > 0 ? (stats.wins / totalTrades) * 100 : 50;
    
    // Bloquear hora com win rate < 25% e mais de 3 trades
    if (hourWinRate < 25 && totalTrades >= 3) {
      blockedHours.push(hour);
      corrections.push({
        type: 'block_hour',
        reason: `Hora ${hour}:00 UTC com apenas ${hourWinRate.toFixed(0)}% win rate`,
        oldValue: 'ativo',
        newValue: 'bloqueado',
        confidence: 85
      });
    }
  }
  
  // Garantir R:R mínimo de 2:1
  if (takeProfitPct < stopLossPct * 2) {
    takeProfitPct = stopLossPct * 2;
  }
  
  return {
    corrections,
    newConfig: {
      stopLossPct: Math.round(stopLossPct * 100) / 100,
      takeProfitPct: Math.round(takeProfitPct * 100) / 100,
      maxLeverage,
      blockedSymbols,
      blockedHours,
      minConfidence,
      positionSizeMultiplier: Math.round(positionSizeMultiplier * 100) / 100
    },
    analysis: {
      tradesAnalyzed: trades.length,
      winRate: Math.round(winRate * 10) / 10,
      profitFactor: Math.round(profitFactor * 100) / 100,
      avgRR: Math.round(avgRR * 100) / 100,
      consecutiveLosses: maxConsecutiveLosses,
      criticalIssues
    }
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { userId } = await req.json();
    const ANONYMOUS_USER_ID = '00000000-0000-0000-0000-000000000000';
    const targetUserId = userId || ANONYMOUS_USER_ID;

    console.log(`🔄 Auto-correção ML iniciada para user: ${targetUserId}`);

    // 1. Buscar trades recentes da Bybit (últimos 100)
    let bybitTrades: any[] = [];
    try {
      const result = await makeBybitRequest('GET', '/v5/position/closed-pnl', {
        category: 'linear',
        limit: 100
      });
      bybitTrades = result?.list || [];
      console.log(`📊 ${bybitTrades.length} trades da Bybit carregados`);
    } catch (e: any) {
      console.log('⚠️ Erro Bybit:', e.message);
    }

    // 2. Buscar trades do banco de dados
    const { data: dbTrades } = await supabase
      .from('auto_trader_positions')
      .select('*')
      .eq('user_id', targetUserId)
      .eq('status', 'CLOSED')
      .order('closed_at', { ascending: false })
      .limit(100);

    // 3. Combinar trades
    const allTrades = [
      ...bybitTrades.map(t => ({
        symbol: t.symbol,
        pnl: parseFloat(t.closedPnl) || 0,
        leverage: parseFloat(t.leverage) || 10,
        opened_at: new Date(parseInt(t.createdTime)).toISOString(),
        createdTime: t.createdTime
      })),
      ...(dbTrades || []).map(t => ({
        symbol: t.symbol,
        pnl: t.realized_pnl || t.pnl || 0,
        leverage: t.leverage || 10,
        opened_at: t.opened_at
      }))
    ];

    console.log(`📊 Total: ${allTrades.length} trades para análise`);

    if (allTrades.length < 5) {
      return new Response(JSON.stringify({
        success: false,
        message: 'Necessário mínimo de 5 trades para auto-correção',
        tradesCount: allTrades.length
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // 4. Buscar config atual
    const { data: currentConfig } = await supabase
      .from('ml_adaptive_config')
      .select('*')
      .eq('user_id', targetUserId)
      .single();

    // 5. Analisar e gerar correções
    const result = analyzeAndCorrect(allTrades, currentConfig);

    console.log(`🔧 ${result.corrections.length} correções geradas`);
    console.log(`📊 Análise: WR ${result.analysis.winRate}% | PF ${result.analysis.profitFactor} | R:R ${result.analysis.avgRR}`);

    // 6. Salvar configuração corrigida no banco
    // IMPORTANTE: Armazenar TUDO no optimal_patterns já que min_confidence_threshold não existe na tabela
    const updatedPatterns = {
      ...(currentConfig?.optimal_patterns || {}),
      autoCorrections: result.corrections,
      blockedSymbols: result.newConfig.blockedSymbols,
      blockedHours: result.newConfig.blockedHours,
      positionSizeMultiplier: result.newConfig.positionSizeMultiplier,
      minConfidence: result.newConfig.minConfidence,
      lastAutoCorrection: new Date().toISOString(),
      criticalIssues: result.analysis.criticalIssues,
      analysis: {
        winRate: result.analysis.winRate,
        profitFactor: result.analysis.profitFactor,
        avgRR: result.analysis.avgRR,
        consecutiveLosses: result.analysis.consecutiveLosses
      }
    };

    const { error: updateError } = await supabase
      .from('ml_adaptive_config')
      .upsert({
        user_id: targetUserId,
        is_enabled: true,
        recommended_stop_loss_pct: result.newConfig.stopLossPct,
        recommended_take_profit_pct: result.newConfig.takeProfitPct,
        recommended_leverage: result.newConfig.maxLeverage,
        confidence_score: Math.max(10, 100 - (result.analysis.criticalIssues.length * 15)),
        trades_analyzed: result.analysis.tradesAnalyzed,
        optimal_patterns: updatedPatterns,
        last_analysis_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'user_id'
      });

    if (updateError) {
      console.error('❌ Erro ao salvar config:', updateError);
    }

    // 7. Log das correções
    if (result.corrections.length > 0) {
      await supabase.from('auto_trader_logs').insert({
        user_id: targetUserId,
        log_type: 'ML_AUTO_CORRECTION',
        message: `Auto-correção: ${result.corrections.length} ajustes aplicados`,
        metadata: {
          corrections: result.corrections,
          analysis: result.analysis,
          newConfig: result.newConfig
        }
      });
    }

    return new Response(JSON.stringify({
      success: true,
      corrections: result.corrections,
      newConfig: result.newConfig,
      analysis: result.analysis,
      message: result.corrections.length > 0 
        ? `${result.corrections.length} correções automáticas aplicadas`
        : 'Nenhuma correção necessária'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('❌ Erro auto-correção:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
