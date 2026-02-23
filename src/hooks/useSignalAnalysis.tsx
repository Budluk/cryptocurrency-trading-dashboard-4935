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
  m1Signal?: 'buy' | 'sell' | 'hold';
  m5Support?: number;
  m5Resistance?: number;
  compositeScore?: number;
  aiConfidence?: number;
  marketRegime?: 'trending' | 'ranging' | 'volatile';
  pullbackReady?: boolean;
  btcAligned?: boolean;
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
  symbol?: string;
  btcPriceChange?: number; // BTC trend for correlation
  previousPrice?: number; // For pullback detection
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
      m15?: { trend: string };
      alignment: string;
    };
    sentiment: { fearGreedIndex: number; signal: string };
    onChain: { signal: string; fundingRate: number };
  };
}

// Cache para BTC data
const btcCache = {
  priceChange: 0,
  lastFetch: 0,
};

export const useSignalAnalysis = () => {
  const lastAIFetch = useRef<Map<string, number>>(new Map());
  const aiCache = useRef<Map<string, any>>(new Map());
  const priceHistory = useRef<Map<string, number[]>>(new Map());

  const fetchComprehensiveAI = useCallback(async (symbol: string): Promise<any | null> => {
    const now = Date.now();
    const lastFetch = lastAIFetch.current.get(symbol) || 0;
    
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

  // Fetch BTC trend for correlation check
  const fetchBTCTrend = useCallback(async (): Promise<number> => {
    const now = Date.now();
    if (now - btcCache.lastFetch < 60000) {
      return btcCache.priceChange;
    }

    try {
      const { data } = await supabase.functions.invoke('bybit-trading', {
        body: { action: 'get_tickers', isTestnet: false, params: { category: 'linear', symbol: 'BTCUSDT' } }
      });
      
      if (data?.success && data?.data?.list?.[0]) {
        btcCache.priceChange = parseFloat(data.data.list[0].price24hPcnt || 0) * 100;
        btcCache.lastFetch = now;
      }
    } catch (e) {
      console.log('⚠️ BTC fetch failed');
    }
    return btcCache.priceChange;
  }, []);

  // Detect market regime (trending vs ranging vs volatile)
  const detectMarketRegime = useCallback((
    priceChange: number,
    volatility: number,
    atrPercent: number,
    pricePosition: number
  ): 'trending' | 'ranging' | 'volatile' => {
    // High volatility = volatile market
    if (volatility > 12 || atrPercent > 8) {
      return 'volatile';
    }
    
    // Strong directional move = trending
    if (Math.abs(priceChange) > 2.0) {
      return 'trending';
    }
    
    // Low volatility + price in middle = ranging
    if (volatility < 3 && pricePosition > 0.3 && pricePosition < 0.7 && Math.abs(priceChange) < 1.5) {
      return 'ranging';
    }
    
    // Default to trending if there's movement
    if (Math.abs(priceChange) > 0.8) {
      return 'trending';
    }
    
    return 'ranging';
  }, []);

  // Check if price has pulled back (not chasing)
  const checkPullback = useCallback((
    symbol: string,
    currentPrice: number,
    action: 'BUY' | 'SELL' | null,
    priceChange: number
  ): boolean => {
    const history = priceHistory.current.get(symbol) || [];
    
    // Update price history (keep last 10 prices)
    history.push(currentPrice);
    if (history.length > 10) history.shift();
    priceHistory.current.set(symbol, history);
    
    if (history.length < 3) return true; // Not enough data, allow entry
    
    const recentHigh = Math.max(...history.slice(-5));
    const recentLow = Math.min(...history.slice(-5));
    const recentRange = recentHigh - recentLow;
    
    if (recentRange === 0) return true;
    
    // For BUY: price should have pulled back from recent high (not at top)
    if (action === 'BUY') {
      const pullbackFromHigh = (recentHigh - currentPrice) / recentRange;
      // Allow if pulled back at least 20% from recent high OR if overall bearish (bounce)
      return pullbackFromHigh >= 0.15 || priceChange < -0.5;
    }
    
    // For SELL: price should have bounced from recent low (not at bottom)
    if (action === 'SELL') {
      const bounceFromLow = (currentPrice - recentLow) / recentRange;
      // Allow if bounced at least 20% from recent low OR if overall bullish (top)
      return bounceFromLow >= 0.15 || priceChange > 0.5;
    }
    
    return true;
  }, []);

  // Check BTC correlation (don't trade alts against BTC)
  const checkBTCCorrelation = useCallback((
    symbol: string,
    action: 'BUY' | 'SELL' | null,
    btcPriceChange: number
  ): boolean => {
    // BTC and stablecoins don't need correlation check
    if (symbol.includes('BTC') || symbol.includes('USD')) return true;
    
    // If BTC is moving strongly, alts should follow
    const btcStrong = Math.abs(btcPriceChange) > 2;
    
    if (btcStrong) {
      // BTC pumping hard - don't short alts
      if (btcPriceChange > 3 && action === 'SELL') {
        return false;
      }
      // BTC dumping hard - don't long alts
      if (btcPriceChange < -3 && action === 'BUY') {
        return false;
      }
    }
    
    return true;
  }, []);

  // Check trading hours - crypto opera 24/7, sem bloqueio
  const checkTradingHours = useCallback((): { isGoodHour: boolean; reason: string } => {
    // Crypto opera 24/7 - não bloquear nenhum horário
    return { isGoodHour: true, reason: 'Crypto 24/7' };
  }, []);

  // Check multi-timeframe alignment
  const checkMultiTimeframeAlignment = useCallback((
    comprehensiveAI: AnalysisParams['comprehensiveAI'],
    action: 'BUY' | 'SELL' | null
  ): { aligned: boolean; strength: number } => {
    if (!comprehensiveAI?.technical) {
      return { aligned: true, strength: 0 };
    }

    const { m1, m5, m15, alignment } = comprehensiveAI.technical;
    
    let alignedCount = 0;
    let totalChecks = 0;

    // Check M1
    if (m1?.signal) {
      totalChecks++;
      if ((action === 'BUY' && m1.signal === 'buy') || 
          (action === 'SELL' && m1.signal === 'sell')) {
        alignedCount++;
      }
    }

    // Check M5 trend
    if (m5?.trend) {
      totalChecks++;
      if ((action === 'BUY' && (m5.trend === 'bullish' || m5.trend === 'strong_bullish')) ||
          (action === 'SELL' && (m5.trend === 'bearish' || m5.trend === 'strong_bearish'))) {
        alignedCount++;
      }
    }

    // Check M15 if available
    if (m15?.trend) {
      totalChecks++;
      if ((action === 'BUY' && (m15.trend === 'bullish' || m15.trend === 'strong_bullish')) ||
          (action === 'SELL' && (m15.trend === 'bearish' || m15.trend === 'strong_bearish'))) {
        alignedCount++;
      }
    }

    // Check overall alignment
    if (alignment) {
      if ((action === 'BUY' && (alignment === 'strong_buy' || alignment === 'buy')) ||
          (action === 'SELL' && (alignment === 'strong_sell' || alignment === 'sell'))) {
        alignedCount++;
      }
      totalChecks++;
    }

    const strength = totalChecks > 0 ? alignedCount / totalChecks : 0;
    const aligned = strength >= 0.5; // At least 50% timeframes aligned

    return { aligned, strength };
  }, []);

  const analyzeSignal = useCallback((params: AnalysisParams): SignalAnalysisResult => {
    const {
      currentPrice, highPrice, lowPrice, priceChange,
      volume24h, volatility, scoreThreshold, minConfirmations, currentBalance,
      comprehensiveAI, symbol, btcPriceChange
    } = params;

    const priceRange = highPrice - lowPrice;
    const atrPercent = (priceRange / currentPrice) * 100;
    const pricePosition = priceRange > 0 ? (currentPrice - lowPrice) / priceRange : 0.5;
    
    // === MARKET REGIME DETECTION ===
    const marketRegime = detectMarketRegime(priceChange, volatility, atrPercent, pricePosition);
    
    // === TRADING HOURS CHECK ===
    const { isGoodHour, reason: hourReason } = checkTradingHours();
    
    // === VALIDAÇÕES BASE ===
    const hasMinVolume = volume24h > 80000;
    const hasGoodVolume = volume24h > 300000;
    const hasStrongVolume = volume24h > 700000;
    const hasVolumeSpike = volume24h > 1500000;
    
    // Volatilidade ideal (ajustada por regime)
    const volInRange = marketRegime === 'volatile' 
      ? volatility > 2 && volatility < 25  // Mais tolerante em mercado volátil
      : volatility > 0.5 && volatility < 18;
    const volIdeal = volatility > 1.5 && volatility < 10;
    
    // === ANÁLISE DE TENDÊNCIA ===
    const strongBullish = priceChange > 2.5;
    const bullish = priceChange > 1.2;
    const mildBullish = priceChange > 0.5;
    
    const strongBearish = priceChange < -2.5;
    const bearish = priceChange < -1.2;
    const mildBearish = priceChange < -0.5;
    
    // === ZONAS DE S/R ===
    let nearSupport = pricePosition < 0.20;
    let nearResistance = pricePosition > 0.80;
    let inMiddle = pricePosition >= 0.35 && pricePosition <= 0.65;
    
    if (comprehensiveAI?.scalpingConfig) {
      const { support5m, resistance5m } = comprehensiveAI.scalpingConfig;
      if (support5m > 0 && resistance5m > 0) {
        const range5m = resistance5m - support5m;
        if (range5m > 0) {
          const pos5m = (currentPrice - support5m) / range5m;
          nearSupport = pos5m < 0.20;
          nearResistance = pos5m > 0.80;
          inMiddle = pos5m >= 0.35 && pos5m <= 0.65;
        }
      }
    }
    
    // === CONDIÇÕES DE REVERSÃO ===
    const oversold = priceChange < -4.0;
    const mildOversold = priceChange < -2.5 && priceChange >= -4.0;
    const overbought = priceChange > 4.0;
    const mildOverbought = priceChange > 2.5 && priceChange <= 4.0;
    
    const confirmations: string[] = [];
    
    // === PENALIDADES PARA MERCADO RANGING ===
    const rangingPenalty = marketRegime === 'ranging' ? 0.7 : 1;
    
    // === PONTUAÇÃO BUY ===
    let buyScore = 0;
    
    // 1. Tendência + Volume
    if (strongBullish && hasVolumeSpike) {
      buyScore += 35 * rangingPenalty;
      confirmations.push('📈 Tendência forte + volume spike');
    } else if (bullish && hasStrongVolume) {
      buyScore += 28 * rangingPenalty;
      confirmations.push('📈 Tendência bullish confirmada');
    } else if (bullish && hasGoodVolume) {
      buyScore += 22 * rangingPenalty;
      confirmations.push('📈 Tendência bullish');
    } else if (mildBullish && hasStrongVolume) {
      buyScore += 18 * rangingPenalty;
      confirmations.push('Momentum bullish + volume');
    }
    
    // 2. Reversão em suporte (sempre ok, mesmo em ranging)
    if (oversold && nearSupport && hasVolumeSpike) {
      buyScore += 40;
      confirmations.push('🔄 Reversão forte no suporte');
    } else if (mildOversold && nearSupport && hasStrongVolume) {
      buyScore += 32;
      confirmations.push('🔄 Reversão no suporte');
    } else if (nearSupport && !bearish && hasGoodVolume) {
      buyScore += 20;
      confirmations.push('📍 Zona de suporte + volume');
    }
    
    // 3. Momentum
    if (pricePosition > 0.55 && mildBullish && volIdeal) {
      buyScore += 20 * rangingPenalty;
      confirmations.push('⚡ Momentum forte');
    } else if (pricePosition > 0.45 && priceChange > 0.3 && volInRange) {
      buyScore += 12 * rangingPenalty;
      confirmations.push('Momentum positivo');
    }
    
    // 4. ATR ideal
    if (atrPercent > 1.5 && atrPercent < 6) {
      buyScore += 15;
      confirmations.push('ATR ideal para scalp');
    } else if (atrPercent > 0.8 && atrPercent < 10) {
      buyScore += 8;
    }
    
    // === PONTUAÇÃO SELL ===
    let sellScore = 0;
    
    // 1. Tendência + Volume
    if (strongBearish && hasVolumeSpike) {
      sellScore += 35 * rangingPenalty;
      confirmations.push('📉 Tendência forte + volume spike');
    } else if (bearish && hasStrongVolume) {
      sellScore += 28 * rangingPenalty;
      confirmations.push('📉 Tendência bearish confirmada');
    } else if (bearish && hasGoodVolume) {
      sellScore += 22 * rangingPenalty;
      confirmations.push('📉 Tendência bearish');
    } else if (mildBearish && hasStrongVolume) {
      sellScore += 18 * rangingPenalty;
      confirmations.push('Momentum bearish + volume');
    }
    
    // 2. Reversão em resistência
    if (overbought && nearResistance && hasVolumeSpike) {
      sellScore += 40;
      confirmations.push('🔄 Reversão forte na resistência');
    } else if (mildOverbought && nearResistance && hasStrongVolume) {
      sellScore += 32;
      confirmations.push('🔄 Reversão na resistência');
    } else if (nearResistance && !bullish && hasGoodVolume) {
      sellScore += 20;
      confirmations.push('📍 Zona de resistência + volume');
    }
    
    // 3. Momentum
    if (pricePosition < 0.45 && mildBearish && volIdeal) {
      sellScore += 20 * rangingPenalty;
      confirmations.push('⚡ Momentum bearish forte');
    } else if (pricePosition < 0.55 && priceChange < -0.3 && volInRange) {
      sellScore += 12 * rangingPenalty;
      confirmations.push('Momentum negativo');
    }
    
    // 4. ATR
    if (atrPercent > 1.5 && atrPercent < 6) {
      sellScore += 15;
    } else if (atrPercent > 0.8 && atrPercent < 10) {
      sellScore += 8;
    }
    
    // === AI BOOST ===
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
      
      if (compositeScore !== undefined && aiConfidence && aiConfidence > 60) {
        if (compositeScore > 35 && buyScore > sellScore) {
          buyScore += 20;
          confirmations.push(`🤖 AI bullish: ${compositeScore.toFixed(0)}%`);
          aiBoost = 20;
        } else if (compositeScore < -35 && sellScore > buyScore) {
          sellScore += 20;
          confirmations.push(`🤖 AI bearish: ${compositeScore.toFixed(0)}%`);
          aiBoost = 20;
        }
      }
      
      // On-chain
      if (comprehensiveAI.onChain?.signal === 'bullish' && buyScore > sellScore) {
        buyScore += 10;
        confirmations.push('📊 On-Chain bullish');
      } else if (comprehensiveAI.onChain?.signal === 'bearish' && sellScore > buyScore) {
        sellScore += 10;
        confirmations.push('📊 On-Chain bearish');
      }
      
      // Funding rate
      const funding = comprehensiveAI.onChain?.fundingRate || 0;
      if (funding > 0.05 && sellScore > buyScore) {
        sellScore += 8;
        confirmations.push('💰 Funding muito alto');
      } else if (funding < -0.03 && buyScore > sellScore) {
        buyScore += 8;
        confirmations.push('💰 Funding negativo');
      }
      
      // Sentiment
      const fgi = comprehensiveAI.sentiment?.fearGreedIndex || 50;
      if (fgi < 20 && buyScore > sellScore) {
        buyScore += 12;
        confirmations.push('😱 Fear extremo');
      } else if (fgi > 80 && sellScore > buyScore) {
        sellScore += 12;
        confirmations.push('🤑 Greed extremo');
      }
      
      // 1m signal
      if (m1Signal === 'buy' && buyScore > sellScore) {
        buyScore += 10;
        confirmations.push('📈 1m BUY');
      } else if (m1Signal === 'sell' && sellScore > buyScore) {
        sellScore += 10;
        confirmations.push('📉 1m SELL');
      }
    }
    
    // === DETERMINAR AÇÃO (SWING: mais rigoroso) ===
    const scoreDiff = Math.abs(buyScore - sellScore);
    const minDiff = 12; // SWING: diferença maior para evitar sinais fracos
    
    let action: 'BUY' | 'SELL' | null = null;
    let signalScore = 0;
    
    // Threshold dinâmico baseado em volatilidade (relaxado)
    const volatilityAdjustedThreshold = volatility > 10 
      ? scoreThreshold + 8 
      : volatility > 6 
        ? scoreThreshold + 4 
        : scoreThreshold;
    
    if (scoreDiff >= minDiff) {
      if (buyScore > sellScore && buyScore >= volatilityAdjustedThreshold) {
        action = 'BUY';
        signalScore = buyScore;
      } else if (sellScore > buyScore && sellScore >= volatilityAdjustedThreshold) {
        action = 'SELL';
        signalScore = sellScore;
      }
    }
    
    // === MULTI-TIMEFRAME ALIGNMENT ===
    const { aligned: tfAligned, strength: tfStrength } = checkMultiTimeframeAlignment(comprehensiveAI, action);
    
    // Boost se aligned, penalidade leve se não
    if (tfAligned && tfStrength >= 0.6) {
      signalScore = Math.round(signalScore * 1.15);
      confirmations.push(`✅ ${Math.round(tfStrength * 100)}% TFs`);
    } else if (!tfAligned && tfStrength < 0.3) {
      signalScore = Math.round(signalScore * 0.85);
    }
    
    // === PULLBACK CHECK (flexível) ===
    const pullbackReady = symbol ? checkPullback(symbol, currentPrice, action, priceChange) : true;
    
    // === BTC CORRELATION ===
    const btcAligned = btcPriceChange !== undefined && symbol 
      ? checkBTCCorrelation(symbol, action, btcPriceChange) 
      : true;
    
    // === FILTROS ===
    const volumeOk = hasMinVolume;
    const volatilityOk = volInRange;
    const atrOk = atrPercent > 0.3 && atrPercent < 15;
    const priceMovementOk = Math.abs(priceChange) > 0.2 && Math.abs(priceChange) < 18;
    
    const momentumScore = Math.abs(priceChange) * (hasVolumeSpike ? 2.5 : hasStrongVolume ? 1.8 : hasGoodVolume ? 1.3 : 1);
    const momentumOk = momentumScore > 0.6;
    
    // Reversões com volume forte
    const isReversal = (
      (action === 'BUY' && (oversold || mildOversold) && nearSupport && hasStrongVolume) ||
      (action === 'SELL' && (overbought || mildOverbought) && nearResistance && hasStrongVolume)
    );
    
    // Momentum trade
    const isMomentumTrade = (
      (action === 'BUY' && priceChange > 1.5 && hasStrongVolume) ||
      (action === 'SELL' && priceChange < -1.5 && hasStrongVolume)
    );
    
    const volumeDirectionOk = isReversal || isMomentumTrade ||
      (action === 'BUY' && priceChange > 0.3) ||
      (action === 'SELL' && priceChange < -0.3);
    
    const positionOk = !inMiddle || scoreDiff >= 15 || isReversal || isMomentumTrade || signalScore >= 50;
    
    // === CLASSIFICAÇÃO DE QUALIDADE (SWING: mais rigoroso) ===
    let signalQuality: 'low' | 'medium' | 'high' | 'premium' = 'low';
    
    // Premium: sinais excepcionais (SWING: requer mais)
    if (signalScore >= 80 && hasVolumeSpike && (isReversal || isMomentumTrade) && scoreDiff >= 25) {
      signalQuality = 'premium';
    }
    // High: sinais bons (SWING: requer mais)
    else if (signalScore >= 65 && hasStrongVolume && scoreDiff >= 18) {
      signalQuality = 'high';
    }
    else if (signalScore >= 60 && hasVolumeSpike && scoreDiff >= 15) {
      signalQuality = 'high';
    }
    // Medium: sinais decentes (SWING: requer mais)
    else if (signalScore >= 50 && hasGoodVolume && scoreDiff >= 14) {
      signalQuality = 'medium';
    }
    else if (signalScore >= 48 && hasStrongVolume && scoreDiff >= 12) {
      signalQuality = 'medium';
    }
    else if (signalScore >= 45 && (isReversal || isMomentumTrade) && hasVolumeSpike) {
      signalQuality = 'medium';
    }
    
    // AI upgrade
    if (aiBoost >= 10 && signalQuality === 'low' && signalScore >= 35) signalQuality = 'medium';
    if (aiBoost >= 15 && signalQuality === 'medium' && signalScore >= 50) signalQuality = 'high';
    if (aiConfidence && aiConfidence > 70 && signalQuality === 'medium') signalQuality = 'high';
    
    // === BLOQUEIO DE RANGING (apenas se score baixo) ===
    const rangingBlocked = marketRegime === 'ranging' && !isReversal && signalScore < 50;
    
    // === DECISÃO FINAL (RELAXADO para operar) ===
    const shouldTrade = (
      action !== null &&
      signalScore >= volatilityAdjustedThreshold &&
      scoreDiff >= minDiff &&
      currentBalance > 2 &&
      confirmations.length >= Math.max(1, minConfirmations - 1) &&
      volumeOk &&
      (volatilityOk || isReversal || isMomentumTrade) &&
      atrOk &&
      priceMovementOk &&
      (momentumOk || isReversal || signalScore >= 45) &&
      (volumeDirectionOk || signalScore >= 50) &&
      (positionOk || signalScore >= 45) &&
      (signalQuality !== 'low' || signalScore >= 40) &&
      (pullbackReady || isReversal || isMomentumTrade || signalScore >= 50) &&
      (btcAligned || isReversal || isMomentumTrade || signalScore >= 50) &&
      !rangingBlocked
    );

    // Skip reason
    let skipReason = '';
    if (!shouldTrade) {
      if (action === null) skipReason = 'Sem sinal claro';
      else if (signalScore < scoreThreshold) skipReason = `Score ${signalScore}/${scoreThreshold}`;
      else if (scoreDiff < minDiff) skipReason = `Diff ${scoreDiff}/${minDiff}`;
      else if (signalQuality === 'low') skipReason = 'Qualidade baixa';
      else if (!volumeOk) skipReason = `Vol $${(volume24h/1e6).toFixed(2)}M`;
      else if (!priceMovementOk) skipReason = `Move ${priceChange.toFixed(1)}%`;
      else if (!momentumOk && !isReversal && signalScore < 50) skipReason = `Momentum ${momentumScore.toFixed(1)}`;
      else if (!pullbackReady && !isReversal && !isMomentumTrade && signalScore < 50) skipReason = '⏳ Aguardando pullback';
      else if (!btcAligned && !isReversal && !isMomentumTrade && signalScore < 55) skipReason = '🪙 BTC contrário';
      else if (!isGoodHour && !isReversal && !isMomentumTrade && signalScore < 55) skipReason = `⏰ ${hourReason}`;
      else if (currentBalance <= 2) skipReason = `Saldo $${currentBalance.toFixed(2)}`;
      else skipReason = 'Filtro geral';
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
      marketRegime,
      pullbackReady,
      btcAligned,
    };
  }, [detectMarketRegime, checkTradingHours, checkMultiTimeframeAlignment, checkPullback, checkBTCCorrelation]);

  return { analyzeSignal, fetchComprehensiveAI, fetchBTCTrend };
};
