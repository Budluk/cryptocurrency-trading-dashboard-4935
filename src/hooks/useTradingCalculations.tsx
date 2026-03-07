import { useCallback, useMemo } from 'react';

export interface SymbolRiskProfile {
  isOptimalForHour: boolean;
  isPremium: boolean;
  hourWinRate: number | null;
  isBTCOrSOL: boolean;
}

// 🎯 Hook para cálculos de trading reutilizáveis
export const useTradingCalculations = () => {
  
  // 🎯 Alavancagem para scalping baseada na volatilidade
  // 🔧 REDUZIDO: Leverage menor = SL mais largo = menos stop-outs
  const getLeverageForScalping = useCallback((volatility: number): number => {
    if (volatility > 10.0) return 5;
    if (volatility > 5.0) return 8;
    if (volatility > 3.0) return 10;
    if (volatility > 2.0) return 12;
    if (volatility > 1.0) return 15;
    return 18; // Mínimo garantido: 5x (capped no caller)
  }, []);

  // Alavancagem baseada no bankroll e win rate
  // 🔧 REDUZIDO: Leverage menor para dar mais espaço ao SL
  const getLeverageForBalance = useCallback((balance: number, winRate: number): number => {
    let baseLeverage = 10;
    if (balance < 5) baseLeverage = 15;
    else if (balance < 10) baseLeverage = 12;
    else if (balance < 20) baseLeverage = 10;
    else if (balance < 50) baseLeverage = 8;
    else baseLeverage = 6;

    if (winRate >= 60) baseLeverage = Math.min(baseLeverage + 3, 20);
    else if (winRate < 40) baseLeverage = Math.max(baseLeverage - 3, 5);

    return Math.max(5, baseLeverage); // NUNCA abaixo de 5x
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

  // 🛡️ Calcular Stop Loss e Take Profit UNIFICADO v6
  // PROBLEMA: R:R 2.0 = TP nunca atingido → PF 0.49
  // SOLUÇÃO: R:R 1.5 com SL mais apertado = TP alcançável + scalping rápido
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
    const targetRR = 1.5; // v6: REDUZIDO de 2.0 → 1.5 (TP alcançável!)
    let stopLossPct: number;
    let takeProfitPct: number;

    // 🔧 BTC/SOL: SL ultra-apertado (alta liquidez, spreads baixos)
    if (symbolProfile?.isBTCOrSOL) {
      stopLossPct = Math.max(0.003, Math.min(0.006, atrPercent * 0.04 / 100)); // 0.3%-0.6%
      takeProfitPct = stopLossPct * targetRR;
    }
    // Ativo ideal para esta hora com alto WR
    else if (symbolProfile?.isOptimalForHour && symbolProfile.hourWinRate && symbolProfile.hourWinRate >= 70) {
      stopLossPct = Math.max(0.005, Math.min(0.010, atrPercent * 0.06 / 100)); // 0.5%-1.0%
      takeProfitPct = stopLossPct * targetRR;
    }
    // Ativo ideal com WR médio
    else if (symbolProfile?.isOptimalForHour && symbolProfile.hourWinRate && symbolProfile.hourWinRate >= 50) {
      stopLossPct = Math.max(0.006, Math.min(0.012, atrPercent * 0.06 / 100)); // 0.6%-1.2%
      takeProfitPct = stopLossPct * targetRR;
    }
    // Fallback: volatilidade
    else {
      stopLossPct = Math.max(0.006, Math.min(0.012, atrPercent * 0.20 / 100)); // 0.6%-1.2%
      takeProfitPct = stopLossPct * targetRR;
    }

    // Alta volatilidade = SL ligeiramente maior mas CAPPED em 1.2%
    if (atrPercent > 10) {
      stopLossPct = Math.max(stopLossPct, 0.010);
      takeProfitPct = stopLossPct * targetRR;
    } else if (atrPercent > 5) {
      stopLossPct = Math.max(stopLossPct, 0.008);
      takeProfitPct = stopLossPct * targetRR;
    }

    // Cap SL máximo em 1.2% (v6: reduzido de 2.0%)
    stopLossPct = Math.min(stopLossPct, 0.012);
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
    console.log(`🎯 ${action} ATR: ${atrPercent.toFixed(1)}% → SL: ${(stopLossPct*100).toFixed(2)}% | TP: ${(takeProfitPct*100).toFixed(2)}% | R:R ${targetRR}:1`);

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
