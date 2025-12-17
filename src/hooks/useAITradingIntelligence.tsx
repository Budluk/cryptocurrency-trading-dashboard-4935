import { useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface WinningPatterns {
  winRate: number;
  profitFactor: number;
  avgWinSize: number;
  avgLossSize: number;
  bestHours: { hour: number; winRate: number; totalPnl: number }[];
  bestSymbols: { symbol: string; winRate: number; totalPnl: number }[];
  totalTrades: number;
}

interface AIRecommendations {
  optimalLeverage: number;
  optimalStopLoss: number;
  optimalTakeProfit: number;
  bestTradingHours: number[];
  symbolsToFocus: string[];
  symbolsToAvoid: string[];
  riskPerTrade: number;
  maxConcurrentPositions: number;
  insights: string;
}

interface WhaleAnalysis {
  signal: 'BUY' | 'SELL' | 'NEUTRAL';
  confidence: number;
  buyPressure: number;
  sellPressure: number;
  whaleDirection: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  pattern: string;
  insights: string;
}

interface SentimentAnalysis {
  sentiment: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  confidence: number;
  fearGreedIndex: number;
  socialScore: number;
  keyFactors: string[];
  recommendation: string;
}

interface TradingSignal {
  symbol: string;
  signal: 'BUY' | 'SELL' | 'NEUTRAL';
  score: number;
  confidence: number;
  components: {
    whaleSignal: string;
    whaleConfidence: number;
    sentiment: string;
    sentimentConfidence: number;
    historicalEdge: boolean;
  };
  parameters: {
    suggestedLeverage: number;
    suggestedStopLoss: number;
    suggestedTakeProfit: number;
    riskPerTrade: number;
  };
  insights: string[];
}

export const useAITradingIntelligence = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [patterns, setPatterns] = useState<WinningPatterns | null>(null);
  const [recommendations, setRecommendations] = useState<AIRecommendations | null>(null);
  const [whaleAnalysis, setWhaleAnalysis] = useState<WhaleAnalysis | null>(null);
  const [sentimentAnalysis, setSentimentAnalysis] = useState<SentimentAnalysis | null>(null);
  const [tradingSignal, setTradingSignal] = useState<TradingSignal | null>(null);
  const [lastTrainingTime, setLastTrainingTime] = useState<Date | null>(null);

  const lastAnalysisRef = useRef<Map<string, number>>(new Map());

  // 📊 Buscar histórico de trades do Bybit
  const fetchBybitHistory = useCallback(async (): Promise<any[]> => {
    try {
      const { data, error } = await supabase.functions.invoke('bybit-trading', {
        body: {
          action: 'get_closed_pnl',
          isTestnet: false,
          params: { category: 'linear', limit: 100 }
        }
      });

      if (error) {
        console.error('Erro ao buscar histórico Bybit:', error);
        return [];
      }

      return data?.data?.list || [];
    } catch (err) {
      console.error('Erro ao buscar histórico:', err);
      return [];
    }
  }, []);

  // 🧠 Treinar IA com padrões vencedores
  const trainOnWinningPatterns = useCallback(async () => {
    setIsLoading(true);
    console.log('🧠 Iniciando treinamento de IA com padrões vencedores...');

    try {
      const bybitTrades = await fetchBybitHistory();
      
      if (bybitTrades.length < 10) {
        console.log('⚠️ Poucos trades para análise (mínimo 10)');
        return null;
      }

      console.log(`📊 Analisando ${bybitTrades.length} trades históricos...`);

      const { data, error } = await supabase.functions.invoke('ai-trading-intelligence', {
        body: {
          action: 'analyze_winning_patterns',
          bybitTrades
        }
      });

      if (error) {
        console.error('Erro na análise de padrões:', error);
        return null;
      }

      if (data?.success) {
        setPatterns(data.data.patterns);
        setRecommendations(data.data.recommendations);
        setLastTrainingTime(new Date());
        
        console.log('✅ Treinamento concluído:', data.data.recommendations);
        return data.data;
      }

      return null;
    } catch (err) {
      console.error('Erro no treinamento:', err);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [fetchBybitHistory]);

  // 🐋 Analisar atividade de grandes players
  const analyzeWhales = useCallback(async (symbol?: string) => {
    // Rate limit: 1 análise por minuto por símbolo
    const key = symbol || 'all';
    const lastTime = lastAnalysisRef.current.get(`whale-${key}`) || 0;
    if (Date.now() - lastTime < 60000) {
      return whaleAnalysis;
    }
    lastAnalysisRef.current.set(`whale-${key}`, Date.now());

    try {
      // Buscar grandes ordens do banco
      const { data: largeOrders } = await supabase
        .from('large_orders')
        .select('*')
        .order('detected_at', { ascending: false })
        .limit(50);

      const { data, error } = await supabase.functions.invoke('ai-trading-intelligence', {
        body: {
          action: 'analyze_whale_activity',
          symbol,
          largeOrders: largeOrders || []
        }
      });

      if (!error && data?.success) {
        setWhaleAnalysis(data.data);
        console.log(`🐋 Análise de baleias para ${symbol || 'mercado'}:`, data.data.insights);
        return data.data;
      }

      return null;
    } catch (err) {
      console.error('Erro na análise de baleias:', err);
      return null;
    }
  }, [whaleAnalysis]);

  // 📰 Analisar sentimento do mercado
  const analyzeSentiment = useCallback(async (symbol: string) => {
    const lastTime = lastAnalysisRef.current.get(`sentiment-${symbol}`) || 0;
    if (Date.now() - lastTime < 120000) { // 2 min cooldown
      return sentimentAnalysis;
    }
    lastAnalysisRef.current.set(`sentiment-${symbol}`, Date.now());

    try {
      const { data, error } = await supabase.functions.invoke('ai-trading-intelligence', {
        body: {
          action: 'sentiment_analysis',
          symbol
        }
      });

      if (!error && data?.success) {
        setSentimentAnalysis(data.data);
        console.log(`📰 Sentimento para ${symbol}:`, data.data.sentiment, data.data.recommendation);
        return data.data;
      }

      return null;
    } catch (err) {
      console.error('Erro na análise de sentimento:', err);
      return null;
    }
  }, [sentimentAnalysis]);

  // 🎯 Obter sinal de trading completo
  const getTradingSignal = useCallback(async (symbol: string): Promise<TradingSignal | null> => {
    setIsLoading(true);
    console.log(`🎯 Gerando sinal de trading para ${symbol}...`);

    try {
      // Buscar dados necessários
      const bybitTrades = await fetchBybitHistory();
      
      const { data: largeOrders } = await supabase
        .from('large_orders')
        .select('*')
        .order('detected_at', { ascending: false })
        .limit(30);

      const { data, error } = await supabase.functions.invoke('ai-trading-intelligence', {
        body: {
          action: 'get_trading_signal',
          symbol,
          bybitTrades,
          largeOrders: largeOrders || []
        }
      });

      if (error) {
        console.error('Erro ao obter sinal:', error);
        return null;
      }

      if (data?.success) {
        setTradingSignal(data.data);
        console.log(`✅ Sinal para ${symbol}:`, data.data.signal, `(${data.data.confidence}% confiança)`);
        return data.data;
      }

      return null;
    } catch (err) {
      console.error('Erro ao obter sinal:', err);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [fetchBybitHistory]);

  // 🔄 Validar trade com IA antes de executar
  const validateTradeWithAI = useCallback(async (
    symbol: string,
    side: 'Buy' | 'Sell',
    currentScore: number
  ): Promise<{ approved: boolean; adjustedScore: number; reason: string }> => {
    try {
      const signal = await getTradingSignal(symbol);
      
      if (!signal) {
        return { approved: true, adjustedScore: currentScore, reason: 'Sem dados de IA disponíveis' };
      }

      let adjustedScore = currentScore;
      let approved = true;
      let reason = '';

      // Verificar alinhamento com sinal da IA
      if (signal.signal === 'NEUTRAL') {
        adjustedScore -= 10;
        reason = 'IA neutra - cautela recomendada';
      } else if ((side === 'Buy' && signal.signal === 'SELL') || (side === 'Sell' && signal.signal === 'BUY')) {
        adjustedScore -= 25;
        reason = `IA sugere ${signal.signal}, você está tentando ${side}`;
        if (signal.confidence >= 70) {
          approved = false;
          reason += ' - BLOQUEADO por alta confiança da IA';
        }
      } else if ((side === 'Buy' && signal.signal === 'BUY') || (side === 'Sell' && signal.signal === 'SELL')) {
        adjustedScore += 15;
        reason = `✅ Alinhado com sinal da IA (${signal.confidence}% confiança)`;
      }

      // Verificar baleias
      if (signal.components.whaleConfidence >= 60) {
        if ((side === 'Buy' && signal.components.whaleSignal === 'SELL') ||
            (side === 'Sell' && signal.components.whaleSignal === 'BUY')) {
          adjustedScore -= 15;
          reason += ' | ⚠️ Baleias em direção oposta';
        } else if ((side === 'Buy' && signal.components.whaleSignal === 'BUY') ||
                   (side === 'Sell' && signal.components.whaleSignal === 'SELL')) {
          adjustedScore += 10;
          reason += ' | 🐋 Baleias na mesma direção';
        }
      }

      // Verificar sentimento
      if (signal.components.sentimentConfidence >= 60) {
        if ((side === 'Buy' && signal.components.sentiment === 'BEARISH') ||
            (side === 'Sell' && signal.components.sentiment === 'BULLISH')) {
          adjustedScore -= 10;
          reason += ' | 📰 Sentimento contrário';
        }
      }

      return {
        approved,
        adjustedScore: Math.max(0, Math.min(100, adjustedScore)),
        reason
      };
    } catch (err) {
      console.error('Erro na validação:', err);
      return { approved: true, adjustedScore: currentScore, reason: 'Erro na validação IA' };
    }
  }, [getTradingSignal]);

  // 📈 Obter parâmetros otimizados
  const getOptimizedParameters = useCallback((symbol: string) => {
    if (!recommendations) {
      return {
        leverage: 15,
        stopLoss: 0.15,
        takeProfit: 0.35,
        riskPerTrade: 2
      };
    }

    const isTopSymbol = recommendations.symbolsToFocus?.includes(symbol);
    const currentHour = new Date().getUTCHours();
    const isBestHour = recommendations.bestTradingHours?.includes(currentHour);

    // Ajustar baseado no contexto
    let leverage = recommendations.optimalLeverage;
    let stopLoss = recommendations.optimalStopLoss;
    let takeProfit = recommendations.optimalTakeProfit;

    if (isTopSymbol && isBestHour) {
      leverage = Math.min(leverage * 1.2, 50);
      takeProfit *= 1.15;
    } else if (!isTopSymbol) {
      leverage = Math.max(leverage * 0.7, 10);
      stopLoss *= 0.85; // SL mais apertado
    }

    return {
      leverage: Math.round(leverage),
      stopLoss: Math.round(stopLoss * 1000) / 1000,
      takeProfit: Math.round(takeProfit * 1000) / 1000,
      riskPerTrade: recommendations.riskPerTrade
    };
  }, [recommendations]);

  return {
    // Estado
    isLoading,
    patterns,
    recommendations,
    whaleAnalysis,
    sentimentAnalysis,
    tradingSignal,
    lastTrainingTime,

    // Ações
    trainOnWinningPatterns,
    analyzeWhales,
    analyzeSentiment,
    getTradingSignal,
    validateTradeWithAI,
    getOptimizedParameters,
    fetchBybitHistory,
  };
};
