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

  // 💼 v20: Position sizing — score-weighted risk (1-2% per trade)
  const calculatePositionSize = useCallback((
    balance: number, 
    leverage: number, 
    volatility: number, 
    winRate: number, 
    currentOpenPositions: number,
    maxOpenPositions: number,
    signalScore?: number,
    signalQuality?: string
  ) => {
    // v20: Risk scales with signal quality
    let RISK_PER_TRADE = 0.01; // base 1%
    if (signalQuality === 'premium') RISK_PER_TRADE = 0.02;      // 2% for premium
    else if (signalQuality === 'high') RISK_PER_TRADE = 0.015;    // 1.5% for high
    // medium stays at 1%
    
    // Bonus for high win rate
    if (winRate >= 60) RISK_PER_TRADE *= 1.15;
    
    const stopLossPct = getAdaptiveStopLoss(volatility);
    
    let usdSize = (balance * RISK_PER_TRADE) / stopLossPct;
    
    // v20: Max size scales with quality too
    const maxPct = signalQuality === 'premium' ? 0.30 : signalQuality === 'high' ? 0.25 : 0.20;
    const maxUsdSize = balance * maxPct;
    usdSize = Math.min(usdSize, maxUsdSize);
    
    const minPositionSize = 2;
    usdSize = Math.max(minPositionSize, usdSize);
    
    const positionSizeMultiplier = currentOpenPositions === 0 
      ? 1.0 
      : Math.max(0.5, 1 - (currentOpenPositions / maxOpenPositions) * 0.3);
    usdSize *= positionSizeMultiplier;
    
    const marginPerPosition = balance / Math.min(maxOpenPositions, 10);
    
    console.log(`💰 v20 Size | Quality: ${signalQuality} | Risk: ${(RISK_PER_TRADE*100).toFixed(1)}% | USD: $${usdSize.toFixed(2)} | MaxPct: ${(maxPct*100)}%`);
    
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

  // 🛡️ v20: SL tight + TP generous — maximize R:R for profit
  const calculateStopTakeProfit = useCallback((
    currentPrice: number,
    action: 'BUY' | 'SELL',
    atrPercent: number,
    _isScalpAsset: boolean,
    _mlConfig: any,
    highPrice?: number,
    lowPrice?: number,
    symbolProfile?: SymbolRiskProfile,
    signalQuality?: string
  ): { stopLoss: string; takeProfit: string; stopLossPct: number; takeProfitPct: number } => {
    const atrValue = (atrPercent / 100) * currentPrice;
    
    // 1) SL por ATR (tighter: 1.0x instead of 1.2x)
    const slATR = atrValue * 1.0;
    
    // 2) SL por estrutura (swing high/low)
    let slStructure = slATR;
    if (highPrice && lowPrice) {
      const lastSwing = action === 'BUY' ? lowPrice : highPrice;
      const buffer = (highPrice - lowPrice) * 0.08;
      slStructure = Math.abs(currentPrice - lastSwing) + buffer;
    }
    
    // 3) stop_final = min(sl_atr, sl_structure)
    const slDistance = Math.min(slATR, slStructure);
    
    // v20: Tighter bounds: 0.15% min, 0.50% max (was 0.60%)
    const slPctMin = 0.0015;
    const slPctMax = 0.005;
    let stopLossPct = slDistance / currentPrice;
    stopLossPct = Math.max(slPctMin, Math.min(slPctMax, stopLossPct));
    
    // v20: TP = 2.5x ATR (was 2.0x) — more room for profit
    const tpMultiplier = signalQuality === 'premium' ? 3.0 : signalQuality === 'high' ? 2.5 : 2.0;
    const tpDistance = atrValue * tpMultiplier;
    let takeProfitPct = tpDistance / currentPrice;
    
    // TP mínimo = 2x SL (garantia de R:R 2:1)
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
    const rr = (takeProfitPct / stopLossPct).toFixed(1);
    console.log(`🎯 v20 ${action} | SL: ${(stopLossPct*100).toFixed(3)}%${usedSwing ? '(swing)' : '(atr)'} | TP: ${(takeProfitPct*100).toFixed(3)}% (${tpMultiplier}x ATR) | R:R ${rr}:1 | Quality: ${signalQuality}`);

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
