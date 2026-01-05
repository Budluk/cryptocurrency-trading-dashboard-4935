import { useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface NewsSentiment {
  sentiment: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  confidence: number;
  keyNews: string[];
  catalysts: string[];
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  recommendation: 'LONG' | 'SHORT' | 'WAIT';
  reasoning: string;
  symbol: string;
  source: string; // 'simulated' | 'perplexity' | etc
  analyzedAt: string;
}

interface MarketEvent {
  title: string;
  type: string;
  impact: 'HIGH' | 'MEDIUM' | 'LOW';
  expectedTime: string;
  affectedAssets: string[];
  expectedDirection: 'BULLISH' | 'BEARISH' | 'UNCERTAIN';
  tradingAdvice: string;
}

interface WhaleAlert {
  symbol: string;
  type: 'ACCUMULATION' | 'DISTRIBUTION' | 'EXCHANGE_INFLOW' | 'EXCHANGE_OUTFLOW';
  amount: string;
  impact: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  confidence: number;
  details: string;
}

interface FearGreedData {
  value: number;
  classification: string;
  sentiment: 'EXTREME_FEAR' | 'FEAR' | 'NEUTRAL' | 'GREED' | 'EXTREME_GREED';
  tradingAdvice: string;
  longBias: 'FAVORABLE' | 'UNFAVORABLE' | 'NEUTRAL';
  shortBias: 'FAVORABLE' | 'UNFAVORABLE' | 'NEUTRAL';
  source: string;
  analyzedAt: string;
}

interface TradeValidation {
  approved: boolean;
  adjustedConfidence: number;
  reasons: string[];
  warnings: string[];
  recommendation: 'PROCEED' | 'CAUTION' | 'AVOID';
}

export const useMarketIntelligence = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [newsSentiment, setNewsSentiment] = useState<Map<string, NewsSentiment>>(new Map());
  const [marketEvents, setMarketEvents] = useState<MarketEvent[]>([]);
  const [whaleAlerts, setWhaleAlerts] = useState<WhaleAlert[]>([]);
  const [fearGreed, setFearGreed] = useState<FearGreedData | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  // Cache para evitar chamadas excessivas
  const cacheRef = useRef<Map<string, { data: any; timestamp: number }>>(new Map());
  const CACHE_TTL = 5 * 60 * 1000; // 5 minutos

  // 📰 Buscar sentimento de notícias para um símbolo
  const fetchNewsSentiment = useCallback(async (symbol: string): Promise<NewsSentiment | null> => {
    const cacheKey = `news-${symbol}`;
    const cached = cacheRef.current.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return cached.data;
    }

    try {
      const { data, error } = await supabase.functions.invoke('market-intelligence', {
        body: { action: 'get_news_sentiment', symbol }
      });

      if (error) {
        console.error('Erro ao buscar notícias:', error);
        return null;
      }

      if (data?.success) {
        const sentiment = data.data as NewsSentiment;
        setNewsSentiment(prev => new Map(prev).set(symbol, sentiment));
        cacheRef.current.set(cacheKey, { data: sentiment, timestamp: Date.now() });
        console.log(`📰 Sentimento ${symbol}: ${sentiment.sentiment} (${sentiment.confidence}%)`);
        return sentiment;
      }

      return null;
    } catch (err) {
      console.error('Erro ao buscar sentimento:', err);
      return null;
    }
  }, []);

  // 🌐 Buscar eventos de mercado
  const fetchMarketEvents = useCallback(async (): Promise<MarketEvent[]> => {
    const cacheKey = 'market-events';
    const cached = cacheRef.current.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return cached.data;
    }

    try {
      const { data, error } = await supabase.functions.invoke('market-intelligence', {
        body: { action: 'get_market_events' }
      });

      if (error) {
        console.error('Erro ao buscar eventos:', error);
        return [];
      }

      if (data?.success && data.data?.events) {
        setMarketEvents(data.data.events);
        cacheRef.current.set(cacheKey, { data: data.data.events, timestamp: Date.now() });
        console.log(`🌐 ${data.data.events.length} eventos de mercado encontrados`);
        return data.data.events;
      }

      return [];
    } catch (err) {
      console.error('Erro ao buscar eventos:', err);
      return [];
    }
  }, []);

  // 🐋 Buscar alertas de whales
  const fetchWhaleAlerts = useCallback(async (symbols: string[]): Promise<WhaleAlert[]> => {
    const cacheKey = `whales-${symbols.slice(0, 5).join('-')}`;
    const cached = cacheRef.current.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return cached.data;
    }

    try {
      const { data, error } = await supabase.functions.invoke('market-intelligence', {
        body: { action: 'get_whale_alerts', symbols }
      });

      if (error) {
        console.error('Erro ao buscar whales:', error);
        return [];
      }

      if (data?.success && data.data?.alerts) {
        setWhaleAlerts(data.data.alerts);
        cacheRef.current.set(cacheKey, { data: data.data.alerts, timestamp: Date.now() });
        console.log(`🐋 ${data.data.alerts.length} alertas de whales`);
        return data.data.alerts;
      }

      return [];
    } catch (err) {
      console.error('Erro ao buscar whales:', err);
      return [];
    }
  }, []);

  // 😱 Buscar Fear & Greed Index
  const fetchFearGreed = useCallback(async (): Promise<FearGreedData | null> => {
    const cacheKey = 'fear-greed';
    const cached = cacheRef.current.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < CACHE_TTL * 2) { // Cache mais longo para F&G
      return cached.data;
    }

    try {
      const { data, error } = await supabase.functions.invoke('market-intelligence', {
        body: { action: 'get_fear_greed' }
      });

      if (error) {
        console.error('Erro ao buscar F&G:', error);
        return null;
      }

      if (data?.success && data.data) {
        // Handle both old and new API response structures
        const rawData = data.data;
        let fearGreedData: FearGreedData;
        
        // Check if new structure (sentiment is an object with fearGreedIndex)
        if (rawData.sentiment && typeof rawData.sentiment === 'object' && 'fearGreedIndex' in rawData.sentiment) {
          const sentimentObj = rawData.sentiment;
          const value = sentimentObj.fearGreedIndex || 50;
          let sentiment: FearGreedData['sentiment'] = 'NEUTRAL';
          
          if (value <= 20) sentiment = 'EXTREME_FEAR';
          else if (value <= 40) sentiment = 'FEAR';
          else if (value <= 60) sentiment = 'NEUTRAL';
          else if (value <= 80) sentiment = 'GREED';
          else sentiment = 'EXTREME_GREED';
          
          const recommendation = rawData.recommendation || {};
          
          fearGreedData = {
            value,
            classification: sentimentObj.fearGreedLabel || 'Neutral',
            sentiment,
            tradingAdvice: recommendation.reasons?.join('. ') || 'Mercado neutro - seguir sinais técnicos.',
            longBias: recommendation.bias === 'bullish' ? 'FAVORABLE' : recommendation.bias === 'bearish' ? 'UNFAVORABLE' : 'NEUTRAL',
            shortBias: recommendation.bias === 'bearish' ? 'FAVORABLE' : recommendation.bias === 'bullish' ? 'UNFAVORABLE' : 'NEUTRAL',
            source: 'market-intelligence',
            analyzedAt: rawData.timestamp || new Date().toISOString()
          };
        } else {
          // Old structure (value and sentiment are direct properties)
          fearGreedData = rawData as FearGreedData;
        }
        
        setFearGreed(fearGreedData);
        cacheRef.current.set(cacheKey, { data: fearGreedData, timestamp: Date.now() });
        console.log(`😱 Fear & Greed: ${fearGreedData.value} (${fearGreedData.sentiment})`);
        return fearGreedData;
      }

      return null;
    } catch (err) {
      console.error('Erro ao buscar F&G:', err);
      return null;
    }
  }, []);

  // 🔄 Atualizar toda a inteligência de mercado
  const refreshAllIntelligence = useCallback(async (symbols: string[]) => {
    setIsLoading(true);
    console.log('🔄 Atualizando inteligência de mercado...');

    try {
      // Buscar em paralelo
      await Promise.all([
        fetchFearGreed(),
        fetchMarketEvents(),
        fetchWhaleAlerts(symbols),
        ...symbols.slice(0, 5).map(s => fetchNewsSentiment(s))
      ]);

      setLastUpdate(new Date());
      console.log('✅ Inteligência de mercado atualizada');
    } catch (err) {
      console.error('Erro ao atualizar inteligência:', err);
    } finally {
      setIsLoading(false);
    }
  }, [fetchFearGreed, fetchMarketEvents, fetchWhaleAlerts, fetchNewsSentiment]);

  // 🎯 VALIDAR TRADE com base em TODA inteligência disponível
  const validateTradeWithIntelligence = useCallback(async (
    symbol: string,
    side: 'Buy' | 'Sell',
    baseConfidence: number
  ): Promise<TradeValidation> => {
    const reasons: string[] = [];
    const warnings: string[] = [];
    let adjustedConfidence = baseConfidence;
    let approved = true;

    try {
      // 1. Verificar Fear & Greed
      const fg = fearGreed || await fetchFearGreed();
      if (fg) {
        if (side === 'Buy' && fg.longBias === 'UNFAVORABLE') {
          adjustedConfidence -= 15;
          warnings.push(`⚠️ F&G ${fg.value}: ${fg.tradingAdvice}`);
          if (fg.sentiment === 'EXTREME_GREED') {
            adjustedConfidence -= 10;
            warnings.push('🚨 Euforia extrema - alto risco para longs');
          }
        } else if (side === 'Sell' && fg.shortBias === 'UNFAVORABLE') {
          adjustedConfidence -= 15;
          warnings.push(`⚠️ F&G ${fg.value}: Mercado em medo, shorts arriscados`);
        } else if (
          (side === 'Buy' && fg.longBias === 'FAVORABLE') ||
          (side === 'Sell' && fg.shortBias === 'FAVORABLE')
        ) {
          adjustedConfidence += 10;
          reasons.push(`✅ F&G ${fg.value} favorável para ${side}`);
        }
      }

      // 2. Verificar notícias do símbolo
      const cachedNews = newsSentiment.get(symbol);
      const news = cachedNews || await fetchNewsSentiment(symbol);
      if (news) {
        // 🔧 CORRIGIDO: Ignorar dados simulados para não bloquear operações
        const isSimulated = news.source === 'simulated';
        
        if (isSimulated) {
          // Apenas log informativo, não afeta decisão
          console.log(`📰 ${symbol}: Sentimento simulado (ignorado para decisão)`);
        } else {
          const newsAligned = 
            (side === 'Buy' && news.sentiment === 'BULLISH') ||
            (side === 'Sell' && news.sentiment === 'BEARISH');
          
          const newsContra =
            (side === 'Buy' && news.sentiment === 'BEARISH') ||
            (side === 'Sell' && news.sentiment === 'BULLISH');

          if (newsContra && news.confidence >= 70) {
            adjustedConfidence -= 20;
            warnings.push(`🚨 Notícias ${news.sentiment} (${news.confidence}%): ${news.keyNews[0] || 'Ver detalhes'}`);
            if (news.riskLevel === 'HIGH') {
              approved = false;
              warnings.push('❌ BLOQUEADO: Risco alto por notícias');
            }
          } else if (newsAligned) {
            adjustedConfidence += 15;
            reasons.push(`✅ Notícias ${news.sentiment}: ${news.reasoning || 'Alinhado'}`);
          }
        }
      }

      // 3. Verificar whales para o símbolo
      const whaleForSymbol = whaleAlerts.find(w => 
        symbol.includes(w.symbol) || w.symbol.includes(symbol.replace('USDT', ''))
      );
      if (whaleForSymbol) {
        const whalesBuying = 
          whaleForSymbol.type === 'ACCUMULATION' || 
          whaleForSymbol.type === 'EXCHANGE_OUTFLOW';
        const whalesSelling = 
          whaleForSymbol.type === 'DISTRIBUTION' || 
          whaleForSymbol.type === 'EXCHANGE_INFLOW';

        if (side === 'Buy' && whalesSelling && whaleForSymbol.confidence >= 60) {
          adjustedConfidence -= 15;
          warnings.push(`🐋 Whales vendendo ${whaleForSymbol.symbol}: ${whaleForSymbol.details}`);
        } else if (side === 'Sell' && whalesBuying && whaleForSymbol.confidence >= 60) {
          adjustedConfidence -= 15;
          warnings.push(`🐋 Whales comprando ${whaleForSymbol.symbol}: ${whaleForSymbol.details}`);
        } else if (
          (side === 'Buy' && whalesBuying) ||
          (side === 'Sell' && whalesSelling)
        ) {
          adjustedConfidence += 12;
          reasons.push(`🐋 Whales na mesma direção: ${whaleForSymbol.type}`);
        }
      }

      // 4. Verificar eventos de mercado importantes
      const highImpactEvents = marketEvents.filter(e => e.impact === 'HIGH');
      for (const event of highImpactEvents) {
        const affectsSymbol = event.affectedAssets.some(a => 
          symbol.includes(a) || a.includes(symbol.replace('USDT', ''))
        );
        if (affectsSymbol || event.affectedAssets.includes('ALL')) {
          warnings.push(`📅 Evento: ${event.title} - ${event.tradingAdvice}`);
          if (event.expectedDirection === 'UNCERTAIN') {
            adjustedConfidence -= 10;
          }
        }
      }

      // Determinar recomendação final
      let recommendation: 'PROCEED' | 'CAUTION' | 'AVOID' = 'PROCEED';
      
      if (!approved || adjustedConfidence < 30) {
        recommendation = 'AVOID';
      } else if (warnings.length >= 2 || adjustedConfidence < 50) {
        recommendation = 'CAUTION';
      }

      return {
        approved,
        adjustedConfidence: Math.max(0, Math.min(100, adjustedConfidence)),
        reasons,
        warnings,
        recommendation
      };
    } catch (err) {
      console.error('Erro na validação de inteligência:', err);
      return {
        approved: true,
        adjustedConfidence: baseConfidence,
        reasons: [],
        warnings: ['⚠️ Erro ao validar inteligência de mercado'],
        recommendation: 'CAUTION'
      };
    }
  }, [fearGreed, newsSentiment, whaleAlerts, marketEvents, fetchFearGreed, fetchNewsSentiment]);

  // 🚫 Verificar se deve evitar trading agora
  const shouldAvoidTrading = useCallback((): { avoid: boolean; reason: string } => {
    // Verificar F&G extremo
    if (fearGreed) {
      if (fearGreed.sentiment === 'EXTREME_GREED' && fearGreed.value >= 85) {
        return { avoid: true, reason: 'Euforia extrema no mercado - alto risco' };
      }
      if (fearGreed.sentiment === 'EXTREME_FEAR' && fearGreed.value <= 15) {
        return { avoid: false, reason: 'Pânico extremo - possível oportunidade' };
      }
    }

    // Verificar eventos de alto impacto iminentes
    const upcomingHighImpact = marketEvents.filter(e => 
      e.impact === 'HIGH' && e.expectedDirection === 'UNCERTAIN'
    );
    if (upcomingHighImpact.length >= 2) {
      return { 
        avoid: true, 
        reason: `${upcomingHighImpact.length} eventos de alto impacto próximos` 
      };
    }

    return { avoid: false, reason: '' };
  }, [fearGreed, marketEvents]);

  return {
    // Estado
    isLoading,
    newsSentiment,
    marketEvents,
    whaleAlerts,
    fearGreed,
    lastUpdate,

    // Ações
    fetchNewsSentiment,
    fetchMarketEvents,
    fetchWhaleAlerts,
    fetchFearGreed,
    refreshAllIntelligence,
    validateTradeWithIntelligence,
    shouldAvoidTrading,
  };
};
