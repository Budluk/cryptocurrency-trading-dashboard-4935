import { useCallback, useMemo } from 'react';

// 🎯 Hook para cálculos de trading reutilizáveis
export const useTradingCalculations = () => {
  
  // 🎯 Alavancagem para scalping baseada na volatilidade
  const getLeverageForScalping = useCallback((volatility: number): number => {
    if (volatility > 5.0) return 15;
    if (volatility > 3.0) return 20;
    if (volatility > 2.0) return 25;
    if (volatility > 1.0) return 30;
    return 35;
  }, []);

  // Alavancagem baseada no bankroll e win rate
  const getLeverageForBalance = useCallback((balance: number, winRate: number): number => {
    let baseLeverage = 20;
    if (balance < 5) baseLeverage = 30;
    else if (balance < 10) baseLeverage = 25;
    else if (balance < 20) baseLeverage = 20;
    else if (balance < 50) baseLeverage = 18;
    else baseLeverage = 15;

    if (winRate >= 60) baseLeverage = Math.min(baseLeverage + 5, 40);
    else if (winRate < 40) baseLeverage = Math.max(baseLeverage - 8, 10);

    return baseLeverage;
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

  // 🛡️ Calcular Stop Loss e Take Profit
  const calculateStopTakeProfit = useCallback((
    currentPrice: number,
    action: 'BUY' | 'SELL',
    atrPercent: number,
    isScalpAsset: boolean,
    mlConfig: any
  ): { stopLoss: string; takeProfit: string; stopLossPct: number; takeProfitPct: number } => {
    const ATR_SL_MULTIPLIER = 1.5;
    let stopLossPct: number;
    let takeProfitPct: number;
    
    // Usar recomendações do ML se disponível (mas com limites para scalping)
    if (mlConfig?.is_enabled && mlConfig?.recommended_stop_loss_pct) {
      stopLossPct = Math.min(mlConfig.recommended_stop_loss_pct / 100, 0.005); // Max 0.5% para scalping
      takeProfitPct = Math.min(mlConfig.recommended_take_profit_pct / 100, 0.01); // Max 1% TP
    } else if (isScalpAsset) {
      // SCALPING AGRESSIVO: stops ultra-apertados
      stopLossPct = 0.003; // 0.3% stop loss
      takeProfitPct = 0.006; // 0.6% take profit (2:1 ratio)
    } else {
      // Normal: stops mais apertados para scalping
      const atrBasedSL = (atrPercent / 100) * ATR_SL_MULTIPLIER;
      const minSL = 0.004; // Mínimo 0.4%
      const maxSL = 0.015; // Máximo 1.5%
      stopLossPct = Math.max(minSL, Math.min(maxSL, atrBasedSL));
      takeProfitPct = stopLossPct * 2; // R:R 2:1
    }
    
    let stopLoss: number;
    let takeProfit: number;
    
    if (action === 'BUY') {
      stopLoss = currentPrice * (1 - stopLossPct);
      takeProfit = currentPrice * (1 + takeProfitPct);
    } else {
      stopLoss = currentPrice * (1 + stopLossPct);
      takeProfit = currentPrice * (1 - takeProfitPct);
    }
    
    const priceDecimals = currentPrice < 1 ? 6 : currentPrice < 100 ? 4 : 2;
    
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
  };
};
