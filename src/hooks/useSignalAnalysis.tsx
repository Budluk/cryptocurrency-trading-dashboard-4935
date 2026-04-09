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
  // v18: AGGRESSIVE VOLATILITY ENTRY — ALL ASSETS
  // Entrar em TODOS os ativos com volatilidade, filtros mínimos
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
    
    // If no AI data, use price action only
    const hasAI = !!m1 && !!m5;
    
    // === INDICATOR VALUES (with safe defaults) ===
    const rsi = m1?.rsi ?? 50;
    const volumeAboveAvg = m1?.volumeAboveAvg ?? true;
    const isLateral = m1?.isLateral ?? false;
    const priceAboveVwap = m1?.priceAboveVwap ?? (priceChange > 0);
    const priceBelowVwap = m1?.priceBelowVwap ?? (priceChange < 0);
    const m5Trend = m5?.trend || (priceChange > 0.1 ? 'up' : priceChange < -0.1 ? 'down' : 'sideways');
    const m5Lateral = m5?.isLateral ?? false;
    const volumeRatio = m1?.volumeRatio ?? 1.5;
    const ema9 = m1?.ema?.ema9 ?? 0;
    const ema21 = m1?.ema?.ema21 ?? 0;
    const ema50 = m1?.ema?.ema50 ?? 0;
    const vwap = m1?.vwap ?? currentPrice;
    const m5Rsi = m5?.rsi ?? 50;
    const macdHistogram = m1?.macd?.histogram ?? 0;
    const fearGreed = comprehensiveAI?.sentiment?.fearGreedIndex ?? 50;
    const fundingRate = comprehensiveAI?.onChain?.fundingRate ?? 0;
    
    // === MINIMAL FILTERS (only block truly bad conditions) ===
    
    // 1. Both timeframes lateral → skip
    if (isLateral && m5Lateral && atrPercent < 0.3) {
      return {
        action: null, signalScore: 0, buyScore: 0, sellScore: 0,
        confirmations: ['🚫 Mercado lateral M1+M5 + ATR baixo'], shouldTrade: false,
        skipReason: '📊 Sem movimento (lateral + ATR < 0.3%)',
        signalQuality: 'low', momentumScore: 0,
        marketRegime: 'ranging', pullbackReady: false, btcAligned: true,
      };
    }
    
    // 2. Minimum volume $30k (muito baixo = sem liquidez)
    if (volume24h < 30000) {
      return {
        action: null, signalScore: 0, buyScore: 0, sellScore: 0,
        confirmations: [], shouldTrade: false,
        skipReason: `Volume $${(volume24h/1e6).toFixed(2)}M < $30k mínimo`,
        signalQuality: 'low', momentumScore: 0,
        marketRegime: 'ranging', pullbackReady: false, btcAligned: true,
      };
    }
    
    // 3. Balance check
    if (currentBalance < 2) {
      return {
        action: null, signalScore: 0, buyScore: 0, sellScore: 0,
        confirmations: [], shouldTrade: false,
        skipReason: `Saldo $${currentBalance.toFixed(2)} insuficiente`,
        signalQuality: 'low', momentumScore: 0,
        marketRegime: 'ranging', pullbackReady: false, btcAligned: true,
      };
    }
    
    // === DIRECTION DETECTION (simplified — follow the trend) ===
    const emaBullish = ema9 > 0 && ema21 > 0 ? ema9 > ema21 : priceChange > 0;
    const emaBearish = ema9 > 0 && ema21 > 0 ? ema9 < ema21 : priceChange < 0;
    const priceAboveEma50 = ema50 > 0 ? currentPrice > ema50 : true;
    const priceBelowEma50 = ema50 > 0 ? currentPrice < ema50 : true;
    
    // === DISTANCE FROM KEY LEVELS ===
    const distFromEma9Pct = ema9 > 0 ? ((currentPrice - ema9) / ema9) * 100 : 0;
    const distFromVwapPct = vwap > 0 ? ((currentPrice - vwap) / vwap) * 100 : 0;
    
    // === LONG CONDITIONS (relaxed) ===
    const longDirection = emaBullish || priceChange > 0.05;
    const longVWAP = priceAboveVwap || distFromVwapPct > -0.1;
    const longRSI = rsi >= 30 && rsi <= 72; // wide range
    const longM5OK = m5Trend !== 'down' || m5Rsi < 35; // allow if M5 oversold
    const longNotExtreme = rsi < 80 && m5Rsi < 78;
    
    // === SHORT CONDITIONS (relaxed) ===
    const shortDirection = emaBearish || priceChange < -0.05;
    const shortVWAP = priceBelowVwap || distFromVwapPct < 0.1;
    const shortRSI = rsi >= 28 && rsi <= 70;
    const shortM5OK = m5Trend !== 'up' || m5Rsi > 65;
    const shortNotExtreme = rsi > 20 && m5Rsi > 22;
    
    const allLongMet = longDirection && longVWAP && longRSI && longM5OK && longNotExtreme;
    const allShortMet = shortDirection && shortVWAP && shortRSI && shortM5OK && shortNotExtreme;
    
    // === DETERMINE ACTION ===
    let action: 'BUY' | 'SELL' | null = null;
    let signalScore = 0;
    let buyScore = 0;
    let sellScore = 0;
    
    if (allLongMet && !allShortMet) {
      action = 'BUY';
      buyScore = 50;
      
      // Bonuses
      if (emaBullish) buyScore += 8;
      if (priceAboveVwap) buyScore += 6;
      if (priceAboveEma50) buyScore += 6;
      if (m5Trend === 'up') buyScore += 8;
      if (rsi >= 40 && rsi <= 60) buyScore += 6; // ideal zone
      if (volumeRatio > 1.2) buyScore += 5;
      if (volumeRatio > 1.8) buyScore += 5;
      if (macdHistogram > 0) buyScore += 7;
      if (compositeScore && compositeScore > 15) buyScore += 5;
      if (compositeScore && compositeScore > 35) buyScore += 5;
      if (aiConfidence && aiConfidence > 60) buyScore += 4;
      if (aiConfidence && aiConfidence > 80) buyScore += 4;
      if (fearGreed < 30) buyScore += 8; // contrarian
      if (fundingRate < -0.01) buyScore += 4;
      if (comprehensiveAI?.technical?.m15?.trend === 'up') buyScore += 5;
      if (distFromEma9Pct >= -0.2 && distFromEma9Pct <= 0.15) buyScore += 6; // pullback bonus
      if (atrPercent > 0.5) buyScore += 3; // volatility bonus
      
      signalScore = buyScore;
      
      confirmations.push(`✅ Direção LONG (EMA${emaBullish ? '✓' : '○'} Price${priceChange > 0 ? '✓' : '○'})`);
      if (priceAboveVwap) confirmations.push('✅ Preço > VWAP');
      confirmations.push(`✅ RSI ${rsi.toFixed(0)}`);
      if (m5Trend === 'up') confirmations.push('✅ M5 UP');
      if (volumeRatio > 1.2) confirmations.push(`✅ Volume ${volumeRatio.toFixed(1)}x`);
      if (macdHistogram > 0) confirmations.push('✅ MACD +');
      if (priceAboveEma50) confirmations.push('✅ > EMA50');
      
    } else if (allShortMet && !allLongMet) {
      action = 'SELL';
      sellScore = 50;
      
      if (emaBearish) sellScore += 8;
      if (priceBelowVwap) sellScore += 6;
      if (priceBelowEma50) sellScore += 6;
      if (m5Trend === 'down') sellScore += 8;
      if (rsi >= 40 && rsi <= 60) sellScore += 6;
      if (volumeRatio > 1.2) sellScore += 5;
      if (volumeRatio > 1.8) sellScore += 5;
      if (macdHistogram < 0) sellScore += 7;
      if (compositeScore && compositeScore < -15) sellScore += 5;
      if (compositeScore && compositeScore < -35) sellScore += 5;
      if (aiConfidence && aiConfidence > 60) sellScore += 4;
      if (aiConfidence && aiConfidence > 80) sellScore += 4;
      if (fearGreed > 70) sellScore += 8;
      if (fundingRate > 0.01) sellScore += 4;
      if (comprehensiveAI?.technical?.m15?.trend === 'down') sellScore += 5;
      if (distFromEma9Pct >= -0.15 && distFromEma9Pct <= 0.2) sellScore += 6;
      if (atrPercent > 0.5) sellScore += 3;
      
      signalScore = sellScore;
      
      confirmations.push(`✅ Direção SHORT (EMA${emaBearish ? '✓' : '○'} Price${priceChange < 0 ? '✓' : '○'})`);
      if (priceBelowVwap) confirmations.push('✅ Preço < VWAP');
      confirmations.push(`✅ RSI ${rsi.toFixed(0)}`);
      if (m5Trend === 'down') confirmations.push('✅ M5 DOWN');
      if (volumeRatio > 1.2) confirmations.push(`✅ Volume ${volumeRatio.toFixed(1)}x`);
      if (macdHistogram < 0) confirmations.push('✅ MACD -');
      if (priceBelowEma50) confirmations.push('✅ < EMA50');
    }
    
    // === BTC CORRELATION (only block extreme divergence >5%) ===
    let btcAligned = true;
    if (btcPriceChange !== undefined && symbol && !symbol.includes('BTC')) {
      if (btcPriceChange > 5 && action === 'SELL') btcAligned = false;
      if (btcPriceChange < -5 && action === 'BUY') btcAligned = false;
    }
    
    if (!btcAligned) {
      return {
        action: null, signalScore: 0, buyScore, sellScore,
        confirmations, shouldTrade: false,
        skipReason: '🪙 BTC divergência extrema (>5%)',
        signalQuality: 'low', momentumScore: 0,
        marketRegime: 'trending', pullbackReady: true, btcAligned: false,
      };
    }
    
    // === QUALITY (lowered thresholds) ===
    let signalQuality: 'low' | 'medium' | 'high' | 'premium' = 'low';
    if (action) {
      if (signalScore >= 85) signalQuality = 'premium';
      else if (signalScore >= 62) signalQuality = 'high';
      else if (signalScore >= 50) signalQuality = 'medium';
    }
    
    // === SKIP REASON ===
    let skipReason = '';
    if (!action) {
      const reasons: string[] = [];
      if (!longDirection && !shortDirection) reasons.push('Sem direção clara');
      if (allLongMet && allShortMet) reasons.push('Conflito LONG/SHORT');
      if (!longRSI && !shortRSI) reasons.push(`RSI ${rsi.toFixed(0)} extremo`);
      if (!longM5OK && !shortM5OK) reasons.push('M5 contra ambos');
      skipReason = reasons.length > 0 ? reasons.join(', ') : `L:${longDirection?'✓':'✗'}${longVWAP?'✓':'✗'}${longRSI?'✓':'✗'} S:${shortDirection?'✓':'✗'}${shortVWAP?'✓':'✗'}${shortRSI?'✓':'✗'}`;
    }
    
    // v18: medium, high e premium TODOS passam
    const shouldTrade = action !== null && signalQuality !== 'low';
    const momentumScore = Math.abs(priceChange) * (volumeAboveAvg ? 1.5 : 1);
    const marketRegime: 'trending' | 'ranging' | 'volatile' = 
      volatility > 12 ? 'volatile' : Math.abs(priceChange) > 1.0 ? 'trending' : 'ranging';

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
      m1Signal: m1?.signal as any,
      m5Support,
      m5Resistance,
      compositeScore,
      aiConfidence,
      marketRegime,
      pullbackReady: true,
      btcAligned,
    };
  }, []);

  return { analyzeSignal, fetchComprehensiveAI, fetchBTCTrend };
};
