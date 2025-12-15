import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface OnChainData {
  fundingRate: number;
  openInterest: number;
  openInterestChange: number;
  longShortRatio: number;
  whaleActivity: 'buying' | 'selling' | 'neutral';
  signal: 'bullish' | 'bearish' | 'neutral';
  score: number;
}

export interface TechnicalData {
  timeframe: string;
  trend: 'up' | 'down' | 'sideways';
  support: number;
  resistance: number;
  rsi: number;
  macd: { value: number; signal: number; histogram: number };
  ema: { ema9: number; ema21: number; ema50: number };
  vwap: number;
  atr: number;
  pricePosition: number;
  signal: 'buy' | 'sell' | 'hold';
  score: number;
}

export interface MultiTimeframeTechnical {
  m1: TechnicalData;
  m5: TechnicalData;
  m15: TechnicalData;
  alignment: 'strong_buy' | 'buy' | 'neutral' | 'sell' | 'strong_sell';
  overallScore: number;
}

export interface FundamentalData {
  volume24h: number;
  volumeRank: 'high' | 'medium' | 'low';
  priceChange24h: number;
  volatility: number;
  liquidityScore: number;
  tradingActivity: 'very_active' | 'active' | 'moderate' | 'low';
  signal: 'bullish' | 'bearish' | 'neutral';
  score: number;
}

export interface SentimentData {
  fearGreedIndex: number;
  fearGreedLabel: 'extreme_fear' | 'fear' | 'neutral' | 'greed' | 'extreme_greed';
  marketMood: 'euphoric' | 'optimistic' | 'neutral' | 'pessimistic' | 'panic';
  signal: 'bullish' | 'bearish' | 'neutral';
  score: number;
}

export interface ScalpingConfig {
  action: 'buy' | 'sell' | 'wait';
  confidence: number;
  entryPrice: number;
  stopLoss: number;
  takeProfit: number;
  support5m: number;
  resistance5m: number;
  riskReward: number;
  reasoning: string[];
}

export interface ComprehensiveAnalysis {
  symbol: string;
  timestamp: string;
  onChain: OnChainData;
  technical: MultiTimeframeTechnical;
  fundamental: FundamentalData;
  sentiment: SentimentData;
  compositeScore: number;
  scalpingConfig: ScalpingConfig;
  aiInsights: any;
}

export const useComprehensiveAI = () => {
  const [analysis, setAnalysis] = useState<ComprehensiveAnalysis | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAnalysis = useCallback(async (symbol: string, userId?: string) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const { data, error: fnError } = await supabase.functions.invoke('ai-comprehensive-analysis', {
        body: { symbol, userId },
      });
      
      if (fnError) throw fnError;
      
      if (data?.success && data?.analysis) {
        setAnalysis(data.analysis);
        return data.analysis;
      } else {
        throw new Error(data?.error || 'Análise falhou');
      }
    } catch (err: any) {
      const msg = err.message || 'Erro na análise';
      setError(msg);
      toast.error(msg);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Quick scoring for trade decisions
  const shouldEnterTrade = useCallback((minScore: number = 25, minConfidence: number = 60): { 
    shouldEnter: boolean; 
    action: 'buy' | 'sell' | null;
    reason: string;
  } => {
    if (!analysis) return { shouldEnter: false, action: null, reason: 'Sem análise' };
    
    const { compositeScore, scalpingConfig, technical, sentiment } = analysis;
    
    // Check composite score
    if (Math.abs(compositeScore) < minScore) {
      return { shouldEnter: false, action: null, reason: `Score ${compositeScore.toFixed(0)} < ${minScore}` };
    }
    
    // Check confidence
    if (scalpingConfig.confidence < minConfidence) {
      return { shouldEnter: false, action: null, reason: `Confiança ${scalpingConfig.confidence}% < ${minConfidence}%` };
    }
    
    // Check alignment
    if (technical.alignment === 'neutral') {
      return { shouldEnter: false, action: null, reason: 'Timeframes não alinhados' };
    }
    
    // Check extreme sentiment (contrarian)
    if (sentiment.fearGreedLabel === 'extreme_greed' && scalpingConfig.action === 'buy') {
      return { shouldEnter: false, action: null, reason: 'Extreme greed - evitar longs' };
    }
    if (sentiment.fearGreedLabel === 'extreme_fear' && scalpingConfig.action === 'sell') {
      return { shouldEnter: false, action: null, reason: 'Extreme fear - evitar shorts' };
    }
    
    return {
      shouldEnter: scalpingConfig.action !== 'wait',
      action: scalpingConfig.action === 'wait' ? null : scalpingConfig.action,
      reason: scalpingConfig.reasoning.join(' | '),
    };
  }, [analysis]);

  // Get optimal entry parameters
  const getEntryParams = useCallback(() => {
    if (!analysis) return null;
    
    const { scalpingConfig, technical, compositeScore } = analysis;
    
    // Dynamic leverage based on confidence and volatility
    let suggestedLeverage = 20;
    if (scalpingConfig.confidence > 80) suggestedLeverage = 40;
    else if (scalpingConfig.confidence > 70) suggestedLeverage = 30;
    else if (scalpingConfig.confidence < 60) suggestedLeverage = 15;
    
    // Reduce leverage in high volatility
    if (technical.m1.atr > technical.m1.ema.ema9 * 0.02) {
      suggestedLeverage *= 0.7;
    }
    
    return {
      action: scalpingConfig.action,
      entryPrice: scalpingConfig.entryPrice,
      stopLoss: scalpingConfig.stopLoss,
      takeProfit: scalpingConfig.takeProfit,
      support: scalpingConfig.support5m,
      resistance: scalpingConfig.resistance5m,
      confidence: scalpingConfig.confidence,
      suggestedLeverage: Math.round(suggestedLeverage),
      compositeScore,
      reasoning: scalpingConfig.reasoning,
    };
  }, [analysis]);

  return {
    analysis,
    isLoading,
    error,
    fetchAnalysis,
    shouldEnterTrade,
    getEntryParams,
  };
};
