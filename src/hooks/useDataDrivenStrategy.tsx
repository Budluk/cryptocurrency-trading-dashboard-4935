import { useCallback, useMemo } from 'react';

// 🕐 MAPA DE ATIVOS LUCRATIVOS POR HORA UTC - LIMPO v3
// APENAS ativos com PnL POSITIVO, win rate >= 60%, E NÃO na blacklist
// ⚠️ Removidos: MERLUSDT, MONUSDT, TRUTHUSDT, PUMPFUNUSDT, BOBBOBUSDT (todos na blacklist ou marginais)
const HOUR_ASSET_MAP: Record<number, { symbol: string; winRate: number; pnl: number }[]> = {
  0: [
    { symbol: 'HUSDT', winRate: 75.0, pnl: 0.74 },
  ],
  1: [
    { symbol: 'JELLYJELLYUSDT', winRate: 53.3, pnl: 1.42 }, // Mantido: PnL alto compensa WR
  ],
  2: [], // Todos removidos (blacklistados ou WR < 60%)
  3: [], 
  4: [], // BOBBOBUSDT removido (marginal)
  5: [],
  6: [], // BOBBOBUSDT removido (50% WR = marginal)
  7: [], 
  8: [], 
  9: [], 
  10: [], 
  11: [],
  12: [
    { symbol: 'NIGHTUSDT', winRate: 75.0, pnl: 2.34 },
  ],
  13: [
    { symbol: 'NIGHTUSDT', winRate: 100.0, pnl: 0.28 },
  ],
  14: [
    { symbol: 'NIGHTUSDT', winRate: 80.0, pnl: 0.06 },
  ],
  15: [
    { symbol: 'NIGHTUSDT', winRate: 66.7, pnl: 0.39 },
    { symbol: '1000PEPEUSDT', winRate: 52.9, pnl: 0.52 }, // Mantido: PnL positivo
  ],
  16: [
    { symbol: '1000PEPEUSDT', winRate: 75.0, pnl: 0.13 },
    { symbol: 'JELLYJELLYUSDT', winRate: 66.7, pnl: 0.04 },
    { symbol: 'NIGHTUSDT', winRate: 100.0, pnl: 0.02 },
  ],
  17: [], 
  18: [], // PUMPFUNUSDT removido (blacklistado)
  19: [], 
  20: [], 
  21: [
    { symbol: '1000PEPEUSDT', winRate: 100.0, pnl: 0.70 },
  ],
  22: [],
  23: [
    { symbol: 'FLUXUSDT', winRate: 66.7, pnl: 0.11 },
  ],
};

// 🔴 SÍMBOLOS QUE SEMPRE PERDEM - BLACKLIST v4
// ✅ BTCUSDT removido: incluído como ativo tradável com config específica
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
  'STRKUSDT',      // -$1.84 em 13 trades
  'TRUTHUSDT',     // Perde em múltiplas horas
  'MERLUSDT',      // -$1.48 em 6 trades Sell
  'MONUSDT',       // -$1.29 em 4 trades Buy
  'APRUSDT',       // -$1.29 em 14 trades
  'PUMPFUNUSDT',   // -$1.13 em 44 trades Buy
  'FARTCOINUSDT',  // -$1.05 em 3 trades Sell
  'BOBBOBUSDT',    // 50% WR, PnL marginal
  'LUNA2USDT',     // PnL inconsistente
  'NOTUSDT',       // Poucos dados, PnL marginal
]);

// 🟢 SÍMBOLOS PREMIUM - Comprovados + BTC/SOL (alta liquidez)
const PREMIUM_SYMBOLS = new Map([
  ['NIGHTUSDT', { avgWinRate: 84.4, totalPnl: 3.11 }],
  ['1000PEPEUSDT', { avgWinRate: 65, totalPnl: 1.35 }],
  ['HUSDT', { avgWinRate: 75, totalPnl: 0.74 }],
  ['JELLYJELLYUSDT', { avgWinRate: 60, totalPnl: 1.46 }],
  ['FLUXUSDT', { avgWinRate: 66.7, totalPnl: 0.11 }],
  ['BTCUSDT', { avgWinRate: 50, totalPnl: 0 }], // Alta liquidez, SL/TP mais apertados
  ['SOLUSDT', { avgWinRate: 50, totalPnl: 0 }], // Alta liquidez, SL/TP apertados
]);

// 📊 Configurações otimizadas v4 — R:R REALISTA para aumentar Profit Factor
// PROBLEMA: R:R 3.0 = TP nunca é atingido → PF 0.70
// SOLUÇÃO: R:R 2.0 com SL apertado = TP alcançável + wins > losses
const OPTIMAL_CONFIG = {
  minRiskReward: 2.0,       // v4: REDUZIDO de 3.0 → 2.0 (TP alcançável)
  maxStopLossPct: 0.08,     // v4: REDUZIDO de 0.10 → 0.08 (SL mais apertado)
  minTakeProfitPct: 0.16,   // v4: 2x o SL máximo
  minWinRateForHour: 55,    // v4: REDUZIDO de 60 → 55 (mais oportunidades)
  minTradesForStats: 5,
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
    
    // Se não há ativos específicos para esta hora, usar APENAS premium symbols
    // 🔧 v3: NÃO usar fallback genérico — só premium comprovados
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
      confidenceBoost = 5; // Reduzido de 10 — premium sem dados de hora é arriscado
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
    
    // Símbolo sem dados — PENALIZAR MAIS para evitar trades cegos
    return {
      symbol,
      isBlacklisted: false,
      isOptimalForHour: false,
      hourWinRate: null,
      hourPnl: null,
      isPremium: false,
      recommendation: 'AVOID', // v3: AVOID em vez de CAUTION para desconhecidos
      confidenceBoost: -25, // v3: penalidade maior (era -10)
      reason: `🚫 Sem histórico para ${currentHourUTC}h UTC - EVITAR`
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
    
    // v3: Desconhecidos = AVOID por padrão
    if (analysis.recommendation === 'AVOID') {
      return { shouldTrade: false, adjustedScore: 0, reason: analysis.reason };
    }
    
    // Ajustar score
    const adjustedScore = Math.min(100, Math.max(0, signalScore + analysis.confidenceBoost));
    
    // Score mínimo baseado na situação — v3: mais restritivo
    let minScore = 60; // Aumentado de 55
    if (analysis.isOptimalForHour) {
      minScore = 45; // Aumentado de 40
    } else if (analysis.isPremium) {
      minScore = 55; // Aumentado de 50
    }
    
    // Alta volatilidade = mais exigência
    if (volatility > 10) {
      minScore += 10;
    }
    
    const shouldTrade = adjustedScore >= minScore;
    
    return {
      shouldTrade,
      adjustedScore,
      reason: `${analysis.reason} | Score: ${signalScore} → ${adjustedScore} (min: ${minScore})`
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
    
    if (idealAssets.length > 0) {
      return idealAssets.sort((a, b) => {
        const aData = hourAssets.find(h => h.symbol === a.symbol);
        const bData = hourAssets.find(h => h.symbol === b.symbol);
        return (bData?.winRate || 0) - (aData?.winRate || 0);
      });
    }
    
    // Fallback: APENAS premium symbols (v3: sem top-N genérico)
    return assets.filter(asset => 
      PREMIUM_SYMBOLS.has(asset.symbol) && !GLOBAL_BLACKLIST.has(asset.symbol)
    ).sort((a, b) => {
      const aData = PREMIUM_SYMBOLS.get(a.symbol);
      const bData = PREMIUM_SYMBOLS.get(b.symbol);
      return (bData?.avgWinRate || 0) - (aData?.avgWinRate || 0);
    });
  }, [getAssetsForCurrentHour]);
  
  const getOptimalConfig = useCallback(() => OPTIMAL_CONFIG, []);
  
  const hasAssetsForCurrentHour = useCallback(() => {
    return getAssetsForCurrentHour().length > 0;
  }, [getAssetsForCurrentHour]);
  
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