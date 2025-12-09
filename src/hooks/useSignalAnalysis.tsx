import { useCallback } from 'react';

export interface SignalAnalysisResult {
  action: 'BUY' | 'SELL' | null;
  signalScore: number;
  buyScore: number;
  sellScore: number;
  confirmations: string[];
  shouldTrade: boolean;
  skipReason: string;
}

interface AnalysisParams {
  currentPrice: number;
  highPrice: number;
  lowPrice: number;
  priceChange: number;
  volume24h: number;
  volatility: number;
  scoreThreshold: number;
  minConfirmations: number;
  currentBalance: number;
}

export const useSignalAnalysis = () => {

  const analyzeSignal = useCallback((params: AnalysisParams): SignalAnalysisResult => {
    const {
      currentPrice, highPrice, lowPrice, priceChange,
      volume24h, volatility, scoreThreshold, minConfirmations, currentBalance
    } = params;

    const priceRange = highPrice - lowPrice;
    const atrPercent = (priceRange / currentPrice) * 100;
    const pricePosition = priceRange > 0 ? (currentPrice - lowPrice) / priceRange : 0.5;
    
    // Validações
    const hasGoodVolume = volume24h > 50000;
    const hasVolumeSpike = volume24h > 1500000;
    const hasStrongVolume = volume24h > 800000;
    const hasGoodVolatility = volatility > 0.2;
    
    // Tendências
    const isBullishTrend = priceChange > 1.5;
    const isBearishTrend = priceChange < -1.5;
    const isModerateBullish = priceChange > 0.8 && priceChange <= 1.5;
    const isModerateBearish = priceChange < -0.8 && priceChange >= -1.5;
    
    // Zonas
    const nearResistance = pricePosition > 0.80;
    const nearSupport = pricePosition < 0.20;
    
    // Reversões
    const isOversold = priceChange < -3.5;
    const isOverbought = priceChange > 3.5;
    const isMildOversold = priceChange < -2.0 && priceChange >= -3.5;
    const isMildOverbought = priceChange > 2.0 && priceChange <= 3.5;
    
    const confirmations: string[] = [];
    
    // === SINAIS DE COMPRA ===
    let buyScore = 0;
    
    if (isBullishTrend && hasVolumeSpike) {
      buyScore += 40;
      confirmations.push('Trend bullish + volume spike');
    } else if (isBullishTrend && hasStrongVolume) {
      buyScore += 33;
      confirmations.push('Trend bullish confirmado');
    } else if (isModerateBullish && hasVolumeSpike) {
      buyScore += 28;
      confirmations.push('Trend bullish moderado + volume');
    } else if (isModerateBullish && hasGoodVolume) {
      buyScore += 20;
      confirmations.push('Momentum bullish');
    } else if (isModerateBullish) {
      buyScore += 15;
      confirmations.push('Momentum bullish leve');
    }
    
    if (isOversold && nearSupport && hasVolumeSpike) {
      buyScore += 45;
      confirmations.push('Reversão bullish forte');
    } else if (isMildOversold && nearSupport) {
      buyScore += 30;
      confirmations.push('Zona de suporte detectada');
    } else if (nearSupport && hasStrongVolume) {
      buyScore += 23;
      confirmations.push('Suporte com volume');
    } else if (nearSupport) {
      buyScore += 15;
      confirmations.push('Zona de suporte');
    }
    
    if (pricePosition > 0.55 && priceChange > 1.0 && volatility > 1.0) {
      buyScore += 25;
      confirmations.push('Momentum bullish forte');
    } else if (pricePosition > 0.50 && priceChange > 0.5) {
      buyScore += 17;
      confirmations.push('Momentum positivo');
    } else if (priceChange > 0.3) {
      buyScore += 10;
      confirmations.push('Momentum leve');
    }
    
    if (atrPercent > 1.0 && atrPercent < 10) {
      buyScore += 20;
      confirmations.push('ATR ideal');
    } else if (atrPercent > 0.5 && atrPercent < 15) {
      buyScore += 12;
      confirmations.push('ATR aceitável');
    }
    
    // === SINAIS DE VENDA ===
    let sellScore = 0;
    
    if (isBearishTrend && hasVolumeSpike) {
      sellScore += 40;
      confirmations.push('Trend bearish + volume spike');
    } else if (isBearishTrend && hasStrongVolume) {
      sellScore += 33;
      confirmations.push('Trend bearish confirmado');
    } else if (isModerateBearish && hasVolumeSpike) {
      sellScore += 28;
      confirmations.push('Trend bearish moderado + volume');
    } else if (isModerateBearish && hasGoodVolume) {
      sellScore += 20;
      confirmations.push('Momentum bearish');
    } else if (isModerateBearish) {
      sellScore += 15;
      confirmations.push('Momentum bearish leve');
    }
    
    if (isOverbought && nearResistance && hasVolumeSpike) {
      sellScore += 45;
      confirmations.push('Reversão bearish forte');
    } else if (isMildOverbought && nearResistance) {
      sellScore += 30;
      confirmations.push('Zona de resistência detectada');
    } else if (nearResistance && hasStrongVolume) {
      sellScore += 23;
      confirmations.push('Resistência com volume');
    } else if (nearResistance) {
      sellScore += 15;
      confirmations.push('Zona de resistência');
    }
    
    if (pricePosition < 0.45 && priceChange < -1.0 && volatility > 1.0) {
      sellScore += 25;
      confirmations.push('Momentum bearish forte');
    } else if (pricePosition < 0.50 && priceChange < -0.5) {
      sellScore += 17;
      confirmations.push('Momentum negativo');
    } else if (priceChange < -0.3) {
      sellScore += 10;
      confirmations.push('Momentum leve negativo');
    }
    
    if (atrPercent > 1.0 && atrPercent < 10) {
      sellScore += 20;
    } else if (atrPercent > 0.5 && atrPercent < 15) {
      sellScore += 12;
    }
    
    // Determinar ação
    const strongCounterTrend = (buyScore >= scoreThreshold && isBearishTrend) || 
                                (sellScore >= scoreThreshold && isBullishTrend);
    
    let action: 'BUY' | 'SELL' | null = null;
    let signalScore = 0;
    
    if (buyScore > sellScore && buyScore >= scoreThreshold && !strongCounterTrend) {
      action = 'BUY';
      signalScore = buyScore;
    } else if (sellScore > buyScore && sellScore >= scoreThreshold && !strongCounterTrend) {
      action = 'SELL';
      signalScore = sellScore;
    }
    
    // Critérios MELHORADOS para reduzir perdas
    const volumeCheck = volume24h > 100000; // Mínimo $100k volume
    const volatilityCheck = volatility > 2.0 && volatility < 20; // Alta volatilidade (mínimo 2%)
    const atrMinCheck = atrPercent > 0.5 && atrPercent < 10; // ATR maior
    const priceMovementOk = Math.abs(priceChange) > 1.0 && Math.abs(priceChange) < 15; // Movimento forte
    const hasStrongSignal = Math.abs(buyScore - sellScore) >= 10; // Mínimo 10 pontos diferença
    
    const shouldTrade = (
      signalScore >= scoreThreshold &&
      action !== null &&
      currentBalance > 2 && // Mínimo $2
      confirmations.length >= minConfirmations &&
      volumeCheck &&
      volatilityCheck &&
      hasStrongSignal &&
      priceMovementOk
    );

    // Determinar razão do skip
    let skipReason = '';
    if (!shouldTrade) {
      if (signalScore < scoreThreshold) skipReason = `Score ${signalScore}/${scoreThreshold}`;
      else if (!hasStrongSignal) skipReason = `Sinal fraco: diff=${Math.abs(buyScore - sellScore)}/10`;
      else if (!volumeCheck) skipReason = `Vol $${(volume24h/1e6).toFixed(2)}M < $0.1M`;
      else if (!volatilityCheck) skipReason = `Volatility ${volatility.toFixed(2)}% fora 0.5-15%`;
      else if (!atrMinCheck) skipReason = `ATR ${atrPercent.toFixed(2)}% fora 0.3-8%`;
      else if (!priceMovementOk) skipReason = `Move ${priceChange.toFixed(2)}% fora 0.5-12%`;
      else if (action === null) skipReason = 'Sem ação definida';
      else if (currentBalance <= 2) skipReason = `Saldo $${currentBalance.toFixed(2)} < $2`;
      else if (confirmations.length < minConfirmations) skipReason = `Conf ${confirmations.length}/${minConfirmations}`;
      else skipReason = 'Outro filtro';
    }

    return {
      action,
      signalScore,
      buyScore,
      sellScore,
      confirmations,
      shouldTrade,
      skipReason,
    };
  }, []);

  return { analyzeSignal };
};
