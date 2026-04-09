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
  btcPriceChange?: number;
  previousPrice?: number;
  comprehensiveAI?: {
    compositeScore: number;
    scalpingConfig: {
      action: 'buy' | 'sell' | 'wait';
      confidence: number;
      support5m: number;
      resistance5m: number;
    };
    technical: {
      m1: { 
        signal: string; rsi: number; score: number;
        emaCrossover?: string; volumeAboveAvg?: boolean; volumeRatio?: number;
        isLateral?: boolean; priceAboveVwap?: boolean; priceBelowVwap?: boolean;
        ema?: { ema9: number; ema21: number; ema50: number };
        vwap?: number;
        macd?: { histogram: number };
      };
      m5: { 
        trend: string; support: number; resistance: number;
        emaCrossover?: string; isLateral?: boolean;
        rsi?: number;
      };
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

  // ============================================================
  // v17: PULLBACK ENTRY + PRECISION SCALPING
  // Entrar em PULLBACKS para suporte/EMA, não perseguir momentum
  // ============================================================
  const analyzeSignal = useCallback((params: AnalysisParams): SignalAnalysisResult => {
    const {
      currentPrice, highPrice, lowPrice, priceChange,
      volume24h, volatility, scoreThreshold, minConfirmations, currentBalance,
      comprehensiveAI, symbol, btcPriceChange
    } = params;

    const confirmations: string[] = [];
    const priceRange = highPrice - lowPrice;
    const atrPercent = (priceRange / currentPrice) * 100;
    
    // === EXTRACT INDICATORS FROM AI ===
    const m1 = comprehensiveAI?.technical?.m1;
    const m5 = comprehensiveAI?.technical?.m5;
    const aiConfidence = comprehensiveAI?.scalpingConfig?.confidence;
    const compositeScore = comprehensiveAI?.compositeScore;
    const m5Support = comprehensiveAI?.scalpingConfig?.support5m;
    const m5Resistance = comprehensiveAI?.scalpingConfig?.resistance5m;
    
    // If no AI data, skip
    if (!m1 || !m5) {
      return {
        action: null, signalScore: 0, buyScore: 0, sellScore: 0,
        confirmations: [], shouldTrade: false, skipReason: '⏳ Sem dados AI',
        signalQuality: 'low', momentumScore: 0,
        marketRegime: 'ranging', pullbackReady: false, btcAligned: true,
      };
    }
    
    // === INDICATOR VALUES ===
    const rsi = m1.rsi ?? 50;
    const emaCrossover = m1.emaCrossover || 'below';
    const volumeAboveAvg = m1.volumeAboveAvg ?? false;
    const isLateral = m1.isLateral ?? false;
    const priceAboveVwap = m1.priceAboveVwap ?? false;
    const priceBelowVwap = m1.priceBelowVwap ?? false;
    const m5Trend = m5.trend || 'sideways';
    const m5Lateral = m5.isLateral ?? false;
    const volumeRatio = m1.volumeRatio ?? 1.0;
    const ema9 = m1.ema?.ema9 ?? 0;
    const ema21 = m1.ema?.ema21 ?? 0;
    const ema50 = m1.ema?.ema50 ?? 0;
    const vwap = m1.vwap ?? currentPrice;
    const m5Rsi = m5.rsi ?? 50;
    const macdHistogram = m1.macd?.histogram ?? 0;
    const fearGreed = comprehensiveAI?.sentiment?.fearGreedIndex ?? 50;
    const fundingRate = comprehensiveAI?.onChain?.fundingRate ?? 0;
    
    // === QUALITY FILTERS (block trade if ANY is true) ===
    
    // 1. Lateral market → NO TRADE
    if (isLateral && m5Lateral) {
      return {
        action: null, signalScore: 0, buyScore: 0, sellScore: 0,
        confirmations: ['🚫 Mercado lateral M1+M5'], shouldTrade: false,
        skipReason: '📊 Mercado lateral em ambos timeframes',
        signalQuality: 'low', momentumScore: 0,
        marketRegime: 'ranging', pullbackReady: false, btcAligned: true,
      };
    }
    
    // 2. Volume below average → NO TRADE (relaxed: only need volumeRatio >= 1.1)
    if (volumeRatio < 1.1) {
      return {
        action: null, signalScore: 0, buyScore: 0, sellScore: 0,
        confirmations: ['🚫 Volume ratio fraco'], shouldTrade: false,
        skipReason: `📉 Volume ratio ${volumeRatio.toFixed(2)}x < 1.1x mínimo`,
        signalQuality: 'low', momentumScore: 0,
        marketRegime: 'ranging', pullbackReady: false, btcAligned: true,
      };
    }
    
    // 3. Minimum volume $80k
    if (volume24h < 80000) {
      return {
        action: null, signalScore: 0, buyScore: 0, sellScore: 0,
        confirmations: [], shouldTrade: false,
        skipReason: `Volume $${(volume24h/1e6).toFixed(2)}M muito baixo`,
        signalQuality: 'low', momentumScore: 0,
        marketRegime: 'ranging', pullbackReady: false, btcAligned: true,
      };
    }
    
    // 4. Balance check
    if (currentBalance < 3) {
      return {
        action: null, signalScore: 0, buyScore: 0, sellScore: 0,
        confirmations: [], shouldTrade: false,
        skipReason: `Saldo $${currentBalance.toFixed(2)} insuficiente`,
        signalQuality: 'low', momentumScore: 0,
        marketRegime: 'ranging', pullbackReady: false, btcAligned: true,
      };
    }
    
    // === v17: PULLBACK DETECTION ===
    // Instead of entering on momentum, detect price pulling back to support
    const distFromEma9Pct = ema9 > 0 ? ((currentPrice - ema9) / ema9) * 100 : 0;
    const distFromVwapPct = vwap > 0 ? ((currentPrice - vwap) / vwap) * 100 : 0;
    const distFromEma21Pct = ema21 > 0 ? ((currentPrice - ema21) / ema21) * 100 : 0;
    
    // LONG pullback: Price near EMA9 or VWAP from above (retracing in uptrend)
    const longPullbackToEma9 = distFromEma9Pct >= -0.15 && distFromEma9Pct <= 0.10; // Near EMA9
    const longPullbackToVwap = distFromVwapPct >= -0.10 && distFromVwapPct <= 0.15; // Near VWAP
    const longPullbackReady = longPullbackToEma9 || longPullbackToVwap;
    
    // SHORT pullback: Price near EMA9 or VWAP from below (retracing in downtrend)
    const shortPullbackToEma9 = distFromEma9Pct >= -0.10 && distFromEma9Pct <= 0.15;
    const shortPullbackToVwap = distFromVwapPct >= -0.15 && distFromVwapPct <= 0.10;
    const shortPullbackReady = shortPullbackToEma9 || shortPullbackToVwap;
    
    // === v17: TREND CONFIRMATION (relaxed ATR filter) ===
    // Require EMA9 vs EMA21 gap > 0.08*ATR (was 0.2 — too strict)
    let hasTrend = true;
    if (ema9 > 0 && ema21 > 0 && atrPercent > 0) {
      const emaDiffPct = Math.abs(ema9 - ema21) / currentPrice * 100;
      if (emaDiffPct < atrPercent * 0.08) {
        hasTrend = false;
      }
    }
    
    if (!hasTrend) {
      return {
        action: null, signalScore: 0, buyScore: 0, sellScore: 0,
        confirmations: ['🚫 Sem tendência'], shouldTrade: false,
        skipReason: `📊 EMA gap < 0.08*ATR (sem direção)`,
        signalQuality: 'low', momentumScore: 0,
        marketRegime: 'ranging', pullbackReady: false, btcAligned: true,
      };
    }
    
    // === EMA50 trend alignment ===
    const priceAboveEma50 = ema50 > 0 ? currentPrice > ema50 : true;
    const priceBelowEma50 = ema50 > 0 ? currentPrice < ema50 : true;
    
    // === v17: M5 RSI DIVERGENCE CHECK ===
    // M5 RSI overbought (>70) blocks new longs; oversold (<30) blocks new shorts
    const m5OverboughtBlock = m5Rsi > 70;
    const m5OversoldBlock = m5Rsi < 30;
    
    // === STRICT LONG CONDITIONS ===
    const longEMATrend = ema9 > ema21; // EMA9 above EMA21 (uptrend structure)
    const longVWAP = priceAboveVwap;
    const longRSI = rsi >= 40 && rsi <= 65; // v17: wider range 40-65 (allow dips)
    const longM5Confirm = m5Trend === 'up';
    const longEMA50 = priceAboveEma50;
    const longFearGreed = fearGreed <= 75;
    const longNotOverbought = !m5OverboughtBlock;
    const longPullback = longPullbackReady; // v17: MUST be near support
    
    // v17: MACD histogram positive confirms momentum
    const longMACDPositive = macdHistogram > 0;
    
    const allLongMet = longEMATrend && longVWAP && longRSI && longM5Confirm 
      && longEMA50 && longFearGreed && longNotOverbought && longPullback;
    
    // === STRICT SHORT CONDITIONS ===
    const shortEMATrend = ema9 < ema21; // EMA9 below EMA21 (downtrend structure)
    const shortVWAP = priceBelowVwap;
    const shortRSI = rsi >= 35 && rsi <= 60; // v17: wider range 35-60 (allow bounces)
    const shortM5Confirm = m5Trend === 'down';
    const shortEMA50 = priceBelowEma50;
    const shortFearGreed = fearGreed >= 25;
    const shortNotOversold = !m5OversoldBlock;
    const shortPullback = shortPullbackReady;
    
    const shortMACDNegative = macdHistogram < 0;
    
    const allShortMet = shortEMATrend && shortVWAP && shortRSI && shortM5Confirm 
      && shortEMA50 && shortFearGreed && shortNotOversold && shortPullback;
    
    // === DETERMINE ACTION ===
    let action: 'BUY' | 'SELL' | null = null;
    let signalScore = 0;
    let buyScore = 0;
    let sellScore = 0;
    
    if (allLongMet) {
      action = 'BUY';
      buyScore = 55; // Base score for passing all strict conditions
      
      // Pullback quality bonuses
      if (longPullbackToEma9 && longPullbackToVwap) buyScore += 15; // Double support confluence
      else if (longPullbackToVwap) buyScore += 10;
      else buyScore += 5;
      
      // MACD confirmation
      if (longMACDPositive) buyScore += 10;
      
      // Volume strength
      if (volumeRatio > 1.5) buyScore += 8;
      if (volumeRatio > 2.0) buyScore += 5;
      
      // RSI sweet spot (50-58 is ideal pullback zone for longs)
      if (rsi >= 48 && rsi <= 58) buyScore += 8;
      
      // Composite AI score
      if (compositeScore && compositeScore > 20) buyScore += 7;
      if (compositeScore && compositeScore > 40) buyScore += 5;
      
      // AI confidence
      if (aiConfidence && aiConfidence > 70) buyScore += 5;
      if (aiConfidence && aiConfidence > 85) buyScore += 3;
      
      // Contrarian buy in extreme fear
      if (fearGreed < 25) buyScore += 10;
      
      // Strong EMA50 support
      if (ema50 > 0 && currentPrice > ema50 * 1.003) buyScore += 4;
      
      // Funding rate alignment (negative = shorts paying longs = bullish)
      if (fundingRate < -0.01) buyScore += 5;
      
      // M15 alignment bonus
      if (comprehensiveAI?.technical?.m15?.trend === 'up') buyScore += 5;
      
      signalScore = buyScore;
      
      confirmations.push('✅ EMA9 > EMA21 (tendência)');
      confirmations.push(`✅ Pullback: EMA9 ${distFromEma9Pct.toFixed(3)}% | VWAP ${distFromVwapPct.toFixed(3)}%`);
      confirmations.push('✅ Preço > VWAP');
      confirmations.push(`✅ RSI ${rsi.toFixed(0)} (zona ideal)`);
      confirmations.push(`✅ Volume ${volumeRatio.toFixed(1)}x média`);
      confirmations.push('✅ M5 tendência UP');
      confirmations.push('✅ Preço > EMA50');
      if (longMACDPositive) confirmations.push('✅ MACD histogram +');
      if (fearGreed < 25) confirmations.push('🎯 Compra contrária (medo extremo)');
      if (fundingRate < -0.01) confirmations.push('📊 Funding negativo (bullish)');
      
    } else if (allShortMet) {
      action = 'SELL';
      sellScore = 55;
      
      // Pullback quality bonuses
      if (shortPullbackToEma9 && shortPullbackToVwap) sellScore += 15;
      else if (shortPullbackToVwap) sellScore += 10;
      else sellScore += 5;
      
      // MACD confirmation
      if (shortMACDNegative) sellScore += 10;
      
      // Volume strength
      if (volumeRatio > 1.5) sellScore += 8;
      if (volumeRatio > 2.0) sellScore += 5;
      
      // RSI sweet spot (42-52 is ideal pullback zone for shorts)
      if (rsi >= 42 && rsi <= 52) sellScore += 8;
      
      // Composite AI score
      if (compositeScore && compositeScore < -20) sellScore += 7;
      if (compositeScore && compositeScore < -40) sellScore += 5;
      
      // AI confidence
      if (aiConfidence && aiConfidence > 70) sellScore += 5;
      if (aiConfidence && aiConfidence > 85) sellScore += 3;
      
      // Contrarian sell in extreme greed
      if (fearGreed > 75) sellScore += 10;
      
      // Strong below EMA50
      if (ema50 > 0 && currentPrice < ema50 * 0.997) sellScore += 4;
      
      // Funding rate alignment (positive = longs paying shorts = bearish)
      if (fundingRate > 0.01) sellScore += 5;
      
      // M15 alignment bonus
      if (comprehensiveAI?.technical?.m15?.trend === 'down') sellScore += 5;
      
      signalScore = sellScore;
      
      confirmations.push('✅ EMA9 < EMA21 (tendência)');
      confirmations.push(`✅ Pullback: EMA9 ${distFromEma9Pct.toFixed(3)}% | VWAP ${distFromVwapPct.toFixed(3)}%`);
      confirmations.push('✅ Preço < VWAP');
      confirmations.push(`✅ RSI ${rsi.toFixed(0)} (zona ideal)`);
      confirmations.push(`✅ Volume ${volumeRatio.toFixed(1)}x média`);
      confirmations.push('✅ M5 tendência DOWN');
      confirmations.push('✅ Preço < EMA50');
      if (shortMACDNegative) confirmations.push('✅ MACD histogram -');
      if (fearGreed > 75) confirmations.push('🎯 Venda contrária (ganância extrema)');
      if (fundingRate > 0.01) confirmations.push('📊 Funding positivo (bearish)');
    }
    
    // === BTC CORRELATION CHECK ===
    let btcAligned = true;
    if (btcPriceChange !== undefined && symbol && !symbol.includes('BTC')) {
      if (btcPriceChange > 3 && action === 'SELL') btcAligned = false;
      if (btcPriceChange < -3 && action === 'BUY') btcAligned = false;
    }
    
    if (!btcAligned) {
      return {
        action: null, signalScore: 0, buyScore, sellScore,
        confirmations, shouldTrade: false,
        skipReason: '🪙 BTC em direção oposta (>3%)',
        signalQuality: 'low', momentumScore: 0,
        marketRegime: 'trending', pullbackReady: true, btcAligned: false,
      };
    }
    
    // === DETERMINE QUALITY ===
    let signalQuality: 'low' | 'medium' | 'high' | 'premium' = 'low';
    if (action) {
      if (signalScore >= 90) signalQuality = 'premium';
      else if (signalScore >= 68) signalQuality = 'high'; // v17: lowered from 70 to 68
      else signalQuality = 'medium';
    }
    
    // === SKIP REASON FOR NON-ENTRY ===
    let skipReason = '';
    if (!action) {
      const longMissing: string[] = [];
      if (!longEMATrend) longMissing.push('EMA9 < EMA21');
      if (!longVWAP) longMissing.push('Preço < VWAP');
      if (!longRSI) longMissing.push(`RSI ${rsi.toFixed(0)}∉[40-65]`);
      if (!longM5Confirm) longMissing.push('M5 ≠ UP');
      if (!longEMA50) longMissing.push('Preço < EMA50');
      if (!longFearGreed) longMissing.push('F&G > 75');
      if (!longNotOverbought) longMissing.push('M5 RSI > 70');
      if (!longPullback) longMissing.push(`Pullback: EMA9 ${distFromEma9Pct.toFixed(2)}% VWAP ${distFromVwapPct.toFixed(2)}%`);
      
      const shortMissing: string[] = [];
      if (!shortEMATrend) shortMissing.push('EMA9 > EMA21');
      if (!shortVWAP) shortMissing.push('Preço > VWAP');
      if (!shortRSI) shortMissing.push(`RSI ${rsi.toFixed(0)}∉[35-60]`);
      if (!shortM5Confirm) shortMissing.push('M5 ≠ DOWN');
      if (!shortEMA50) shortMissing.push('Preço > EMA50');
      if (!shortFearGreed) shortMissing.push('F&G < 25');
      if (!shortNotOversold) shortMissing.push('M5 RSI < 30');
      if (!shortPullback) shortMissing.push(`Pullback: EMA9 ${distFromEma9Pct.toFixed(2)}% VWAP ${distFromVwapPct.toFixed(2)}%`);
      
      if (longMissing.length <= shortMissing.length) {
        skipReason = `LONG falta: ${longMissing.join(', ')}`;
      } else {
        skipReason = `SHORT falta: ${shortMissing.join(', ')}`;
      }
    }
    
    // v17: high e premium passam — medium = filtrado
    const shouldTrade = action !== null && (signalQuality === 'high' || signalQuality === 'premium');
    const momentumScore = Math.abs(priceChange) * (volumeAboveAvg ? 1.5 : 1);
    const marketRegime: 'trending' | 'ranging' | 'volatile' = 
      volatility > 12 ? 'volatile' : Math.abs(priceChange) > 1.5 ? 'trending' : 'ranging';

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
      m1Signal: m1.signal as any,
      m5Support,
      m5Resistance,
      compositeScore,
      aiConfidence,
      marketRegime,
      pullbackReady: longPullbackReady || shortPullbackReady,
      btcAligned,
    };
  }, []);

  return { analyzeSignal, fetchComprehensiveAI, fetchBTCTrend };
};
