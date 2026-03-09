import { useCallback } from 'react';

export interface SymbolRiskProfile {
  isOptimalForHour: boolean;
  isPremium: boolean;
  hourWinRate: number | null;
  isBTCOrSOL: boolean;
}

// 🎯 v11: Scalper profissional — 1% risco, 0.4% SL, 0.8% TP, 5-10x leverage
export const useTradingCalculations = () => {
  
  // v11: Leverage 5-10x baseada em volatilidade
  const getLeverageForScalping = useCallback((volatility: number): number => {
    if (volatility > 8) return 5;
    if (volatility > 5) return 6;
    if (volatility > 3) return 7;
    if (volatility > 2) return 8;
    if (volatility > 1) return 9;
    return 10; // Max 10x para vol muito baixa
  }, []);

  // v11: Leverage baseada no balance — sempre 5-10x
  const getLeverageForBalance = useCallback((balance: number, winRate: number): number => {
    let baseLeverage = 7;
    if (balance < 10) baseLeverage = 10;
    else if (balance < 20) baseLeverage = 8;
    else if (balance < 50) baseLeverage = 7;
    else baseLeverage = 5;

    // Win rate adjustment (minor)
    if (winRate >= 60) baseLeverage = Math.min(baseLeverage + 1, 10);
    else if (winRate < 40) baseLeverage = Math.max(baseLeverage - 1, 5);

    return Math.max(5, Math.min(10, baseLeverage));
  }, []);

  // 💼 v11: Position sizing — risco EXATO de 1% por trade
  // Fórmula: usdSize = (balance * 0.01) / 0.004
  // Com SL de 0.4%, perder 1% do capital por stop-out
  const calculatePositionSize = useCallback((
    balance: number, 
    leverage: number, 
    volatility: number, 
    winRate: number, 
    currentOpenPositions: number,
    maxOpenPositions: number
  ) => {
    const RISK_PER_TRADE = 0.01; // 1% do capital
    const STOP_LOSS_PCT = 0.004; // 0.4% SL
    
    // USD size = quanto de capital arriscar dividido pela % de perda
    let usdSize = (balance * RISK_PER_TRADE) / STOP_LOSS_PCT;
    
    // Limitar ao máximo razoável
    const maxUsdSize = balance * 0.20; // Máximo 20% do capital por posição
    usdSize = Math.min(usdSize, maxUsdSize);
    
    // Mínimo para operar
    const minPositionSize = 2;
    usdSize = Math.max(minPositionSize, usdSize);
    
    // Reduzir se muitas posições abertas
    const positionSizeMultiplier = currentOpenPositions === 0 
      ? 1.0 
      : Math.max(0.5, 1 - (currentOpenPositions / maxOpenPositions) * 0.3);
    usdSize *= positionSizeMultiplier;
    
    const marginPerPosition = balance / Math.min(maxOpenPositions, 10);
    
    return { 
      usdSize, 
      quantity: usdSize * leverage,
      marginUsed: usdSize / leverage,
      marginPerPosition,
      positionSizeMultiplier
    };
  }, []);

  // 🧠 Trailing stop dinâmico
  const calculateDynamicTrailingStop = useCallback((volatility: number): number => {
    if (volatility < 2) return 0.3;
    if (volatility < 5) return 0.4;
    if (volatility < 10) return 0.6;
    return 0.8;
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

  // 🔍 Swing levels para stops estruturais
  const findSwingLevels = useCallback((
    highPrice: number,
    lowPrice: number,
    currentPrice: number,
    action: 'BUY' | 'SELL'
  ): { swingStop: number; swingTarget: number } => {
    const priceRange = highPrice - lowPrice;
    const buffer = priceRange * 0.1;
    
    if (action === 'BUY') {
      return { swingStop: lowPrice - buffer, swingTarget: highPrice + buffer };
    } else {
      return { swingStop: highPrice + buffer, swingTarget: lowPrice - buffer };
    }
  }, []);

  // 🛡️ v11: SL/TP FIXO — 0.4% SL / 0.8% TP = R:R 1:2
  const calculateStopTakeProfit = useCallback((
    currentPrice: number,
    action: 'BUY' | 'SELL',
    _atrPercent: number,
    _isScalpAsset: boolean,
    _mlConfig: any,
    _highPrice?: number,
    _lowPrice?: number,
    _symbolProfile?: SymbolRiskProfile
  ): { stopLoss: string; takeProfit: string; stopLossPct: number; takeProfitPct: number } => {
    const stopLossPct = 0.004;  // 0.4% FIXO
    const takeProfitPct = 0.008; // 0.8% FIXO (R:R 1:2)

    let stopLoss: number, takeProfit: number;
    if (action === 'BUY') {
      stopLoss = currentPrice * (1 - stopLossPct);
      takeProfit = currentPrice * (1 + takeProfitPct);
    } else {
      stopLoss = currentPrice * (1 + stopLossPct);
      takeProfit = currentPrice * (1 - takeProfitPct);
    }

    const priceDecimals = currentPrice < 1 ? 6 : currentPrice < 100 ? 4 : 2;
    console.log(`🎯 v11 ${action} SL: 0.40% | TP: 0.80% | R:R 1:2`);

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
