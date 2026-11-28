import { ROBOT_RISK, isBlockedHourUtc, isRobotBlacklisted, maxNotionalForRisk, capLeverage } from '@/config/robotRiskParams';
import { getGatewaySignal } from '@/hooks/useSignalGateway';
import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Play, Square, Zap, DollarSign, TrendingUp, Target, Network, Brain, ShieldAlert, Clock, Wallet, Crosshair, Sparkles, FlaskConical } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { usePositions } from "@/contexts/PositionsContext";
import { useSmartExitManager } from "@/hooks/useSmartExitManager";
import { useContinuousMLTraining } from "@/hooks/useContinuousMLTraining";
import { useTradingCalculations } from "@/hooks/useTradingCalculations";
import { useBybitSync } from "@/hooks/useBybitSync";
import { useSignalAnalysis } from "@/hooks/useSignalAnalysis";
import { useLosingPatternBlocker } from "@/hooks/useLosingPatternBlocker";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useCorrelationAnalysis } from "@/hooks/useCorrelationAnalysis";
import { useAdvancedRiskManager } from "@/hooks/useAdvancedRiskManager";
import { getUserId, getUserIdOrNull } from "@/lib/anonymousUser";
import { AntiLossMonitor } from "./AntiLossMonitor";
import { useDataDrivenStrategy } from "@/hooks/useDataDrivenStrategy";
import { useArmedOrders } from "@/hooks/useArmedOrders";
import { useAITradingIntelligence } from "@/hooks/useAITradingIntelligence";
import { useMarketIntelligence } from "@/hooks/useMarketIntelligence";
import { useManualTradeTracker } from "@/hooks/useManualTradeTracker";
import { useAutoMLSync } from "@/hooks/useAutoMLSync";
import { useMLAutoCorrector } from "@/hooks/useMLAutoCorrector";
import { useDemoTrading } from "@/hooks/useDemoTrading";
import { GateDiagnosticsPanel } from "./GateDiagnosticsPanel";
import { RiskPresetSelector } from "./RiskPresetSelector";
import { GateAuditTable } from "./GateAuditTable";
import { getRiskRule, getCurrentPreset } from "@/config/qualityRiskConfig";
import { recordGateAudit } from "@/lib/gateAudit";
import { planDemoTrade, readDemoMode, writeDemoMode } from "@/lib/demoTrading";

interface Trade {
  symbol: string;
  action: string;
  confidence: number;
  leverage: number;
  usdSize: number;
  timestamp: string;
}

export const MultiAssetTrader = () => {
  const [isRunning, setIsRunning] = useState(false);
  const tradingLockRef = useRef(false);
  const [isTestnet, setIsTestnet] = useState(false);
  // Modo demo persistente: um reload nunca pode voltar para "conta real".
  const initialDemoModeRef = useRef(readDemoMode());
  const [isDemoMode, setIsDemoMode] = useState(() => initialDemoModeRef.current);
  const [activeTrades, setActiveTrades] = useState<Trade[]>([]);
  const [totalPnL, setTotalPnL] = useState(0);
  const [cycleCount, setCycleCount] = useState(0);
  const [dailyPnL, setDailyPnL] = useState(0);
  const [consecutiveLosses, setConsecutiveLosses] = useState(0);
  const [mlConfig, setMlConfig] = useState<any>(null);
  const { toast } = useToast();
  // 🔍 Diagnóstico de gates do último ciclo
  const [gateDiagnostics, setGateDiagnostics] = useState<{
    skipCounts: Record<string, number>;
    totalAnalyzed: number;
    openedThisCycle: number;
    lastCycleAt: Date | null;
  }>({ skipCounts: {}, totalAnalyzed: 0, openedThisCycle: 0, lastCycleAt: null });
  
  // 🆕 Hook Demo Trading
  const {
    demoAccount,
    demoBalance,
    demoPositions,
    demoPnL,
    unrealizedPnL: demoUnrealizedPnL,
    demoPositionsCount,
    openDemoPosition,
    closeDemoPosition,
    updateDemoPositions,
    fetchCurrentPrice,
    resetDemoAccount,
    loadDemoAccount
  } = useDemoTrading(isDemoMode);
  
  // Hooks customizados
  const { refetch } = usePositions();
  const { checkNewPosition, getCorrelationRisk } = useCorrelationAnalysis();
  const { processOpenPositions, clearPositionState, getAdaptiveTrailingConfig } = useSmartExitManager();
  const { addTradeToBuffer, triggerFullTraining, getMLRecommendations, shouldBlockTrade, getRecommendedPositionSize } = useContinuousMLTraining();
  const { 
    getLeverageForScalping, getLeverageForBalance, calculatePositionSize,
    calculateDynamicTrailingStop, calculateValidQuantity, calculateStopTakeProfit
  } = useTradingCalculations();
  const {
    currentBalance, availableBalance, openPositionsCount,
    lastSyncTime, top10VolatileAssets, syncBybitBalance, syncOpenPositions, fetchTop10VolatileAssets
  } = useBybitSync(isTestnet);
  const { analyzeSignal, fetchComprehensiveAI, fetchBTCTrend } = useSignalAnalysis();
  const { isPatternBlocked, recordTradeResult, getBlockedStats, blockedCount, forceUnblock, loadHistoricalPatterns } = useLosingPatternBlocker();
  const { 
    analyzeSymbol, shouldTradeDataDriven, 
    filterAssetsDataDriven, hasAssetsForCurrentHour, getAssetsForCurrentHour, getStrategyStats,
    GLOBAL_BLACKLIST, PREMIUM_SYMBOLS, HOUR_ASSET_MAP
  } = useDataDrivenStrategy();
  
  // 🎯 Sistema de ordens armadas S/R
  const {
    armedOrders,
    hourlyPerformance,
    srLevels,
    isAnalyzing: isAnalyzingSR,
    analyzeHourlyPerformance,
    getBestAssetsForCurrentHour: getBestHourlyAssets,
    updateSRLevels,
    checkAndArmOrders,
    checkArmedOrdersForTrigger,
    cleanupOldOrders,
    MIN_PROFIT_TARGET
  } = useArmedOrders();
  
  // 🤖 AI Trading Intelligence
  const {
    isLoading: isAILoading,
    patterns: aiPatterns,
    recommendations: aiRecommendations,
    whaleAnalysis,
    sentimentAnalysis,
    tradingSignal,
    lastTrainingTime,
    trainOnWinningPatterns,
    validateTradeWithAI,
    getOptimizedParameters,
    analyzeWhales,
    analyzeSentiment
  } = useAITradingIntelligence();
  
  // 🧠 Market Intelligence (Notícias, Whales, Fear & Greed)
  const {
    isLoading: isIntelLoading,
    fearGreed,
    whaleAlerts,
    marketEvents,
    lastUpdate: intelLastUpdate,
    refreshAllIntelligence,
    validateTradeWithIntelligence,
    shouldAvoidTrading,
    fetchFearGreed,
  } = useMarketIntelligence();
  
  // 🎓 Manual Trade Tracker - IA aprende com todas as suas operações
  const { markAsBotOpened, manualTradesCount } = useManualTradeTracker(isTestnet, true, isDemoMode);
  
  // 🔄 Auto ML Sync - Sincroniza automaticamente com histórico Bybit
  const { 
    syncMLWithBybit, 
    getMLRecommendations: getAutoMLRecommendations, 
    shouldBlockTrade: shouldMLBlockTrade,
    getOptimizedTradeParams 
  } = useAutoMLSync(isTestnet, true);
  
  // 🔧 ML Auto-Corrector - Correção automática de estratégia
  const {
    isEnabled: mlAutoCorrectEnabled,
    runAutoCorrection,
    shouldBlockTrade: shouldMLAutoBlockTrade,
    getCorrectedParams,
    currentConfig: mlAutoConfig,
    analysis: mlAutoAnalysis,
    lastCorrections
  } = useMLAutoCorrector();
  
  // AI cache for comprehensive analysis
  const aiAnalysisCache = useRef<Map<string, { data: any; timestamp: number }>>(new Map());
  const instrumentsCache = useRef<{ data: any[]; timestamp: number }>({ data: [], timestamp: 0 });
  const INSTRUMENTS_CACHE_TTL = 300000; // 5 min — instruments rarely change
  const { calculateExposure, classifyVolatilityRisk, getAdaptiveTrailingConfig: getAdvancedTrailing, checkAssetCorrelation, getProtectProfitLevel } = useAdvancedRiskManager();
  
  const lastMLCheck = useRef<number>(0);
  const lastClosedPositionsRef = useRef<string[]>([]);
  const orphanCleanupDoneRef = useRef<boolean>(false);

  // Configurações
  const [maxOpenPositions, setMaxOpenPositions] = useState(200);
  const MAX_CONSECUTIVE_LOSSES = ROBOT_RISK.maxConsecutiveLosses;
  const [historicalWinRate, setHistoricalWinRate] = useState(50);
  
  // Opções avançadas
  const [trailingStopEnabled, setTrailingStopEnabled] = useState(true);
  const [smartExitEnabled, setSmartExitEnabled] = useState(true);
  const [partialExitEnabled, setPartialExitEnabled] = useState(true);
  const [timeFilterEnabled, setTimeFilterEnabled] = useState(false);
  const [startHour, setStartHour] = useState(14);
  const [endHour, setEndHour] = useState(20);
  const [scaleInOutEnabled, setScaleInOutEnabled] = useState(true);
  const [martingaleEnabled, setMartingaleEnabled] = useState(false);
  const [hedgeEnabled, setHedgeEnabled] = useState(false);
  const [mlDecisionsEnabled, setMlDecisionsEnabled] = useState(true);
  const [dynamicLeverageEnabled, setDynamicLeverageEnabled] = useState(false);
  const [armedModeEnabled, setArmedModeEnabled] = useState(false); // 🎯 MODO ORDENS ARMADAS - DESATIVADO
  const [aiIntelligenceEnabled, setAiIntelligenceEnabled] = useState(true); // 🤖 AI INTELLIGENCE
  
  // Tracking
  const [positionTracking, setPositionTracking] = useState<Map<string, {
    highestPrice: number;
    lowestPrice: number;
    currentStopLoss: number;
  }>>(new Map());
  const [lossStreak, setLossStreak] = useState(0);
  const [pyramidingTracking, setPyramidingTracking] = useState<Map<string, {
    timesAdded: number;
    lastAddPrice: number;
    originalQty: number;
  }>>(new Map());

  const { openPositions, closedPositions } = usePositions();
  
  // Treinamento contínuo
  useEffect(() => {
    if (closedPositions.length > 0) {
      const currentIds = closedPositions.map(p => p.id);
      const newClosed = closedPositions.filter(p => 
        !lastClosedPositionsRef.current.includes(p.id) && p.realized_pnl !== null
      );

      if (newClosed.length > 0) {
        console.log(`📚 ${newClosed.length} novos trades para treinamento ML`);
        for (const trade of newClosed) {
          // Registrar no buffer de ML
          addTradeToBuffer({
            symbol: trade.symbol,
            side: trade.side,
            entry_price: trade.entry_price,
            exit_price: trade.exit_price || trade.current_price || trade.entry_price,
            realized_pnl: trade.realized_pnl || 0,
            leverage: trade.leverage || ROBOT_RISK.leverageMax,
            volatility: trade.volatility || 2,
            confidence: trade.confidence || 50,
            close_reason: trade.close_reason || 'UNKNOWN',
            opened_at: trade.opened_at,
            closed_at: trade.closed_at || new Date().toISOString(),
          });
          
          // 🚫 Registrar resultado para bloqueio de padrão perdedor (com volatilidade)
          recordTradeResult(
            trade.symbol,
            trade.side,
            trade.leverage || ROBOT_RISK.leverageMax,
            trade.realized_pnl || 0,
            trade.volatility || undefined // Passar volatilidade para análise
          );
        }
      }

      lastClosedPositionsRef.current = currentIds;
      const recent20 = closedPositions.slice(0, 20);
      const wins = recent20.filter(t => (t.realized_pnl || 0) > 0).length;
      setHistoricalWinRate((wins / recent20.length) * 100);
    }
  }, [closedPositions, addTradeToBuffer]);

  // Carregar saldo inicial e treinar IA
  useEffect(() => {
    const init = async () => {
      console.log('🔄 Inicializando trader...');
      // No demo não lemos nem a conta real: saldo e posições vêm do ledger paper.
      if (!initialDemoModeRef.current) {
        await syncBybitBalance();
        await syncOpenPositions();
        await fetchTop10VolatileAssets();
      } else {
        console.log('🎮 [DEMO] Sincronização com a exchange real ignorada');
      }
      
      // 🤖 Treinar IA automaticamente com histórico Bybit
      try {
        console.log('🧠 Iniciando treinamento automático da IA...');
        await trainOnWinningPatterns();
        console.log('✅ IA treinada com sucesso');
      } catch (err) {
        console.log('⚠️ Falha no treinamento inicial da IA (não crítico)');
      }
      
      // 🔄 Carregar padrões perdedores históricos
      await loadHistoricalPatterns();
      
      console.log('✅ Inicialização completa');
    };
    init();
  }, [trainOnWinningPatterns, loadHistoricalPatterns]);

  // Restaurar estado e garantir config existe
  useEffect(() => {
    const restoreTraderState = async () => {
      const userId = await getUserId();
      const authenticatedUserId = await getUserIdOrNull();
      console.log('👤 User ID:', userId);
      
      // Carregar ML config
      const { data: mlData } = await supabase
        .from('ml_adaptive_config')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (mlData?.is_enabled) {
        setMlConfig(mlData);
        console.log('🧠 ML Adaptativo ATIVADO');
      }

      // Verificar/criar config do trader
      let { data: config } = await supabase
        .from('auto_trader_config')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      // Se não existe config, criar uma apenas com sessão autenticada.
      // Sem sessão, o RLS bloqueia o INSERT; o robô segue em modo local.
      if (!config) {
        if (!authenticatedUserId) {
          console.info('📝 Sem sessão Supabase: config do trader mantida apenas localmente.');
        } else {
          console.log('📝 Criando config para usuário...');
          const { data: newConfig, error } = await supabase.from('auto_trader_config').insert({
            user_id: authenticatedUserId,
            trader_is_running: false,
            is_active: false,
            min_confidence: 50,
            leverage_max: ROBOT_RISK.leverageMax
          }).select().single();

          if (!error && newConfig) {
            config = newConfig;
            console.log('✅ Config criada');
          }
        }
      }

      if (config?.trader_is_running) {
        const lastActivity = new Date(config.last_activity_at || Date.now()).getTime();
        if (Date.now() - lastActivity < 10 * 60 * 1000) { // 10 min tolerance
          setIsRunning(true);
          toast({ title: "🔄 Trader Restaurado", description: "Operações continuam automaticamente" });
        } else if (authenticatedUserId) {
          await supabase.from('auto_trader_config').update({ trader_is_running: false }).eq('user_id', authenticatedUserId);
        }
      }
      
      console.log('📊 Estado trader:', config?.trader_is_running ? 'ATIVO' : 'PARADO');
    };
    restoreTraderState();
  }, []);

  // Sincronizar PnL de posições fechadas com Bybit e registrar no anti-loss
  const syncClosedPositionsPnL = useCallback(async () => {
    // Ledger demo é fechado pelo hook paper; não consultar posições reais.
    if (isDemoMode) return;
    try {
      const userId = await getUserId();
      
      // Buscar posições fechadas sem PnL
      const { data: closedWithoutPnl, error: fetchError } = await supabase
        .from('auto_trader_positions')
        .select('id, symbol, side, leverage, closed_at, entry_price, exit_price, qty')
        .eq('user_id', userId)
        .eq('status', 'CLOSED')
        .is('realized_pnl', null)
        .order('closed_at', { ascending: false })
        .limit(50);

      if (fetchError) {
        console.error('❌ Erro ao buscar posições:', fetchError);
        return;
      }

      if (!closedWithoutPnl?.length) {
        return; // Silencioso quando não há nada para sincronizar
      }

      console.log(`🔄 Sincronizando PnL de ${closedWithoutPnl.length} posições...`);

      // Buscar PnL real do Bybit (últimos 200 registros)
      const { data: bybitPnL, error: apiError } = await supabase.functions.invoke('bybit-trading', {
        body: { 
          action: 'get_closed_pnl', 
          isTestnet,
          params: { category: 'linear', limit: 200 } 
        }
      });

      const pnlList = (!apiError && bybitPnL?.success) ? (bybitPnL.data?.list || []) : [];
      console.log(`📊 Bybit retornou ${pnlList.length} registros de PnL`);

      let syncedCount = 0;
      
      for (const pos of closedWithoutPnl) {
        let realizedPnl: number | null = null;
        let closeReason = 'UNKNOWN';

        // 1. Tentar encontrar no Bybit por símbolo + tempo
        const symbolMatches = pnlList.filter((p: any) => p.symbol === pos.symbol);
        
        if (symbolMatches.length > 0 && pos.closed_at) {
          const posCloseTime = new Date(pos.closed_at).getTime();
          
          // Encontrar o match mais próximo no tempo (tolerance de 10 minutos)
          let bestMatch = symbolMatches[0];
          let bestDiff = Infinity;
          
          for (const pnl of symbolMatches) {
            const pnlTime = parseInt(pnl.updatedTime);
            const diff = Math.abs(pnlTime - posCloseTime);
            if (diff < bestDiff) {
              bestDiff = diff;
              bestMatch = pnl;
            }
          }
          
          // Se encontrou match dentro de 10 min, usar
          if (bestDiff < 600000) {
            realizedPnl = parseFloat(bestMatch.closedPnl);
            closeReason = bestMatch.execType || 'BYBIT';
          }
        }

        // 2. Se não encontrou no Bybit, CALCULAR manualmente
        if (realizedPnl === null && pos.entry_price && pos.exit_price && pos.qty) {
          const entryPrice = parseFloat(String(pos.entry_price));
          const exitPrice = parseFloat(String(pos.exit_price));
          const qty = parseFloat(String(pos.qty));
          const leverage = pos.leverage || 1;
          
          if (pos.side === 'Buy') {
            // Long: lucro quando preço sobe
            realizedPnl = (exitPrice - entryPrice) * qty;
          } else {
            // Short: lucro quando preço desce
            realizedPnl = (entryPrice - exitPrice) * qty;
          }
          
          closeReason = 'CALCULATED';
          console.log(`📐 PnL calculado para ${pos.symbol}: entry=${entryPrice}, exit=${exitPrice}, qty=${qty}, pnl=${realizedPnl.toFixed(4)}`);
        }

        // Se ainda não tem PnL, pular
        if (realizedPnl === null) {
          console.log(`⚠️ Não foi possível determinar PnL para ${pos.symbol}`);
          continue;
        }
        
        // Atualizar no banco
        const { error: updateError } = await supabase
          .from('auto_trader_positions')
          .update({ 
            realized_pnl: realizedPnl,
            close_reason: closeReason
          })
          .eq('id', pos.id);

        if (updateError) {
          console.error(`❌ Erro ao atualizar PnL de ${pos.symbol}:`, updateError);
          continue;
        }

        // 🚫 REGISTRAR NO SISTEMA ANTI-LOSS
        recordTradeResult(
          pos.symbol,
          pos.side,
          pos.leverage || 10,
          realizedPnl
        );

        syncedCount++;
        const emoji = realizedPnl >= 0 ? '🟢' : '🔴';
        console.log(`${emoji} PnL sincronizado: ${pos.symbol} ${pos.side} = $${realizedPnl.toFixed(4)} (${closeReason})`);
      }

      if (syncedCount > 0) {
        console.log(`✅ Sincronizados ${syncedCount}/${closedWithoutPnl.length} PnLs`);
      }
      
    } catch (error) {
      console.error('❌ Erro ao sincronizar PnL:', error);
    }
  }, [recordTradeResult, isDemoMode]);

  // Smart exits + sync de preços/PnL no banco
  const updateSmartExits = useCallback(async () => {
    // Saídas demo são simuladas em useDemoTrading — nunca chamar place_order real.
    if (isDemoMode) return;
    if (!smartExitEnabled && !trailingStopEnabled) return;

    try {
      const { data, error } = await supabase.functions.invoke('bybit-trading', {
        body: { action: 'get_positions', isTestnet, params: { category: 'linear', settleCoin: 'USDT' } }
      });

      if (error || !data?.success) return;

      // positions data is array directly
      const positionsList = Array.isArray(data.data) ? data.data : (data.data?.list || []);
      const openPositionsData = positionsList.filter((p: any) => parseFloat(p.size) > 0);
      const volatilityMap = (window as any).assetVolatility || new Map();

      // ✅ Atualizar current_price/unrealized_pnl no banco (para dashboard e IA)
      if (openPositionsData.length > 0) {
        const userId = await getUserId();
        const symbols: string[] = Array.from(
          new Set<string>(openPositionsData.map((p: any) => String(p.symbol)))
        );

        const { data: dbRows, error: dbErr } = await supabase
          .from('auto_trader_positions')
          .select('id, symbol, side, opened_at')
          .eq('user_id', userId)
          .eq('status', 'OPEN')
          .in('symbol', symbols)
          .order('opened_at', { ascending: false })
          .limit(1000);

        // Mapear opened_at para cada posição (para saída por tempo)
        const openedAtMap = new Map<string, string>();

        if (!dbErr && dbRows?.length) {
          const latestIdByKey = new Map<string, string>();
          for (const r of dbRows) {
            const key = `${r.symbol}-${r.side}`;
            if (!latestIdByKey.has(key)) {
              latestIdByKey.set(key, r.id);
              openedAtMap.set(key, r.opened_at);
            }
          }

          await Promise.all(
            openPositionsData.map(async (p: any) => {
              const key = `${p.symbol}-${p.side}`;
              const id = latestIdByKey.get(key);
              if (!id) return;

              const currentPrice = parseFloat(p.markPrice);
              const unrealized = parseFloat(p.unrealisedPnl);
              if (!isFinite(currentPrice)) return;

              await supabase
                .from('auto_trader_positions')
                .update({
                  current_price: currentPrice,
                  unrealized_pnl: isFinite(unrealized) ? unrealized : 0,
                })
                .eq('id', id);
            })
          );
        }

        // ⏰ Passar openedAtMap para processOpenPositions (saída por tempo)
        if (smartExitEnabled) {
          const positionsData = openPositionsData.map((p: any) => ({
            symbol: p.symbol,
            side: p.side,
            size: parseFloat(p.size),
            entryPrice: parseFloat(p.avgPrice),
            currentPrice: parseFloat(p.markPrice),
            unrealizedPnl: parseFloat(p.unrealisedPnl),
            leverage: parseFloat(p.leverage),
          }));
          await processOpenPositions(positionsData, mlConfig, volatilityMap, { 
            enablePartialExit: partialExitEnabled,
            openedAtMap 
          });
        }
      }

      // Detectar posições que fecharam e sincronizar PnL
      const openSymbols = new Set(openPositionsData.map((p: any) => p.symbol));
      const previousSymbols = Array.from(positionTracking.keys());
      const closedSymbols = previousSymbols.filter(s => !openSymbols.has(s));

      if (closedSymbols.length > 0) {
        console.log(`🔄 Detectadas ${closedSymbols.length} posições fechadas, sincronizando PnL...`);
        await syncClosedPositionsPnL();
      }

      // Limpar tracking de posições fechadas
      setPositionTracking(prev => {
        const newMap = new Map(prev);
        for (const [symbol] of newMap) {
          if (!openSymbols.has(symbol)) {
            newMap.delete(symbol);
            clearPositionState(symbol);
          }
        }
        return newMap;
      });

      // Recarregar contexto para refletir PnL atualizado no UI
      if (openPositionsData.length > 0 || closedSymbols.length > 0) {
        await refetch();
      }
    } catch (error) {
      console.error('Erro ao atualizar smart exits:', error);
    }
  }, [smartExitEnabled, trailingStopEnabled, partialExitEnabled, isTestnet, isDemoMode, mlConfig, processOpenPositions, positionTracking, syncClosedPositionsPnL, clearPositionState, refetch]);

  const analyzeAndTrade = async () => {
    // 🔒 Mutex: impedir execuções concorrentes
    if (tradingLockRef.current) {
      console.log('🔒 Ciclo anterior ainda em execução - pulando');
      return;
    }
    tradingLockRef.current = true;
    try {
      // 🧪 DEMO: ciclo determinístico e isolado. Não depende de IA paga,
      // horário, filtros históricos nem de qualquer chamada autenticada.
      if (isDemoMode) {
        const finishDemoCycle = (opened: number, analyzed: number) => {
          setGateDiagnostics({
            skipCounts: {},
            totalAnalyzed: analyzed,
            openedThisCycle: opened,
            lastCycleAt: new Date(),
          });
          setCycleCount(prev => prev + 1);
        };

        let account = demoAccount;
        if (!account) account = await loadDemoAccount();
        if (!account) {
          console.error('❌ [DEMO] Conta demo não carregada - ciclo abortado');
          toast({ title: '⚠️ Demo não pronta', description: 'Aguarde o carregamento da conta demo e tente novamente.', variant: 'destructive' });
          return;
        }

        const { data: tickersData, error: tickersError } = await supabase.functions.invoke('bybit-trading', {
          body: { action: 'get_tickers', isTestnet: false, params: { category: 'linear' } }
        });
        const tickers = Array.isArray(tickersData?.data)
          ? tickersData.data
          : (tickersData?.data?.list || []);
        if (tickersError || !tickersData?.success || tickers.length === 0) {
          console.warn('⚠️ [DEMO] Ticker público indisponível; tentando preço de referência', tickersError);
        }

        const openSymbols = demoPositions.map(p => p.symbol);
        const candidates = tickers
          .map((t: any) => ({
            symbol: String(t.symbol || ''),
            price: Number(t.lastPrice || 0),
            changePct: Number(t.price24hPcnt || 0) * 100,
            volume: Number(t.turnover24h || 0),
          }))
          .filter((t: { symbol: string; price: number }) =>
            t.symbol.endsWith('USDT') && t.price > 0 && !openSymbols.includes(t.symbol))
          .sort((a: { symbol: string; volume: number }, b: { symbol: string; volume: number }) => {
            const rank = (s: string) => (s === 'BTCUSDT' || s === 'ETHUSDT' ? 0 : 1);
            return rank(a.symbol) - rank(b.symbol) || b.volume - a.volume;
          })
          .slice(0, 10);

        let chosen = candidates[0];
        if (!chosen) {
          const fallbackPrice = await fetchCurrentPrice('BTCUSDT');
          if (fallbackPrice > 0 && !openSymbols.includes('BTCUSDT')) {
            chosen = { symbol: 'BTCUSDT', price: fallbackPrice, changePct: 0, volume: 0 };
          }
        }

        const plan = chosen
          ? planDemoTrade({
              symbol: chosen.symbol,
              price: chosen.price,
              changePct: chosen.changePct,
              balance: demoBalance,
              openSymbols,
            })
          : null;

        if (!plan) {
          console.warn('⚠️ [DEMO] Nenhum ativo disponível para o ciclo simulado');
          toast({ title: '⚠️ Demo sem ativo', description: 'Não foi possível obter um preço público para simular a ordem.', variant: 'destructive' });
          finishDemoCycle(0, candidates.length);
          return;
        }

        console.log(`🧪 [DEMO] Sinal ${plan.side} ${plan.symbol} @ $${plan.price.toFixed(4)} | confiança ${plan.confidence}% | sem ordem real`);
        const demoResult = await openDemoPosition({
          symbol: plan.symbol,
          side: plan.side,
          quantity: plan.quantity,
          leverage: plan.leverage,
          stopLoss: plan.stopLoss,
          takeProfit: plan.takeProfit,
          confidence: plan.confidence,
          price: plan.price,
        });

        if (!demoResult.success) {
          console.error(`❌ [DEMO] Falha na ordem simulada: ${demoResult.error}`);
          toast({ title: '❌ Demo não abriu posição', description: demoResult.error, variant: 'destructive' });
          finishDemoCycle(0, 1);
          return;
        }

        setActiveTrades(prev => [{
          symbol: plan.symbol,
          action: plan.side,
          confidence: plan.confidence,
          leverage: plan.leverage,
          usdSize: plan.usdSize,
          timestamp: new Date().toISOString(),
        }, ...prev].slice(0, 50));
        console.log(`✅ [DEMO] TRADE: ${JSON.stringify({
          symbol: plan.symbol, side: plan.side, leverage: plan.leverage,
          qty: plan.quantity, stopLoss: plan.stopLoss, takeProfit: plan.takeProfit,
          mode: 'DEMO', orderId: demoResult.data?.orderId,
        })}`);
        toast({
          title: '🧪 Demo: ordem simulada',
          description: `${plan.side} ${plan.symbol} @ $${plan.price.toFixed(4)} · SL/TP simulados`,
        });
        finishDemoCycle(1, 1);
        return;
      }

      // Modo real: sincronizar saldo/posições e filtros da exchange.
      // O ramo demo já retornou acima, então não há leitura autenticada aqui.
      let balanceNow = await syncBybitBalance();
      await syncOpenPositions();
      const topVolNow = await fetchTop10VolatileAssets();
      
      // 🛡️ EARLY EXIT: Se saldo disponível < $3, não faz sentido continuar o ciclo
      if (balanceNow < 3) {
        console.log(`🛑 Saldo disponível muito baixo: $${balanceNow.toFixed(2)} - pulando ciclo (margem toda em uso)`);
        return;
      }
      
      // 🆕 Buscar tendência do BTC para correlação com alts
      const btcTrend = await fetchBTCTrend();
      console.log(`🪙 BTC trend: ${btcTrend > 0 ? '+' : ''}${btcTrend.toFixed(2)}%`);

      // 🧠 Atualizar Fear & Greed a cada ciclo (cache interno de 10min)
      if (aiIntelligenceEnabled) {
        const fg = await fetchFearGreed();
        if (fg) {
          console.log(`😱 Fear & Greed: ${fg.value} (${fg.sentiment}) - ${fg.tradingAdvice}`);
          
          // Verificar se deve evitar trading
          const avoidCheck = shouldAvoidTrading();
          if (avoidCheck.avoid) {
            console.log(`🚫 TRADING PAUSADO: ${avoidCheck.reason}`);
            toast({ 
              title: "⚠️ Trading Pausado", 
              description: avoidCheck.reason,
              variant: "destructive" 
            });
            return; // Pular este ciclo
          }
        }
      }

      // Verificar proteções
      if (consecutiveLosses >= MAX_CONSECUTIVE_LOSSES) {
        toast({ title: "⚠️ Sequência de Perdas", variant: "destructive" });
        setIsRunning(false);
        return;
      }

      // Horários bloqueados (UTC)
      if (isBlockedHourUtc()) {
        console.log(`⏸️ Hora ${new Date().getUTCHours()}h UTC bloqueada para entradas`);
        return;
      }

      // Filtro de horário
      if (timeFilterEnabled) {
        const currentHour = new Date().getUTCHours();
        const isWithinTradingHours = startHour <= endHour
          ? currentHour >= startHour && currentHour < endHour
          : currentHour >= startHour || currentHour < endHour;
        if (!isWithinTradingHours) return;
      }

      // Buscar instrumentos (com cache de 5min)
      let tradableAssets: any[];
      const now = Date.now();
      if (instrumentsCache.current.data.length > 0 && now - instrumentsCache.current.timestamp < INSTRUMENTS_CACHE_TTL) {
        tradableAssets = instrumentsCache.current.data;
        console.log(`📊 ${tradableAssets.length} ativos tradáveis (cache)`);
      } else {
        const { data: instrumentsData, error: instrumentsError } = await supabase.functions.invoke('bybit-trading', {
          body: { action: 'get_instruments', isTestnet, params: { category: 'linear', limit: 1000, status: 'Trading' } }
        });

        if (instrumentsError || !instrumentsData?.success) {
          console.log('❌ Erro ao buscar instruments:', instrumentsError);
          return;
        }

        const instruments = Array.isArray(instrumentsData.data) ? instrumentsData.data : (instrumentsData.data?.list || []);
        tradableAssets = instruments.filter((inst: any) => inst.status === 'Trading' && inst.quoteCoin === 'USDT');
        instrumentsCache.current = { data: tradableAssets, timestamp: now };
        console.log(`📊 ${tradableAssets.length} ativos tradáveis (fresh)`);
      }

      const { data: tickerData, error: tickerError } = await supabase.functions.invoke('bybit-trading', {
        body: { action: 'get_ticker', isTestnet, params: { category: 'linear' } }
      });

      if (tickerError || !tickerData?.success) {
        console.log('❌ Erro ao buscar tickers:', tickerError);
        return;
      }

      // tickers data is array directly in data field
      const tickers = Array.isArray(tickerData.data) ? tickerData.data : (tickerData.data?.list || []);
      console.log(`📈 ${tickers.length} tickers recebidos`);

      // Map rápido para monitorar ordens armadas (S/R)
      const tickersMap = new Map<string, { lastPrice: string }>();
      for (const t of tickers) {
        if (t?.symbol && t?.lastPrice) tickersMap.set(t.symbol, { lastPrice: t.lastPrice });
      }
      
      // === FILTRO AVANÇADO DE ATIVOS PARA SCALPING ===
      const assetsWithVolatility = tradableAssets.map((instrument: any) => {
        const ticker = tickers.find((t: any) => t.symbol === instrument.symbol);
        if (!ticker) return null;
        
        const priceChange = parseFloat(ticker?.price24hPcnt || '0') * 100;
        const volume24h = parseFloat(ticker?.turnover24h || '0');
        const lastPrice = parseFloat(ticker?.lastPrice || '0');
        const bid1Price = parseFloat(ticker?.bid1Price || '0');
        const ask1Price = parseFloat(ticker?.ask1Price || '0');
        
        // Calcular spread percentual (importante para scalping)
        const spread = lastPrice > 0 ? ((ask1Price - bid1Price) / lastPrice) * 100 : 999;
        
        // Calcular "score de liquidez" (volume / volatilidade = melhor liquidez relativa)
        const liquidityScore = volume24h > 0 && Math.abs(priceChange) > 0 
          ? volume24h / (Math.abs(priceChange) * 1000000) 
          : 0;
        
        return { 
          instrument, 
          ticker, 
          volatility: Math.abs(priceChange), 
          priceChange, 
          volume24h,
          spread,
          liquidityScore,
          lastPrice
        };
      }).filter(a => {
        if (!a) return false;
        
        const isInTop10 = topVolNow.includes(a.instrument.symbol);
        const symbol = a.instrument.symbol;
        
        if (isRobotBlacklisted(symbol)) return false;

        // Em TESTNET liberamos a lista (para treinar) sem mexer no modo REAL
        if (!isTestnet) {
          // 🆕 PRIMEIRO: Verificar BLACKLIST GLOBAL (baseado em dados históricos reais)
          if (GLOBAL_BLACKLIST.has(symbol)) {
            return false; // Nunca operar símbolos que historicamente perdem
          }
        }
        
        // === CRITÉRIOS PARA SCALPING LUCRATIVO (mais flexíveis em TESTNET) ===
        
        // 1. Spread máximo
        const maxSpread = isTestnet || isDemoMode ? 0.20 : 0.05;
        if (a.spread > maxSpread) return false;
        
        // 2. Volume mínimo
        const minVolume = isTestnet || isDemoMode ? 100000 : (isInTop10 ? 500000 : 1000000);
        if (a.volume24h < minVolume) return false;
        
        // 3. Faixa de volatilidade
        const minVol = isTestnet || isDemoMode ? 0.5 : (isInTop10 ? 1.5 : 2.0);
        const maxVol = isTestnet || isDemoMode ? 25 : 10;
        if (a.volatility < minVol || a.volatility > maxVol) return false;
        
        // 4. Preço mínimo para evitar dust trades
        if (a.lastPrice < 0.001) return false;
        
        // 5. Priorizar majors e ativos conhecidos (no REAL), mas sem travar o treino em TESTNET
        // v13: APENAS MAJORS COM LIQUIDEZ COMPROVADA — shitcoins = loss
        const ALLOWED_SYMBOLS = new Set([
          'BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'XRPUSDT', 'BNBUSDT',
          'ADAUSDT', 'DOGEUSDT', 'AVAXUSDT', 'LINKUSDT', 'DOTUSDT',
          'SUIUSDT', 'APTUSDT', 'NEARUSDT', 'ARBUSDT', 'OPUSDT',
        ]);
        if (!isTestnet && !isDemoMode && !ALLOWED_SYMBOLS.has(symbol)) return false;
        
        return true;
      });
      
      // === ORDENAÇÃO INTELIGENTE: Priorizar WHITELIST + fatores de qualidade ===
      const maxLiquidity = Math.max(...assetsWithVolatility.map(a => a?.liquidityScore || 0), 1);
      const maxVolume = Math.max(...assetsWithVolatility.map(a => a?.volume24h || 0), 1);
      
      const scoredAssets = assetsWithVolatility.filter(Boolean).map(a => {
        const symbol = a!.instrument.symbol;
        const normalizedLiquidity = (a!.liquidityScore / maxLiquidity);
        const normalizedVolatility = Math.min(a!.volatility / 8, 1); // Cap em 8%
        const normalizedVolume = (a!.volume24h / maxVolume);
        
        // 🆕 MEGA BONUS para símbolos com bom histórico na hora atual
        const symbolAnalysis = analyzeSymbol(symbol);
        let whitelistBonus = 0;
        if (symbolAnalysis.isOptimalForHour && symbolAnalysis.hourWinRate) {
          if (symbolAnalysis.hourWinRate >= 70) whitelistBonus = 0.50;
          else if (symbolAnalysis.hourWinRate >= 50) whitelistBonus = 0.30;
          else whitelistBonus = 0.15;
        } else if (symbolAnalysis.isPremium) {
          whitelistBonus = 0.20;
        }
        
         // Bonus para majors prioritários
         const priorityBonus = ['BTCUSDT', 'ETHUSDT'].includes(symbol) ? 0.25 : ['XRPUSDT', 'SOLUSDT'].includes(symbol) ? 0.10 : 0;
        
        // Penalidade para spread alto
        const spreadPenalty = a!.spread > 0.03 ? 0.1 : 0;
        
        const assetScore = (normalizedLiquidity * 0.25) + (normalizedVolatility * 0.20) + (normalizedVolume * 0.25) + whitelistBonus + priorityBonus - spreadPenalty;
        
        return { ...a!, assetScore, isWhitelisted: symbolAnalysis.isOptimalForHour || symbolAnalysis.isPremium };
      });
      
      // 🆕 Ordenar com WHITELIST primeiro
      const topVolatileAssets = scoredAssets
        .sort((a, b) => {
          // Whitelist sempre primeiro
          if (a.isWhitelisted && !b.isWhitelisted) return -1;
          if (!a.isWhitelisted && b.isWhitelisted) return 1;
          return b.assetScore - a.assetScore;
        })
        .slice(0, 15); // v13: REDUZIDO de 50→15 — foco em qualidade
      
      console.log(`🔥 ${topVolatileAssets.length} ativos após filtro avançado | Top 5: ${topVolatileAssets.slice(0, 5).map(a => `${a.instrument.symbol}(${a.assetScore.toFixed(2)})${a.isWhitelisted ? '⭐' : ''}`).join(', ')}`);

      // 🎯 ORDENS ARMADAS (S/R): armar + disparar a cada ciclo com base nos tickers atuais
      if (armedModeEnabled && !isDemoMode) {
        try {
          // 1) Disparar ordens já armadas quando o preço encostar no nível
          await checkArmedOrdersForTrigger(tickersMap);

          // 2) Armar novas ordens S/R (rate-limit de 5min/símbolo já existe no hook)
          const baseArmedLev = mlConfig?.recommended_leverage
            ? Number(mlConfig.recommended_leverage)
            : getLeverageForBalance(balanceNow, historicalWinRate);
          const armedLeverage = Math.max(5, Math.min(25, Math.floor(baseArmedLev)));

          await checkAndArmOrders(
            topVolatileAssets.map(a => ({
              symbol: a.instrument.symbol,
              ticker: a.ticker,
              instrument: a.instrument,
            })),
            armedLeverage
          );

          // 3) Limpeza simples para não acumular ordens antigas
          cleanupOldOrders();
        } catch (err) {
          console.log('⚠️ Falha no monitor de ordens armadas:', err);
        }
      }
      
      const dataDrivenSymbols = new Set(
        filterAssetsDataDriven(
          topVolatileAssets.map(asset => ({
            symbol: asset.instrument.symbol,
            assetScore: asset.assetScore,
          }))
        ).map(asset => asset.symbol)
      );

      const candidateAssets = topVolatileAssets.filter(asset =>
        dataDrivenSymbols.has(asset.instrument.symbol)
      );

      if (candidateAssets.length === 0) {
        console.log('🛑 Nenhum ativo aprovado pelo filtro histórico nesta hora - ciclo encerrado');
        return;
      }

      console.log(
        `🧭 ${candidateAssets.length}/${topVolatileAssets.length} ativos aprovados pelo filtro histórico: ${candidateAssets
          .map(asset => asset.instrument.symbol)
          .join(', ')}`
      );

      let shouldStopTrading = false;
      let openedThisCycle = 0;
      const skipCounts = new Map<string, number>();
      const activePreset = getCurrentPreset();
      // Helper: registra skip + entrada de auditoria
      const auditSkip = (
        symbol: string,
        gate: string,
        reason: string,
        quality?: string,
      ) => {
        skipCounts.set(reason, (skipCounts.get(reason) || 0) + 1);
        recordGateAudit({
          symbol,
          quality,
          preset: activePreset,
          outcome: 'BLOCKED',
          gate,
          reason,
          rule: getRiskRule(quality, activePreset),
        });
      };
      const openPositionsLite = isDemoMode 
        ? demoPositions.map(p => ({ symbol: p.symbol, side: p.side }))
        : openPositions.map(p => ({ symbol: p.symbol, side: p.side }));
      
      // === LIMITES POR CICLO — v8: mais agressivo para mais entradas ===
      let buyCountThisCycle = 0;
      let sellCountThisCycle = 0;
      const MAX_SAME_DIRECTION_PER_CYCLE = 1; // v13: 1 por direção — precisão > quantidade
      const MAX_TRADES_PER_CYCLE = 1; // v13: 1 trade por ciclo — sniper mode
      
      // Contar posições abertas por direção (incluir demo se ativo)
      const allOpenPositions = isDemoMode ? demoPositions.map(p => ({ symbol: p.symbol, side: p.side })) : openPositions;
      const existingBuys = allOpenPositions.filter(p => p.side === 'Buy').length;
      const existingSells = allOpenPositions.filter(p => p.side === 'Sell').length;
      const MAX_IMBALANCE = 3; // Swing: menor imbalance
      
      // 🚫 BLOQUEAR HEDGE: símbolos já com posição aberta
      const symbolsWithOpenPosition = new Set(allOpenPositions.map(p => p.symbol));
      
      // v8: SEM whitelist estática — todos os ativos que passaram no scoring de qualidade são permitidos
      // A blacklist global e os filtros de ML já protegem contra ativos ruins
      
      // 🔧 ML Auto-Corrector: Obter símbolos bloqueados pela correção automática
      const mlBlockedSymbols = new Set(mlAutoConfig?.blockedSymbols || []);
      
      // 🚀 v23: BATCH AI PREFETCH — fetch AI data for top 5 uncached assets in parallel
      const uncachedSymbols = candidateAssets
        .slice(0, 8)
        .map(a => a.instrument.symbol)
        .filter(s => !symbolsWithOpenPosition.has(s) && !mlBlockedSymbols.has(s))
        .filter(s => {
          const cached = aiAnalysisCache.current.get(s);
          return !cached || Date.now() - cached.timestamp > 60000;
        })
        .slice(0, 5);
      
      if (uncachedSymbols.length > 0) {
        await Promise.allSettled(
          uncachedSymbols.map(async (s) => {
            try {
              const ai = await fetchComprehensiveAI(s);
              if (ai) aiAnalysisCache.current.set(s, { data: ai, timestamp: Date.now() });
            } catch {
              // IA indisponível para este ativo: segue sem cache e usa os dados locais.
            }
          })
        );
      }

      for (const assetData of candidateAssets) {
        if (!isRunning || shouldStopTrading) break;
        
        // LIMITE DE TRADES POR CICLO
        if (openedThisCycle >= MAX_TRADES_PER_CYCLE) {
          console.log(`⚠️ Limite de ${MAX_TRADES_PER_CYCLE} trades/ciclo atingido`);
          break;
        }

        const { instrument, ticker, volatility, priceChange, volume24h } = assetData;
        const symbol = instrument.symbol;
        const isScalpAsset = topVolNow.includes(symbol);
        const isPriorityMajor = symbol === 'BTCUSDT' || symbol === 'ETHUSDT';
        
        // 🆕 ANÁLISE BASEADA EM DADOS POR HORA
        const symbolAnalysis = analyzeSymbol(symbol);
        const isOptimalForHour = symbolAnalysis.isOptimalForHour;
        const isPremiumSymbol = symbolAnalysis.isPremium;
        
        // 🚫 BLACKLIST GLOBAL: nunca operar
        if (symbolAnalysis.isBlacklisted) {
          continue;
        }
        
        // 🔧 ML PRIMEIRO: Verificar se ML bloqueou este símbolo
        if (mlAutoCorrectEnabled && mlBlockedSymbols.has(symbol)) {
          console.log(`🔧 ML BLOQUEOU SÍMBOLO: ${symbol} (WR ruim)`);
          continue;
        }
        
        // 🚫 BLOQUEAR HEDGE: não abrir posição em símbolo que já tem posição aberta
        if (symbolsWithOpenPosition.has(symbol)) {
          console.log(`🚫 ${symbol}: HEDGE bloqueado - já existe posição aberta`);
          continue;
        }
        
        try {
          const currentPrice = parseFloat(ticker.lastPrice);
          const highPrice = parseFloat(ticker.highPrice24h);
          const lowPrice = parseFloat(ticker.lowPrice24h);
          
          // v23: Use cached AI or skip if unavailable (prefetch happens before loop)
          let comprehensiveAI = null;
          const cached = aiAnalysisCache.current.get(symbol);
          if (cached && Date.now() - cached.timestamp < 60000) {
            comprehensiveAI = cached.data;
          } else {
            try {
              comprehensiveAI = await fetchComprehensiveAI(symbol);
              if (comprehensiveAI) {
                aiAnalysisCache.current.set(symbol, { data: comprehensiveAI, timestamp: Date.now() });
              }
            } catch (e) {
              // v23: Skip silently without logging for each asset
              continue;
            }
          }
          
          // v11: Sem dados AI, não é possível validar condições estritas
          if (!comprehensiveAI?.technical?.m1) {
            console.log(`⚠️ ${symbol}: Sem dados técnicos AI - pulando`);
            continue;
          }
          
          // v11: Thresholds simplificados (condições estritas já filtram)
          const scoreThreshold = 55;
          const minConfirmations = 4; // Todas as 5 condições devem ser atendidas
          
          // Passar symbol, BTC trend E dados AI para análise
          const analysisResult = analyzeSignal({
            currentPrice, highPrice, lowPrice, priceChange, volume24h, volatility,
            scoreThreshold, minConfirmations, currentBalance: balanceNow,
            symbol,
            btcPriceChange: btcTrend,
            comprehensiveAI, // v11: CRITICAL - passa dados para validação estrita
          });

          if (!analysisResult.shouldTrade || !analysisResult.action) {
            const reason = analysisResult.skipReason || 'Sem motivo';
            auditSkip(symbol, 'Sinal', reason, analysisResult.signalQuality);
            continue;
          }

          const historicalDecision = shouldTradeDataDriven(symbol, analysisResult.signalScore, volatility);
          if (!historicalDecision.shouldTrade) {
            auditSkip(symbol, 'Histórico/Hora', 'Filtro histórico/data-driven', analysisResult.signalQuality);
            continue;
          }

          // v28 EQUILIBRADO: relaxar gates redundantes para mais entradas mantendo qualidade
          const hasSR = Boolean(analysisResult.srEntry);
          const hasPullback = Boolean(analysisResult.pullbackCandle);
          const hasAnyConfirm = hasSR || hasPullback;
          
          // v28: Premium entra livre, High/Medium precisa de PELO MENOS 1 confirmação (S/R OU pullback)
          let qualityApproved = false;
          if (analysisResult.signalQuality === 'premium') {
            qualityApproved = true; // premium: sinal já é forte
          } else if (analysisResult.signalQuality === 'high') {
            qualityApproved = hasAnyConfirm; // high: 1 confirmação basta
          } else if (analysisResult.signalQuality === 'medium') {
            // medium: 1 confirmação para majors, combo para alts
            qualityApproved = isPriorityMajor ? hasAnyConfirm : (hasSR && hasPullback);
          }

          if (!qualityApproved) {
            auditSkip(symbol, 'Qualidade', 'Qualidade insuficiente (sem S/R nem pullback)', analysisResult.signalQuality);
            continue;
          }

          // v28: CONFIANÇA MÍNIMA 70% (era 75) — mais entradas com qualidade ainda alta
          const rawAiConf = analysisResult.aiConfidence;
          const compAbs = Math.abs(analysisResult.compositeScore ?? 0);
          const techConf = Math.min(100, (analysisResult.signalScore / 100) * 100);
          const compConf = Math.min(100, compAbs * 1.2);
          const effectiveConf = (rawAiConf && rawAiConf > 0)
            ? rawAiConf
            : (compAbs > 0 ? (techConf * 0.6 + compConf * 0.4) : techConf);
          
          // v29: Threshold dinâmico via config centralizada + preset ativo
          const riskRule = getRiskRule(analysisResult.signalQuality, activePreset);
          const minConf = riskRule.minConfidence;
          if (effectiveConf < minConf) {
            auditSkip(symbol, 'Confiança', `Confiança < ${minConf}% (atual ${effectiveConf.toFixed(0)}%)`, analysisResult.signalQuality);
            continue;
          }

          // Gateway de sinais como veto: bloqueio/divergência do consenso
          // impedem a entrada. Indisponibilidade do gateway não bloqueia.
          {
            const gateway = await getGatewaySignal(symbol);
            if (gateway?.gatePass === false && gateway.finalAction === 'WAIT') {
              auditSkip(symbol, 'Gateway IA', `Bloqueado: ${(gateway.gateBlockedBy ?? []).join(', ') || 'sem consenso'}`, analysisResult.signalQuality);
              continue;
            }
            if (gateway?.gatePass && gateway.finalAction !== analysisResult.action) {
              auditSkip(symbol, 'Gateway IA', `Divergência: gateway ${gateway.finalAction} x analisador ${analysisResult.action}`, analysisResult.signalQuality);
              continue;
            }
          }

          // v28: M1/M5 — M5 sideways agora é PERMITIDO se M1 estiver alinhado com a ação (mercado em range tem oportunidades)
          const m1Sig = analysisResult.m1Signal;
          const m5Trend = comprehensiveAI?.technical?.m5?.trend;
          const m1Aligned =
            (analysisResult.action === 'BUY' && m1Sig === 'buy') ||
            (analysisResult.action === 'SELL' && m1Sig === 'sell');
          const m5NotContradicting = 
            (analysisResult.action === 'BUY' && m5Trend !== 'down') ||
            (analysisResult.action === 'SELL' && m5Trend !== 'up');
          
          if (!m1Aligned || !m5NotContradicting) {
            auditSkip(symbol, 'Alinhamento M1/M5', `M1/M5 conflito (M1:${m1Sig}/M5:${m5Trend})`, analysisResult.signalQuality);
            continue;
          }

          // v28: Score mínimo via config centralizada
          let minTradeScore = riskRule.minScore;
          if (!isPriorityMajor) minTradeScore += 5;
          if (volatility > 8) minTradeScore += 3;

          if (historicalDecision.adjustedScore < minTradeScore) {
            auditSkip(symbol, 'Score', `Score < ${minTradeScore} (atual ${historicalDecision.adjustedScore.toFixed(0)})`, analysisResult.signalQuality);
            continue;
          }
          
          // v13: FEAR & GREED DIRECTION FILTER — operar COM o mercado, não contra
          if (fearGreed) {
            const fgValue = fearGreed.value;
            if (fgValue < 25 && analysisResult.action === 'SELL') {
              console.log(`🚫 ${symbol}: F&G ${fgValue} (medo) → SHORT bloqueado, só LONG permitido`);
              auditSkip(symbol, 'Fear & Greed', `F&G ${fgValue} (medo) — SHORT bloqueado`, analysisResult.signalQuality);
              continue;
            }
            if (fgValue > 75 && analysisResult.action === 'BUY') {
              console.log(`🚫 ${symbol}: F&G ${fgValue} (ganância) → LONG bloqueado, só SHORT permitido`);
              auditSkip(symbol, 'Fear & Greed', `F&G ${fgValue} (ganância) — LONG bloqueado`, analysisResult.signalQuality);
              continue;
            }
          }
          
          // 🆕 CONTROLE DE DIVERSIFICAÇÃO - evitar muitos trades na mesma direção
          const isBuy = analysisResult.action === 'BUY';
          const isSell = analysisResult.action === 'SELL';
          
          // Verificar limite por direção neste ciclo
          if (isBuy && buyCountThisCycle >= MAX_SAME_DIRECTION_PER_CYCLE) {
            console.log(`⚠️ ${symbol}: Limite BUY/ciclo atingido (${buyCountThisCycle}/${MAX_SAME_DIRECTION_PER_CYCLE})`);
            continue;
          }
          if (isSell && sellCountThisCycle >= MAX_SAME_DIRECTION_PER_CYCLE) {
            console.log(`⚠️ ${symbol}: Limite SELL/ciclo atingido (${sellCountThisCycle}/${MAX_SAME_DIRECTION_PER_CYCLE})`);
            continue;
          }
          
          // Verificar imbalance geral (evitar muitas posições em uma direção)
          if (isBuy && (existingBuys + buyCountThisCycle) - (existingSells + sellCountThisCycle) >= MAX_IMBALANCE) {
            console.log(`⚠️ ${symbol}: Muitos BUYs vs SELLs - aguardando equilíbrio`);
            continue;
          }
          if (isSell && (existingSells + sellCountThisCycle) - (existingBuys + buyCountThisCycle) >= MAX_IMBALANCE) {
            console.log(`⚠️ ${symbol}: Muitos SELLs vs BUYs - aguardando equilíbrio`);
            continue;
          }
          
          // === SCALPING: Volatilidade alta = OPORTUNIDADE, não risco ===
          // Só bloquear em volatilidade EXTREMA (>15%) sem score forte
          if (volatility > 15 && analysisResult.signalScore < 50) {
            console.log(`⚠️ ${symbol}: Vol extrema ${volatility.toFixed(1)}%, score ${analysisResult.signalScore} baixo`);
            continue;
          }

          // Calcular alavancagem antes de verificar padrão
          const maxLeverageInstrument = parseFloat(instrument.leverageFilter?.maxLeverage || '25');
          let dynamicLeverage = isScalpAsset
            ? Math.min(getLeverageForScalping(volatility), maxLeverageInstrument)
            : Math.min(getLeverageForBalance(balanceNow, historicalWinRate), maxLeverageInstrument);
          
          // 🔧 ML AUTO-CORRECTOR: Aplicar limite de alavancagem corrigido
          if (mlAutoCorrectEnabled && mlAutoConfig?.maxLeverage) {
            dynamicLeverage = Math.min(dynamicLeverage, mlAutoConfig.maxLeverage);
          }
          
          if (mlConfig?.is_enabled && mlConfig?.recommended_leverage) {
            dynamicLeverage = Math.min(dynamicLeverage, mlConfig.recommended_leverage, maxLeverageInstrument);
          }
          
          // v28: Leverage cap centralizado em qualityRiskConfig
          let leverageCap = riskRule.maxLeverage;
          if (volatility > 6) leverageCap = Math.min(leverageCap, 4);
          if (!isPriorityMajor) {
            leverageCap = Math.min(leverageCap, analysisResult.srEntry && analysisResult.pullbackCandle ? 5 : 4);
          }

          const leverage = capLeverage(Math.max(ROBOT_RISK.minLeverage, Math.min(leverageCap, Math.floor(dynamicLeverage))));

          // 🚫 Verificar padrão perdedor ANTES de entrar
          const patternCheck = isPatternBlocked(symbol, analysisResult.action === 'BUY' ? 'Buy' : 'Sell', leverage);
          if (patternCheck.blocked) {
            console.log(`🚫 BLOQUEADO: ${symbol} - ${patternCheck.reason}`);
            continue;
          }
          
          // 🔧 ML AUTO-CORRECTOR: Verificar bloqueio automático baseado em dados
          if (mlAutoCorrectEnabled && mlAutoConfig) {
            const mlAutoBlock = shouldMLAutoBlockTrade(symbol, leverage);
            if (mlAutoBlock.blocked) {
              console.log(`🔧 ML AUTO-CORRIGIU: ${symbol} - ${mlAutoBlock.reason}`);
              continue;
            }
          }
          
          // 🧠 VERIFICAR ML AUTO SYNC - Bloqueio baseado em aprendizado contínuo
          if (mlDecisionsEnabled) {
            try {
              const mlBlockCheck = await shouldMLBlockTrade(symbol, analysisResult.action === 'BUY' ? 'Buy' : 'Sell', leverage);
              if (mlBlockCheck.blocked) {
                console.log(`🧠 ML BLOQUEOU: ${symbol} - ${mlBlockCheck.reason}`);
                continue;
              }
            } catch (mlErr) {
              // Erro no ML não bloqueia trade
            }
          }

          // 🤖 VALIDAÇÃO COM AI (apenas se tiver tradingSignal disponível)
          if (aiIntelligenceEnabled && tradingSignal && tradingSignal.confidence >= 60) {
            try {
              const aiValidation = await validateTradeWithAI(
                symbol,
                analysisResult.action === 'BUY' ? 'Buy' : 'Sell',
                analysisResult.signalScore
              );
              
              // Só bloquear se AI reprovar COM ALTA CONFIANÇA
              if (!aiValidation.approved && tradingSignal.confidence >= 75) {
                console.log(`🤖 IA BLOQUEOU ${symbol}: ${aiValidation.reason}`);
                continue;
              }
              
              // Se AI ajustou score MUITO para baixo E confiança alta, pular
              if (aiValidation.adjustedScore < 30 && tradingSignal.confidence >= 70) {
                console.log(`🤖 ${symbol}: Score muito baixo após IA (${aiValidation.adjustedScore})`);
                continue;
              }
              
              if (aiValidation.approved) {
                console.log(`🤖 ${symbol}: ${aiValidation.reason}`);
              }
            } catch (aiErr) {
              // Erro na AI não bloqueia trade
              console.log(`⚠️ Erro validação IA ${symbol}, continuando...`);
            }
          }

          // 🆕 Verificar correlação AVANÇADA
          const advancedCorrelation = checkAssetCorrelation(
            symbol,
            openPositionsLite,
            analysisResult.action === 'BUY' ? 'Buy' : 'Sell'
          );
          if (!advancedCorrelation.allowed) {
            console.log(`🚫 ${symbol}: ${advancedCorrelation.reason}`);
            continue;
          }

          // Verificar correlação básica
          const correlationCheck = checkNewPosition(symbol, analysisResult.action === 'BUY' ? 'Buy' : 'Sell');
          if (!correlationCheck.allowed) {
            console.log(`🚫 ${symbol}: ${correlationCheck.reason}`);
            continue;
          }
          
          // 🆕 Verificar risco de volatilidade
          const volRisk = classifyVolatilityRisk(symbol, volatility, balanceNow);
          if (volRisk.riskLevel === 'extreme' && !topVolNow.includes(symbol)) {
            console.log(`⚠️ ${symbol}: Volatilidade extrema ${volatility.toFixed(1)}% - pulando`);
            continue;
          }

          // 🆕 Usar saldo atualizado (balanceNow é decrementado após cada trade)
          const freshBalance = balanceNow; // demo: saldo local já decrementado a cada abertura
          const minBalance = isDemoMode ? 1 : 2; // Demo permite saldo menor
          
          if (freshBalance < minBalance) {
            console.log(`⚠️ Saldo ${isDemoMode ? 'DEMO' : 'disponível'} muito baixo: $${freshBalance.toFixed(2)}`);
            shouldStopTrading = true;
            break;
          }
          
          // 🆕 Verificar exposição máxima do portfolio
          const exposureData = calculateExposure(openPositions, balanceNow);
          if (exposureData.isOverExposed) {
            console.log(`⚠️ Exposição máxima atingida: ${exposureData.exposurePercent.toFixed(1)}% > 80%`);
            continue;
          }

          // 🆕 Usar limite de tamanho baseado em volatilidade E saldo disponível
          const maxPositionForVol = volRisk.maxPositionSize;
          let maxMarginPerTrade = Math.min(
            freshBalance * (isPriorityMajor ? 0.15 : 0.10),
            maxPositionForVol,
            isPriorityMajor ? 10 : 6
          );
          
          // 🔧 ML AUTO-CORRECTOR: Aplicar multiplicador de posição (reduz tamanho após perdas)
          if (mlAutoCorrectEnabled && mlAutoConfig?.positionSizeMultiplier) {
            const multiplier = mlAutoConfig.positionSizeMultiplier;
            if (multiplier < 1.0) {
              maxMarginPerTrade = maxMarginPerTrade * multiplier;
              console.log(`🔧 ML reduziu tamanho de posição: ${(multiplier * 100).toFixed(0)}%`);
            }
          }
          
          const sizing = calculatePositionSize(
            freshBalance,
            leverage,
            volatility,
            historicalWinRate,
            allOpenPositions.length + openedThisCycle,
            Math.max(3, Math.min(maxOpenPositions, 8)),
            analysisResult.signalScore,
            analysisResult.signalQuality
          );

          const usdSize = Math.min(
            sizing.usdSize,
            maxMarginPerTrade * leverage,
            freshBalance * (isPriorityMajor ? 0.45 : 0.30),
            isPriorityMajor ? 40 : 20,
            maxNotionalForRisk(freshBalance)
          );

          // Calcular quantidade
          const lotSizeFilter = instrument.lotSizeFilter || {};
          const minOrderQty = parseFloat(lotSizeFilter.minOrderQty || '0.01');
          const qtyStep = parseFloat(lotSizeFilter.qtyStep || '0.01');
          const maxOrderQty = parseFloat(lotSizeFilter.maxOrderQty || '10000');

          const { qty, qtyStr, orderValueUSD } = calculateValidQuantity(
            usdSize, currentPrice, leverage, minOrderQty, qtyStep, maxOrderQty
          );

          // Verificar margem requerida vs saldo DISPONÍVEL (mais conservador)
          const requiredMargin = (parseFloat(orderValueUSD) / leverage) * 1.10; // 10% buffer para fees
          const maxMarginPct = isDemoMode ? 0.50 : 0.35; // Demo permite margem maior
          if (requiredMargin > freshBalance * maxMarginPct) {
            console.log(`⚠️ Margem ${requiredMargin.toFixed(2)} > ${maxMarginPct * 100}% ${isDemoMode ? 'demo' : 'disponível'} ${freshBalance.toFixed(2)} - pulando`);
            continue;
          }

          if (parseFloat(orderValueUSD) < 5) continue;

          // 🆕 Calcular SL/TP UNIFICADO — sem duplicação
          const priceRange = highPrice - lowPrice;
          const atrPercent = (priceRange / currentPrice) * 100;
          
          const symbolProfile = {
            isOptimalForHour: isOptimalForHour,
            isPremium: isPremiumSymbol,
            hourWinRate: symbolAnalysis.hourWinRate,
            isBTCOrSOL: symbol === 'BTCUSDT' || symbol === 'SOLUSDT'
          };
          
          // ML Auto-Corrector override
          let mlConfigForSLTP = mlConfig;
          if (mlAutoCorrectEnabled && mlAutoConfig) {
            mlConfigForSLTP = {
              ...mlConfig,
              is_enabled: true,
              recommended_stop_loss_pct: Math.min(ROBOT_RISK.maxStopPct, Math.max(0.25, mlAutoConfig.stopLossPct || 0.33)),
              recommended_take_profit_pct: Math.max(0.5, Math.min(ROBOT_RISK.maxStopPct * 3, (mlAutoConfig.stopLossPct || 0.33) * 2.0)),
            };
          }
          
          const sltp = calculateStopTakeProfit(
            currentPrice, analysisResult.action, atrPercent, isScalpAsset, mlConfigForSLTP,
            highPrice, lowPrice, symbolProfile, analysisResult.signalQuality, analysisResult.m5Support, analysisResult.m5Resistance
          );
          // Parâmetros fixos: SL 0.33% / TP 0.60%
          sltp.stopLossPct = ROBOT_RISK.stopLossPct / 100;
          sltp.takeProfitPct = ROBOT_RISK.takeProfitPct / 100;
          const isBuySide = analysisResult.action === 'BUY';
          let stopLoss = (currentPrice * (isBuySide ? 1 - sltp.stopLossPct : 1 + sltp.stopLossPct)).toFixed(6);
          let takeProfit = (currentPrice * (isBuySide ? 1 + sltp.takeProfitPct : 1 - sltp.takeProfitPct)).toFixed(6);

          // 🔒 VALIDAÇÃO: Garantir SL/TP no lado correto do preço
          const slNum = parseFloat(stopLoss);
          const tpNum = parseFloat(takeProfit);

          if (analysisResult.action === 'BUY') {
            if (!Number.isFinite(slNum) || slNum >= currentPrice) {
              stopLoss = (currentPrice * (1 - sltp.stopLossPct)).toFixed(6);
            }
            if (!Number.isFinite(tpNum) || tpNum <= currentPrice) {
              takeProfit = (currentPrice * (1 + sltp.takeProfitPct)).toFixed(6);
            }
          } else {
            if (!Number.isFinite(slNum) || slNum <= currentPrice) {
              stopLoss = (currentPrice * (1 + sltp.stopLossPct)).toFixed(6);
            }
            if (!Number.isFinite(tpNum) || tpNum >= currentPrice) {
              takeProfit = (currentPrice * (1 - sltp.takeProfitPct)).toFixed(6);
            }
          }

          // 🔒 v25: R:R mínimo 2.5:1 — rejeitar trades que não atendem
          {
            const finalSL = parseFloat(stopLoss);
            const finalTP = parseFloat(takeProfit);
            const slDist = Math.abs(currentPrice - finalSL);
            const tpDist = Math.abs(finalTP - currentPrice);
            const actualRR = slDist > 0 ? tpDist / slDist : 0;
            console.log(`✅ ${symbol}: R:R ${actualRR.toFixed(2)}:1 | SL: ${(sltp.stopLossPct * 100).toFixed(2)}% | TP: ${(sltp.takeProfitPct * 100).toFixed(2)}%`);
            if (actualRR < 1.7) {
              console.log(`⛔ ${symbol}: R:R ${actualRR.toFixed(2)} < 1.7 — trade rejeitado`);
              continue;
            }
          }

          // 🧠 VALIDAÇÃO COM INTELIGÊNCIA DE MERCADO (Notícias, Whales, Fear & Greed)
          if (aiIntelligenceEnabled) {
            try {
              const intelValidation = await validateTradeWithIntelligence(
                symbol,
                analysisResult.action === 'BUY' ? 'Buy' : 'Sell',
                analysisResult.signalScore
              );

              // Log das razões e warnings
              if (intelValidation.reasons.length > 0) {
                console.log(`✅ ${symbol}: ${intelValidation.reasons.join(' | ')}`);
              }
              if (intelValidation.warnings.length > 0) {
                console.log(`⚠️ ${symbol}: ${intelValidation.warnings.join(' | ')}`);
              }

              // Bloquear se inteligência recomendar AVOID
              if (intelValidation.recommendation === 'AVOID') {
                console.log(`🚫 ${symbol} BLOQUEADO por inteligência de mercado: ${intelValidation.warnings[0]}`);
                continue;
              }

              // Reduzir score/confiança se CAUTION
              if (intelValidation.recommendation === 'CAUTION') {
                if (intelValidation.adjustedConfidence < 40) {
                  console.log(`⚠️ ${symbol}: Confiança muito baixa após inteligência (${intelValidation.adjustedConfidence}%)`);
                  continue;
                }
              }
            } catch (intelErr) {
              console.log(`⚠️ Erro na validação de inteligência para ${symbol}:`, intelErr);
              // Continuar mesmo com erro - não bloquear trade
            }
          }

          // Configurar alavancagem (skip para modo demo)
          let finalLeverage = leverage;
          let leverageSuccess = isDemoMode; // Demo sempre sucesso
          
          if (!symbol || symbol.trim() === '') {
            console.error('Invalid symbol for leverage setting:', symbol);
            continue;
          }
          
          // Só configura alavancagem na Bybit se não for demo
          if (!isDemoMode) {
            for (let attempts = 0; attempts < 2 && !leverageSuccess; attempts++) {
              const { data: leverageData, error } = await supabase.functions.invoke('bybit-trading', {
                body: {
                  action: 'set_leverage', isTestnet,
                  params: { category: 'linear', symbol: symbol.trim(), buyLeverage: finalLeverage.toString(), sellLeverage: finalLeverage.toString() }
                }
              });
            
              if (!error || leverageData?.data?.success || leverageData?.data?.retCode === 110043) {
                leverageSuccess = true;
              } else {
                console.log(`Leverage attempt ${attempts + 1} failed for ${symbol}, reducing from ${finalLeverage}`);
                finalLeverage = Math.max(Math.floor(finalLeverage * 0.7), 5);
                await new Promise(resolve => setTimeout(resolve, 1000)); // Rate limit delay
              }
            }
          }
          
          if (!leverageSuccess) continue;

          // Executar ordem - sempre Market
          const orderType = 'Market' as const;
          
          // 🆕 MODO DEMO: Simular trade localmente
          let orderSuccess = false;
          let orderId = '';
          
          if (isDemoMode) {
            // Verificar limite de posições demo (max 10)
            if (demoPositionsCount >= 10) {
              console.log(`🚫 [DEMO] Limite de posições atingido (10)`);
              continue;
            }
            
            const demoResult = await openDemoPosition({
              symbol,
              side: analysisResult.action === 'BUY' ? 'Buy' : 'Sell',
              quantity: qty,
              leverage: finalLeverage,
              stopLoss: parseFloat(stopLoss),
              takeProfit: parseFloat(takeProfit),
              confidence: analysisResult.signalScore
            });
            
            orderSuccess = demoResult.success;
            orderId = demoResult.data?.orderId || '';
            
            if (!orderSuccess) {
              console.log(`❌ [DEMO] Falha ao abrir posição: ${demoResult.error}`);
            }
          } else {
            // Modo real - Bybit API
            const orderParams: Record<string, any> = {
              category: 'linear', symbol,
              side: analysisResult.action === 'BUY' ? 'Buy' : 'Sell',
              orderType, qty: qtyStr,
              stopLoss, takeProfit,
              timeInForce: 'GTC', positionIdx: 0, reduceOnly: false
            };
            
            const { data: orderData, error: orderError } = await supabase.functions.invoke('bybit-trading', {
              body: { action: 'place_order', isTestnet, params: orderParams }
            });
            
            orderSuccess = !orderError && orderData?.success;
            orderId = orderData?.data?.orderId || '';
            
            if (!orderSuccess) {
              const errorMsg = orderData?.error || orderError?.message || '';
              if (errorMsg.includes('ab not enough')) {
                console.log(`🛑 Saldo insuficiente na Bybit para ${symbol} - PARANDO ciclo imediatamente`);
                // Saldo real da Bybit é $0 - não adianta tentar outros ativos
                balanceNow = 0;
                shouldStopTrading = true;
                break;
              }
              if (errorMsg.includes('Rate Limit') || errorMsg.includes('Too many visits')) {
                console.log(`⏳ Rate limit atingido - aguardando 5s antes do próximo ativo...`);
                await new Promise(resolve => setTimeout(resolve, 5000));
                continue;
              }
            }
          }

          if (orderSuccess) {
            openedThisCycle++;
            if (analysisResult.action === 'BUY') buyCountThisCycle++;
            if (analysisResult.action === 'SELL') sellCountThisCycle++;
            
            // 💰 Deduzir margem usada do saldo local para evitar "ab not enough" nos próximos ativos
            const usedMargin = requiredMargin;
            balanceNow = Math.max(balanceNow - usedMargin, 0);
            console.log(`💰 Saldo local atualizado: $${balanceNow.toFixed(2)} (deduzido $${usedMargin.toFixed(2)} margem)`);
            
            markAsBotOpened(symbol);
            
            const entryPrice = currentPrice;
            
            const tradeLog = {
              timestamp: new Date().toISOString(),
              symbol, side: analysisResult.action, leverage: finalLeverage,
              size: usdSize.toFixed(2), volatility: volatility.toFixed(2),
              signalScore: analysisResult.signalScore,
              signalQuality: analysisResult.signalQuality,
              exposure: exposureData.exposurePercent.toFixed(1),
              volRisk: volRisk.riskLevel,
              orderType,
              mode: isDemoMode ? 'DEMO' : (isTestnet ? 'TESTNET' : 'REAL')
            };
            console.log(`✅ ${isDemoMode ? '[DEMO]' : ''} TRADE:`, JSON.stringify(tradeLog));

            // 📋 Auditoria: trade APROVADO com regras + valores aplicados
            try {
              const slPct = Math.abs(parseFloat(stopLoss) - currentPrice) / currentPrice * 100;
              const tpPct = Math.abs(parseFloat(takeProfit) - currentPrice) / currentPrice * 100;
              recordGateAudit({
                symbol,
                quality: analysisResult.signalQuality,
                preset: activePreset,
                outcome: 'APPROVED',
                gate: 'Aprovado',
                reason: `${analysisResult.action} ${finalLeverage}x · $${usdSize.toFixed(0)}`,
                rule: getRiskRule(analysisResult.signalQuality, activePreset),
                applied: {
                  leverage: finalLeverage,
                  stopLossPct: slPct,
                  takeProfitPct: tpPct,
                  trailingPct: calculateDynamicTrailingStop(volatility),
                },
              });
            } catch (e) { /* não crítico */ }
            
            // Só salvar em auto_trader_positions se não for demo
            if (!isDemoMode) {
              const saveUserId = await getUserId();
              await supabase.from('auto_trader_positions').insert({
                user_id: saveUserId, symbol,
                side: analysisResult.action === 'BUY' ? 'Buy' : 'Sell',
                entry_price: entryPrice, qty, leverage: finalLeverage,
                stop_loss: parseFloat(stopLoss), take_profit: parseFloat(takeProfit),
                trailing_stop_percentage: calculateDynamicTrailingStop(volatility),
                highest_price: entryPrice, volatility,
                partial_tp_executed: false, original_quantity: qty,
                confidence: analysisResult.signalScore, 
                status: 'OPEN',
                order_source: 'BOT',
                exchange_order_id: orderId
              });
            }
            
            if (trailingStopEnabled && !isDemoMode) {
              setPositionTracking(prev => {
                const newMap = new Map(prev);
                newMap.set(symbol, {
                  highestPrice: analysisResult.action === 'BUY' ? currentPrice : 0,
                  lowestPrice: analysisResult.action === 'SELL' ? currentPrice : Infinity,
                  currentStopLoss: parseFloat(stopLoss)
                });
                return newMap;
              });
            }
            
            if (scaleInOutEnabled && !isDemoMode) {
              setPyramidingTracking(prev => {
                const newMap = new Map(prev);
                newMap.set(symbol, { timesAdded: 0, lastAddPrice: currentPrice, originalQty: qty });
                return newMap;
              });
            }
            
            if (martingaleEnabled) setLossStreak(0);
            
            setActiveTrades(prev => [...prev.slice(-19), {
              symbol, action: analysisResult.action!, confidence: analysisResult.signalScore,
              leverage: finalLeverage, usdSize, timestamp: new Date().toISOString()
            }]);
            
            toast({ 
              title: `${isDemoMode ? '🧪 DEMO' : (isScalpAsset ? '⚡ SCALP' : '✅ TRADE')} ${symbol}`, 
              description: `${analysisResult.action} ${finalLeverage}x | $${usdSize.toFixed(0)}` 
            });
            
          await new Promise(resolve => setTimeout(resolve, isDemoMode ? 3000 : 6000));
          } else {
            if (martingaleEnabled) setLossStreak(prev => Math.min(prev + 1, 3));
            setConsecutiveLosses(prev => prev + 1);
          }

          // v23: Only delay between assets if a trade was placed (rate limit protection)
          if (openedThisCycle > 0) {
            await new Promise(resolve => setTimeout(resolve, 1500));
          }
        } catch (error) {
          console.error(`Erro ao processar ${symbol}:`, error);
        }
      }

      // 🔍 Persistir diagnóstico de gates do ciclo para o painel UI
      setGateDiagnostics({
        skipCounts: Object.fromEntries(skipCounts),
        totalAnalyzed: candidateAssets.length,
        openedThisCycle,
        lastCycleAt: new Date(),
      });

      // Log resumido quando não abre nada no ciclo
      if (openedThisCycle === 0 && skipCounts.size > 0) {
        const topReasons = Array.from(skipCounts.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([reason, count]) => `${reason} (${count})`)
          .join(' | ');
        console.log(`🧾 Sem operações no ciclo. Top motivos: ${topReasons}`);
      }

      setCycleCount(prev => prev + 1);
    } catch (error) {
      console.error('Erro no ciclo de trading:', error);
    } finally {
      tradingLockRef.current = false;
    }
  };

  // Loop principal - otimizado com intervalos maiores
  useEffect(() => {
    if (!isRunning) return;

    // Executar imediatamente
    analyzeAndTrade();

    // v7: Intervalo principal: 60s (era 45s) — menos overtrading
    const interval = setInterval(() => {
      if (isRunning) analyzeAndTrade();
    }, 60000);

    // Smart exits: 45s — balanced between responsiveness and API pressure
    const exitInterval = setInterval(() => {
      void updateSmartExits();
    }, 45000);

    // Sincronizar PnL a cada 60s para alimentar sistema anti-loss
    const pnlSyncInterval = setInterval(() => {
      void syncClosedPositionsPnL();
    }, 60000);

    // Sincronizar imediatamente ao iniciar
    void syncClosedPositionsPnL();

    return () => {
      clearInterval(interval);
      clearInterval(exitInterval);
      clearInterval(pnlSyncInterval);
    };
  }, [isRunning, syncClosedPositionsPnL, updateSmartExits]);

  // Pyramiding
  useEffect(() => {
    if (isDemoMode) return; // Pyramiding usa place_order real: desligado no demo.
    if (!scaleInOutEnabled || !isRunning || !mlConfig?.optimal_patterns?.pyramiding) return;
    
    const monitorPyramiding = async () => {
      const { data: openPos } = await supabase
        .from('auto_trader_positions')
        .select('*')
        .eq('status', 'OPEN')
        .eq('user_id', await getUserId());
      
      if (!openPos?.length) return;
      
      for (const position of openPos) {
        const tracking = pyramidingTracking.get(position.symbol);
        const maxLevels = mlConfig.optimal_patterns.pyramiding.maxLevels || 2;
        const threshold = mlConfig.optimal_patterns.pyramiding.threshold || 1.5;
        
        if (tracking && tracking.timesAdded >= maxLevels) continue;
        
        const currentPrice = position.current_price || position.entry_price;
        const pnlPercent = position.side === 'Buy' 
          ? ((currentPrice - position.entry_price) / position.entry_price) * 100
          : ((position.entry_price - currentPrice) / position.entry_price) * 100;
        
        if (pnlPercent >= threshold) {
          // Calcular qty com formatação correta
          const baseQty = (tracking?.originalQty || position.qty) * 0.5;
          
          // Buscar instrumento para obter qtyStep
          const { data: instData } = await supabase.functions.invoke('bybit-trading', {
            body: { action: 'get_instruments', isTestnet, params: { category: 'linear', symbol: position.symbol } }
          });
          
          const instrument = instData?.data?.list?.[0];
          const lotSizeFilter = instrument?.lotSizeFilter || {};
          const qtyStep = parseFloat(lotSizeFilter.qtyStep || '0.001');
          const minOrderQty = parseFloat(lotSizeFilter.minOrderQty || '0.001');
          
          // Arredondar qty para qtyStep
          let addQty = Math.floor(baseQty / qtyStep) * qtyStep;
          addQty = Math.max(addQty, minOrderQty);
          
          // Formatar com casas decimais corretas
          const qtyStepStr = qtyStep.toString();
          const decimalPlaces = qtyStepStr.includes('.') ? qtyStepStr.split('.')[1].length : 0;
          const addQtyStr = addQty.toFixed(decimalPlaces);
          
          const { data: addOrder, error } = await supabase.functions.invoke('bybit-trading', {
            body: {
              action: 'place_order', isTestnet,
              params: {
                category: 'linear', symbol: position.symbol, side: position.side,
                orderType: 'Market', qty: addQtyStr,
                timeInForce: 'GTC', positionIdx: 0, reduceOnly: false
              }
            }
          });
          
          if (!error && addOrder?.success) {
            setPyramidingTracking(prev => {
              const newMap = new Map(prev);
              newMap.set(position.symbol, {
                timesAdded: (tracking?.timesAdded || 0) + 1,
                lastAddPrice: currentPrice,
                originalQty: tracking?.originalQty || position.qty
              });
              return newMap;
            });
            
            await supabase.functions.invoke('bybit-trading', {
              body: {
                action: 'set_trading_stop', isTestnet,
                params: { category: 'linear', symbol: position.symbol, stopLoss: position.entry_price.toString(), positionIdx: 0 }
              }
            });
            
            toast({ title: `🎯 Pyramiding ${position.symbol}`, description: `+50% | SL → Breakeven` });
          }
        }
      }
    };
    
    // Pyramiding: 60s (era 30s)
    const interval = setInterval(monitorPyramiding, 60000);
    return () => clearInterval(interval);
  }, [scaleInOutEnabled, isRunning, isDemoMode, mlConfig, pyramidingTracking]);

  const cleanupOrphanPositions = useCallback(async () => {
    if (isDemoMode) return;
    console.log('🧹 Sincronizando posições...');
    try {
      const userId = await getUserId();

      // Buscar posições reais do Bybit
      const { data: bybitData } = await supabase.functions.invoke('bybit-trading', {
        body: { action: 'get_positions', isTestnet, params: { category: 'linear', settleCoin: 'USDT' } }
      });

      const positionsList = Array.isArray((bybitData as any)?.data)
        ? (bybitData as any).data
        : ((bybitData as any)?.data?.list || []);

      const realPositions = (positionsList || []).filter((p: any) => parseFloat(p.size || '0') > 0);
      const realSymbols = new Set(realPositions.map((p: any) => `${p.symbol}-${p.side}`));
      console.log(`📊 ${realPositions.length} posições reais no Bybit`);

      const idsToClose: string[] = [];
      const seenRealKeys = new Set<string>();

      // Buscar posições "OPEN" do usuário no banco em páginas (limite Supabase = 1000)
      const PAGE_SIZE = 1000;
      for (let from = 0; ; from += PAGE_SIZE) {
        const { data: page, error: dbError } = await supabase
          .from('auto_trader_positions')
          .select('id, symbol, side, opened_at')
          .eq('user_id', userId)
          .eq('status', 'OPEN')
          .order('opened_at', { ascending: false })
          .range(from, from + PAGE_SIZE - 1);

        if (dbError) {
          console.log('⚠️ Erro ao buscar posições no banco:', dbError);
          return;
        }

        if (!page?.length) break;

        for (const dbPos of page) {
          const key = `${dbPos.symbol}-${dbPos.side}`;

          // Não existe no Bybit -> órfã
          if (!realSymbols.has(key)) {
            idsToClose.push(dbPos.id);
            continue;
          }

          // Existe no Bybit, mas já temos 1 registro para esse símbolo+lado -> duplicata
          if (seenRealKeys.has(key)) {
            idsToClose.push(dbPos.id);
            continue;
          }

          seenRealKeys.add(key);
        }

        if (page.length < PAGE_SIZE) break;
      }

      if (idsToClose.length > 0) {
        console.log(`🗑️ Fechando ${idsToClose.length} posições inconsistentes (órfãs/duplicadas)...`);
        for (let i = 0; i < idsToClose.length; i += 100) {
          const batch = idsToClose.slice(i, i + 100);
          await supabase
            .from('auto_trader_positions')
            .update({ status: 'CLOSED', close_reason: 'orphan_cleanup', closed_at: new Date().toISOString() })
            .in('id', batch);
        }
        console.log(`✅ ${idsToClose.length} posições limpas`);
      }

      // Recarregar contexto de posições
      await refetch();
    } catch (err) {
      console.log('⚠️ Erro na sincronização:', err);
    }
  }, [refetch, isTestnet, isDemoMode]);

  // Se o trader foi restaurado automaticamente, rodar a limpeza 1x para evitar "limite atingido" falso
  useEffect(() => {
    if (!isRunning) return;
    if (orphanCleanupDoneRef.current) return;
    orphanCleanupDoneRef.current = true;
    void cleanupOrphanPositions();
  }, [isRunning, cleanupOrphanPositions]);

  const startTrading = async () => {
    // 🧹 Limpeza/sync antes de iniciar (evita travar entradas por posições antigas/duplicadas)
    orphanCleanupDoneRef.current = true;
    await cleanupOrphanPositions();

    // FORÇAR recarga do sistema anti-perdas
    console.log('🔄 Recarregando sistema anti-perdas...');
    await loadHistoricalPatterns(true);
    const stats = getBlockedStats();
    console.log(`🔒 Símbolos bloqueados: ${stats.blockedSymbols.join(', ') || 'nenhum'}`);

    setIsRunning(true);
    setConsecutiveLosses(0);

    const userId = await getUserIdOrNull();

    // Sem sessão autenticada o RLS bloqueia a escrita; o robô roda localmente.
    if (userId) {
      // Check if config exists, then insert or update
      const { data: existing } = await supabase.from('auto_trader_config')
        .select('id').eq('user_id', userId).maybeSingle();

      if (existing) {
        await supabase.from('auto_trader_config')
          .update({ trader_is_running: true, is_active: true, last_activity_at: new Date().toISOString() })
          .eq('user_id', userId);
      } else {
        await supabase.from('auto_trader_config')
          .insert({ user_id: userId, trader_is_running: true, is_active: true, last_activity_at: new Date().toISOString() });
      }
    }

    toast({ title: "🚀 Trader iniciado", description: `${stats.blockedSymbols.length} símbolos bloqueados` });
  };

  const persistTraderStopped = useCallback(async () => {
    const userId = await getUserIdOrNull();
    if (!userId) return;
    await supabase.from('auto_trader_config').update({ trader_is_running: false }).eq('user_id', userId);
  }, []);

  const stopTrading = async () => {
    setIsRunning(false);
    orphanCleanupDoneRef.current = false;
    await persistTraderStopped();

    toast({ title: "⏸️ Trader pausado", description: `P&L Total: $${totalPnL.toFixed(2)}` });
  };

  const resetBankroll = async () => {
    if (!isDemoMode) await syncBybitBalance();
    setTotalPnL(0);
    setDailyPnL(0);
    setActiveTrades([]);
    setCycleCount(0);
    setConsecutiveLosses(0);
    toast({ title: "🔄 Reset Completo" });
  };

  return (
    <div className="space-y-4">
      <div className="robot-controls">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div><h2 className="text-xl font-semibold">Robô de trading</h2><p className="mt-1 text-sm text-muted-foreground">{isRunning ? 'Em operação' : 'Parado'} · {cycleCount} ciclos</p></div>
          <Badge variant={isDemoMode || isTestnet ? "outline" : "destructive"}>{isDemoMode ? 'Demo (paper)' : isTestnet ? 'Testnet' : 'Conta real'}</Badge>
        </div>

        {/* Status Cards */}
        <div className="grid grid-cols-3 gap-2 sm:gap-4 mb-6">
          <div className="p-4 bg-background/50">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="h-4 w-4 text-primary" />
              <span className="text-xs text-muted-foreground">Alavancagem</span>
            </div>
            <div className="text-xl font-bold">{getLeverageForBalance(currentBalance, historicalWinRate)}x</div>
            <div className="text-xs text-muted-foreground">Win: {historicalWinRate.toFixed(0)}%</div>
          </div>

          <div className="p-4 bg-background/50">
            <div className="flex items-center gap-2 mb-1">
              <Zap className="h-4 w-4 text-warning" />
              <span className="text-xs text-muted-foreground">Posições</span>
            </div>
            <div className="text-xl font-bold">{openPositionsCount}/{maxOpenPositions}</div>
            <div className="text-xs text-muted-foreground">{activeTrades.length} total</div>
          </div>

          <div className="p-4 bg-background/50">
            <div className="flex items-center gap-2 mb-1">
              <Target className="h-4 w-4 text-success" />
              <span className="text-xs text-muted-foreground">Proteção</span>
            </div>
            <div className="text-xl font-bold">{consecutiveLosses}/{MAX_CONSECUTIVE_LOSSES}</div>
            <div className="text-xs text-muted-foreground">Perdas seguidas</div>
          </div>
        </div>

        {/* Mode Toggle */}
        <div className="space-y-3 mb-4">
          {/* Demo Mode - NOVO */}
          <div className={`flex items-center justify-between p-4 rounded-lg border transition-all ${
            isDemoMode 
              ? 'bg-secondary/40 border-primary shadow-lg shadow-primary/20' 
              : 'bg-primary/10 border-primary/20'
          }`}>
            <div>
              <Label className="text-sm font-medium flex items-center gap-2">
                <FlaskConical className={`h-4 w-4 ${isDemoMode ? 'text-primary' : 'text-primary/60'}`} />
                Modo Demo (paper)
              </Label>
              <p className="text-xs text-muted-foreground">
                {isDemoMode
                  ? `Saldo virtual: $${demoBalance.toFixed(2)} | PnL: $${demoPnL.toFixed(2)} | Posições: ${demoPositionsCount}/10 · sem ordens reais`
                  : 'Simular sem dinheiro real'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Switch 
                checked={isDemoMode} 
                onCheckedChange={(checked) => {
                  writeDemoMode(checked);
                  setIsDemoMode(checked);
                  setIsTestnet(false);
                  setIsRunning(false);
                  orphanCleanupDoneRef.current = false;
                  if (checked) void loadDemoAccount();
                  else void persistTraderStopped();
                }}
                disabled={isRunning} 
              />
              {isDemoMode && (
                <Button variant="ghost" size="sm" onClick={resetDemoAccount} disabled={isRunning} className="text-xs">
                  Reset
                </Button>
              )}
            </div>
          </div>

          {/* Real/Testnet Toggle - desabilitado no modo demo */}
          {!isDemoMode && (
            <div className="flex flex-wrap gap-3 items-center justify-between p-4 bg-warning/10 border border-warning/20 rounded-lg">
              <div>
                <Label className="text-sm font-medium">Modo de operação</Label>
                <p className="text-xs text-muted-foreground">{isTestnet ? 'Testnet' : '⚠️ REAL'}</p>
              </div>
              <div className="flex items-center gap-2">
                <Label className="text-xs">Testnet</Label>
                <Switch checked={!isTestnet} onCheckedChange={(checked) => { setIsTestnet(!checked); setIsRunning(false); }} disabled={isRunning} />
                <Label className="text-xs">Real</Label>
              </div>
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="flex gap-2 mb-4">
          {!isRunning ? (
            <>
              <Button onClick={startTrading} className="flex-1" size="lg">
                <Play className="h-5 w-5 mr-2" />Iniciar robô
              </Button>
              {isDemoMode && (
                <Button onClick={() => void analyzeAndTrade()} variant="secondary" size="lg">
                  <Zap className="h-5 w-5 mr-2" />Rodar 1 ciclo
                </Button>
              )}
              <Button onClick={resetBankroll} variant="outline" size="lg">Reset</Button>
            </>
          ) : (
            <Button onClick={stopTrading} variant="destructive" className="w-full" size="lg">
              <Square className="h-5 w-5 mr-2" />Parar robô
            </Button>
          )}
        </div>

        <details className="workspace-disclosure mb-4">
          <summary>Limites e gestão de risco<span className="ml-auto text-muted-foreground">+</span></summary>
          <div className="space-y-4 py-4">
        {/* Proteções */}
        <div className="grid grid-cols-1 gap-3 mb-4">
          <div className="p-3 bg-primary/10 border border-primary/20 rounded-lg">
            <div className="text-xs font-medium mb-1">📊 Posições Max</div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="h-6 w-6 p-0" onClick={() => setMaxOpenPositions(Math.max(1, maxOpenPositions - 1))} disabled={isRunning}>-</Button>
              <span className="text-sm font-bold">{maxOpenPositions}</span>
              <Button variant="outline" size="sm" className="h-6 w-6 p-0" onClick={() => setMaxOpenPositions(Math.min(200, maxOpenPositions + 1))} disabled={isRunning}>+</Button>
            </div>
          </div>
        </div>

        {/* Margem */}
        <div className={`p-4 mb-4 ${isDemoMode ? 'bg-secondary/40 border-primary/20' : 'bg-secondary/40 border-accent/20'}`}>
          <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
            <div className="flex items-center gap-2">
              {isDemoMode ? <FlaskConical className="h-5 w-5 text-primary" /> : <DollarSign className="h-5 w-5 text-accent" />}
              <span className="text-sm font-medium">{isDemoMode ? 'Conta Demo' : 'Gerenciamento de Margem'}</span>
            </div>
            <Badge variant="outline" className={isDemoMode ? "text-primary border-primary" : "text-accent border-accent"}>
              {isDemoMode ? `${demoPositionsCount}/10` : `${openPositionsCount}/${maxOpenPositions}`}
            </Badge>
          </div>
          
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">{isDemoMode ? 'Saldo Demo:' : 'Margem Total:'}</span>
              <span className={`font-mono ${isDemoMode ? 'text-primary' : 'text-accent'}`}>
                ${isDemoMode ? demoBalance.toFixed(2) : currentBalance.toFixed(2)}
              </span>
            </div>
            {isDemoMode && (
              <>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">PnL Não Realizado:</span>
                  <span className={`font-mono ${demoUnrealizedPnL >= 0 ? 'text-success' : 'text-destructive'}`}>
                    ${demoUnrealizedPnL.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">PnL Total:</span>
                  <span className={`font-mono ${demoPnL >= 0 ? 'text-success' : 'text-destructive'}`}>
                    ${demoPnL.toFixed(2)}
                  </span>
                </div>
              </>
            )}
            <Progress value={(isDemoMode ? demoPositionsCount / 10 : openPositionsCount / maxOpenPositions) * 100} className="h-2 mt-2" />
            {isDemoMode && demoPositions.length > 0 && (
              <div className="space-y-1 pt-2">
                {demoPositions.map(position => (
                  <div key={position.id} className="flex items-center justify-between gap-2 text-xs">
                    <span className="font-mono">
                      {position.side} {position.symbol} · {position.leverage}x · ${position.pnl.toFixed(2)}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-xs"
                      onClick={() => void closeDemoPosition(position.id, 'manual')}
                    >
                      Fechar
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <RiskPresetSelector />
          </div>
        </details>
        <details className="workspace-disclosure mb-4">
          <summary>Aprendizado e estratégia<span className="ml-auto text-muted-foreground">+</span></summary>
          <div className="space-y-4 py-4">
        {/* ML Card */}
        <div className="p-4 bg-secondary/40 border-accent/20 mb-4">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
            <div>
              <h4 className="text-sm font-semibold flex items-center gap-2">
                🧠 ML Adaptativo
                {mlConfig?.is_enabled && <Badge variant="default" className="text-xs">ATIVO</Badge>}
              </h4>
              <p className="text-xs text-muted-foreground mt-1">
                {mlConfig?.is_enabled ? `${mlConfig.trades_analyzed} trades | ${mlConfig.confidence_score?.toFixed(0)}% confiança` : 'Analise seu histórico'}
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline" size="sm"
                onClick={async () => {
                  toast({ title: "🔄 Sincronizando ML", description: "Buscando histórico da Bybit..." });
                  const data = await syncMLWithBybit(true);
                  if (data?.success) {
                    setMlConfig(data.config);
                  }
                }}
                disabled={isRunning}
              >
                🔄 Sync Bybit
              </Button>
              <Button
                variant="outline" size="sm"
                onClick={async () => {
                  const userId = await getUserId();
                  const { data, error } = await supabase.functions.invoke('ml-adaptive-learning', { body: { userId } });
                  if (error) {
                    toast({ title: "❌ Erro no ML", description: error.message, variant: "destructive" });
                    return;
                  }
                  if (data?.success) {
                    setMlConfig(data.config);
                    const lev = data.config?.recommended_leverage ?? data.leverage?.optimal;
                    toast({ title: "🧠 ML Configurado!", description: `Leverage: ${lev ?? '—'}x` });
                  }
                }}
                disabled={isRunning}
              >
                {mlConfig?.is_enabled ? 'Reanalisar' : 'Ativar ML'}
              </Button>
            </div>
          </div>
          
          {mlConfig?.is_enabled && (
            <>
              <div className="grid grid-cols-4 gap-2 text-xs mb-3">
                <div className="p-2 bg-background/50 rounded border"><div className="text-muted-foreground">Lev</div><div className="font-bold text-accent">{mlConfig.recommended_leverage}x</div></div>
                <div className="p-2 bg-background/50 rounded border"><div className="text-muted-foreground">SL</div><div className="font-bold text-destructive">{mlConfig.recommended_stop_loss_pct?.toFixed(2)}%</div></div>
                <div className="p-2 bg-background/50 rounded border"><div className="text-muted-foreground">TP</div><div className="font-bold text-success">{mlConfig.recommended_take_profit_pct?.toFixed(2)}%</div></div>
                <div className="p-2 bg-background/50 rounded border"><div className="text-muted-foreground">Conf</div><div className="font-bold text-warning">{mlConfig.confidence_score?.toFixed(0)}%</div></div>
              </div>
              
              {/* Alertas críticos do ML */}
              {mlConfig?.optimal_patterns?.criticalWarnings?.length > 0 && (
                <div className="p-2 bg-destructive/10 border border-destructive/30 rounded-lg mb-2">
                  <div className="text-xs font-medium text-destructive mb-1">⚠️ Alertas Críticos</div>
                  {mlConfig.optimal_patterns.criticalWarnings.slice(0, 2).map((warning: string, i: number) => (
                    <div key={i} className="text-xs text-destructive/80 line-clamp-2">{warning}</div>
                  ))}
                </div>
              )}
              
              {/* Símbolos a evitar */}
              {mlConfig?.optimal_patterns?.symbolsToAvoid?.length > 0 && (
                <div className="p-2 bg-warning/10 border border-warning/30 rounded-lg">
                  <div className="text-xs font-medium text-warning mb-1">🚫 Símbolos Bloqueados</div>
                  <div className="text-xs text-warning/80">{mlConfig.optimal_patterns.symbolsToAvoid.join(', ')}</div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Gestão de Saídas */}
        <div className="p-4 bg-secondary/40 border-primary/20 mb-4">
          <div className="flex items-center gap-2 mb-3">
            <Brain className="h-5 w-5 text-primary" />
            <span className="text-sm font-medium">Gestão de Saídas</span>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex items-center justify-between p-2 bg-background/50 rounded-lg">
              <div><Label className="text-xs font-medium">Smart Exit (ML)</Label></div>
              <Switch checked={smartExitEnabled} onCheckedChange={setSmartExitEnabled} disabled={isRunning} />
            </div>
            
            <div className="flex items-center justify-between p-2 bg-background/50 rounded-lg">
              <div><Label className="text-xs font-medium">Saídas Parciais</Label></div>
              <Switch checked={partialExitEnabled} onCheckedChange={setPartialExitEnabled} disabled={isRunning} />
            </div>
            
            <div className="flex items-center justify-between p-2 bg-background/50 rounded-lg">
              <div><Label className="text-xs font-medium">ML nas Decisões</Label></div>
              <Switch checked={mlDecisionsEnabled} onCheckedChange={setMlDecisionsEnabled} disabled={isRunning} />
            </div>
            
            <div className="flex items-center justify-between p-2 bg-background/50 rounded-lg">
              <div><Label className="text-xs font-medium">Trailing Stop</Label></div>
              <Switch checked={trailingStopEnabled} onCheckedChange={setTrailingStopEnabled} disabled={isRunning} />
            </div>
          </div>
        </div>

        {/* 🎯 Sistema de Ordens Armadas S/R */}
        <div className={`p-4 mb-4 transition-all duration-300 ${
          armedOrders.filter(o => o.status === 'armed').length > 0 
            ? 'bg-secondary/40 border-warning shadow-lg shadow-warning/20' 
            : 'bg-secondary/40 border-warning/20'
        }`}>
          <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
            <div className="flex items-center gap-2">
              <Crosshair className={`h-5 w-5 ${armedOrders.filter(o => o.status === 'armed').length > 0 ? 'text-warning animate-spin' : 'text-warning'}`} style={{ animationDuration: '3s' }} />
              <span className="text-sm font-medium">Ordens Armadas S/R</span>
              {armedOrders.filter(o => o.status === 'armed').length > 0 ? (
                <Badge className="bg-warning text-primary-foreground font-bold text-xs px-2 py-1">
                  🎯 {armedOrders.filter(o => o.status === 'armed').length} ARMADA{armedOrders.filter(o => o.status === 'armed').length > 1 ? 'S' : ''}
                </Badge>
              ) : (
                <Badge variant="outline" className="text-[10px] text-warning">$0.20+ min</Badge>
              )}
            </div>
            <Switch checked={armedModeEnabled} onCheckedChange={setArmedModeEnabled} disabled={isRunning || isDemoMode} />
          </div>
          
          {armedModeEnabled && (
            <>
              <div className="text-xs text-muted-foreground mb-2">
                Ordens limit em níveis de suporte/resistência com stops automáticos
              </div>
              
              {/* Ordens armadas ativas - DESTAQUE VISUAL */}
              {armedOrders.filter(o => o.status === 'armed').length > 0 ? (
                <div className="space-y-2 max-h-32 overflow-y-auto mb-3 p-2 bg-warning/10 rounded-lg border-2 border-warning/50">
                  <div className="text-xs text-warning font-semibold mb-1">⚡ ORDENS PRONTAS PARA EXECUTAR:</div>
                  {armedOrders.filter(o => o.status === 'armed').slice(0, 5).map((order) => (
                    <div key={order.id} className="flex justify-between items-center text-xs p-2 bg-background/70 rounded border border-warning/40 hover:bg-warning/20 transition-colors">
                      <span className="font-bold text-warning">{order.symbol.replace('USDT', '')}</span>
                      <Badge variant={order.side === 'Buy' ? 'default' : 'destructive'} className="text-[10px] font-semibold">
                        {order.srType === 'support' ? '🟢 SUP' : '🔴 RES'} {order.side}
                      </Badge>
                      <span className="text-warning font-mono">@{order.entryPrice.toFixed(4)}</span>
                      <div className="flex flex-col items-end">
                        <span className="text-destructive text-[9px]">SL: {order.stopLoss.toFixed(4)}</span>
                        <span className="text-success text-[9px]">TP: {order.takeProfit.toFixed(4)}</span>
                      </div>
                      <span className="text-success font-bold">+${order.expectedProfit.toFixed(2)}</span>
                    </div>
                  ))}
                  <div className="text-[10px] text-warning/80 text-center mt-1">
                    💡 Ordens executam automaticamente quando preço atingir nível S/R
                  </div>
                </div>
              ) : (
                <div className="text-xs text-muted-foreground text-center py-3 mb-3 border border-dashed border-warning/30 rounded">
                  {isRunning ? (
                    <div className="flex flex-col items-center gap-1">
                      <span className="animate-pulse">🔍 Analisando níveis S/R...</span>
                      <span className="text-[10px]">Aguardando oportunidades com +$0.20 de lucro</span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-1">
                      <span>⏸️ Sistema parado</span>
                      <span className="text-[10px]">Inicie o trader para armar ordens</span>
                    </div>
                  )}
                </div>
              )}
              
              {/* Melhores ativos por hora */}
              {getBestHourlyAssets().length > 0 && (
                <div className="border-t border-border/50 pt-2">
                  <div className="text-xs text-muted-foreground mb-1">🕐 Melhores para {new Date().getUTCHours()}h UTC:</div>
                  <div className="flex flex-wrap gap-1">
                    {getBestHourlyAssets().slice(0, 5).map((perf) => (
                      <Badge key={`${perf.symbol}-${perf.hour}`} variant="outline" className="text-[10px]">
                        {perf.symbol.replace('USDT', '')} {perf.winRate.toFixed(0)}%
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* 🤖 AI Trading Intelligence */}
        <div className="p-4 bg-secondary/40 border-accent/20 mb-4">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-accent" />
              <span className="text-sm font-medium">AI Trading Intelligence</span>
              {lastTrainingTime && (
                <Badge variant="outline" className="text-[10px] text-accent">
                  Treinado {new Date(lastTrainingTime).toLocaleTimeString()}
                </Badge>
              )}
            </div>
            <Switch checked={aiIntelligenceEnabled} onCheckedChange={setAiIntelligenceEnabled} disabled={isRunning} />
          </div>
          
          {aiIntelligenceEnabled && (
            <>
              <div className="grid grid-cols-3 gap-2 mb-3">
                {/* Padrões */}
                <div className="p-2 bg-background/50 rounded border text-center">
                  <div className="text-[10px] text-muted-foreground">Win Rate</div>
                  <div className="font-bold text-success">{aiPatterns?.winRate?.toFixed(1) || '--'}%</div>
                </div>
                
                {/* Baleias */}
                <div className="p-2 bg-background/50 rounded border text-center">
                  <div className="text-[10px] text-muted-foreground">Baleias</div>
                  <div className={`font-bold ${whaleAnalysis?.whaleDirection === 'BULLISH' ? 'text-success' : whaleAnalysis?.whaleDirection === 'BEARISH' ? 'text-destructive' : 'text-warning'}`}>
                    {whaleAnalysis?.whaleDirection || '--'}
                  </div>
                </div>
                
                {/* Sentimento */}
                <div className="p-2 bg-background/50 rounded border text-center">
                  <div className="text-[10px] text-muted-foreground">Sentimento</div>
                  <div className={`font-bold ${sentimentAnalysis?.sentiment === 'BULLISH' ? 'text-success' : sentimentAnalysis?.sentiment === 'BEARISH' ? 'text-destructive' : 'text-warning'}`}>
                    {sentimentAnalysis?.sentiment || '--'}
                  </div>
                </div>
              </div>
              
              {/* Recomendações */}
              {aiRecommendations && (
                <div className="text-xs text-muted-foreground mb-2 p-2 bg-background/30 rounded">
                  <div className="flex flex-wrap gap-2">
                    <span>Lev: <span className="text-accent font-medium">{aiRecommendations.optimalLeverage}x</span></span>
                    <span>SL: <span className="text-destructive font-medium">{(aiRecommendations.optimalStopLoss * 100).toFixed(2)}%</span></span>
                    <span>TP: <span className="text-success font-medium">{(aiRecommendations.optimalTakeProfit * 100).toFixed(2)}%</span></span>
                  </div>
                  {aiRecommendations.insights && (
                    <div className="mt-1 text-[10px] opacity-75">{aiRecommendations.insights}</div>
                  )}
                </div>
              )}
              
              {/* Botão de treinar */}
              <Button
                size="sm"
                variant="outline"
                className="w-full text-xs"
                onClick={async () => {
                  const result = await trainOnWinningPatterns();
                  if (result) {
                    toast({ title: "🤖 IA Treinada!", description: `${result.patterns?.totalTrades || 0} trades analisados` });
                  }
                }}
                disabled={isRunning || isAILoading}
              >
                {isAILoading ? '🔄 Treinando...' : '🧠 Treinar IA com Histórico Bybit'}
              </Button>
            </>
          )}
        </div>

        {/* 😱 Market Intelligence (Fear & Greed, Events, Whales) */}
        {aiIntelligenceEnabled && (
          <div className="p-4 bg-secondary/40 border-warning/20 mb-4">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
              <div className="flex items-center gap-2">
                <span className="text-lg">😱</span>
                <span className="text-sm font-medium">Market Intelligence</span>
                {intelLastUpdate && (
                  <Badge variant="outline" className="text-[10px] text-warning">
                    {new Date(intelLastUpdate).toLocaleTimeString()}
                  </Badge>
                )}
              </div>
              {isIntelLoading && <span className="text-xs text-muted-foreground">Atualizando...</span>}
            </div>
            
            <div className="grid grid-cols-3 gap-2 mb-3">
              {/* Fear & Greed */}
              <div className={`p-2 rounded border text-center ${
                fearGreed?.sentiment === 'EXTREME_FEAR' || fearGreed?.sentiment === 'FEAR' 
                  ? 'bg-destructive/10 border-destructive/30' 
                  : fearGreed?.sentiment === 'EXTREME_GREED' || fearGreed?.sentiment === 'GREED'
                    ? 'bg-success/10 border-success/30'
                    : 'bg-background/50'
              }`}>
                <div className="text-[10px] text-muted-foreground">Fear & Greed</div>
                <div className={`font-bold text-lg ${
                  (fearGreed?.value || 50) <= 30 ? 'text-destructive' : 
                  (fearGreed?.value || 50) >= 70 ? 'text-success' : 'text-warning'
                }`}>
                  {fearGreed?.value || '--'}
                </div>
                <div className="text-[9px] text-muted-foreground">{fearGreed?.sentiment || 'N/A'}</div>
              </div>
              
              {/* Eventos */}
              <div className="p-2 bg-background/50 rounded border text-center">
                <div className="text-[10px] text-muted-foreground">Eventos</div>
                <div className="font-bold">{marketEvents.length}</div>
                <div className="text-[9px] text-muted-foreground">
                  {marketEvents.filter(e => e.impact === 'HIGH').length} alto impacto
                </div>
              </div>
              
              {/* Whale Alerts */}
              <div className="p-2 bg-background/50 rounded border text-center">
                <div className="text-[10px] text-muted-foreground">Whales</div>
                <div className="font-bold">{whaleAlerts.length}</div>
                <div className="text-[9px] text-muted-foreground">alertas ativos</div>
              </div>
            </div>
            
            {/* Trading Advice */}
            {fearGreed && (
              <div className="text-xs p-2 bg-background/30 rounded border-l-2 border-warning/50">
                <span className="text-warning font-medium">💡 Conselho: </span>
                {fearGreed.tradingAdvice}
              </div>
            )}
            
            {/* High Impact Events Warning */}
            {marketEvents.filter(e => e.impact === 'HIGH').length > 0 && (
              <div className="mt-2 text-xs p-2 bg-destructive/10 rounded border border-destructive/20">
                <div className="text-destructive font-medium mb-1">⚠️ Eventos de Alto Impacto:</div>
                {marketEvents.filter(e => e.impact === 'HIGH').slice(0, 2).map((e, i) => (
                  <div key={i} className="text-[10px] text-muted-foreground">• {e.title}</div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Opções Avançadas */}
        <div className="p-4 bg-background/50 mb-4">
          <div className="text-sm font-medium mb-3">⚙️ Opções Avançadas</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
            <div className="flex items-center justify-between p-2 bg-background/50 rounded-lg">
              <Label className="text-xs">Pyramiding</Label>
              <Switch checked={scaleInOutEnabled} onCheckedChange={setScaleInOutEnabled} disabled={isRunning} />
            </div>
            <div className="flex items-center justify-between p-2 bg-background/50 rounded-lg">
              <Label className="text-xs">Martingale</Label>
              <Switch checked={martingaleEnabled} onCheckedChange={setMartingaleEnabled} disabled={isRunning} />
            </div>
            <div className="flex items-center justify-between p-2 bg-background/50 rounded-lg">
              <Label className="text-xs">Hedge</Label>
              <Switch checked={hedgeEnabled} onCheckedChange={setHedgeEnabled} disabled={isRunning} />
            </div>
            <div className="flex items-center justify-between p-2 bg-background/50 rounded-lg">
              <Label className="text-xs">Lev. Dinâmica</Label>
              <Switch checked={dynamicLeverageEnabled} onCheckedChange={setDynamicLeverageEnabled} disabled={isRunning} />
            </div>
          </div>
        </div>

          </div>
        </details>
        <details className="workspace-disclosure mb-4">
          <summary>Diagnóstico e auditoria<span className="ml-auto text-muted-foreground">+</span></summary>
          <div className="space-y-4 py-4">
        {/* 🔍 Diagnóstico de Gates Bloqueados */}
        <GateDiagnosticsPanel
          skipCounts={gateDiagnostics.skipCounts}
          totalAnalyzed={gateDiagnostics.totalAnalyzed}
          openedThisCycle={gateDiagnostics.openedThisCycle}
          lastCycleAt={gateDiagnostics.lastCycleAt}
        />

        {/* 📋 Auditoria por trade — gates aplicados */}
        <GateAuditTable />

        {/* 🚫 Monitor Anti-Perdas */}
        <AntiLossMonitor 
          getBlockedStats={getBlockedStats} 
          blockedCount={blockedCount}
          forceUnblock={forceUnblock}
        />

          </div>
        </details>
        {/* Recent Trades */}
        {activeTrades.length > 0 && (
          <div className="p-4 bg-background/50">
            <div className="text-sm font-medium mb-2">📊 Trades Recentes</div>
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {activeTrades.slice(-5).reverse().map((trade, i) => (
                <div key={i} className="flex justify-between items-center text-xs p-2 bg-background/50 rounded">
                  <span className="font-medium">{trade.symbol}</span>
                  <Badge variant={trade.action === 'BUY' ? 'default' : 'destructive'} className="text-[10px]">{trade.action}</Badge>
                  <span>{trade.leverage}x</span>
                  <span className="text-muted-foreground">${trade.usdSize.toFixed(0)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MultiAssetTrader;
