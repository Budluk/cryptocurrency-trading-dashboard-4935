import { useCallback, useRef, useState } from 'react';

interface ExposureData {
  totalExposure: number;
  maxExposure: number;
  exposurePercent: number;
  isOverExposed: boolean;
}

interface VolatilityRisk {
  symbol: string;
  volatility: number;
  riskLevel: 'low' | 'medium' | 'high' | 'extreme';
  maxPositionSize: number;
}

interface TrailingConfig {
  activationPct: number;
  trailingPct: number;
  breakEvenPct: number;
}

// Cache de volatilidade por símbolo
const volatilityCache = new Map<string, { volatility: number; timestamp: number }>();
const VOLATILITY_CACHE_TTL = 60000; // 1 minuto

// Estatísticas de correlação
const correlationStats = new Map<string, Set<string>>();

export const useAdvancedRiskManager = () => {
  const [totalExposure, setTotalExposure] = useState(0);
  const lastCalculation = useRef<number>(0);

  // 🎯 Calcular exposição total do portfolio
  const calculateExposure = useCallback((
    openPositions: Array<{ symbol: string; qty: number; entry_price: number; leverage?: number }>,
    balance: number
  ): ExposureData => {
    const now = Date.now();
    
    // Cache de 5 segundos
    if (now - lastCalculation.current < 5000 && totalExposure > 0) {
      const maxExposure = balance * 0.8; // 80% max exposure
      return {
        totalExposure,
        maxExposure,
        exposurePercent: (totalExposure / maxExposure) * 100,
        isOverExposed: totalExposure > maxExposure
      };
    }

    const exposure = openPositions.reduce((sum, pos) => {
      const positionValue = pos.qty * pos.entry_price;
      const margin = positionValue / (pos.leverage || 10);
      return sum + margin;
    }, 0);

    lastCalculation.current = now;
    setTotalExposure(exposure);

    const maxExposure = balance * 0.8;
    return {
      totalExposure: exposure,
      maxExposure,
      exposurePercent: (exposure / maxExposure) * 100,
      isOverExposed: exposure > maxExposure
    };
  }, [totalExposure]);

  // 📊 Classificar risco baseado em volatilidade
  const classifyVolatilityRisk = useCallback((
    symbol: string,
    volatility: number,
    balance: number
  ): VolatilityRisk => {
    // Atualizar cache
    volatilityCache.set(symbol, { volatility, timestamp: Date.now() });

    let riskLevel: 'low' | 'medium' | 'high' | 'extreme';
    let maxPositionMultiplier: number;

    if (volatility < 2) {
      riskLevel = 'low';
      maxPositionMultiplier = 0.25; // 25% do capital
    } else if (volatility < 5) {
      riskLevel = 'medium';
      maxPositionMultiplier = 0.15; // 15% do capital
    } else if (volatility < 10) {
      riskLevel = 'high';
      maxPositionMultiplier = 0.10; // 10% do capital
    } else {
      riskLevel = 'extreme';
      maxPositionMultiplier = 0.05; // 5% do capital
    }

    return {
      symbol,
      volatility,
      riskLevel,
      maxPositionSize: balance * maxPositionMultiplier
    };
  }, []);

  // 🔄 Trailing stop adaptativo à volatilidade
  const getAdaptiveTrailingConfig = useCallback((
    volatility: number,
    profitPercent: number,
    isScalp: boolean
  ): TrailingConfig => {
    // Scalping: trailing mais apertado
    if (isScalp) {
      return {
        activationPct: 0.3, // Ativa com 0.3% lucro
        trailingPct: volatility < 2 ? 0.15 : volatility < 5 ? 0.25 : 0.35,
        breakEvenPct: 0.2 // Move para breakeven com 0.2%
      };
    }

    // Normal: trailing mais largo
    let activationPct = 0.5;
    let trailingPct = 0.3;

    if (volatility >= 10) {
      // Alta volatilidade: trailing mais largo
      activationPct = 1.0;
      trailingPct = 0.6;
    } else if (volatility >= 5) {
      activationPct = 0.7;
      trailingPct = 0.45;
    }

    // Se já tem bom lucro, apertar trailing
    if (profitPercent > 1.5) {
      trailingPct = Math.max(0.2, trailingPct * 0.7);
    }

    return {
      activationPct,
      trailingPct,
      breakEvenPct: activationPct * 0.6
    };
  }, []);

  // 🛡️ Verificar correlação de ativos
  const checkAssetCorrelation = useCallback((
    newSymbol: string,
    existingPositions: Array<{ symbol: string; side: string }>,
    side: string
  ): { allowed: boolean; reason: string; correlatedWith: string[] } => {
    // Grupos de correlação
    const correlationGroups: Record<string, string[]> = {
      'BTC': ['BTCUSDT', 'BTC'],
      'ETH': ['ETHUSDT', 'ETH'],
      'BNB': ['BNBUSDT', 'BNB'],
      'SOL': ['SOLUSDT', 'SOL'],
      'MEME': ['DOGEUSDT', 'SHIBUSDT', 'PEPEUSDT', 'FLOKIUSDT', 'BONKUSDT', 'WIFUSDT'],
      'AI': ['RENDERUSDT', 'FETUSDT', 'AGIXUSDT', 'OCEANUSDT'],
      'L2': ['ARBUSDT', 'OPUSDT', 'MATICUSDT', 'STXUSDT'],
      'DEFI': ['AAVEUSDT', 'LINKUSDT', 'UNIUSDT', 'MKRUSDT'],
    };

    // Encontrar grupo do novo símbolo
    let newSymbolGroup = '';
    for (const [group, symbols] of Object.entries(correlationGroups)) {
      if (symbols.some(s => newSymbol.includes(s))) {
        newSymbolGroup = group;
        break;
      }
    }

    if (!newSymbolGroup) {
      return { allowed: true, reason: '', correlatedWith: [] };
    }

    // Verificar posições existentes no mesmo grupo
    const correlatedPositions = existingPositions.filter(pos => {
      const symbols = correlationGroups[newSymbolGroup] || [];
      return symbols.some(s => pos.symbol.includes(s)) && pos.side === side;
    });

    // Máximo 2 posições correlacionadas na mesma direção
    if (correlatedPositions.length >= 2) {
      return {
        allowed: false,
        reason: `Limite de correlação ${newSymbolGroup}: ${correlatedPositions.length}/2 posições`,
        correlatedWith: correlatedPositions.map(p => p.symbol)
      };
    }

    return {
      allowed: true,
      reason: '',
      correlatedWith: correlatedPositions.map(p => p.symbol)
    };
  }, []);

  // 📉 Proteção de lucro dinâmica
  const getProtectProfitLevel = useCallback((
    entryPrice: number,
    currentPrice: number,
    highestPrice: number,
    side: string,
    volatility: number
  ): { shouldProtect: boolean; newStopLoss: number; reason: string } => {
    const profitPercent = side === 'Buy'
      ? ((currentPrice - entryPrice) / entryPrice) * 100
      : ((entryPrice - currentPrice) / entryPrice) * 100;

    const maxProfitPercent = side === 'Buy'
      ? ((highestPrice - entryPrice) / entryPrice) * 100
      : ((entryPrice - highestPrice) / entryPrice) * 100;

    // Não proteger se não tem lucro
    if (profitPercent < 0.3) {
      return { shouldProtect: false, newStopLoss: 0, reason: 'Lucro insuficiente' };
    }

    // Calcular nível de proteção baseado em volatilidade
    const protectMultiplier = volatility > 5 ? 0.4 : volatility > 2 ? 0.5 : 0.6;
    const protectLevel = entryPrice + ((highestPrice - entryPrice) * protectMultiplier);

    // Breakeven se lucro >= 0.5%
    if (profitPercent >= 0.5) {
      const breakEvenStop = side === 'Buy'
        ? entryPrice * 1.001 // 0.1% acima do entry
        : entryPrice * 0.999; // 0.1% abaixo do entry

      return {
        shouldProtect: true,
        newStopLoss: side === 'Buy' ? Math.max(breakEvenStop, protectLevel) : Math.min(breakEvenStop, protectLevel),
        reason: `Protegendo ${profitPercent.toFixed(2)}% lucro`
      };
    }

    return { shouldProtect: false, newStopLoss: 0, reason: 'Aguardando mais lucro' };
  }, []);

  // 📊 Estatísticas de risco consolidadas
  const getRiskStats = useCallback((): {
    volatilityCount: { low: number; medium: number; high: number; extreme: number };
    cachedSymbols: number;
    avgVolatility: number;
  } => {
    const now = Date.now();
    let low = 0, medium = 0, high = 0, extreme = 0;
    let totalVol = 0;
    let validCount = 0;

    volatilityCache.forEach((data, symbol) => {
      if (now - data.timestamp < VOLATILITY_CACHE_TTL) {
        validCount++;
        totalVol += data.volatility;
        if (data.volatility < 2) low++;
        else if (data.volatility < 5) medium++;
        else if (data.volatility < 10) high++;
        else extreme++;
      }
    });

    return {
      volatilityCount: { low, medium, high, extreme },
      cachedSymbols: validCount,
      avgVolatility: validCount > 0 ? totalVol / validCount : 0
    };
  }, []);

  return {
    calculateExposure,
    classifyVolatilityRisk,
    getAdaptiveTrailingConfig,
    checkAssetCorrelation,
    getProtectProfitLevel,
    getRiskStats,
    totalExposure,
  };
};
