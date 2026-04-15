import { useCallback } from 'react';

export interface SymbolRiskProfile {
  isOptimalForHour: boolean;
  isPremium: boolean;
  hourWinRate: number | null;
  isBTCOrSOL: boolean;
}

// 🎯 v12: Scalper pro — SL/TP adaptativo por volatilidade, R:R mínimo 1:2
export const useTradingCalculations = () => {
  
  // v25: Leverage conservadora — stops precisam de espaço
  const getLeverageForScalping = useCallback((volatility: number): number => {
    if (volatility > 8) return 3;
    if (volatility > 5) return 4;
    if (volatility > 3) return 5;
    if (volatility > 2) return 5;
    if (volatility > 1) return 6;
    return 6;
  }, []);

  // v25: Leverage conservadora por saldo — max 5x
  const getLeverageForBalance = useCallback((balance: number, winRate: number): number => {
    let baseLeverage = 4;
    if (balance < 10) baseLeverage = 5;
    else if (balance < 20) baseLeverage = 5;
    else if (balance < 50) baseLeverage = 4;
    else baseLeverage = 3;

    if (winRate >= 65) baseLeverage = Math.min(baseLeverage + 1, 6);
    else if (winRate < 35) baseLeverage = Math.max(baseLeverage - 1, 2);

    return Math.max(2, Math.min(6, baseLeverage));
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

  // v25: SL adaptativo ALARGADO — stops apertados causavam 63% stop-out
  const getAdaptiveStopLoss = (volatility: number): number => {
    if (volatility > 8) return 0.020;  // 2.0% — mercado muito volátil
    if (volatility > 5) return 0.015;  // 1.5%
    if (volatility > 3) return 0.012;  // 1.2% — padrão
    if (volatility > 1) return 0.010;  // 1.0% — baixa vol
    return 0.008;                       // 0.8% — vol muito baixa
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

  // 🛡️ v25: SL ALARGADO + TP com R:R mínimo 2.5:1 — resolve PF 0.14 e stop-out 63%
  const calculateStopTakeProfit = useCallback((
    currentPrice: number,
    action: 'BUY' | 'SELL',
    atrPercent: number,
    _isScalpAsset: boolean,
    _mlConfig: any,
    highPrice?: number,
    lowPrice?: number,
    symbolProfile?: SymbolRiskProfile,
    signalQuality?: string,
    m5Support?: number,
    m5Resistance?: number
  ): { stopLoss: string; takeProfit: string; stopLossPct: number; takeProfitPct: number } => {
    const atrValue = (atrPercent / 100) * currentPrice;
    
    // 1) SL por ATR — usar 1.5x ATR para dar espaço ao preço respirar
    const slATR = atrValue * 1.5;
    
    // 2) SL por estrutura (swing high/low) — com buffer generoso
    let slStructure = slATR;
    if (highPrice && lowPrice) {
      const lastSwing = action === 'BUY' ? lowPrice : highPrice;
      const buffer = (highPrice - lowPrice) * 0.15; // 15% buffer (era 8%)
      slStructure = Math.abs(currentPrice - lastSwing) + buffer;
    }
    
    // 3) SL por S/R — buffer de 0.3% (era 0.15%)
    let slSR = slATR;
    if (action === 'BUY' && m5Support && m5Support > 0) {
      const srBuffer = m5Support * 0.003; // 0.3% buffer além do suporte
      slSR = currentPrice - (m5Support - srBuffer);
      if (slSR > 0 && slSR < slATR * 3) {
        console.log(`🟢 SL via Suporte: ${m5Support.toFixed(4)} - buffer = SL dist ${slSR.toFixed(4)}`);
      } else {
        slSR = slATR;
      }
    } else if (action === 'SELL' && m5Resistance && m5Resistance > 0) {
      const srBuffer = m5Resistance * 0.003;
      slSR = (m5Resistance + srBuffer) - currentPrice;
      if (slSR > 0 && slSR < slATR * 3) {
        console.log(`🔴 SL via Resistência: ${m5Resistance.toFixed(4)} + buffer = SL dist ${slSR.toFixed(4)}`);
      } else {
        slSR = slATR;
      }
    }
    
    // v25: stop_final = MEDIANA dos 3 (não o menor!) para evitar stops absurdamente apertados
    const slValues = [slATR, slStructure, slSR].sort((a, b) => a - b);
    const slDistance = slValues[1]; // mediana
    
    // v25: Bounds ALARGADOS: 0.6% min, 2.0% max (era 0.15%-0.50%)
    const slPctMin = 0.006;
    const slPctMax = 0.020;
    let stopLossPct = slDistance / currentPrice;
    stopLossPct = Math.max(slPctMin, Math.min(slPctMax, stopLossPct));
    
    // v25: TP com R:R mínimo 2.5:1 (era 2.0)
    let takeProfitPct: number;
    const minRR = signalQuality === 'premium' ? 3.0 : signalQuality === 'high' ? 2.5 : 2.5;
    const tpMultiplier = signalQuality === 'premium' ? 3.5 : signalQuality === 'high' ? 3.0 : 2.5;
    
    // Tentar usar S/R oposto como TP
    let usedSRForTP = false;
    if (action === 'BUY' && m5Resistance && m5Resistance > currentPrice) {
      const tpViaSR = (m5Resistance - currentPrice) / currentPrice;
      if (tpViaSR / stopLossPct >= minRR) {
        takeProfitPct = tpViaSR;
        usedSRForTP = true;
        console.log(`🎯 TP via Resistência: ${m5Resistance.toFixed(4)} (R:R ${(tpViaSR/stopLossPct).toFixed(1)})`);
      }
    } else if (action === 'SELL' && m5Support && m5Support < currentPrice) {
      const tpViaSR = (currentPrice - m5Support) / currentPrice;
      if (tpViaSR / stopLossPct >= minRR) {
        takeProfitPct = tpViaSR;
        usedSRForTP = true;
        console.log(`🎯 TP via Suporte: ${m5Support.toFixed(4)} (R:R ${(tpViaSR/stopLossPct).toFixed(1)})`);
      }
    }
    
    // Fallback: ATR-based TP
    if (!usedSRForTP) {
      const tpDistance = atrValue * tpMultiplier;
      takeProfitPct = tpDistance / currentPrice;
    }
    
    // v25: TP mínimo = minRR × SL (garante R:R 2.5+)
    takeProfitPct = Math.max(takeProfitPct!, stopLossPct * minRR);
    
    let stopLoss: number, takeProfit: number;
    if (action === 'BUY') {
      stopLoss = currentPrice * (1 - stopLossPct);
      takeProfit = currentPrice * (1 + takeProfitPct);
    } else {
      stopLoss = currentPrice * (1 + stopLossPct);
      takeProfit = currentPrice * (1 - takeProfitPct);
    }

    const priceDecimals = currentPrice < 1 ? 6 : currentPrice < 100 ? 4 : 2;
    const rr = (takeProfitPct / stopLossPct).toFixed(1);
    const slSource = slSR === slValues[1] ? 'S/R' : slStructure === slValues[1] ? 'swing' : 'ATR';
    console.log(`🎯 v25 ${action} | SL: ${(stopLossPct*100).toFixed(2)}%(${slSource}) | TP: ${(takeProfitPct*100).toFixed(2)}%(${usedSRForTP ? 'S/R' : 'ATR'}) | R:R ${rr}:1 | Quality: ${signalQuality}`);

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
