import { useEffect, useRef, useCallback } from 'react';
import { supabase } from "@/integrations/supabase/client";
import { getUserId } from "@/lib/anonymousUser";
import { useToast } from "@/hooks/use-toast";

interface TradeData {
  symbol: string;
  side: string;
  entry_price: number;
  exit_price?: number;
  realized_pnl?: number;
  leverage?: number;
  volatility?: number;
  confidence?: number;
  close_reason?: string;
  opened_at?: string;
  closed_at?: string;
}

interface SymbolStats {
  wins: number;
  total: number;
  pnl: number;
}

interface MarketRegime {
  current: 'trending' | 'ranging' | 'volatile' | 'calm';
  recentWinRate: number;
  recentVolatility: number;
  adaptations?: {
    recommendedLeverage?: number;
    recommendedRiskPercent?: number;
    shouldBeAggressive?: boolean;
  };
}

interface LossPatterns {
  consecutiveLosses: number[];
  maxLossStreak: number;
  winStreaks: number[];
  commonLossHours: number[];
  commonLossSymbols: string[];
  highLeverageLosses: number;
  mitigation?: {
    avoidHighLeverage?: boolean;
    avoidLowVolatility?: boolean;
    dangerousHours?: number[];
    dangerousSymbols?: string[];
    maxConsecutiveLosses?: number;
  };
}

interface PositionSizing {
  basePercent: number;
  afterWinStreak: number;
  afterLossStreak: number;
  highConfidence: number;
}

interface MLPatterns {
  symbolPerformance?: Record<string, SymbolStats>;
  hourlyPerformance?: Record<string, SymbolStats>;
  bestSymbols?: string[];
  bestHours?: number[];
  incrementalUpdates?: number;
  lastIncrementalUpdate?: string;
  marketRegime?: MarketRegime;
  lossPatterns?: LossPatterns;
  positionSizing?: PositionSizing;
  dynamicStops?: Record<string, number>;
  dynamicTP?: Record<string, number>;
  insights?: string[];
  criticalWarnings?: string[];
}

export const useContinuousMLTraining = () => {
  const { toast } = useToast();
  const lastTrainingTime = useRef<number>(0);
  const tradesBuffer = useRef<TradeData[]>([]);
  const TRAINING_INTERVAL = 5 * 60 * 1000; // Treinar a cada 5 minutos se houver novos trades
  const MIN_TRADES_FOR_UPDATE = 3; // Mínimo de trades para atualizar

  // 📊 Adicionar trade ao buffer para treinamento
  const addTradeToBuffer = useCallback((trade: TradeData) => {
    console.log('📚 Trade adicionado ao buffer de treinamento:', trade.symbol);
    tradesBuffer.current.push(trade);

    // Se acumulamos trades suficientes, iniciar treinamento
    if (tradesBuffer.current.length >= MIN_TRADES_FOR_UPDATE) {
      const now = Date.now();
      if (now - lastTrainingTime.current > TRAINING_INTERVAL) {
        triggerIncrementalTraining();
      }
    }
  }, []);

  // 🧠 Treinar incrementalmente com novos dados
  const triggerIncrementalTraining = useCallback(async () => {
    if (tradesBuffer.current.length === 0) return;

    const tradesToProcess = [...tradesBuffer.current];
    tradesBuffer.current = []; // Limpar buffer
    lastTrainingTime.current = Date.now();

    try {
      console.log(`🧠 Iniciando treinamento incremental com ${tradesToProcess.length} trades...`);
      
      const userId = await getUserId();

      // Salvar dados de aprendizado no banco
      const learningData = tradesToProcess.map(trade => ({
        user_id: userId,
        position_id: null, // Pode ser vinculado se necessário
        entry_features: {
          symbol: trade.symbol,
          side: trade.side,
          entry_price: trade.entry_price,
          leverage: trade.leverage || 10,
          volatility: trade.volatility || 2,
          confidence: trade.confidence || 50,
          hour: new Date(trade.opened_at || new Date()).getUTCHours(),
        },
        exit_features: {
          exit_price: trade.exit_price,
          close_reason: trade.close_reason,
          duration_ms: trade.opened_at && trade.closed_at 
            ? new Date(trade.closed_at).getTime() - new Date(trade.opened_at).getTime()
            : 0,
        },
        pnl: trade.realized_pnl || 0,
        outcome: (trade.realized_pnl || 0) > 0 ? 'WIN' : 'LOSS',
        lessons_learned: {
          stop_was_tight: trade.close_reason?.includes('STOP') && Math.abs(trade.realized_pnl || 0) < 1,
          tp_hit: trade.close_reason?.includes('TP'),
          time_of_trade: new Date(trade.opened_at || new Date()).getUTCHours(),
        },
      }));

      // Inserir dados de aprendizado
      const { error: insertError } = await supabase
        .from('ai_learning_data')
        .insert(learningData);

      if (insertError) {
        console.error('❌ Erro ao salvar dados de aprendizado:', insertError);
        return;
      }

      console.log(`✅ ${learningData.length} registros de aprendizado salvos`);

      // Atualizar estatísticas rápidas no ML config
      await updateMLConfigStats(userId, tradesToProcess);

    } catch (error) {
      console.error('❌ Erro no treinamento incremental:', error);
    }
  }, []);

  // 📈 Atualizar estatísticas no ML config sem retreinar completamente
  const updateMLConfigStats = async (userId: string, newTrades: TradeData[]) => {
    try {
      // Buscar config atual
      const { data: mlConfig, error } = await supabase
        .from('ml_adaptive_config')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (error || !mlConfig) return;

      // Cast para tipo correto
      const currentPatterns = (mlConfig.optimal_patterns as MLPatterns) || {};
      const symbolPerformance: Record<string, SymbolStats> = currentPatterns.symbolPerformance || {};
      const hourlyPerformance: Record<string, SymbolStats> = currentPatterns.hourlyPerformance || {};

      const currentTradesAnalyzed = mlConfig.trades_analyzed || 0;
      const newTotal = currentTradesAnalyzed + newTrades.length;

      for (const trade of newTrades) {
        // Atualizar por símbolo
        const symbol = trade.symbol;
        if (!symbolPerformance[symbol]) {
          symbolPerformance[symbol] = { wins: 0, total: 0, pnl: 0 };
        }
        symbolPerformance[symbol].total++;
        symbolPerformance[symbol].pnl += trade.realized_pnl || 0;
        if ((trade.realized_pnl || 0) > 0) symbolPerformance[symbol].wins++;

        // Atualizar por hora
        const hour = new Date(trade.opened_at || new Date()).getUTCHours().toString();
        if (!hourlyPerformance[hour]) {
          hourlyPerformance[hour] = { wins: 0, total: 0, pnl: 0 };
        }
        hourlyPerformance[hour].total++;
        hourlyPerformance[hour].pnl += trade.realized_pnl || 0;
        if ((trade.realized_pnl || 0) > 0) hourlyPerformance[hour].wins++;
      }

      // Recalcular melhores símbolos e horários
      const bestSymbols = Object.entries(symbolPerformance)
        .filter(([_, stats]) => stats.total >= 3)
        .sort((a, b) => {
          const wrA = a[1].wins / a[1].total;
          const wrB = b[1].wins / b[1].total;
          return wrB - wrA;
        })
        .slice(0, 10)
        .map(([symbol]) => symbol);

      const bestHours = Object.entries(hourlyPerformance)
        .filter(([_, stats]) => stats.total >= 3)
        .sort((a, b) => {
          const wrA = a[1].wins / a[1].total;
          const wrB = b[1].wins / b[1].total;
          return wrB - wrA;
        })
        .slice(0, 6)
        .map(([hour]) => parseInt(hour));

      // Atualizar ML config - cast para any para compatibilidade com Json type
      const updatedPatterns = JSON.parse(JSON.stringify({
        ...currentPatterns,
        symbolPerformance,
        hourlyPerformance,
        bestSymbols,
        bestHours,
        lastIncrementalUpdate: new Date().toISOString(),
        incrementalUpdates: (currentPatterns.incrementalUpdates || 0) + 1,
      }));

      await supabase
        .from('ml_adaptive_config')
        .update({
          trades_analyzed: newTotal,
          optimal_patterns: updatedPatterns as any,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', userId);

      console.log(`📊 ML Config atualizado: ${newTotal} trades analisados, ${bestSymbols.length} melhores símbolos`);

    } catch (error) {
      console.error('❌ Erro ao atualizar ML config:', error);
    }
  };

  // 🔄 Forçar treinamento completo via edge function
  const triggerFullTraining = useCallback(async () => {
    try {
      const userId = await getUserId();
      
      toast({
        title: "🧠 Treinamento Iniciado",
        description: "Buscando histórico da Bybit e treinando IA...",
      });

      const { data, error } = await supabase.functions.invoke('ml-adaptive-learning', {
        body: { userId, minTrades: 5 }
      });

      if (error) {
        console.error('❌ Erro no treinamento:', error);
        toast({
          title: "❌ Erro no Treinamento",
          description: error.message,
          variant: "destructive",
        });
        return null;
      }

       const total = data?.dataSource?.totalAnalyzed ?? data?.config?.trades_analyzed ?? 0;
       toast({
         title: "✅ Treinamento Concluído",
         description: `${total} trades analisados`,
       });

      return data;

    } catch (error) {
      console.error('❌ Erro ao treinar:', error);
      return null;
    }
  }, [toast]);

  // 🎯 Obter recomendações ML atualizadas COM NOVOS DADOS
  const getMLRecommendations = useCallback(async () => {
    try {
      const userId = await getUserId();
      
      const { data: mlConfig, error } = await supabase
        .from('ml_adaptive_config')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (error || !mlConfig || !mlConfig.is_enabled) {
        return null;
      }

      const patterns = (mlConfig.optimal_patterns as MLPatterns) || {};
      
      return {
        // Símbolos e horários
        bestSymbols: patterns.bestSymbols || [],
        bestHours: patterns.bestHours || [],
        symbolPerformance: patterns.symbolPerformance || {},
        hourlyPerformance: patterns.hourlyPerformance || {},
        // Parâmetros recomendados
        recommendedStopLoss: mlConfig.recommended_stop_loss_pct,
        recommendedTakeProfit: mlConfig.recommended_take_profit_pct,
        recommendedLeverage: mlConfig.recommended_leverage,
        confidenceScore: mlConfig.confidence_score,
        tradesAnalyzed: mlConfig.trades_analyzed,
        lastUpdate: mlConfig.last_analysis_at,
        // NOVOS: Regime de mercado
        marketRegime: patterns.marketRegime || null,
        // NOVOS: Padrões de perda
        lossPatterns: patterns.lossPatterns || null,
        // NOVOS: Position sizing dinâmico
        positionSizing: patterns.positionSizing || null,
        // NOVOS: Stops dinâmicos por volatilidade
        dynamicStops: patterns.dynamicStops || null,
        dynamicTP: patterns.dynamicTP || null,
        // NOVOS: Insights e avisos
        insights: patterns.insights || [],
        criticalWarnings: patterns.criticalWarnings || [],
      };

    } catch (error) {
      console.error('❌ Erro ao buscar recomendações ML:', error);
      return null;
    }
  }, []);

  // 🚫 Verificar se deve bloquear trade baseado em padrões de perda
  const shouldBlockTrade = useCallback(async (symbol: string, hour: number, leverage: number): Promise<{ blocked: boolean; reason: string }> => {
    try {
      const recommendations = await getMLRecommendations();
      if (!recommendations?.lossPatterns?.mitigation) {
        return { blocked: false, reason: '' };
      }

      const mitigation = recommendations.lossPatterns.mitigation;
      
      // Verificar símbolos perigosos
      if (mitigation.dangerousSymbols?.includes(symbol)) {
        return { blocked: true, reason: `ML: ${symbol} identificado como problemático` };
      }
      
      // Verificar horários perigosos
      if (mitigation.dangerousHours?.includes(hour)) {
        return { blocked: true, reason: `ML: Horário ${hour}h identificado como problemático` };
      }
      
      // Verificar alavancagem
      if (mitigation.avoidHighLeverage && leverage > 50) {
        return { blocked: true, reason: `ML: Alavancagem ${leverage}x muito alta para padrão atual` };
      }

      return { blocked: false, reason: '' };
    } catch {
      return { blocked: false, reason: '' };
    }
  }, [getMLRecommendations]);

  // 📊 Obter position sizing recomendado
  const getRecommendedPositionSize = useCallback(async (
    balance: number,
    consecutiveWins: number,
    consecutiveLosses: number,
    signalConfidence: number
  ): Promise<number> => {
    try {
      const recommendations = await getMLRecommendations();
      const sizing = recommendations?.positionSizing || {
        basePercent: 10,
        afterWinStreak: 15,
        afterLossStreak: 5,
        highConfidence: 20,
      };

      let percent = sizing.basePercent;
      
      // Ajustar por sequências
      if (consecutiveWins >= 3) {
        percent = sizing.afterWinStreak;
      } else if (consecutiveLosses >= 2) {
        percent = sizing.afterLossStreak;
      }
      
      // Ajustar por confiança do sinal
      if (signalConfidence >= 80) {
        percent = Math.max(percent, sizing.highConfidence);
      }

      return (balance * percent) / 100;
    } catch {
      return (balance * 10) / 100; // Fallback 10%
    }
  }, [getMLRecommendations]);

  // 🔄 Verificar se é bom momento para treinar (baseado em trades fechados)
  useEffect(() => {
    const checkAndTrain = async () => {
      const now = Date.now();
      
      // Se passou muito tempo desde último treinamento e tem trades no buffer
      if (tradesBuffer.current.length > 0 && now - lastTrainingTime.current > TRAINING_INTERVAL) {
        await triggerIncrementalTraining();
      }
    };

    const interval = setInterval(checkAndTrain, 60000); // Verificar a cada minuto
    return () => clearInterval(interval);
  }, [triggerIncrementalTraining]);

  return {
    addTradeToBuffer,
    triggerIncrementalTraining,
    triggerFullTraining,
    getMLRecommendations,
    shouldBlockTrade,
    getRecommendedPositionSize,
    tradesBufferCount: tradesBuffer.current.length,
  };
};
