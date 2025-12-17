import { useCallback, useMemo } from 'react';

// 🕐 MAPA DE ATIVOS LUCRATIVOS POR HORA UTC - OPERA 24H
// Baseado em análise de histórico real de trades
const HOUR_ASSET_MAP: Record<number, { symbol: string; winRate: number; pnl: number }[]> = {
  0: [
    { symbol: 'HUSDT', winRate: 75.0, pnl: 0.74 },
    { symbol: 'BTCUSDT', winRate: 66.7, pnl: 0.21 },
  ],
  1: [
    { symbol: 'MERLUSDT', winRate: 100.0, pnl: 0.94 },
    { symbol: 'NOTUSDT', winRate: 100.0, pnl: 0.11 },
    { symbol: 'MONUSDT', winRate: 66.7, pnl: 0.56 },
    { symbol: 'JELLYJELLYUSDT', winRate: 53.3, pnl: 1.42 },
  ],
  2: [
    { symbol: 'TRUTHUSDT', winRate: 100.0, pnl: 1.04 },
    { symbol: 'LUNA2USDT', winRate: 100.0, pnl: 0.10 },
    { symbol: 'NIGHTUSDT', winRate: 77.8, pnl: -0.18 },
    { symbol: '1000LUNCUSDT', winRate: 75.0, pnl: -0.14 },
    { symbol: '1000PEPEUSDT', winRate: 75.0, pnl: -0.48 },
    { symbol: 'MONUSDT', winRate: 50.0, pnl: 0.30 },
  ],
  3: [], // Sem ativos lucrativos identificados
  4: [
    { symbol: 'BOBBOBUSDT', winRate: 62.5, pnl: 0.29 },
  ],
  5: [
    { symbol: 'NIGHTUSDT', winRate: 80.0, pnl: -1.68 },
    { symbol: '1000PEPEUSDT', winRate: 57.1, pnl: -0.08 },
  ],
  6: [
    { symbol: 'BOBBOBUSDT', winRate: 50.0, pnl: 0.40 },
  ],
  7: [], // Sem dados suficientes
  8: [], // Sem dados suficientes
  9: [], // Sem dados suficientes
  10: [], // Sem dados suficientes
  11: [
    { symbol: 'BOBBOBUSDT', winRate: 75.0, pnl: -0.13 },
  ],
  12: [
    { symbol: 'JELLYJELLYUSDT', winRate: 83.3, pnl: -0.22 },
    { symbol: 'NIGHTUSDT', winRate: 75.0, pnl: 2.34 },
    { symbol: 'TRUTHUSDT', winRate: 66.7, pnl: -1.22 },
  ],
  13: [
    { symbol: 'NIGHTUSDT', winRate: 100.0, pnl: 0.28 },
    { symbol: 'BOBBOBUSDT', winRate: 61.5, pnl: -0.60 },
    { symbol: 'TRUTHUSDT', winRate: 57.1, pnl: -2.06 },
    { symbol: 'JELLYJELLYUSDT', winRate: 55.6, pnl: -2.58 },
  ],
  14: [
    { symbol: 'NIGHTUSDT', winRate: 80.0, pnl: 0.06 },
    { symbol: 'TRUTHUSDT', winRate: 55.6, pnl: -1.02 },
  ],
  15: [
    { symbol: 'TRUTHUSDT', winRate: 80.0, pnl: -1.82 },
    { symbol: 'JELLYJELLYUSDT', winRate: 75.0, pnl: -0.48 },
    { symbol: 'PUMPFUNUSDT', winRate: 66.7, pnl: 1.30 },
    { symbol: 'NIGHTUSDT', winRate: 66.7, pnl: 0.39 },
    { symbol: 'BOBBOBUSDT', winRate: 60.0, pnl: -1.34 },
    { symbol: '1000PEPEUSDT', winRate: 52.9, pnl: 0.52 },
    { symbol: '1000LUNCUSDT', winRate: 50.0, pnl: -0.52 },
  ],
  16: [
    { symbol: 'NIGHTUSDT', winRate: 100.0, pnl: 0.02 },
    { symbol: 'PUMPFUNUSDT', winRate: 75.0, pnl: 0.87 },
    { symbol: '1000PEPEUSDT', winRate: 75.0, pnl: 0.13 },
    { symbol: 'JELLYJELLYUSDT', winRate: 66.7, pnl: 0.04 },
    { symbol: 'TRUTHUSDT', winRate: 50.0, pnl: -2.63 },
  ],
  17: [], // Sem dados suficientes
  18: [
    { symbol: 'PUMPFUNUSDT', winRate: 53.8, pnl: 0.99 },
  ],
  19: [], // Sem dados suficientes
  20: [], // Sem dados suficientes
  21: [
    { symbol: '1000PEPEUSDT', winRate: 100.0, pnl: 0.70 },
    { symbol: 'LUNA2USDT', winRate: 66.7, pnl: -0.11 },
  ],
  22: [
    { symbol: 'BTCUSDT', winRate: 100.0, pnl: 0.35 },
  ],
  23: [
    { symbol: 'FLUXUSDT', winRate: 66.7, pnl: 0.11 },
    { symbol: 'BTCUSDT', winRate: 66.7, pnl: 0.05 },
  ],
};

// 🔴 SÍMBOLOS QUE SEMPRE PERDEM GLOBALMENTE - BLACKLIST ABSOLUTA
const GLOBAL_BLACKLIST = new Set([
  'LINEAUSDT',     // 0% win rate global
  'HIPPOUSDT',     // 27% win rate global
  'ARCUSDT',       // Perdas consistentes
  'ATUSDT',        // Perdas consistentes
  'XPINUSDT',      // Perdas consistentes
  'AI16ZUSDT',     // Perdas consistentes
  'AKEUSDT',       // Perdas consistentes
  'COMMONUSDT',    // Perdas consistentes
  'PTBUSDT',       // Perdas consistentes
]);

// 🟢 SÍMBOLOS PREMIUM (podem operar em qualquer hora se não tiverem dados específicos)
const PREMIUM_SYMBOLS = new Map([
  ['NIGHTUSDT', { avgWinRate: 84.4, totalPnl: 3.11 }],
  ['MERLUSDT', { avgWinRate: 100, totalPnl: 0.94 }],
  ['ETHUSDT', { avgWinRate: 100, totalPnl: 0.91 }],
  ['LUNA2USDT', { avgWinRate: 80, totalPnl: 0.10 }],
  ['PIPPINUSDT', { avgWinRate: 66.7, totalPnl: 3.39 }],
  ['JELLYJELLYUSDT', { avgWinRate: 55, totalPnl: 3.36 }],
  ['PUMPFUNUSDT', { avgWinRate: 65, totalPnl: 3.16 }],
  ['BOBBOBUSDT', { avgWinRate: 58, totalPnl: 0.56 }],
]);

// 📊 Configurações otimizadas
const OPTIMAL_CONFIG = {
  minRiskReward: 2.5,
  maxStopLossPct: 0.12,
  minTakeProfitPct: 0.25,
  minWinRateForHour: 50,
  minTradesForStats: 3,
  maxConsecutiveLossesPerSymbol: 2,
};

interface SymbolAnalysis {
  symbol: string;
  isBlacklisted: boolean;
  isOptimalForHour: boolean;
  hourWinRate: number | null;
  hourPnl: number | null;
  isPremium: boolean;
  recommendation: 'TRADE' | 'AVOID' | 'CAUTION';
  confidenceBoost: number;
  reason: string;
}

export const useDataDrivenStrategy = () => {
  
  // Obter ativos lucrativos para hora atual
  const getAssetsForCurrentHour = useCallback((): { symbol: string; winRate: number; pnl: number }[] => {
    const currentHourUTC = new Date().getUTCHours();
    const hourAssets = HOUR_ASSET_MAP[currentHourUTC] || [];
    
    // Filtrar apenas ativos com win rate >= 50% E não na blacklist global
    const profitable = hourAssets.filter(a => 
      a.winRate >= 50 && 
      !GLOBAL_BLACKLIST.has(a.symbol)
    );
    
    // Se não há ativos específicos para esta hora, usar premium symbols
    if (profitable.length === 0) {
      return Array.from(PREMIUM_SYMBOLS.entries())
        .map(([symbol, data]) => ({
          symbol,
          winRate: data.avgWinRate,
          pnl: data.totalPnl
        }))
        .filter(a => !GLOBAL_BLACKLIST.has(a.symbol));
    }
    
    return profitable.sort((a, b) => b.winRate - a.winRate);
  }, []);
  
  // Analisar símbolo baseado na hora atual
  const analyzeSymbol = useCallback((symbol: string): SymbolAnalysis => {
    const currentHourUTC = new Date().getUTCHours();
    const hourAssets = HOUR_ASSET_MAP[currentHourUTC] || [];
    const hourData = hourAssets.find(a => a.symbol === symbol);
    const premiumData = PREMIUM_SYMBOLS.get(symbol);
    const isBlacklisted = GLOBAL_BLACKLIST.has(symbol);
    
    let recommendation: 'TRADE' | 'AVOID' | 'CAUTION' = 'CAUTION';
    let confidenceBoost = 0;
    let reason = '';
    
    // Blacklist global = nunca operar
    if (isBlacklisted) {
      return {
        symbol,
        isBlacklisted: true,
        isOptimalForHour: false,
        hourWinRate: null,
        hourPnl: null,
        isPremium: false,
        recommendation: 'AVOID',
        confidenceBoost: -100,
        reason: `❌ Símbolo na BLACKLIST GLOBAL`
      };
    }
    
    // Verificar se é ativo ideal para esta hora
    if (hourData && hourData.winRate >= 50) {
      const isHighPerformer = hourData.winRate >= 70;
      const hasProfitablePnl = hourData.pnl > 0;
      
      recommendation = 'TRADE';
      confidenceBoost = isHighPerformer ? 35 : 20;
      if (hasProfitablePnl) confidenceBoost += 10;
      
      reason = `✅ ATIVO IDEAL para ${currentHourUTC}h UTC: ${hourData.winRate}% win rate`;
      if (hasProfitablePnl) reason += ` | +$${hourData.pnl.toFixed(2)}`;
      
      return {
        symbol,
        isBlacklisted: false,
        isOptimalForHour: true,
        hourWinRate: hourData.winRate,
        hourPnl: hourData.pnl,
        isPremium: !!premiumData,
        recommendation,
        confidenceBoost,
        reason
      };
    }
    
    // Símbolo premium sem dados específicos para esta hora
    if (premiumData) {
      recommendation = 'CAUTION';
      confidenceBoost = 10;
      reason = `🟡 Premium (${premiumData.avgWinRate}% avg) - sem dados para ${currentHourUTC}h UTC`;
      
      return {
        symbol,
        isBlacklisted: false,
        isOptimalForHour: false,
        hourWinRate: null,
        hourPnl: null,
        isPremium: true,
        recommendation,
        confidenceBoost,
        reason
      };
    }
    
    // Símbolo sem dados
    return {
      symbol,
      isBlacklisted: false,
      isOptimalForHour: false,
      hourWinRate: null,
      hourPnl: null,
      isPremium: false,
      recommendation: 'CAUTION',
      confidenceBoost: -10,
      reason: `⚠️ Sem histórico para ${currentHourUTC}h UTC`
    };
  }, []);
  
  // Verificar se deve operar
  const shouldTradeDataDriven = useCallback((
    symbol: string,
    signalScore: number,
    volatility: number
  ): { shouldTrade: boolean; adjustedScore: number; reason: string } => {
    const analysis = analyzeSymbol(symbol);
    
    // Blacklist = nunca
    if (analysis.isBlacklisted) {
      return { shouldTrade: false, adjustedScore: 0, reason: analysis.reason };
    }
    
    // Ajustar score
    const adjustedScore = Math.min(100, Math.max(0, signalScore + analysis.confidenceBoost));
    
    // Score mínimo baseado na situação
    let minScore = 55;
    if (analysis.isOptimalForHour) {
      minScore = 40; // Ativos ideais para hora precisam menos confirmação
    } else if (analysis.isPremium) {
      minScore = 50; // Premium sem dados específicos
    }
    
    // Alta volatilidade = mais exigência
    if (volatility > 10) {
      minScore += 10;
    }
    
    const shouldTrade = adjustedScore >= minScore && analysis.recommendation !== 'AVOID';
    
    return {
      shouldTrade,
      adjustedScore,
      reason: `${analysis.reason} | Score: ${signalScore} → ${adjustedScore} (min: ${minScore})`
    };
  }, [analyzeSymbol]);
  
  // Calcular SL/TP otimizados
  const getOptimalStopTakeProfit = useCallback((
    symbol: string,
    entryPrice: number,
    side: 'Buy' | 'Sell',
    volatility: number
  ): { stopLoss: number; takeProfit: number; reason: string } => {
    const analysis = analyzeSymbol(symbol);
    
    // R:R 1:2.5+ para compensar win rate
    let slPercent = 0.10;
    let tpPercent = 0.25;
    
    // Ativos com alto win rate na hora = pode usar R:R menor
    if (analysis.isOptimalForHour && analysis.hourWinRate && analysis.hourWinRate >= 70) {
      slPercent = 0.08;
      tpPercent = 0.20;
    }
    // Win rate médio
    else if (analysis.isOptimalForHour && analysis.hourWinRate && analysis.hourWinRate >= 50) {
      slPercent = 0.10;
      tpPercent = 0.25;
    }
    // Premium ou desconhecido
    else {
      slPercent = 0.10;
      tpPercent = 0.30;
    }
    
    // Ajuste por volatilidade
    if (volatility > 8) {
      slPercent = Math.min(slPercent * 1.1, 0.12);
      tpPercent = Math.min(tpPercent * 1.2, 0.40);
    }
    
    const slMultiplier = side === 'Buy' ? (1 - slPercent / 100) : (1 + slPercent / 100);
    const tpMultiplier = side === 'Buy' ? (1 + tpPercent / 100) : (1 - tpPercent / 100);
    
    return {
      stopLoss: entryPrice * slMultiplier,
      takeProfit: entryPrice * tpMultiplier,
      reason: `SL: ${slPercent.toFixed(2)}% | TP: ${tpPercent.toFixed(2)}% | R:R ${(tpPercent/slPercent).toFixed(1)}:1`
    };
  }, [analyzeSymbol]);
  
  // Filtrar ativos para hora atual
  const filterAssetsDataDriven = useCallback((assets: any[]): any[] => {
    const currentHourUTC = new Date().getUTCHours();
    const hourAssets = getAssetsForCurrentHour();
    const hourSymbols = new Set(hourAssets.map(a => a.symbol));
    
    // Priorizar ativos ideais para esta hora
    const idealAssets = assets.filter(asset => 
      hourSymbols.has(asset.symbol) && !GLOBAL_BLACKLIST.has(asset.symbol)
    );
    
    // Se temos ativos ideais, usar eles
    if (idealAssets.length > 0) {
      return idealAssets.sort((a, b) => {
        const aData = hourAssets.find(h => h.symbol === a.symbol);
        const bData = hourAssets.find(h => h.symbol === b.symbol);
        return (bData?.winRate || 0) - (aData?.winRate || 0);
      });
    }
    
    // Fallback: premium symbols não na blacklist
    return assets.filter(asset => 
      PREMIUM_SYMBOLS.has(asset.symbol) && !GLOBAL_BLACKLIST.has(asset.symbol)
    ).sort((a, b) => {
      const aData = PREMIUM_SYMBOLS.get(a.symbol);
      const bData = PREMIUM_SYMBOLS.get(b.symbol);
      return (bData?.avgWinRate || 0) - (aData?.avgWinRate || 0);
    });
  }, [getAssetsForCurrentHour]);
  
  // Obter configurações
  const getOptimalConfig = useCallback(() => OPTIMAL_CONFIG, []);
  
  // Verificar se hora atual tem ativos lucrativos
  const hasAssetsForCurrentHour = useCallback(() => {
    return getAssetsForCurrentHour().length > 0;
  }, [getAssetsForCurrentHour]);
  
  // Estatísticas
  const getStrategyStats = useCallback(() => {
    const currentHourUTC = new Date().getUTCHours();
    const hourAssets = getAssetsForCurrentHour();
    
    return {
      currentHour: currentHourUTC,
      assetsForHour: hourAssets.length,
      hourAssetsList: hourAssets,
      premiumCount: PREMIUM_SYMBOLS.size,
      blacklistCount: GLOBAL_BLACKLIST.size,
      totalHoursWithData: Object.values(HOUR_ASSET_MAP).filter(h => h.length > 0).length,
    };
  }, [getAssetsForCurrentHour]);
  
  return {
    analyzeSymbol,
    shouldTradeDataDriven,
    getOptimalStopTakeProfit,
    filterAssetsDataDriven,
    getOptimalConfig,
    hasAssetsForCurrentHour,
    getAssetsForCurrentHour,
    getStrategyStats,
    GLOBAL_BLACKLIST,
    PREMIUM_SYMBOLS,
    HOUR_ASSET_MAP,
  };
};
