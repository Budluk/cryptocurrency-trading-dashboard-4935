import { useCallback, useMemo } from 'react';

// 🔴 SÍMBOLOS QUE SEMPRE PERDEM - BLACKLIST (baseado em histórico real)
const BLACKLISTED_SYMBOLS = new Set([
  '1000LUNCUSDT',  // 300 trades, 31% win rate, -$25.83
  'LINEAUSDT',     // 43 trades, 0% win rate, -$2.19
  'HIPPOUSDT',     // 22 trades, 27% win rate, -$3.93
  'SOLUSDT',       // 6 trades, 16% win rate, -$2.39
  'BTCUSDT',       // 19 trades, 52% win rate, -$1.94 (muito volátil para scalp)
  'NOTUSDT',       // -$2.64
  'ARCUSDT',       // -$2.58
  'ATUSDT',        // -$1.93
  'XPINUSDT',      // -$1.80
  'AI16ZUSDT',     // -$1.69
  'AKEUSDT',       // -$1.61
  '10000SATSUSDT', // -$1.49
  'COMMONUSDT',    // -$1.27
  'KASUSDT',       // -$1.12
  'BOMEUSDT',      // -$1.04
  'PTBUSDT',       // -$2.34
  'TRUTHUSDT',     // -$5.99
]);

// 🟢 SÍMBOLOS QUE DÃO LUCRO - WHITELIST (baseado em histórico real)
const HIGH_WINRATE_SYMBOLS = new Map([
  ['NIGHTUSDT', { winRate: 84.4, avgPnl: 0.069 }],      // 84% win rate!
  ['MERLUSDT', { winRate: 100, avgPnl: 0.22 }],         // 100% win rate
  ['ETHUSDT', { winRate: 100, avgPnl: 0.91 }],          // 100% win rate
  ['LUNA2USDT', { winRate: 80, avgPnl: 0.075 }],        // 80% win rate
  ['BARDUSDT', { winRate: 83.3, avgPnl: 0.10 }],        // 83% win rate
  ['LYNUSDT', { winRate: 75, avgPnl: 0.13 }],           // 75% win rate
  ['IOSTUSDT', { winRate: 75, avgPnl: 0.11 }],          // 75% win rate
  ['PIPPINUSDT', { winRate: 66.7, avgPnl: 1.13 }],      // 67% win rate
  ['0GUSDT', { winRate: 66.7, avgPnl: 0.055 }],         // 67% win rate
  ['JELLYJELLYUSDT', { winRate: 42.1, avgPnl: 0.028 }], // Volume alto, lucro consistente
  ['HUSDT', { winRate: 55.6, avgPnl: 0.05 }],           // 56% win rate
  ['RESOLVUSDT', { winRate: 100, avgPnl: 0.49 }],       // 100% win rate
  ['1000TURBOUSDT', { winRate: 100, avgPnl: 0.15 }],    // 100% win rate
  ['LDOUSDT', { winRate: 100, avgPnl: 0.40 }],          // 100% win rate
]);

// 🕐 HORÁRIOS LUCRATIVOS (UTC) - baseado em dados reais
const PROFITABLE_HOURS = new Set([1, 2, 4]); // +$17.61 combinado
const LOSING_HOURS = new Set([0, 3, 5, 6, 10, 11, 13, 14, 16]); // -$70+ combinado

// 📊 Configurações otimizadas baseadas em dados
const OPTIMAL_CONFIG = {
  // Risk/Reward ajustado para compensar win rate < 50%
  minRiskReward: 1.8, // TP deve ser 1.8x maior que SL
  
  // Stop Loss apertado para scalping
  maxStopLossPct: 0.3, // máximo 0.3% SL
  minTakeProfitPct: 0.54, // mínimo 0.54% TP (1.8x do SL)
  
  // Filtros de qualidade
  minWinRateForSymbol: 40, // símbolo deve ter histórico >= 40% win rate
  minTradesForStats: 5, // mínimo 5 trades para confiar nas estatísticas
  
  // Controle de perdas
  maxConsecutiveLossesPerSymbol: 2, // parar de operar símbolo após 2 perdas seguidas
  maxDailyLossPerSymbol: 1.0, // máximo -$1 por símbolo por dia
  
  // Horário
  useTimeFilter: true,
  onlyProfitableHours: true,
};

interface SymbolAnalysis {
  symbol: string;
  isBlacklisted: boolean;
  isWhitelisted: boolean;
  historicalWinRate: number | null;
  isProfitableHour: boolean;
  isLosingHour: boolean;
  recommendation: 'TRADE' | 'AVOID' | 'CAUTION';
  confidenceBoost: number;
  reason: string;
}

export const useDataDrivenStrategy = () => {
  
  // Analisar símbolo baseado em dados históricos
  const analyzeSymbol = useCallback((symbol: string): SymbolAnalysis => {
    const currentHourUTC = new Date().getUTCHours();
    const isBlacklisted = BLACKLISTED_SYMBOLS.has(symbol);
    const whitelistData = HIGH_WINRATE_SYMBOLS.get(symbol);
    const isWhitelisted = !!whitelistData;
    const isProfitableHour = PROFITABLE_HOURS.has(currentHourUTC);
    const isLosingHour = LOSING_HOURS.has(currentHourUTC);
    
    let recommendation: 'TRADE' | 'AVOID' | 'CAUTION' = 'CAUTION';
    let confidenceBoost = 0;
    let reason = '';
    
    // Blacklist tem prioridade máxima
    if (isBlacklisted) {
      recommendation = 'AVOID';
      confidenceBoost = -100;
      reason = `❌ Símbolo na BLACKLIST (histórico de perdas)`;
      return { 
        symbol, isBlacklisted, isWhitelisted, 
        historicalWinRate: null, isProfitableHour, isLosingHour,
        recommendation, confidenceBoost, reason 
      };
    }
    
    // Whitelist com win rate alto
    if (isWhitelisted && whitelistData) {
      if (whitelistData.winRate >= 70) {
        recommendation = 'TRADE';
        confidenceBoost = 30;
        reason = `✅ Símbolo PREMIUM: ${whitelistData.winRate}% win rate histórico`;
      } else if (whitelistData.winRate >= 50) {
        recommendation = 'TRADE';
        confidenceBoost = 15;
        reason = `🟢 Símbolo LUCRATIVO: ${whitelistData.winRate}% win rate`;
      }
    }
    
    // Ajustar por horário
    if (isLosingHour) {
      if (recommendation === 'TRADE' && confidenceBoost >= 30) {
        // Símbolos premium podem operar em horários ruins com cautela
        confidenceBoost -= 10;
        reason += ` | ⚠️ Horário de risco (${currentHourUTC}h UTC)`;
      } else {
        recommendation = 'AVOID';
        confidenceBoost = -50;
        reason = `🕐 Horário de perdas (${currentHourUTC}h UTC) - evitar`;
      }
    } else if (isProfitableHour) {
      confidenceBoost += 15;
      reason += reason ? ` | 🕐 Horário lucrativo (${currentHourUTC}h UTC)` : `🕐 Horário lucrativo (${currentHourUTC}h UTC)`;
    }
    
    // Símbolos desconhecidos em horário ruim = evitar
    if (!isWhitelisted && !isProfitableHour) {
      recommendation = 'AVOID';
      confidenceBoost = -30;
      reason = `⚠️ Símbolo sem histórico + horário não ideal`;
    }
    
    // Símbolos desconhecidos em horário bom = cautela
    if (!isWhitelisted && !isBlacklisted && isProfitableHour) {
      recommendation = 'CAUTION';
      confidenceBoost = 0;
      reason = `🔍 Símbolo novo - testar com cautela`;
    }
    
    return {
      symbol,
      isBlacklisted,
      isWhitelisted,
      historicalWinRate: whitelistData?.winRate || null,
      isProfitableHour,
      isLosingHour,
      recommendation,
      confidenceBoost,
      reason
    };
  }, []);
  
  // Verificar se deve operar baseado em dados
  const shouldTradeDataDriven = useCallback((
    symbol: string,
    signalScore: number,
    volatility: number
  ): { shouldTrade: boolean; adjustedScore: number; reason: string } => {
    const analysis = analyzeSymbol(symbol);
    
    // Blacklist = nunca operar
    if (analysis.isBlacklisted) {
      return { shouldTrade: false, adjustedScore: 0, reason: analysis.reason };
    }
    
    // Horário de perda + símbolo não premium = não operar
    if (analysis.isLosingHour && analysis.confidenceBoost < 30) {
      return { shouldTrade: false, adjustedScore: 0, reason: analysis.reason };
    }
    
    // Ajustar score com base nos dados históricos
    const adjustedScore = Math.min(100, Math.max(0, signalScore + analysis.confidenceBoost));
    
    // Score mínimo baseado no tipo de símbolo
    let minScore = 50; // padrão
    if (analysis.isWhitelisted) {
      minScore = 40; // símbolos provados precisam de menos confirmação
    }
    if (analysis.isProfitableHour) {
      minScore -= 5; // horário bom = menos exigência
    }
    if (volatility > 10) {
      minScore += 10; // volatilidade alta = mais exigência
    }
    
    const shouldTrade = adjustedScore >= minScore && analysis.recommendation !== 'AVOID';
    
    return {
      shouldTrade,
      adjustedScore,
      reason: `${analysis.reason} | Score: ${signalScore} → ${adjustedScore}`
    };
  }, [analyzeSymbol]);
  
  // Calcular SL/TP otimizados baseado em dados
  const getOptimalStopTakeProfit = useCallback((
    symbol: string,
    entryPrice: number,
    side: 'Buy' | 'Sell',
    volatility: number
  ): { stopLoss: number; takeProfit: number; reason: string } => {
    const analysis = analyzeSymbol(symbol);
    
    // 🎯 R:R 1:2.5+ PARA COMPENSAR WIN RATE BAIXO (~38%)
    // Matemática: (0.38 * 2.5) - (0.62 * 1) = +0.33 (lucrativo)
    let slPercent = 0.10;  // SL apertado
    let tpPercent = 0.25;  // TP 2.5x maior (R:R 1:2.5)
    
    // Símbolos com alto win rate = pode usar R:R menor
    if (analysis.isWhitelisted && analysis.historicalWinRate && analysis.historicalWinRate >= 70) {
      slPercent = 0.08;   // 0.08% SL (mais apertado)
      tpPercent = 0.20;   // 0.20% TP (R:R 1:2.5)
    }
    // Símbolos com win rate médio = R:R padrão
    else if (analysis.isWhitelisted && analysis.historicalWinRate && analysis.historicalWinRate >= 50) {
      slPercent = 0.10;   // 0.10% SL
      tpPercent = 0.25;   // 0.25% TP (R:R 1:2.5)
    }
    // Símbolos desconhecidos = R:R maior para compensar incerteza
    else {
      slPercent = 0.10;   // 0.10% SL
      tpPercent = 0.30;   // 0.30% TP (R:R 1:3)
    }
    
    // Ajustar por volatilidade (manter R:R mínimo 1:2.5)
    if (volatility > 8) {
      slPercent = Math.min(slPercent * 1.1, 0.12);  // máx 0.12%
      tpPercent = Math.min(tpPercent * 1.2, 0.40);  // máx 0.40%
    }
    
    // Calcular preços
    const slMultiplier = side === 'Buy' ? (1 - slPercent / 100) : (1 + slPercent / 100);
    const tpMultiplier = side === 'Buy' ? (1 + tpPercent / 100) : (1 - tpPercent / 100);
    
    const stopLoss = entryPrice * slMultiplier;
    const takeProfit = entryPrice * tpMultiplier;
    
    return {
      stopLoss,
      takeProfit,
      reason: `SL: ${slPercent.toFixed(2)}% | TP: ${tpPercent.toFixed(2)}% | R:R ${(tpPercent/slPercent).toFixed(1)}:1`
    };
  }, [analyzeSymbol]);
  
  // Filtrar lista de ativos baseado em dados
  const filterAssetsDataDriven = useCallback((assets: any[]): any[] => {
    const currentHourUTC = new Date().getUTCHours();
    const isProfitableHour = PROFITABLE_HOURS.has(currentHourUTC);
    
    return assets.filter(asset => {
      const symbol = asset.symbol;
      
      // Sempre remover blacklist
      if (BLACKLISTED_SYMBOLS.has(symbol)) {
        return false;
      }
      
      // Em horário de perda, só aceitar whitelist premium
      if (LOSING_HOURS.has(currentHourUTC)) {
        const whitelistData = HIGH_WINRATE_SYMBOLS.get(symbol);
        return whitelistData && whitelistData.winRate >= 70;
      }
      
      return true;
    }).sort((a, b) => {
      // Priorizar whitelist
      const aWhitelist = HIGH_WINRATE_SYMBOLS.get(a.symbol);
      const bWhitelist = HIGH_WINRATE_SYMBOLS.get(b.symbol);
      
      if (aWhitelist && !bWhitelist) return -1;
      if (!aWhitelist && bWhitelist) return 1;
      if (aWhitelist && bWhitelist) {
        return bWhitelist.winRate - aWhitelist.winRate;
      }
      
      // Por score se não estiver na whitelist
      return (b.score || 0) - (a.score || 0);
    });
  }, []);
  
  // Obter configurações otimizadas
  const getOptimalConfig = useCallback(() => OPTIMAL_CONFIG, []);
  
  // Verificar se é horário lucrativo
  const isProfitableHour = useCallback(() => {
    const currentHourUTC = new Date().getUTCHours();
    return PROFITABLE_HOURS.has(currentHourUTC);
  }, []);
  
  // Obter estatísticas da estratégia
  const getStrategyStats = useCallback(() => {
    return {
      blacklistedCount: BLACKLISTED_SYMBOLS.size,
      whitelistedCount: HIGH_WINRATE_SYMBOLS.size,
      profitableHours: Array.from(PROFITABLE_HOURS),
      losingHours: Array.from(LOSING_HOURS),
      topSymbols: Array.from(HIGH_WINRATE_SYMBOLS.entries())
        .sort((a, b) => b[1].winRate - a[1].winRate)
        .slice(0, 5)
        .map(([symbol, data]) => ({ symbol, ...data })),
    };
  }, []);
  
  return {
    analyzeSymbol,
    shouldTradeDataDriven,
    getOptimalStopTakeProfit,
    filterAssetsDataDriven,
    getOptimalConfig,
    isProfitableHour,
    getStrategyStats,
    BLACKLISTED_SYMBOLS,
    HIGH_WINRATE_SYMBOLS,
    PROFITABLE_HOURS,
    LOSING_HOURS,
  };
};
