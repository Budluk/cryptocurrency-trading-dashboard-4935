import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { getUserId } from '@/lib/anonymousUser';
import { useToast } from './use-toast';

/**
 * 🔄 Hook para sincronizar automaticamente o ML com histórico da Bybit
 * Aprende continuamente com seus trades (especialmente os ganhadores!)
 */
export const useAutoMLSync = (isTestnet: boolean = false, enabled: boolean = true) => {
  const { toast } = useToast();
  const lastSyncRef = useRef<number>(0);
  const isSyncingRef = useRef<boolean>(false);
  const syncIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  // Sincronizar ML a cada 30 minutos
  const SYNC_INTERVAL = 30 * 60 * 1000;
  
  // 🔄 Sincronizar com histórico da Bybit e retreinar ML
  const syncMLWithBybit = useCallback(async (showToast: boolean = false) => {
    if (isSyncingRef.current) {
      console.log('⏳ Sincronização ML já em andamento...');
      return null;
    }
    
    const now = Date.now();
    // Prevenir sincronizações muito frequentes (mínimo 5 minutos entre syncs)
    if (now - lastSyncRef.current < 5 * 60 * 1000) {
      console.log('⏳ Sync ML muito recente, aguardando...');
      return null;
    }
    
    isSyncingRef.current = true;
    lastSyncRef.current = now;
    
    try {
      const userId = await getUserId();
      
      if (showToast) {
        toast({
          title: "🔄 Sincronizando ML",
          description: "Buscando histórico da Bybit para treinar IA...",
        });
      }
      
      console.log('🔄 Iniciando sincronização ML com Bybit...');
      
      const { data, error } = await supabase.functions.invoke('ml-adaptive-learning', {
        body: { 
          userId,
          minTrades: 5, // Mínimo baixo para começar a aprender
        }
      });
      
      if (error) {
        console.error('❌ Erro na sincronização ML:', error);
        if (showToast) {
          toast({
            title: "❌ Erro na sincronização",
            description: error.message,
            variant: "destructive",
          });
        }
        return null;
      }
      
      if (data?.success) {
        const tradesCount = data.dataSource?.totalAnalyzed || 0;
        const winRate = data.performance?.winRate || 0;
        
        console.log(`✅ ML sincronizado: ${tradesCount} trades, WR ${winRate}%`);
        
        if (showToast) {
          toast({
            title: "✅ ML Sincronizado!",
            description: `${tradesCount} trades analisados | Win Rate: ${winRate}%`,
          });
        }
        
        return data;
      }
      
      return null;
    } catch (error: any) {
      console.error('❌ Erro na sincronização ML:', error);
      return null;
    } finally {
      isSyncingRef.current = false;
    }
  }, [toast]);

  // 📊 Buscar recomendações atuais do ML
  const getMLRecommendations = useCallback(async () => {
    try {
      const userId = await getUserId();
      
      const { data, error } = await supabase
        .from('ml_adaptive_config')
        .select('*')
        .eq('user_id', userId)
        .single();
      
      if (error || !data) return null;
      
      const patterns = (data.optimal_patterns as any) || {};
      
      return {
        // Parâmetros básicos
        stopLoss: data.recommended_stop_loss_pct,
        takeProfit: data.recommended_take_profit_pct,
        leverage: data.recommended_leverage,
        confidence: data.confidence_score,
        tradesAnalyzed: data.trades_analyzed,
        lastAnalysis: data.last_analysis_at,
        
        // Símbolos
        bestSymbols: patterns.symbolsToFocus || [],
        worstSymbols: patterns.symbolsToAvoid || [],
        
        // Horários
        bestHours: patterns.bestHours?.map((h: any) => h.hour || h) || [],
        worstHours: patterns.hoursToAvoid || [],
        
        // Stops dinâmicos
        dynamicStops: patterns.dynamicStops || null,
        dynamicTP: patterns.dynamicTP || null,
        
        // Padrões de perda
        lossPatterns: patterns.lossPatterns || null,
        
        // Position sizing
        positionSizing: patterns.positionSizing || null,
        
        // Alertas
        criticalWarnings: patterns.criticalWarnings || [],
        insights: patterns.insights || [],
        
        // Regime de mercado
        marketRegime: patterns.marketRegime || null,
      };
    } catch (error) {
      console.error('❌ Erro ao buscar recomendações ML:', error);
      return null;
    }
  }, []);

  // 🚫 Verificar se trade deve ser bloqueado
  const shouldBlockTrade = useCallback(async (
    symbol: string,
    side: string,
    leverage: number
  ): Promise<{ blocked: boolean; reason: string; recommendations?: any }> => {
    try {
      const recommendations = await getMLRecommendations();
      
      if (!recommendations || recommendations.tradesAnalyzed < 10) {
        return { blocked: false, reason: '', recommendations };
      }
      
      const hour = new Date().getUTCHours();
      const lossPatterns = recommendations.lossPatterns;
      
      // 1. Verificar símbolos perigosos
      if (recommendations.worstSymbols?.includes(symbol)) {
        return {
          blocked: true,
          reason: `⚠️ ${symbol} identificado como problemático (histórico de perdas)`,
          recommendations,
        };
      }
      
      // 2. Verificar horários perigosos
      if (recommendations.worstHours?.includes(hour)) {
        return {
          blocked: true,
          reason: `⚠️ Horário ${hour}h UTC tem alto índice de perdas`,
          recommendations,
        };
      }
      
      // 3. Verificar alavancagem muito alta
      const mitigation = lossPatterns?.mitigation;
      if (mitigation?.avoidHighLeverage && leverage > 50) {
        return {
          blocked: true,
          reason: `⚠️ Alavancagem ${leverage}x muito alta (ML recomenda ≤50x)`,
          recommendations,
        };
      }
      
      // 4. Verificar símbolos na lista de perigo do ML
      if (mitigation?.dangerousSymbols?.includes(symbol)) {
        return {
          blocked: true,
          reason: `⚠️ ML identificou ${symbol} como perigoso`,
          recommendations,
        };
      }
      
      return { blocked: false, reason: '', recommendations };
    } catch (error) {
      console.error('Erro ao verificar bloqueio:', error);
      return { blocked: false, reason: '' };
    }
  }, [getMLRecommendations]);

  // 📈 Obter parâmetros otimizados para trade
  const getOptimizedTradeParams = useCallback(async (
    symbol: string,
    balance: number,
    consecutiveWins: number = 0,
    consecutiveLosses: number = 0
  ) => {
    const recommendations = await getMLRecommendations();
    
    if (!recommendations) {
      return {
        stopLoss: 2.0,
        takeProfit: 4.0,
        leverage: 10,
        positionSize: balance * 0.1,
        confidence: 50,
      };
    }
    
    // Position sizing baseado em sequências
    const sizing = recommendations.positionSizing || {
      basePercent: 10,
      afterWinStreak: 15,
      afterLossStreak: 5,
      highConfidence: 20,
    };
    
    let positionPercent = sizing.basePercent;
    if (consecutiveWins >= 3) {
      positionPercent = sizing.afterWinStreak;
    } else if (consecutiveLosses >= 2) {
      positionPercent = sizing.afterLossStreak;
    }
    
    // Stops dinâmicos
    const dynamicStops = recommendations.dynamicStops || {};
    let stopLoss = dynamicStops.base || recommendations.stopLoss || 2.0;
    
    if (consecutiveLosses >= 2) {
      stopLoss = dynamicStops.afterLossStreak || stopLoss * 1.5;
    } else if (consecutiveWins >= 3) {
      stopLoss = dynamicStops.afterWinStreak || stopLoss * 0.8;
    }
    
    // TP dinâmico
    const dynamicTP = recommendations.dynamicTP || {};
    const takeProfit = dynamicTP.base || recommendations.takeProfit || 4.0;
    
    return {
      stopLoss: Math.max(stopLoss, 0.3),
      takeProfit: Math.max(takeProfit, stopLoss * 2),
      leverage: recommendations.leverage || 10,
      positionSize: (balance * positionPercent) / 100,
      confidence: recommendations.confidence || 50,
      recommendations,
    };
  }, [getMLRecommendations]);

  // ⏰ Iniciar sincronização automática
  useEffect(() => {
    if (!enabled) return;
    
    console.log('🤖 Auto ML Sync ativado - sincronizando a cada 30 min');
    
    // Sincronizar ao iniciar (após 10 segundos para não sobrecarregar)
    const initialTimeout = setTimeout(() => {
      syncMLWithBybit(false);
    }, 10000);
    
    // Sincronizar periodicamente
    syncIntervalRef.current = setInterval(() => {
      syncMLWithBybit(false);
    }, SYNC_INTERVAL);
    
    return () => {
      clearTimeout(initialTimeout);
      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current);
      }
    };
  }, [enabled, syncMLWithBybit]);

  return {
    syncMLWithBybit,
    getMLRecommendations,
    shouldBlockTrade,
    getOptimizedTradeParams,
    isSyncing: isSyncingRef.current,
  };
};
