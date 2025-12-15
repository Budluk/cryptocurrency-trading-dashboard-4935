import { useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface SignalAnalysisResult {
  action: 'BUY' | 'SELL' | null;
  signalScore: number;
  buyScore: number;
  sellScore: number;
  confirmations: string[];
  shouldTrade: boolean;
  skipReason: string;
  signalQuality: 'low' | 'medium' | 'high' | 'premium';
  momentumScore: number;
  // Multi-timeframe data
  m1Signal?: 'buy' | 'sell' | 'hold';
  m5Support?: number;
  m5Resistance?: number;
  compositeScore?: number;
  aiConfidence?: number;
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
  // Optional comprehensive AI data
  comprehensiveAI?: {
    compositeScore: number;
    scalpingConfig: {
      action: 'buy' | 'sell' | 'wait';
      confidence: number;
      support5m: number;
      resistance5m: number;
    };
    technical: {
      m1: { signal: string; rsi: number; score: number };
      m5: { trend: string; support: number; resistance: number };
      alignment: string;
    };
    sentiment: { fearGreedIndex: number; signal: string };
    onChain: { signal: string; fundingRate: number };
  };
}

export const useSignalAnalysis = () => {
  const lastAIFetch = useRef<Map<string, number>>(new Map());
  const aiCache = useRef<Map<string, any>>(new Map());

  // Fetch comprehensive AI analysis
  const fetchComprehensiveAI = useCallback(async (symbol: string): Promise<any | null> => {
    const now = Date.now();
    const lastFetch = lastAIFetch.current.get(symbol) || 0;
    
    // Cache for 30 seconds
    if (now - lastFetch < 30000 && aiCache.current.has(symbol)) {
      return aiCache.current.get(symbol);
    }
    
    try {
      const { data, error } = await supabase.functions.invoke('ai-comprehensive-analysis', {
        body: { symbol },
      });
      
      if (!error && data?.success && data?.analysis) {
        lastAIFetch.current.set(symbol, now);
        aiCache.current.set(symbol, data.analysis);
        return data.analysis;
      }
    } catch (e) {
      console.log(`⚠️ AI fetch failed for ${symbol}`);
    }
    return null;
  }, []);

  const analyzeSignal = useCallback((params: AnalysisParams): SignalAnalysisResult => {
    const {
      currentPrice, highPrice, lowPrice, priceChange,
      volume24h, volatility, scoreThreshold, minConfirmations, currentBalance,
      comprehensiveAI
    } = params;

    const priceRange = highPrice - lowPrice;
    const atrPercent = (priceRange / currentPrice) * 100;
    const pricePosition = priceRange > 0 ? (currentPrice - lowPrice) / priceRange : 0.5;
    
    // Base validations
    const hasGoodVolume = volume24h > 50000;
    const hasVolumeSpike = volume24h > 1500000;
    const hasStrongVolume = volume24h > 800000;
    const hasGoodVolatility = volatility > 0.2;
    
    // Trends
    const isBullishTrend = priceChange > 1.5;
    const isBearishTrend = priceChange < -1.5;
    const isModerateBullish = priceChange > 0.8 && priceChange <= 1.5;
    const isModerateBearish = priceChange < -0.8 && priceChange >= -1.5;
    
    // Zones (SCALPING: use 5m S/R when available)
    let nearResistance = pricePosition > 0.80;
    let nearSupport = pricePosition < 0.20;
    
    if (comprehensiveAI?.scalpingConfig) {
      const { support5m, resistance5m } = comprehensiveAI.scalpingConfig;
      if (support5m > 0 && resistance5m > 0) {
        const range5m = resistance5m - support5m;
        if (range5m > 0) {
          const pos5m = (currentPrice - support5m) / range5m;
          nearSupport = pos5m < 0.25;
          nearResistance = pos5m > 0.75;
        }
      }
    }
    
    // Reversals
    const isOversold = priceChange < -3.5;
    const isOverbought = priceChange > 3.5;
    const isMildOversold = priceChange < -2.0 && priceChange >= -3.5;
    const isMildOverbought = priceChange > 2.0 && priceChange <= 3.5;
    
    const confirmations: string[] = [];
    
    // === BUY SIGNALS ===
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
    
    // === SELL SIGNALS ===
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
    
    // === COMPREHENSIVE AI BOOST ===
    let aiBoost = 0;
    let m1Signal: 'buy' | 'sell' | 'hold' | undefined;
    let m5Support: number | undefined;
    let m5Resistance: number | undefined;
    let compositeScore: number | undefined;
    let aiConfidence: number | undefined;
    
    if (comprehensiveAI) {
      compositeScore = comprehensiveAI.compositeScore;
      aiConfidence = comprehensiveAI.scalpingConfig?.confidence;
      m5Support = comprehensiveAI.scalpingConfig?.support5m;
      m5Resistance = comprehensiveAI.scalpingConfig?.resistance5m;
      m1Signal = comprehensiveAI.technical?.m1?.signal as any;
      
      // Boost from composite score
      if (compositeScore !== undefined) {
        if (compositeScore > 30) {
          buyScore += 25;
          confirmations.push(`🤖 AI: Score +${compositeScore.toFixed(0)}`);
          aiBoost += 25;
        } else if (compositeScore < -30) {
          sellScore += 25;
          confirmations.push(`🤖 AI: Score ${compositeScore.toFixed(0)}`);
          aiBoost += 25;
        } else if (Math.abs(compositeScore) > 15) {
          const boost = 15;
          if (compositeScore > 0) buyScore += boost;
          else sellScore += boost;
          aiBoost += boost;
        }
      }
      
      // Boost from on-chain
      if (comprehensiveAI.onChain?.signal === 'bullish') {
        buyScore += 15;
        confirmations.push('📊 On-Chain bullish');
      } else if (comprehensiveAI.onChain?.signal === 'bearish') {
        sellScore += 15;
        confirmations.push('📊 On-Chain bearish');
      }
      
      // Funding rate warning (contrarian)
      const funding = comprehensiveAI.onChain?.fundingRate || 0;
      if (funding > 0.03) {
        sellScore += 10;
        confirmations.push('💰 Funding alto - cautela longs');
      } else if (funding < -0.02) {
        buyScore += 10;
        confirmations.push('💰 Funding negativo - oportunidade');
      }
      
      // Sentiment boost (contrarian at extremes)
      const fgi = comprehensiveAI.sentiment?.fearGreedIndex || 50;
      if (fgi < 25) {
        buyScore += 15;
        confirmations.push('😱 Fear extremo - oportunidade');
      } else if (fgi > 75) {
        sellScore += 15;
        confirmations.push('🤑 Greed extremo - cautela');
      }
      
      // 1m signal confirmation
      if (m1Signal === 'buy') {
        buyScore += 12;
        confirmations.push('📈 1m: BUY signal');
      } else if (m1Signal === 'sell') {
        sellScore += 12;
        confirmations.push('📉 1m: SELL signal');
      }
      
      // Technical alignment bonus
      const alignment = comprehensiveAI.technical?.alignment;
      if (alignment === 'strong_buy') {
        buyScore += 20;
        confirmations.push('✅ Timeframes alinhados BUY');
      } else if (alignment === 'strong_sell') {
        sellScore += 20;
        confirmations.push('✅ Timeframes alinhados SELL');
      } else if (alignment === 'buy') {
        buyScore += 10;
      } else if (alignment === 'sell') {
        sellScore += 10;
      }
    }
    
    // Determine action
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
    
    // === QUALITY CRITERIA (SCALPING OPTIMIZED) ===
    const volumeCheck = volume24h > 100000;
    const volatilityCheck = volatility > 1.5 && volatility < 18;
    const atrMinCheck = atrPercent > 0.4 && atrPercent < 12;
    const priceMovementOk = Math.abs(priceChange) > 0.8 && Math.abs(priceChange) < 15;
    const hasStrongSignal = Math.abs(buyScore - sellScore) >= 12;
    
    // Momentum Score
    const momentumScore = Math.abs(priceChange) * (hasVolumeSpike ? 2 : hasStrongVolume ? 1.5 : 1);
    const momentumConfirmed = momentumScore > 2.0;

    // Volume direction (allow reversals at S/R)
    const reversalOk = (
      (action === 'BUY' && (isOversold || isMildOversold) && nearSupport) ||
      (action === 'SELL' && (isOverbought || isMildOverbought) && nearResistance)
    );

    const volumeDirectionOk = reversalOk ||
      (action === 'BUY' && priceChange > 0) ||
      (action === 'SELL' && priceChange < 0);
    
    // Signal quality classification
    let signalQuality: 'low' | 'medium' | 'high' | 'premium' = 'low';
    if (signalScore >= 80 && hasVolumeSpike && momentumConfirmed) signalQuality = 'premium';
    else if (signalScore >= 65 && hasStrongVolume && momentumConfirmed) signalQuality = 'high';
    else if (signalScore >= 50 && hasGoodVolume) signalQuality = 'medium';
    
    // AI can upgrade quality
    if (aiBoost >= 25 && signalQuality === 'medium') signalQuality = 'high';
    if (aiConfidence && aiConfidence > 75 && signalQuality !== 'premium') signalQuality = 'high';
    
    const shouldTrade = (
      signalScore >= scoreThreshold &&
      action !== null &&
      currentBalance > 2 &&
      confirmations.length >= minConfirmations &&
      volumeCheck &&
      volatilityCheck &&
      hasStrongSignal &&
      priceMovementOk &&
      (signalQuality !== 'low' || signalScore >= 70) &&
      volumeDirectionOk
    );

    // Skip reason
    let skipReason = '';
    if (!shouldTrade) {
      if (signalScore < scoreThreshold) skipReason = `Score ${signalScore}/${scoreThreshold}`;
      else if (!hasStrongSignal) skipReason = `Sinal fraco: diff=${Math.abs(buyScore - sellScore)}/12`;
      else if (!volumeDirectionOk) skipReason = 'Volume contra direção';
      else if (signalQuality === 'low' && signalScore < 70) skipReason = `Qualidade baixa: ${signalQuality}`;
      else if (!volumeCheck) skipReason = `Vol $${(volume24h/1e6).toFixed(2)}M < $0.1M`;
      else if (!volatilityCheck) skipReason = `Volatility ${volatility.toFixed(2)}% fora 1.5-18%`;
      else if (!atrMinCheck) skipReason = `ATR ${atrPercent.toFixed(2)}% fora 0.4-12%`;
      else if (!priceMovementOk) skipReason = `Move ${priceChange.toFixed(2)}% fora 0.8-15%`;
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
      signalQuality,
      momentumScore,
      m1Signal,
      m5Support,
      m5Resistance,
      compositeScore,
      aiConfidence,
    };
  }, []);

  return { analyzeSignal, fetchComprehensiveAI };
};
