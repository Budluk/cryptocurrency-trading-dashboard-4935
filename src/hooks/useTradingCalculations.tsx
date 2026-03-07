import { useCallback, useMemo } from 'react';

export interface SymbolRiskProfile {
  isOptimalForHour: boolean;
  isPremium: boolean;
  hourWinRate: number | null;
  isBTCOrSOL: boolean;
}

// 🎯 Hook para cálculos de trading reutilizáveis
export const useTradingCalculations = () => {
  
  // 🎯 v7: Leverage MUITO MENOR = SL efetivo mais largo = menos stop-outs por ruído
  // PROBLEMA v6: 15-18x leverage + 0.3% SL = stopado por spread/wicks
  const getLeverageForScalping = useCallback((volatility: number): number => {
    if (volatility > 10.0) return 5;
    if (volatility > 5.0) return 5;
    if (volatility > 3.0) return 6;
    if (volatility > 2.0) return 8;
    if (volatility > 1.0) return 10;
    return 12; // v7: MAX 12x (era 18x)
  }, []);

  // Alavancagem baseada no bankroll e win rate
  // v7: Leverage conservadora — proteger capital
  const getLeverageForBalance = useCallback((balance: number, winRate: number): number => {
    let baseLeverage = 8;
    if (balance < 5) baseLeverage = 10;
    else if (balance < 10) baseLeverage = 8;
    else if (balance < 20) baseLeverage = 7;
    else if (balance < 50) baseLeverage = 6;
    else baseLeverage = 5;

    if (winRate >= 60) baseLeverage = Math.min(baseLeverage + 2, 12);
    else if (winRate < 40) baseLeverage = Math.max(baseLeverage - 2, 5);

    return Math.max(5, Math.min(12, baseLeverage)); // v7: MAX 12x
  }, []);

  // 💼 Gerenciamento de capital dinâmico
  const calculatePositionSize = useCallback((
    balance: number, 
    leverage: number, 
    volatility: number, 
    winRate: number, 
    currentOpenPositions: number,
    maxOpenPositions: number
  ) => {
    const MAX_MARGIN_USAGE = 0.80;
    const targetPositions = Math.min(maxOpenPositions, 20);
    const marginPerPosition = (balance * MAX_MARGIN_USAGE) / targetPositions;
    
    const positionSizeMultiplier = currentOpenPositions === 0 
      ? 1.0 
      : Math.max(0.3, 1 - (currentOpenPositions / targetPositions) * 0.5);
    
    let baseRisk = balance < 15 ? 0.25 : 0.20;
    
    if (volatility > 5) baseRisk *= 0.85;
    else if (volatility > 3) baseRisk *= 0.95;
    else if (volatility < 1) baseRisk *= 1.3;
    
    if (winRate >= 55) baseRisk *= 1.5;
    else if (winRate >= 45) baseRisk *= 1.2;
    else if (winRate < 35) baseRisk *= 0.8;
    
    baseRisk *= positionSizeMultiplier;
    
    const minPositionSize = 2;
    const maxPositionSize = marginPerPosition / leverage;
    
    let usdSize = balance * baseRisk;
    usdSize = Math.max(minPositionSize, Math.min(maxPositionSize, usdSize));
    
    return { 
      usdSize, 
      quantity: (usdSize * leverage),
      marginUsed: usdSize / leverage,
      marginPerPosition,
      positionSizeMultiplier
    };
  }, []);

  // 🧠 Trailing stop dinâmico para SCALPING (mais apertado)
  const calculateDynamicTrailingStop = useCallback((volatility: number): number => {
    if (volatility < 2) return 0.4;
    if (volatility < 5) return 0.6;
    if (volatility < 10) return 0.8;
    return 1.2;
  }, []);

  // 📊 Calcular quantidade válida para ordem
  const calculateValidQuantity = useCallback((
    usdSize: number,
    currentPrice: number,
    leverage: number,
    minOrderQty: number,
    qtyStep: number,
    maxOrderQty: number
  ): { qty: number; qtyStr: string; orderValueUSD: string } => {
    const MIN_ORDER_VALUE = 5.5;
    let qty = usdSize / currentPrice;
    
    const minQtyForValue = MIN_ORDER_VALUE / currentPrice;
    qty = Math.max(qty, minQtyForValue);
    qty = Math.max(qty, minOrderQty);
    qty = Math.min(qty, maxOrderQty);
    qty = Math.floor(qty / qtyStep) * qtyStep;
    
    const orderValueUSD = (qty * currentPrice).toFixed(2);
    
    const decimalPlaces = qtyStep.toString().includes('.') 
      ? qtyStep.toString().split('.')[1].length 
      : 0;
    const qtyStr = qty.toFixed(decimalPlaces);
    
    return { qty, qtyStr, orderValueUSD };
  }, []);

  // 🔍 Encontrar swing highs/lows (topos e fundos) para stops estruturais
  const findSwingLevels = useCallback((
    highPrice: number,
    lowPrice: number,
    currentPrice: number,
    action: 'BUY' | 'SELL'
  ): { swingStop: number; swingTarget: number } => {
    // Para BUY: stop abaixo do fundo recente, target acima do topo
    // Para SELL: stop acima do topo recente, target abaixo do fundo
    const priceRange = highPrice - lowPrice;
    const buffer = priceRange * 0.1; // 10% buffer além do swing
    
    if (action === 'BUY') {
      // Stop abaixo do fundo (suporte) - a favor da tendência de alta
      const swingStop = lowPrice - buffer;
      // Target acima do topo (resistência)
      const swingTarget = highPrice + buffer;
      return { swingStop, swingTarget };
    } else {
      // Stop acima do topo (resistência) - a favor da tendência de baixa
      const swingStop = highPrice + buffer;
      // Target abaixo do fundo (suporte)
      const swingTarget = lowPrice - buffer;
      return { swingStop, swingTarget };
    }
  }, []);

  // 🛡️ v7: SL/TP UNIFICADO — SL MAIS LARGO para aguentar ruído
  // PROBLEMA v6: SL 0.3-0.6% com leverage 15x = stopado por spread/wick
  // SOLUÇÃO v7: SL 0.8-1.5% com leverage 5-12x = mesma exposição, menos stop-outs
  // As saídas parciais (0.4%/0.8% lucro) são o mecanismo REAL de profit-taking
  const calculateStopTakeProfit = useCallback((
    currentPrice: number,
    action: 'BUY' | 'SELL',
    atrPercent: number,
    isScalpAsset: boolean,
    mlConfig: any,
    highPrice?: number,
    lowPrice?: number,
    symbolProfile?: SymbolRiskProfile
  ): { stopLoss: string; takeProfit: string; stopLossPct: number; takeProfitPct: number } => {
    const targetRR = 1.5;
    let stopLossPct: number;
    let takeProfitPct: number;

    // v7: BTC/SOL — SL 0.5-0.8% (era 0.3-0.6% → stopado demais)
    if (symbolProfile?.isBTCOrSOL) {
      stopLossPct = Math.max(0.005, Math.min(0.008, atrPercent * 0.06 / 100));
      takeProfitPct = stopLossPct * targetRR;
    }
    // Ativo ideal para esta hora com alto WR
    else if (symbolProfile?.isOptimalForHour && symbolProfile.hourWinRate && symbolProfile.hourWinRate >= 70) {
      stopLossPct = Math.max(0.008, Math.min(0.012, atrPercent * 0.08 / 100));
      takeProfitPct = stopLossPct * targetRR;
    }
    // Ativo ideal com WR médio
    else if (symbolProfile?.isOptimalForHour && symbolProfile.hourWinRate && symbolProfile.hourWinRate >= 50) {
      stopLossPct = Math.max(0.008, Math.min(0.015, atrPercent * 0.08 / 100));
      takeProfitPct = stopLossPct * targetRR;
    }
    // Fallback geral
    else {
      stopLossPct = Math.max(0.010, Math.min(0.015, atrPercent * 0.20 / 100));
      takeProfitPct = stopLossPct * targetRR;
    }

    // Alta volatilidade = SL maior para não ser stopado
    if (atrPercent > 10) {
      stopLossPct = Math.max(stopLossPct, 0.012);
      takeProfitPct = stopLossPct * targetRR;
    } else if (atrPercent > 5) {
      stopLossPct = Math.max(stopLossPct, 0.010);
      takeProfitPct = stopLossPct * targetRR;
    }

    // v7: Cap SL máximo em 1.5% (era 1.2%)
    stopLossPct = Math.min(stopLossPct, 0.015);
    takeProfitPct = stopLossPct * targetRR;

    // Aplicar stops
    let stopLoss: number, takeProfit: number;
    if (action === 'BUY') {
      stopLoss = currentPrice * (1 - stopLossPct);
      takeProfit = currentPrice * (1 + takeProfitPct);
    } else {
      stopLoss = currentPrice * (1 + stopLossPct);
      takeProfit = currentPrice * (1 - takeProfitPct);
    }

    const priceDecimals = currentPrice < 1 ? 6 : currentPrice < 100 ? 4 : 2;
    console.log(`🎯 v7 ${action} ATR: ${atrPercent.toFixed(1)}% → SL: ${(stopLossPct*100).toFixed(2)}% | TP: ${(takeProfitPct*100).toFixed(2)}% | R:R ${targetRR}:1`);

    return {
      stopLoss: stopLoss.toFixed(priceDecimals),
      takeProfit: takeProfit.toFixed(priceDecimals),
      stopLossPct,
      takeProfitPct
    };
  }, []);

  return {
    getLeverageForScalping,
    getLeverageForBalance,
    calculatePositionSize,
    calculateDynamicTrailingStop,
    calculateValidQuantity,
    calculateStopTakeProfit,
    findSwingLevels,
  };
};
