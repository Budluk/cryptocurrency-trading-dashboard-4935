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
    if (volatility > 8) return 5;
    if (volatility > 5) return 6;
    if (volatility > 3) return 7;
    if (volatility > 2) return 8;
    if (volatility > 1) return 9;
    return 10;
  }, []);

  const getLeverageForBalance = useCallback((balance: number, winRate: number): number => {
    let baseLeverage = 7;
    if (balance < 10) baseLeverage = 10;
    else if (balance < 20) baseLeverage = 8;
    else if (balance < 50) baseLeverage = 7;
    else baseLeverage = 5;

    if (winRate >= 60) baseLeverage = Math.min(baseLeverage + 1, 10);
    else if (winRate < 40) baseLeverage = Math.max(baseLeverage - 1, 5);

    return Math.max(5, Math.min(10, baseLeverage));
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

  // 🛡️ v12: SL/TP ADAPTATIVO por volatilidade — R:R mínimo 1:2
  const calculateStopTakeProfit = useCallback((
    currentPrice: number,
    action: 'BUY' | 'SELL',
    _atrPercent: number,
    _isScalpAsset: boolean,
    _mlConfig: any,
    _highPrice?: number,
    _lowPrice?: number,
    symbolProfile?: SymbolRiskProfile
  ): { stopLoss: string; takeProfit: string; stopLossPct: number; takeProfitPct: number } => {
    // v12: SL adaptativo baseado em volatilidade/perfil
    let stopLossPct: number;
    let rrRatio = 2.0; // R:R mínimo 1:2

    if (symbolProfile?.isBTCOrSOL) {
      // BTC/SOL: stops mais conservadores
      stopLossPct = 0.004; // 0.4%
    } else if (_atrPercent > 8) {
      stopLossPct = 0.006; // 0.6% alta vol
    } else if (_atrPercent > 5) {
      stopLossPct = 0.005; // 0.5%
    } else if (_atrPercent > 3) {
      stopLossPct = 0.004; // 0.4% padrão
    } else if (_atrPercent > 1) {
      stopLossPct = 0.0035; // 0.35%
    } else {
      stopLossPct = 0.003; // 0.3% vol baixa
    }

    const takeProfitPct = stopLossPct * rrRatio;

    let stopLoss: number, takeProfit: number;
    if (action === 'BUY') {
      stopLoss = currentPrice * (1 - stopLossPct);
      takeProfit = currentPrice * (1 + takeProfitPct);
    } else {
      stopLoss = currentPrice * (1 + stopLossPct);
      takeProfit = currentPrice * (1 - takeProfitPct);
    }

    const priceDecimals = currentPrice < 1 ? 6 : currentPrice < 100 ? 4 : 2;
    console.log(`🎯 v12 ${action} SL: ${(stopLossPct * 100).toFixed(2)}% | TP: ${(takeProfitPct * 100).toFixed(2)}% | R:R 1:${rrRatio}`);

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
