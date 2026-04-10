import { useCallback } from 'react';

export interface SymbolRiskProfile {
  isOptimalForHour: boolean;
  isPremium: boolean;
  hourWinRate: number | null;
  isBTCOrSOL: boolean;
}

// 🎯 v12: Scalper pro — SL/TP adaptativo por volatilidade, R:R mínimo 1:2
export const useTradingCalculations = () => {
  
  // v12: Leverage 5-10x baseada em volatilidade
  const getLeverageForScalping = useCallback((volatility: number): number => {
    if (volatility > 8) return 10;
    if (volatility > 5) return 12;
    if (volatility > 3) return 15;
    if (volatility > 2) return 18;
    if (volatility > 1) return 20;
    return 25;
  }, []);

  const getLeverageForBalance = useCallback((balance: number, winRate: number): number => {
    let baseLeverage = 15;
    if (balance < 10) baseLeverage = 25;
    else if (balance < 20) baseLeverage = 20;
    else if (balance < 50) baseLeverage = 15;
    else baseLeverage = 12;

    if (winRate >= 60) baseLeverage = Math.min(baseLeverage + 3, 25);
    else if (winRate < 40) baseLeverage = Math.max(baseLeverage - 3, 10);

    return Math.max(10, Math.min(25, baseLeverage));
  }, []);

  // 💼 v12: Position sizing — 1% risco por trade
  const calculatePositionSize = useCallback((
    balance: number, 
    leverage: number, 
    volatility: number, 
    winRate: number, 
    currentOpenPositions: number,
    maxOpenPositions: number
  ) => {
    const RISK_PER_TRADE = 0.01;
    
    // v12: SL adaptativo por volatilidade
    const stopLossPct = getAdaptiveStopLoss(volatility);
    
    let usdSize = (balance * RISK_PER_TRADE) / stopLossPct;
    
    const maxUsdSize = balance * 0.20;
    usdSize = Math.min(usdSize, maxUsdSize);
    
    const minPositionSize = 2;
    usdSize = Math.max(minPositionSize, usdSize);
    
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

  // v12: SL adaptativo por volatilidade (não mais fixo)
  const getAdaptiveStopLoss = (volatility: number): number => {
    if (volatility > 8) return 0.006;  // 0.6% — mercado muito volátil
    if (volatility > 5) return 0.005;  // 0.5%
    if (volatility > 3) return 0.004;  // 0.4% — padrão
    if (volatility > 1) return 0.0035; // 0.35% — baixa vol
    return 0.003;                       // 0.3% — vol muito baixa
  };

  const calculateDynamicTrailingStop = useCallback((volatility: number): number => {
    if (volatility < 2) return 0.25;
    if (volatility < 5) return 0.35;
    if (volatility < 10) return 0.50;
    return 0.60;
  }, []);

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

  // 🛡️ v15: SL = min(ATR*1.2, swing structure) — stop mais apertado possível
  const calculateStopTakeProfit = useCallback((
    currentPrice: number,
    action: 'BUY' | 'SELL',
    atrPercent: number,
    _isScalpAsset: boolean,
    _mlConfig: any,
    highPrice?: number,
    lowPrice?: number,
    symbolProfile?: SymbolRiskProfile
  ): { stopLoss: string; takeProfit: string; stopLossPct: number; takeProfitPct: number } => {
    const atrValue = (atrPercent / 100) * currentPrice;
    
    // 1) SL por ATR
    const slATR = atrValue * 1.2;
    
    // 2) SL por estrutura (swing high/low)
    let slStructure = slATR; // fallback
    if (highPrice && lowPrice) {
      const lastSwing = action === 'BUY' ? lowPrice : highPrice;
      const buffer = (highPrice - lowPrice) * 0.1;
      slStructure = Math.abs(currentPrice - lastSwing) + buffer;
    }
    
    // 3) stop_final = min(sl_atr, sl_structure) — o mais apertado
    const slDistance = Math.min(slATR, slStructure);
    
    // Limites: 0.15% min, 0.6% max
    const slPctMin = 0.0015;
    const slPctMax = 0.006;
    let stopLossPct = slDistance / currentPrice;
    stopLossPct = Math.max(slPctMin, Math.min(slPctMax, stopLossPct));
    
    // TP = 2x ATR (mantém R:R favorável)
    const tpDistance = atrValue * 2.0;
    let takeProfitPct = tpDistance / currentPrice;
    // TP mínimo = 2x SL
    takeProfitPct = Math.max(takeProfitPct, stopLossPct * 2.0);
    
    let stopLoss: number, takeProfit: number;
    if (action === 'BUY') {
      stopLoss = currentPrice * (1 - stopLossPct);
      takeProfit = currentPrice * (1 + takeProfitPct);
    } else {
      stopLoss = currentPrice * (1 + stopLossPct);
      takeProfit = currentPrice * (1 - takeProfitPct);
    }

    const priceDecimals = currentPrice < 1 ? 6 : currentPrice < 100 ? 4 : 2;
    const usedSwing = slStructure < slATR;
    console.log(`🎯 v15 ${action} | SL_ATR: ${(slATR/currentPrice*100).toFixed(3)}% | SL_SWING: ${(slStructure/currentPrice*100).toFixed(3)}% | FINAL: ${(stopLossPct*100).toFixed(3)}%${usedSwing ? ' (swing)' : ' (atr)'} | TP: ${(takeProfitPct*100).toFixed(3)}%`);

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
