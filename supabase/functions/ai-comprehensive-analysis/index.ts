import { createClient } from "npm:@supabase/supabase-js@2.57.4";


const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Bybit API Config
const BYBIT_API_KEY = Deno.env.get('BYBIT_API_KEY') || '';
const BYBIT_API_SECRET = Deno.env.get('BYBIT_API_SECRET') || '';
const RECV_WINDOW = "30000";
const BASE_URL = "https://api.bybit.com";

// ========================
// BYBIT API HELPERS
// ========================
async function getBybitServerTime(): Promise<number> {
  try {
    const response = await fetch(`${BASE_URL}/v5/market/time`);
    const data = await response.json();
    if (data.retCode === 0 && data.time) {
      return Math.floor(Number(data.time));
    }
    throw new Error('Invalid server time');
  } catch {
    return Math.floor(Date.now() - 1000);
  }
}

async function generateSignature(params: string, timestamp: number): Promise<string> {
  const encoder = new TextEncoder();
  const key = encoder.encode(BYBIT_API_SECRET);
  const message = encoder.encode(`${timestamp}${BYBIT_API_KEY}${RECV_WINDOW}${params}`);
  const cryptoKey = await crypto.subtle.importKey("raw", key, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", cryptoKey, message);
  return Array.from(new Uint8Array(signature)).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function makeBybitRequest(method: string, endpoint: string, params: Record<string, any> = {}, authenticated = false): Promise<any> {
  let url = `${BASE_URL}${endpoint}`;
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) searchParams.append(key, String(value));
  });
  const paramsStr = searchParams.toString();
  if (paramsStr) url += `?${paramsStr}`;

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  
  if (authenticated && BYBIT_API_KEY) {
    const timestamp = await getBybitServerTime();
    const signature = await generateSignature(paramsStr, timestamp);
    headers['X-BAPI-API-KEY'] = BYBIT_API_KEY;
    headers['X-BAPI-SIGN'] = signature;
    headers['X-BAPI-SIGN-TYPE'] = '2';
    headers['X-BAPI-TIMESTAMP'] = String(timestamp);
    headers['X-BAPI-RECV-WINDOW'] = RECV_WINDOW;
  }

  const response = await fetch(url, { method, headers });
  const data = await response.json();
  if (data.retCode !== 0) throw new Error(`Bybit API: ${data.retMsg}`);
  return data.result;
}

// ========================
// 1. ON-CHAIN ANALYSIS
// ========================
interface OnChainData {
  fundingRate: number;
  openInterest: number;
  openInterestChange: number;
  longShortRatio: number;
  whaleActivity: 'buying' | 'selling' | 'neutral';
  liquidations24h: { long: number; short: number };
  signal: 'bullish' | 'bearish' | 'neutral';
  score: number;
}

async function fetchOnChainAnalysis(symbol: string): Promise<OnChainData> {
  try {
    // Fetch funding rate
    const fundingResult = await makeBybitRequest('GET', '/v5/market/funding/history', { category: 'linear', symbol, limit: 10 });
    const fundingHistory = fundingResult?.list || [];
    const currentFunding = parseFloat(fundingHistory[0]?.fundingRate || '0') * 100;
    
    // Fetch open interest
    const oiResult = await makeBybitRequest('GET', '/v5/market/open-interest', { category: 'linear', symbol, intervalTime: '5min', limit: 288 });
    const oiList = oiResult?.list || [];
    const currentOI = parseFloat(oiList[0]?.openInterest || '0');
    const oldOI = parseFloat(oiList[Math.min(oiList.length - 1, 50)]?.openInterest || currentOI);
    const oiChange = oldOI > 0 ? ((currentOI - oldOI) / oldOI) * 100 : 0;
    
    // Fetch long/short ratio
    const lsResult = await makeBybitRequest('GET', '/v5/market/account-ratio', { category: 'linear', symbol, period: '1h', limit: 1 });
    const lsRatio = parseFloat(lsResult?.list?.[0]?.buyRatio || '0.5') / parseFloat(lsResult?.list?.[0]?.sellRatio || '0.5');
    
    // Determine whale activity based on OI change + funding
    let whaleActivity: 'buying' | 'selling' | 'neutral' = 'neutral';
    if (oiChange > 5 && currentFunding > 0.01) whaleActivity = 'buying';
    else if (oiChange > 5 && currentFunding < -0.01) whaleActivity = 'selling';
    else if (oiChange < -5) whaleActivity = 'selling';
    
    // Calculate on-chain score (-100 to 100)
    let score = 0;
    
    // Funding rate analysis
    if (currentFunding > 0.05) score -= 20; // Very high funding = overheated
    else if (currentFunding > 0.02) score -= 10;
    else if (currentFunding < -0.02) score += 15; // Negative funding = potential bounce
    else if (currentFunding < -0.05) score += 25;
    
    // OI analysis
    if (oiChange > 10) score += 15; // Strong OI increase
    else if (oiChange > 5) score += 10;
    else if (oiChange < -10) score -= 15;
    else if (oiChange < -5) score -= 10;
    
    // Long/Short ratio analysis
    if (lsRatio > 1.5) score -= 15; // Too many longs = potential squeeze
    else if (lsRatio < 0.7) score += 15; // Too many shorts = potential squeeze
    
    const signal = score > 15 ? 'bullish' : score < -15 ? 'bearish' : 'neutral';
    
    return {
      fundingRate: currentFunding,
      openInterest: currentOI,
      openInterestChange: oiChange,
      longShortRatio: lsRatio,
      whaleActivity,
      liquidations24h: { long: 0, short: 0 },
      signal,
      score,
    };
  } catch (error) {
    console.error('OnChain error:', error);
    return {
      fundingRate: 0, openInterest: 0, openInterestChange: 0,
      longShortRatio: 1, whaleActivity: 'neutral',
      liquidations24h: { long: 0, short: 0 },
      signal: 'neutral', score: 0,
    };
  }
}

// ========================
// 2. TECHNICAL ANALYSIS (Multi-Timeframe)
// ========================
interface TechnicalData {
  timeframe: string;
  trend: 'up' | 'down' | 'sideways';
  support: number;
  resistance: number;
  rsi: number;
  macd: { value: number; signal: number; histogram: number };
  ema: { ema9: number; ema21: number; ema50: number };
  vwap: number;
  atr: number;
  pricePosition: number; // 0-1 where in range
  signal: 'buy' | 'sell' | 'hold';
  score: number;
}

interface MultiTimeframeTechnical {
  m1: TechnicalData; // Entry timing
  m5: TechnicalData; // S/R levels
  m15: TechnicalData; // Trend confirmation
  alignment: 'strong_buy' | 'buy' | 'neutral' | 'sell' | 'strong_sell';
  overallScore: number;
}

async function fetchTechnicalAnalysis(symbol: string): Promise<MultiTimeframeTechnical> {
  const timeframes = [
    { tf: '1', name: 'm1', limit: 100 },
    { tf: '5', name: 'm5', limit: 100 },
    { tf: '15', name: 'm15', limit: 50 },
  ];
  
  const results: Record<string, TechnicalData> = {};
  
  for (const { tf, name, limit } of timeframes) {
    try {
      const klineResult = await makeBybitRequest('GET', '/v5/market/kline', { 
        category: 'linear', symbol, interval: tf, limit 
      });
      
      const candles = (klineResult?.list || []).map((k: string[]) => ({
        time: parseInt(k[0]),
        open: parseFloat(k[1]),
        high: parseFloat(k[2]),
        low: parseFloat(k[3]),
        close: parseFloat(k[4]),
        volume: parseFloat(k[5]),
      })).reverse();
      
      if (candles.length < 20) {
        results[name] = getEmptyTechnical(name);
        continue;
      }
      
      // Calculate indicators
      const closes = candles.map(c => c.close);
      const highs = candles.map(c => c.high);
      const lows = candles.map(c => c.low);
      const volumes = candles.map(c => c.volume);
      
      // EMAs
      const ema9 = calculateEMA(closes, 9);
      const ema21 = calculateEMA(closes, 21);
      const ema50 = calculateEMA(closes, Math.min(50, closes.length - 1));
      
      // RSI
      const rsi = calculateRSI(closes, 14);
      
      // MACD
      const macd = calculateMACD(closes);
      
      // ATR
      const atr = calculateATR(highs, lows, closes, 14);
      
      // Support/Resistance from swing highs/lows
      const { support, resistance } = findSupportResistance(candles);
      
      // VWAP approximation
      const vwap = calculateVWAP(candles.slice(-20));
      
      // Current price position
      const currentPrice = closes[closes.length - 1];
      const range = resistance - support;
      const pricePosition = range > 0 ? (currentPrice - support) / range : 0.5;
      
      // Determine trend
      let trend: 'up' | 'down' | 'sideways' = 'sideways';
      if (ema9 > ema21 && ema21 > ema50 && currentPrice > ema9) trend = 'up';
      else if (ema9 < ema21 && ema21 < ema50 && currentPrice < ema9) trend = 'down';
      
      // Calculate score
      let score = 0;
      
      // Trend alignment
      if (trend === 'up') score += 15;
      else if (trend === 'down') score -= 15;
      
      // RSI
      if (rsi < 30) score += 20; // Oversold
      else if (rsi < 40) score += 10;
      else if (rsi > 70) score -= 20; // Overbought
      else if (rsi > 60) score -= 10;
      
      // MACD
      if (macd.histogram > 0 && macd.value > macd.signal) score += 15;
      else if (macd.histogram < 0 && macd.value < macd.signal) score -= 15;
      
      // Price position
      if (pricePosition < 0.2) score += 15; // Near support
      else if (pricePosition > 0.8) score -= 15; // Near resistance
      
      // Price vs VWAP
      if (currentPrice > vwap) score += 5;
      else score -= 5;
      
      const signal = score > 20 ? 'buy' : score < -20 ? 'sell' : 'hold';
      
      results[name] = {
        timeframe: name,
        trend,
        support,
        resistance,
        rsi,
        macd,
        ema: { ema9, ema21, ema50 },
        vwap,
        atr,
        pricePosition,
        signal,
        score,
      };
    } catch (error) {
      console.error(`Technical ${name} error:`, error);
      results[name] = getEmptyTechnical(name);
    }
  }
  
  // Calculate alignment
  const totalScore = (results.m1?.score || 0) * 0.3 + (results.m5?.score || 0) * 0.5 + (results.m15?.score || 0) * 0.2;
  let alignment: 'strong_buy' | 'buy' | 'neutral' | 'sell' | 'strong_sell' = 'neutral';
  
  if (totalScore > 40) alignment = 'strong_buy';
  else if (totalScore > 15) alignment = 'buy';
  else if (totalScore < -40) alignment = 'strong_sell';
  else if (totalScore < -15) alignment = 'sell';
  
  return {
    m1: results.m1 || getEmptyTechnical('m1'),
    m5: results.m5 || getEmptyTechnical('m5'),
    m15: results.m15 || getEmptyTechnical('m15'),
    alignment,
    overallScore: totalScore,
  };
}

function getEmptyTechnical(tf: string): TechnicalData {
  return {
    timeframe: tf, trend: 'sideways', support: 0, resistance: 0, rsi: 50,
    macd: { value: 0, signal: 0, histogram: 0 },
    ema: { ema9: 0, ema21: 0, ema50: 0 }, vwap: 0, atr: 0, pricePosition: 0.5,
    signal: 'hold', score: 0,
  };
}

// ========================
// 3. FUNDAMENTAL ANALYSIS
// ========================
interface FundamentalData {
  marketCap: number;
  volume24h: number;
  volumeRank: 'high' | 'medium' | 'low';
  priceChange24h: number;
  priceChange7d: number;
  volatility: number;
  liquidityScore: number;
  tradingActivity: 'very_active' | 'active' | 'moderate' | 'low';
  signal: 'bullish' | 'bearish' | 'neutral';
  score: number;
}

async function fetchFundamentalAnalysis(symbol: string): Promise<FundamentalData> {
  try {
    const tickerResult = await makeBybitRequest('GET', '/v5/market/tickers', { category: 'linear', symbol });
    const ticker = tickerResult?.list?.[0] || {};
    
    const volume24h = parseFloat(ticker.turnover24h || '0');
    const priceChange24h = parseFloat(ticker.price24hPcnt || '0') * 100;
    const highPrice24h = parseFloat(ticker.highPrice24h || '0');
    const lowPrice24h = parseFloat(ticker.lowPrice24h || '0');
    const lastPrice = parseFloat(ticker.lastPrice || '0');
    
    // Calculate volatility
    const volatility = lastPrice > 0 ? ((highPrice24h - lowPrice24h) / lastPrice) * 100 : 0;
    
    // Volume ranking
    let volumeRank: 'high' | 'medium' | 'low' = 'low';
    if (volume24h > 1000000000) volumeRank = 'high'; // > $1B
    else if (volume24h > 100000000) volumeRank = 'medium'; // > $100M
    
    // Trading activity
    let tradingActivity: 'very_active' | 'active' | 'moderate' | 'low' = 'low';
    if (volume24h > 500000000 && volatility > 3) tradingActivity = 'very_active';
    else if (volume24h > 100000000 && volatility > 2) tradingActivity = 'active';
    else if (volume24h > 10000000) tradingActivity = 'moderate';
    
    // Liquidity score
    const liquidityScore = Math.min(100, (volume24h / 10000000));
    
    // Calculate score
    let score = 0;
    
    // Volume analysis
    if (volumeRank === 'high') score += 15;
    else if (volumeRank === 'medium') score += 8;
    
    // Price momentum
    if (priceChange24h > 5) score += 20;
    else if (priceChange24h > 2) score += 10;
    else if (priceChange24h < -5) score -= 20;
    else if (priceChange24h < -2) score -= 10;
    
    // Volatility (good for scalping)
    if (volatility > 2 && volatility < 8) score += 15; // Sweet spot
    else if (volatility > 8) score -= 10; // Too volatile
    else if (volatility < 1) score -= 15; // Too flat
    
    const signal = score > 15 ? 'bullish' : score < -15 ? 'bearish' : 'neutral';
    
    return {
      marketCap: 0, // Would need external API
      volume24h,
      volumeRank,
      priceChange24h,
      priceChange7d: 0,
      volatility,
      liquidityScore,
      tradingActivity,
      signal,
      score,
    };
  } catch (error) {
    console.error('Fundamental error:', error);
    return {
      marketCap: 0, volume24h: 0, volumeRank: 'low', priceChange24h: 0,
      priceChange7d: 0, volatility: 0, liquidityScore: 0,
      tradingActivity: 'low', signal: 'neutral', score: 0,
    };
  }
}

// ========================
// 4. SENTIMENT ANALYSIS
// ========================
interface SentimentData {
  fearGreedIndex: number;
  fearGreedLabel: 'extreme_fear' | 'fear' | 'neutral' | 'greed' | 'extreme_greed';
  socialBuzz: 'very_high' | 'high' | 'moderate' | 'low';
  newsImpact: 'positive' | 'negative' | 'neutral';
  marketMood: 'euphoric' | 'optimistic' | 'neutral' | 'pessimistic' | 'panic';
  signal: 'bullish' | 'bearish' | 'neutral';
  score: number;
}

async function fetchSentimentAnalysis(symbol: string, technical: MultiTimeframeTechnical, onChain: OnChainData): Promise<SentimentData> {
  // Derive sentiment from market data (no external API needed)
  
  // Fear & Greed estimation from volatility + OI + funding
  let fearGreedIndex = 50;
  
  // Funding rate impact
  if (onChain.fundingRate > 0.03) fearGreedIndex += 15; // High greed
  else if (onChain.fundingRate > 0.01) fearGreedIndex += 8;
  else if (onChain.fundingRate < -0.01) fearGreedIndex -= 10;
  else if (onChain.fundingRate < -0.03) fearGreedIndex -= 20;
  
  // OI change impact
  if (onChain.openInterestChange > 10) fearGreedIndex += 10;
  else if (onChain.openInterestChange < -10) fearGreedIndex -= 15;
  
  // Technical RSI impact
  const avgRSI = (technical.m1.rsi + technical.m5.rsi + technical.m15.rsi) / 3;
  if (avgRSI > 70) fearGreedIndex += 15;
  else if (avgRSI > 60) fearGreedIndex += 8;
  else if (avgRSI < 30) fearGreedIndex -= 15;
  else if (avgRSI < 40) fearGreedIndex -= 8;
  
  fearGreedIndex = Math.max(0, Math.min(100, fearGreedIndex));
  
  // Determine label
  let fearGreedLabel: 'extreme_fear' | 'fear' | 'neutral' | 'greed' | 'extreme_greed' = 'neutral';
  if (fearGreedIndex >= 80) fearGreedLabel = 'extreme_greed';
  else if (fearGreedIndex >= 60) fearGreedLabel = 'greed';
  else if (fearGreedIndex <= 20) fearGreedLabel = 'extreme_fear';
  else if (fearGreedIndex <= 40) fearGreedLabel = 'fear';
  
  // Market mood
  let marketMood: 'euphoric' | 'optimistic' | 'neutral' | 'pessimistic' | 'panic' = 'neutral';
  if (fearGreedIndex >= 85) marketMood = 'euphoric';
  else if (fearGreedIndex >= 65) marketMood = 'optimistic';
  else if (fearGreedIndex <= 15) marketMood = 'panic';
  else if (fearGreedIndex <= 35) marketMood = 'pessimistic';
  
  // Calculate score (contrarian approach for extreme values)
  let score = 0;
  
  // Extreme fear = buying opportunity
  if (fearGreedLabel === 'extreme_fear') score += 25;
  else if (fearGreedLabel === 'fear') score += 10;
  // Extreme greed = selling opportunity
  else if (fearGreedLabel === 'extreme_greed') score -= 25;
  else if (fearGreedLabel === 'greed') score -= 10;
  
  const signal = score > 10 ? 'bullish' : score < -10 ? 'bearish' : 'neutral';
  
  return {
    fearGreedIndex,
    fearGreedLabel,
    socialBuzz: 'moderate',
    newsImpact: 'neutral',
    marketMood,
    signal,
    score,
  };
}

// ========================
// TECHNICAL INDICATOR CALCULATIONS
// ========================
function calculateEMA(data: number[], period: number): number {
  if (data.length < period) return data[data.length - 1] || 0;
  const k = 2 / (period + 1);
  let ema = data.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < data.length; i++) {
    ema = data[i] * k + ema * (1 - k);
  }
  return ema;
}

function calculateRSI(closes: number[], period: number): number {
  if (closes.length < period + 1) return 50;
  
  let gains = 0, losses = 0;
  for (let i = closes.length - period; i < closes.length; i++) {
    const change = closes[i] - closes[i - 1];
    if (change > 0) gains += change;
    else losses -= change;
  }
  
  const avgGain = gains / period;
  const avgLoss = losses / period;
  if (avgLoss === 0) return 100;
  
  const rs = avgGain / avgLoss;
  return 100 - (100 / (1 + rs));
}

function calculateMACD(closes: number[]): { value: number; signal: number; histogram: number } {
  const ema12 = calculateEMA(closes, 12);
  const ema26 = calculateEMA(closes, 26);
  const macdLine = ema12 - ema26;
  
  // Signal line (9-period EMA of MACD)
  const macdValues = closes.slice(-30).map((_, i, arr) => {
    const e12 = calculateEMA(closes.slice(0, closes.length - 30 + i + 1), 12);
    const e26 = calculateEMA(closes.slice(0, closes.length - 30 + i + 1), 26);
    return e12 - e26;
  });
  const signalLine = calculateEMA(macdValues, 9);
  
  return {
    value: macdLine,
    signal: signalLine,
    histogram: macdLine - signalLine,
  };
}

function calculateATR(highs: number[], lows: number[], closes: number[], period: number): number {
  if (highs.length < period + 1) return 0;
  
  let atr = 0;
  for (let i = highs.length - period; i < highs.length; i++) {
    const tr = Math.max(
      highs[i] - lows[i],
      Math.abs(highs[i] - closes[i - 1]),
      Math.abs(lows[i] - closes[i - 1])
    );
    atr += tr;
  }
  return atr / period;
}

function calculateVWAP(candles: any[]): number {
  let cumVolPrice = 0;
  let cumVol = 0;
  for (const c of candles) {
    const typicalPrice = (c.high + c.low + c.close) / 3;
    cumVolPrice += typicalPrice * c.volume;
    cumVol += c.volume;
  }
  return cumVol > 0 ? cumVolPrice / cumVol : 0;
}

function findSupportResistance(candles: any[]): { support: number; resistance: number } {
  if (candles.length < 10) {
    const last = candles[candles.length - 1];
    return { support: last?.low || 0, resistance: last?.high || 0 };
  }
  
  const swingHighs: number[] = [];
  const swingLows: number[] = [];
  
  for (let i = 2; i < candles.length - 2; i++) {
    const c = candles[i];
    const prevHigh = Math.max(candles[i-1].high, candles[i-2].high);
    const nextHigh = Math.max(candles[i+1].high, candles[i+2].high);
    const prevLow = Math.min(candles[i-1].low, candles[i-2].low);
    const nextLow = Math.min(candles[i+1].low, candles[i+2].low);
    
    if (c.high > prevHigh && c.high > nextHigh) swingHighs.push(c.high);
    if (c.low < prevLow && c.low < nextLow) swingLows.push(c.low);
  }
  
  const currentPrice = candles[candles.length - 1].close;
  
  // Find nearest support (below current price)
  const supports = swingLows.filter(l => l < currentPrice).sort((a, b) => b - a);
  const support = supports[0] || candles.reduce((min, c) => Math.min(min, c.low), Infinity);
  
  // Find nearest resistance (above current price)
  const resistances = swingHighs.filter(h => h > currentPrice).sort((a, b) => a - b);
  const resistance = resistances[0] || candles.reduce((max, c) => Math.max(max, c.high), 0);
  
  return { support, resistance };
}

// ========================
// MAIN HANDLER
// ========================
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { symbol, userId } = await req.json();
    const targetSymbol = symbol || 'BTCUSDT';
    
    console.log(`🧠 Análise Completa: ${targetSymbol}`);
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Fetch all analyses in parallel
    const [onChain, technical, fundamental] = await Promise.all([
      fetchOnChainAnalysis(targetSymbol),
      fetchTechnicalAnalysis(targetSymbol),
      fetchFundamentalAnalysis(targetSymbol),
    ]);
    
    // Sentiment derived from other data
    const sentiment = await fetchSentimentAnalysis(targetSymbol, technical, onChain);
    
    // ========================
    // COMPOSITE SCORE CALCULATION
    // ========================
    const weights = {
      onChain: 0.25,
      technical: 0.40,
      fundamental: 0.15,
      sentiment: 0.20,
    };
    
    const compositeScore = 
      onChain.score * weights.onChain +
      technical.overallScore * weights.technical +
      fundamental.score * weights.fundamental +
      sentiment.score * weights.sentiment;
    
    // ========================
    // SCALPING CONFIG (CONSERVADOR - stops apertados)
    // ========================
    const currentPrice = technical.m1.ema.ema9 || 0;
    const m5Support = technical.m5.support;
    const m5Resistance = technical.m5.resistance;
    const m1Signal = technical.m1.signal;
    const m5Trend = technical.m5.trend;
    const m15Trend = technical.m15.trend;
    
    // 🎯 STOPS CONSERVADORES para reduzir perdas
    const maxSL = 0.0025; // 0.25% máximo
    const maxTP = 0.004;  // 0.4% máximo
    
    // Scalping entry conditions (MAIS RIGOROSOS)
    let scalpingAction: 'buy' | 'sell' | 'wait' = 'wait';
    let confidence = 0;
    const reasons: string[] = [];
    
    // Momentum confirmation
    const macdBullish = technical.m1.macd.histogram > 0 && technical.m5.macd.histogram > 0;
    const macdBearish = technical.m1.macd.histogram < 0 && technical.m5.macd.histogram < 0;
    const rsiOversold = technical.m1.rsi < 35 && technical.m5.rsi < 40;
    const rsiOverbought = technical.m1.rsi > 65 && technical.m5.rsi > 60;
    const trendAligned = m5Trend === m15Trend && m5Trend !== 'sideways';
    const volumeOk = fundamental.tradingActivity !== 'low';
    
    // Pontuação de entrada
    let entryScore = 0;
    
    // BUY CONDITIONS
    if (m1Signal === 'buy' || compositeScore > 25) {
      // Proximidade ao suporte 5m
      if (technical.m1.pricePosition < 0.25) {
        entryScore += 20;
        reasons.push('📍 Perto do suporte 5m');
      }
      // RSI oversold
      if (rsiOversold) {
        entryScore += 25;
        reasons.push(`📉 RSI oversold: ${technical.m1.rsi.toFixed(0)}`);
      }
      // MACD bullish
      if (macdBullish) {
        entryScore += 15;
        reasons.push('📈 MACD bullish');
      }
      // Trend aligned
      if (trendAligned && m5Trend === 'up') {
        entryScore += 20;
        reasons.push('⬆️ Trend alinhado');
      }
      // On-chain bullish
      if (onChain.signal === 'bullish') {
        entryScore += 15;
        reasons.push(`📊 OnChain: funding ${onChain.fundingRate.toFixed(3)}%`);
      }
      // Volume ok
      if (volumeOk) entryScore += 5;
      
      if (entryScore >= 40 && m5Trend !== 'down') {
        scalpingAction = 'buy';
        confidence = Math.min(85, 40 + entryScore * 0.5);
      }
    }
    
    // SELL CONDITIONS
    if (scalpingAction === 'wait' && (m1Signal === 'sell' || compositeScore < -25)) {
      entryScore = 0;
      reasons.length = 0;
      
      // Proximidade à resistência 5m
      if (technical.m1.pricePosition > 0.75) {
        entryScore += 20;
        reasons.push('📍 Perto da resistência 5m');
      }
      // RSI overbought
      if (rsiOverbought) {
        entryScore += 25;
        reasons.push(`📈 RSI overbought: ${technical.m1.rsi.toFixed(0)}`);
      }
      // MACD bearish
      if (macdBearish) {
        entryScore += 15;
        reasons.push('📉 MACD bearish');
      }
      // Trend aligned
      if (trendAligned && m5Trend === 'down') {
        entryScore += 20;
        reasons.push('⬇️ Trend alinhado');
      }
      // On-chain bearish
      if (onChain.signal === 'bearish') {
        entryScore += 15;
        reasons.push(`📊 OnChain: funding ${onChain.fundingRate.toFixed(3)}%`);
      }
      // Volume ok
      if (volumeOk) entryScore += 5;
      
      if (entryScore >= 40 && m5Trend !== 'up') {
        scalpingAction = 'sell';
        confidence = Math.min(85, 40 + entryScore * 0.5);
      }
    }
    
    // Penalidades de confiança
    if (sentiment.fearGreedLabel === 'extreme_greed' && scalpingAction === 'buy') {
      confidence -= 15;
      reasons.push('⚠️ Extreme greed - cautela');
    }
    if (sentiment.fearGreedLabel === 'extreme_fear' && scalpingAction === 'sell') {
      confidence -= 15;
      reasons.push('⚠️ Extreme fear - cautela');
    }
    if (!volumeOk) {
      confidence -= 10;
      reasons.push('⚠️ Volume baixo');
    }
    
    confidence = Math.max(0, Math.min(90, confidence));
    
    // Calcular SL/TP CONSERVADORES
    const slDistance = currentPrice * maxSL;
    const tpDistance = currentPrice * maxTP;
    
    const scalpingConfig = {
      action: scalpingAction,
      confidence,
      entryPrice: currentPrice,
      stopLoss: scalpingAction === 'buy' ? currentPrice - slDistance : currentPrice + slDistance,
      takeProfit: scalpingAction === 'buy' ? currentPrice + tpDistance : currentPrice - tpDistance,
      support5m: m5Support,
      resistance5m: m5Resistance,
      riskReward: maxTP / maxSL,
      reasoning: reasons.length > 0 ? reasons : ['⏳ Aguardando setup de alta qualidade'],
    };
    
    // ========================
    // AI INSIGHTS
    // ========================
    let aiInsights: any = {};
    
    try {
      const aiPrompt = `Trader SCALPING crypto CONSERVADOR. SL máx 0.25%, TP máx 0.4%.

${targetSymbol} @ ${currentPrice.toFixed(2)}:

ON-CHAIN: Funding ${onChain.fundingRate.toFixed(4)}% | OI ${onChain.openInterestChange > 0 ? '+' : ''}${onChain.openInterestChange.toFixed(1)}% | L/S ${onChain.longShortRatio.toFixed(2)} | ${onChain.whaleActivity} | Score ${onChain.score}

TÉCNICO:
1m: ${technical.m1.signal} RSI ${technical.m1.rsi.toFixed(0)} MACD ${technical.m1.macd.histogram > 0 ? '▲' : '▼'}
5m: ${technical.m5.trend} RSI ${technical.m5.rsi.toFixed(0)} S ${m5Support.toFixed(2)} R ${m5Resistance.toFixed(2)}
15m: ${technical.m15.trend} | Alinhamento: ${technical.alignment} | Score ${technical.overallScore.toFixed(0)}

MERCADO: Vol $${(fundamental.volume24h/1e6).toFixed(0)}M | Volat ${fundamental.volatility.toFixed(1)}% | ${fundamental.tradingActivity}

SENTIMENTO: ${sentiment.fearGreedIndex} ${sentiment.fearGreedLabel} | ${sentiment.marketMood}

SCORE GERAL: ${compositeScore.toFixed(0)} | Pré-análise: ${scalpingConfig.action} ${scalpingConfig.confidence}%

REGRAS:
- WAIT se incerto ou condições não ideais
- BUY só se RSI<40, suporte próximo, trend up
- SELL só se RSI>60, resistência próxima, trend down
- Confidence >70 para entrar

JSON: {"action":"buy"|"sell"|"wait","confidence":0-100,"reason":"motivo principal em 10 palavras","warning":"risco se houver","leverage":15-25}`;

      const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${lovableApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'google/gemini-2.5-pro', // 🔥 Upgrade para modelo mais potente
          messages: [
            { 
              role: 'system', 
              content: `Você é um trader quantitativo de elite especializado em scalping de criptomoedas. 
Sua análise é usada para decisões REAIS com dinheiro real.
Seja EXTREMAMENTE preciso e conservador. Priorize preservação de capital.
WAIT é sempre preferível a um trade duvidoso.
Responda APENAS em JSON válido, sem markdown.` 
            },
            { role: 'user', content: aiPrompt }
          ],
          max_tokens: 1000,
          temperature: 0.2, // Mais determinístico
        }),
      });

      if (aiResponse.ok) {
        const aiData = await aiResponse.json();
        const aiContent = aiData.choices[0].message.content;
        const jsonMatch = aiContent.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          aiInsights = JSON.parse(jsonMatch[0]);
          console.log('✅ AI insights recebidos (modelo: gemini-2.5-pro)');
        }
      }
    } catch (e) {
      console.log('⚠️ AI skipped:', e);
    }
    
    // ========================
    // SAVE TO DB
    // ========================
    const analysisResult = {
      symbol: targetSymbol,
      timestamp: new Date().toISOString(),
      onChain,
      technical,
      fundamental,
      sentiment,
      compositeScore,
      scalpingConfig,
      aiInsights,
    };
    
    // Save to ai_market_signals
    await supabase.from('ai_market_signals').insert({
      currency_pair: targetSymbol,
      signal_type: 'comprehensive',
      action: scalpingConfig.action,
      confidence_score: scalpingConfig.confidence,
      price_target: scalpingConfig.takeProfit,
      stop_loss: scalpingConfig.stopLoss,
      take_profit: scalpingConfig.takeProfit,
      timeframe: '1m-5m',
      reasoning: {
        onChain: onChain.signal,
        technical: technical.alignment,
        fundamental: fundamental.signal,
        sentiment: sentiment.signal,
        compositeScore,
        aiInsights,
      },
      data_sources: {
        onChain: true,
        technical: true,
        fundamental: true,
        sentiment: true,
      },
    });
    
    console.log(`✅ Análise completa: ${targetSymbol} | Score: ${compositeScore.toFixed(0)} | Ação: ${scalpingConfig.action}`);
    
    return new Response(JSON.stringify({
      success: true,
      analysis: analysisResult,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
    
  } catch (error) {
    console.error('❌ Erro análise:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
