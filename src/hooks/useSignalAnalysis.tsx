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
      };
      m5: { 
        trend: string; support: number; resistance: number;
        emaCrossover?: string; isLateral?: boolean;
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
  // v11: STRICT SCALPING SIGNAL ANALYSIS
  // ALL conditions must be TRUE simultaneously for entry
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
    
    // === EXTRACT STRICT INDICATORS FROM AI ===
    const m1 = comprehensiveAI?.technical?.m1;
    const m5 = comprehensiveAI?.technical?.m5;
    const aiConfidence = comprehensiveAI?.scalpingConfig?.confidence;
    const compositeScore = comprehensiveAI?.compositeScore;
    const m5Support = comprehensiveAI?.scalpingConfig?.support5m;
    const m5Resistance = comprehensiveAI?.scalpingConfig?.resistance5m;
    
    // If no AI data, we can't validate strict conditions - skip
    if (!m1 || !m5) {
      return {
        action: null, signalScore: 0, buyScore: 0, sellScore: 0,
        confirmations: [], shouldTrade: false, skipReason: '⏳ Sem dados AI para validação estrita',
        signalQuality: 'low', momentumScore: 0,
        marketRegime: 'ranging', pullbackReady: false, btcAligned: true,
      };
    }
    
    // === STRICT INDICATOR VALUES ===
    const rsi = m1.rsi ?? 50;
    const emaCrossover = m1.emaCrossover || 'below';
    const volumeAboveAvg = m1.volumeAboveAvg ?? false;
    const isLateral = m1.isLateral ?? false;
    const priceAboveVwap = m1.priceAboveVwap ?? false;
    const priceBelowVwap = m1.priceBelowVwap ?? false;
    const m5Trend = m5.trend || 'sideways';
    const m5Lateral = m5.isLateral ?? false;
    
    // === QUALITY FILTERS (block trade if ANY is true) ===
    
    // 1. Lateral market (20+ candles) → NO TRADE
    if (isLateral || m5Lateral) {
      return {
        action: null, signalScore: 0, buyScore: 0, sellScore: 0,
        confirmations: ['🚫 Mercado lateral'], shouldTrade: false,
        skipReason: '📊 Mercado lateral > 20 velas',
        signalQuality: 'low', momentumScore: 0,
        marketRegime: 'ranging', pullbackReady: false, btcAligned: true,
      };
    }
    
    // 2. Volume below average → NO TRADE
    if (!volumeAboveAvg) {
      return {
        action: null, signalScore: 0, buyScore: 0, sellScore: 0,
        confirmations: ['🚫 Volume baixo'], shouldTrade: false,
        skipReason: '📉 Volume abaixo da média 20 velas',
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
    
    // === STRICT LONG CONDITIONS (ALL must be true) ===
    const longEMACross = emaCrossover === 'bullish' || emaCrossover === 'above';
    const longVWAP = priceAboveVwap;
    const longRSI = rsi >= 50 && rsi <= 65;
    const longM5Confirm = m5Trend === 'up';
    // volumeAboveAvg already checked above
    
    const allLongMet = longEMACross && longVWAP && longRSI && longM5Confirm;
    
    // === STRICT SHORT CONDITIONS (ALL must be true) ===
    const shortEMACross = emaCrossover === 'bearish' || emaCrossover === 'below';
    const shortVWAP = priceBelowVwap;
    const shortRSI = rsi >= 35 && rsi <= 50;
    const shortM5Confirm = m5Trend === 'down';
    
    const allShortMet = shortEMACross && shortVWAP && shortRSI && shortM5Confirm;
    
    // === DETERMINE ACTION ===
    let action: 'BUY' | 'SELL' | null = null;
    let signalScore = 0;
    let buyScore = 0;
    let sellScore = 0;
    
    if (allLongMet) {
      action = 'BUY';
      buyScore = 60;
      if (emaCrossover === 'bullish') buyScore += 15; // Fresh cross > already above
      if (rsi >= 52 && rsi <= 60) buyScore += 10; // Sweet spot RSI
      if (m1.volumeRatio && m1.volumeRatio > 1.5) buyScore += 10; // Strong volume
      if (m1.volumeRatio && m1.volumeRatio > 2.0) buyScore += 5; // Very strong volume
      if (compositeScore && compositeScore > 20) buyScore += 10; // AI confirms
      if (compositeScore && compositeScore > 35) buyScore += 5; // Strong AI
      if (aiConfidence && aiConfidence > 70) buyScore += 5;
      signalScore = buyScore;
      
      confirmations.push('✅ EMA9 > EMA21');
      confirmations.push('✅ Preço > VWAP');
      confirmations.push(`✅ RSI ${rsi.toFixed(0)} (50-65)`);
      confirmations.push('✅ Volume > média 20');
      confirmations.push('✅ M5 tendência UP');
    } else if (allShortMet) {
      action = 'SELL';
      sellScore = 60;
      if (emaCrossover === 'bearish') sellScore += 15;
      if (rsi >= 37 && rsi <= 48) sellScore += 10;
      if (m1.volumeRatio && m1.volumeRatio > 1.5) sellScore += 10;
      if (compositeScore && compositeScore < -20) sellScore += 10;
      if (aiConfidence && aiConfidence > 70) sellScore += 5;
      signalScore = sellScore;
      
      confirmations.push('✅ EMA9 < EMA21');
      confirmations.push('✅ Preço < VWAP');
      confirmations.push(`✅ RSI ${rsi.toFixed(0)} (35-50)`);
      confirmations.push('✅ Volume > média 20');
      confirmations.push('✅ M5 tendência DOWN');
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
        skipReason: '🪙 BTC em direção oposta',
        signalQuality: 'low', momentumScore: 0,
        marketRegime: 'trending', pullbackReady: true, btcAligned: false,
      };
    }
    
    // === DETERMINE QUALITY ===
    let signalQuality: 'low' | 'medium' | 'high' | 'premium' = 'low';
    if (action) {
      if (signalScore >= 85) signalQuality = 'premium';
      else if (signalScore >= 70) signalQuality = 'high';
      else if (signalScore >= 60) signalQuality = 'medium';
    }
    
    // === SKIP REASON FOR NON-ENTRY ===
    let skipReason = '';
    if (!action) {
      const missing: string[] = [];
      // Check LONG conditions
      if (!longEMACross) missing.push('EMA cross ↑');
      if (!longVWAP) missing.push('Preço > VWAP');
      if (!(rsi >= 50 && rsi <= 65)) missing.push(`RSI ${rsi.toFixed(0)}∉[50-65]`);
      if (!longM5Confirm) missing.push('M5 ≠ UP');
      
      // Check SHORT conditions  
      const shortMissing: string[] = [];
      if (!shortEMACross) shortMissing.push('EMA cross ↓');
      if (!shortVWAP) shortMissing.push('Preço < VWAP');
      if (!(rsi >= 35 && rsi <= 50)) shortMissing.push(`RSI ${rsi.toFixed(0)}∉[35-50]`);
      if (!shortM5Confirm) shortMissing.push('M5 ≠ DOWN');
      
      // Show the direction with fewer missing conditions
      if (missing.length <= shortMissing.length) {
        skipReason = `LONG falta: ${missing.join(', ')}`;
      } else {
        skipReason = `SHORT falta: ${shortMissing.join(', ')}`;
      }
    }
    
    // v13: APENAS high e premium passam — medium = loss
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
      pullbackReady: true,
      btcAligned,
    };
  }, []);

  return { analyzeSignal, fetchComprehensiveAI, fetchBTCTrend };
};
