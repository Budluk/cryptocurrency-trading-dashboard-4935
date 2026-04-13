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
  // v20: PROFIT MAXIMIZER — Score-weighted entries + strict R:R
  // Prioriza qualidade sobre quantidade para maximizar lucro
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
    
    const hasAI = !!m1 && !!m5;
    
    // === INDICATOR VALUES ===
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
    
    // === HARD BLOCKS (only truly bad conditions) ===
    
    // 1. Both timeframes lateral + low ATR
    if (isLateral && m5Lateral && atrPercent < 0.3) {
      return {
        action: null, signalScore: 0, buyScore: 0, sellScore: 0,
        confirmations: ['🚫 Mercado lateral M1+M5 + ATR baixo'], shouldTrade: false,
        skipReason: '📊 Sem movimento (lateral + ATR < 0.3%)',
        signalQuality: 'low', momentumScore: 0,
        marketRegime: 'ranging', pullbackReady: false, btcAligned: true,
      };
    }
    
    // 2. Minimum volume
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
    
    // === KEY LEVELS & PULLBACK ===
    const distFromEma9Pct = ema9 > 0 ? ((currentPrice - ema9) / ema9) * 100 : 0;
    const distFromVwapPct = vwap > 0 ? ((currentPrice - vwap) / vwap) * 100 : 0;
    const distFromEma50Pct = ema50 > 0 ? ((currentPrice - ema50) / ema50) * 100 : 0;
    
    // === DIRECTION DETECTION ===
    const emaBullish = ema9 > 0 && ema21 > 0 ? ema9 > ema21 : priceChange > 0;
    const emaBearish = ema9 > 0 && ema21 > 0 ? ema9 < ema21 : priceChange < 0;
    const priceAboveEma50 = ema50 > 0 ? currentPrice > ema50 : true;
    const priceBelowEma50 = ema50 > 0 ? currentPrice < ema50 : true;
    
    // === LONG CONDITIONS ===
    const longDirection = emaBullish || priceChange > 0.05;
    const longVWAP = priceAboveVwap || distFromVwapPct > -0.1;
    const longRSI = rsi >= 30 && rsi <= 72;
    const longM5OK = m5Trend !== 'down' || m5Rsi < 35;
    const longNotExtreme = rsi < 80 && m5Rsi < 78;
    
    // === SHORT CONDITIONS ===
    const shortDirection = emaBearish || priceChange < -0.05;
    const shortVWAP = priceBelowVwap || distFromVwapPct < 0.1;
    const shortRSI = rsi >= 28 && rsi <= 70;
    const shortM5OK = m5Trend !== 'up' || m5Rsi > 65;
    const shortNotExtreme = rsi > 20 && m5Rsi > 22;
    
    const allLongMet = longDirection && longVWAP && longRSI && longM5OK && longNotExtreme;
    const allShortMet = shortDirection && shortVWAP && shortRSI && shortM5OK && shortNotExtreme;
    
    // === PRIORITY BONUS FOR BTC/ETH ===
    const isBTCOrETH = symbol ? (symbol.includes('BTC') || symbol.includes('ETH')) : false;
    const priorityBonus = isBTCOrETH ? 15 : 0;
    
    // === DETERMINE ACTION & SCORE ===
    let action: 'BUY' | 'SELL' | null = null;
    let signalScore = 0;
    let buyScore = 0;
    let sellScore = 0;
    
    if (allLongMet && !allShortMet) {
      action = 'BUY';
      buyScore = 40 + priorityBonus; // base + BTC/ETH bonus
      
      // === TREND ALIGNMENT (max +20) ===
      if (emaBullish) { buyScore += 8; confirmations.push('✅ EMA Bull'); }
      if (priceAboveEma50) { buyScore += 6; confirmations.push('✅ > EMA50'); }
      if (m5Trend === 'up') { buyScore += 6; confirmations.push('✅ M5 UP'); }
      
      // === PULLBACK QUALITY (max +18) — KEY PROFIT DRIVER ===
      const longPullback = distFromEma9Pct >= -0.20 && distFromEma9Pct <= 0.08;
      const vwapPullback = distFromVwapPct >= -0.15 && distFromVwapPct <= 0.10;
      if (longPullback) { buyScore += 12; confirmations.push(`✅ Pullback EMA9 (${distFromEma9Pct.toFixed(2)}%)`); }
      if (vwapPullback) { buyScore += 6; confirmations.push('✅ Pullback VWAP'); }
      
      // === MOMENTUM (max +17) ===
      if (priceAboveVwap) { buyScore += 5; confirmations.push('✅ > VWAP'); }
      if (macdHistogram > 0) { buyScore += 7; confirmations.push('✅ MACD +'); }
      if (rsi >= 40 && rsi <= 55) buyScore += 5; // sweet spot
      
      // === VOLUME (max +10) ===
      if (volumeRatio > 1.2) { buyScore += 5; confirmations.push(`✅ Vol ${volumeRatio.toFixed(1)}x`); }
      if (volumeRatio > 2.0) buyScore += 5;
      
      // === AI/COMPOSITE (max +18) ===
      if (compositeScore && compositeScore > 20) buyScore += 5;
      if (compositeScore && compositeScore > 40) buyScore += 5;
      if (aiConfidence && aiConfidence > 65) buyScore += 4;
      if (aiConfidence && aiConfidence > 85) buyScore += 4;
      
      // === MACRO (max +17) ===
      if (fearGreed < 25) { buyScore += 8; confirmations.push('✅ Fear extremo (contrarian)'); }
      else if (fearGreed < 40) buyScore += 4;
      if (fundingRate < -0.01) buyScore += 5; // shorts pagando = squeeze potencial
      if (comprehensiveAI?.technical?.m15?.trend === 'up') buyScore += 4;
      
      // === VOLATILITY BONUS ===
      if (atrPercent > 0.5 && atrPercent < 3) buyScore += 3;
      
      confirmations.push(`📊 RSI ${rsi.toFixed(0)} | M5 RSI ${m5Rsi.toFixed(0)}`);
      signalScore = buyScore;
      
    } else if (allShortMet && !allLongMet) {
      action = 'SELL';
      sellScore = 40 + priorityBonus;
      
      // === TREND ALIGNMENT ===
      if (emaBearish) { sellScore += 8; confirmations.push('✅ EMA Bear'); }
      if (priceBelowEma50) { sellScore += 6; confirmations.push('✅ < EMA50'); }
      if (m5Trend === 'down') { sellScore += 6; confirmations.push('✅ M5 DOWN'); }
      
      // === PULLBACK QUALITY ===
      const shortPullback = distFromEma9Pct >= -0.08 && distFromEma9Pct <= 0.20;
      const vwapPullbackShort = distFromVwapPct >= -0.10 && distFromVwapPct <= 0.15;
      if (shortPullback) { sellScore += 12; confirmations.push(`✅ Pullback EMA9 (${distFromEma9Pct.toFixed(2)}%)`); }
      if (vwapPullbackShort) { sellScore += 6; confirmations.push('✅ Pullback VWAP'); }
      
      // === MOMENTUM ===
      if (priceBelowVwap) { sellScore += 5; confirmations.push('✅ < VWAP'); }
      if (macdHistogram < 0) { sellScore += 7; confirmations.push('✅ MACD -'); }
      if (rsi >= 45 && rsi <= 60) sellScore += 5;
      
      // === VOLUME ===
      if (volumeRatio > 1.2) { sellScore += 5; confirmations.push(`✅ Vol ${volumeRatio.toFixed(1)}x`); }
      if (volumeRatio > 2.0) sellScore += 5;
      
      // === AI/COMPOSITE ===
      if (compositeScore && compositeScore < -20) sellScore += 5;
      if (compositeScore && compositeScore < -40) sellScore += 5;
      if (aiConfidence && aiConfidence > 65) sellScore += 4;
      if (aiConfidence && aiConfidence > 85) sellScore += 4;
      
      // === MACRO ===
      if (fearGreed > 75) { sellScore += 8; confirmations.push('✅ Greed extremo (contrarian)'); }
      else if (fearGreed > 60) sellScore += 4;
      if (fundingRate > 0.01) sellScore += 5;
      if (comprehensiveAI?.technical?.m15?.trend === 'down') sellScore += 4;
      
      // === VOLATILITY BONUS ===
      if (atrPercent > 0.5 && atrPercent < 3) sellScore += 3;
      
      confirmations.push(`📊 RSI ${rsi.toFixed(0)} | M5 RSI ${m5Rsi.toFixed(0)}`);
      signalScore = sellScore;
    }
    
    // === BTC CORRELATION (block extreme divergence >4%) ===
    let btcAligned = true;
    if (btcPriceChange !== undefined && symbol && !symbol.includes('BTC')) {
      if (btcPriceChange > 4 && action === 'SELL') btcAligned = false;
      if (btcPriceChange < -4 && action === 'BUY') btcAligned = false;
    }
    
    if (!btcAligned) {
      return {
        action: null, signalScore: 0, buyScore, sellScore,
        confirmations, shouldTrade: false,
        skipReason: '🪙 BTC divergência extrema (>4%)',
        signalQuality: 'low', momentumScore: 0,
        marketRegime: 'trending', pullbackReady: true, btcAligned: false,
      };
    }
    
    // === QUALITY TIERS (v20: premium threshold raised for better entries) ===
    let signalQuality: 'low' | 'medium' | 'high' | 'premium' = 'low';
    if (action) {
      if (signalScore >= 90) signalQuality = 'premium';
      else if (signalScore >= 68) signalQuality = 'high';
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
    
    // v20: medium+ passa, mas position size escala com qualidade
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
