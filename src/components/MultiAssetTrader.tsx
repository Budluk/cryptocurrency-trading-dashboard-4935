import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Play, Square, Zap, DollarSign, TrendingUp, Target, Network, Brain, ShieldAlert, Clock, Wallet, Crosshair, Sparkles } from "lucide-react";
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
import { getUserId } from "@/lib/anonymousUser";
import { AntiLossMonitor } from "./AntiLossMonitor";
import { useDataDrivenStrategy } from "@/hooks/useDataDrivenStrategy";
import { useArmedOrders } from "@/hooks/useArmedOrders";
import { useAITradingIntelligence } from "@/hooks/useAITradingIntelligence";
import { useMarketIntelligence } from "@/hooks/useMarketIntelligence";

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
  const [isTestnet, setIsTestnet] = useState(false);
  const [activeTrades, setActiveTrades] = useState<Trade[]>([]);
  const [totalPnL, setTotalPnL] = useState(0);
  const [cycleCount, setCycleCount] = useState(0);
  const [dailyPnL, setDailyPnL] = useState(0);
  const [consecutiveLosses, setConsecutiveLosses] = useState(0);
  const [mlConfig, setMlConfig] = useState<any>(null);
  const { toast } = useToast();
  
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
  } = useBybitSync();
  const { analyzeSignal, fetchComprehensiveAI, fetchBTCTrend } = useSignalAnalysis();
  const { isPatternBlocked, recordTradeResult, getBlockedStats, blockedCount, forceUnblock, loadHistoricalPatterns } = useLosingPatternBlocker();
  const { 
    analyzeSymbol, shouldTradeDataDriven, getOptimalStopTakeProfit, 
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
  
  // AI cache for comprehensive analysis
  const aiAnalysisCache = useRef<Map<string, { data: any; timestamp: number }>>(new Map());
  const { calculateExposure, classifyVolatilityRisk, getAdaptiveTrailingConfig: getAdvancedTrailing, checkAssetCorrelation, getProtectProfitLevel } = useAdvancedRiskManager();
  
  const lastMLCheck = useRef<number>(0);
  const lastClosedPositionsRef = useRef<string[]>([]);
  const orphanCleanupDoneRef = useRef<boolean>(false);

  // Configurações
  const [maxOpenPositions, setMaxOpenPositions] = useState(200);
  const MAX_CONSECUTIVE_LOSSES = 10;
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
  const [armedModeEnabled, setArmedModeEnabled] = useState(true); // 🎯 MODO ORDENS ARMADAS
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
            leverage: trade.leverage || 10,
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
            trade.leverage || 10,
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

  // Carregar saldo inicial
  useEffect(() => {
    const init = async () => {
      console.log('🔄 Inicializando trader...');
      await syncBybitBalance();
      await syncOpenPositions();
      await fetchTop10VolatileAssets();
      console.log('✅ Inicialização completa');
    };
    init();
  }, []);

  // Restaurar estado e garantir config existe
  useEffect(() => {
    const restoreTraderState = async () => {
      const userId = await getUserId();
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

      // Se não existe config, criar uma
      if (!config) {
        console.log('📝 Criando config para usuário...');
        const { data: newConfig, error } = await supabase.from('auto_trader_config').insert({
          user_id: userId,
          trader_is_running: false,
          is_active: false,
          min_confidence: 50,
          leverage_max: 25
        }).select().single();
        
        if (!error && newConfig) {
          config = newConfig;
          console.log('✅ Config criada');
        }
      }

      if (config?.trader_is_running) {
        const lastActivity = new Date(config.last_activity_at || Date.now()).getTime();
        if (Date.now() - lastActivity < 10 * 60 * 1000) { // 10 min tolerance
          setIsRunning(true);
          toast({ title: "🔄 Trader Restaurado", description: "Operações continuam automaticamente" });
        } else {
          await supabase.from('auto_trader_config').update({ trader_is_running: false }).eq('user_id', userId);
        }
      }
      
      console.log('📊 Estado trader:', config?.trader_is_running ? 'ATIVO' : 'PARADO');
    };
    restoreTraderState();
  }, []);

  // Sincronizar PnL de posições fechadas com Bybit e registrar no anti-loss
  const syncClosedPositionsPnL = useCallback(async () => {
    try {
      const userId = await getUserId();
      
      // Buscar posições fechadas sem PnL
      const { data: closedWithoutPnl, error: fetchError } = await supabase
        .from('auto_trader_positions')
        .select('id, symbol, side, leverage, closed_at, entry_price, qty')
        .eq('user_id', userId)
        .eq('status', 'CLOSED')
        .is('realized_pnl', null)
        .order('closed_at', { ascending: false })
        .limit(30);

      if (fetchError) {
        console.error('❌ Erro ao buscar posições:', fetchError);
        return;
      }

      if (!closedWithoutPnl?.length) {
        console.log('✅ Todas posições têm PnL sincronizado');
        return;
      }

      console.log(`🔄 Sincronizando PnL de ${closedWithoutPnl.length} posições...`);

      // Buscar PnL real do Bybit (últimos 100 registros)
      const { data: bybitPnL, error: apiError } = await supabase.functions.invoke('bybit-trading', {
        body: { 
          action: 'get_closed_pnl', 
          isTestnet: false, 
          params: { category: 'linear', limit: 100 } 
        }
      });

      if (apiError || !bybitPnL?.success) {
        console.error('❌ Erro ao buscar PnL do Bybit:', apiError || bybitPnL?.error);
        return;
      }

      const pnlList = bybitPnL.data?.list || [];
      console.log(`📊 Bybit retornou ${pnlList.length} registros de PnL`);

      if (pnlList.length === 0) {
        console.log('⚠️ Nenhum PnL encontrado no Bybit');
        return;
      }

      let syncedCount = 0;
      
      for (const pos of closedWithoutPnl) {
        // Tentar encontrar correspondência por símbolo (Bybit pode ter múltiplos trades por símbolo)
        const symbolMatches = pnlList.filter((p: any) => p.symbol === pos.symbol);
        
        if (symbolMatches.length === 0) {
          console.log(`⚠️ Nenhum PnL encontrado para ${pos.symbol}`);
          continue;
        }

        // Pegar o mais recente para o símbolo, ou tentar match por tempo
        let matchingPnl = symbolMatches[0]; // Mais recente por padrão
        
        // Se temos closed_at, tentar match mais preciso
        if (pos.closed_at) {
          const posCloseTime = new Date(pos.closed_at).getTime();
          
          // Encontrar o match mais próximo no tempo (tolerance de 5 minutos)
          for (const pnl of symbolMatches) {
            const pnlTime = parseInt(pnl.updatedTime);
            if (Math.abs(pnlTime - posCloseTime) < 300000) { // 5 min tolerance
              matchingPnl = pnl;
              break;
            }
          }
        }

        const realizedPnl = parseFloat(matchingPnl.closedPnl);
        
        // Atualizar no banco
        const { error: updateError } = await supabase
          .from('auto_trader_positions')
          .update({ realized_pnl: realizedPnl })
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
        console.log(`${emoji} PnL sincronizado: ${pos.symbol} ${pos.side} = $${realizedPnl.toFixed(4)}`);
      }

      console.log(`✅ Sincronizados ${syncedCount}/${closedWithoutPnl.length} PnLs`);
      
    } catch (error) {
      console.error('❌ Erro ao sincronizar PnL:', error);
    }
  }, [recordTradeResult]);

  // Smart exits
  const updateSmartExits = async () => {
    if (!smartExitEnabled && !trailingStopEnabled) return;
    
    try {
      const { data, error } = await supabase.functions.invoke('bybit-trading', {
        body: { action: 'get_positions', isTestnet: false, params: { category: 'linear', settleCoin: 'USDT' } }
      });

      if (error || !data?.success) return;

      // positions data is array directly
      const positionsList = Array.isArray(data.data) ? data.data : (data.data?.list || []);
      const openPositionsData = positionsList.filter((p: any) => parseFloat(p.size) > 0);
      const volatilityMap = (window as any).assetVolatility || new Map();

      if (smartExitEnabled && mlConfig?.is_enabled) {
        const positionsData = openPositionsData.map((p: any) => ({
          symbol: p.symbol,
          side: p.side,
          size: parseFloat(p.size),
          entryPrice: parseFloat(p.avgPrice),
          currentPrice: parseFloat(p.markPrice),
          unrealizedPnl: parseFloat(p.unrealisedPnl),
          leverage: parseFloat(p.leverage),
        }));
        await processOpenPositions(positionsData, mlConfig, volatilityMap);
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
    } catch (error) {
      console.error('Erro ao atualizar smart exits:', error);
    }
  };

  const analyzeAndTrade = async () => {
    try {
      const balanceNow = await syncBybitBalance();
      await syncOpenPositions();
      const topVolNow = await fetchTop10VolatileAssets();
      
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

      // Filtro de horário
      if (timeFilterEnabled) {
        const currentHour = new Date().getUTCHours();
        const isWithinTradingHours = startHour <= endHour
          ? currentHour >= startHour && currentHour < endHour
          : currentHour >= startHour || currentHour < endHour;
        if (!isWithinTradingHours) return;
      }

      // Buscar instrumentos
      const { data: instrumentsData, error: instrumentsError } = await supabase.functions.invoke('bybit-trading', {
        body: { action: 'get_instruments', isTestnet: false, params: { category: 'linear', limit: 1000, status: 'Trading' } }
      });

      if (instrumentsError || !instrumentsData?.success) {
        console.log('❌ Erro ao buscar instruments:', instrumentsError);
        return;
      }

      // instruments data is array directly in data field
      const instruments = Array.isArray(instrumentsData.data) ? instrumentsData.data : (instrumentsData.data?.list || []);
      const tradableAssets = instruments.filter((inst: any) => inst.status === 'Trading' && inst.quoteCoin === 'USDT');
      console.log(`📊 ${tradableAssets.length} ativos tradáveis`);

      const { data: tickerData, error: tickerError } = await supabase.functions.invoke('bybit-trading', {
        body: { action: 'get_ticker', isTestnet: false, params: { category: 'linear' } }
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
        
        // 🆕 PRIMEIRO: Verificar BLACKLIST GLOBAL (baseado em dados históricos reais)
        if (GLOBAL_BLACKLIST.has(symbol)) {
          return false; // Nunca operar símbolos que historicamente perdem
        }
        
        // === CRITÉRIOS PARA SCALPING LUCRATIVO ===
        
        // 1. Spread máximo de 0.05% para scalping (muito importante!)
        if (a.spread > 0.05) return false;
        
        // 2. Volume mínimo mais alto para liquidez
        const minVolume = isInTop10 ? 500000 : 1000000; // $500k ou $1M
        if (a.volume24h < minVolume) return false;
        
        // 3. Faixa de volatilidade ideal para scalping: 2-8%
        // Muito baixa = sem movimento, muito alta = risco de reversão
        const minVol = isInTop10 ? 1.5 : 2.0;
        const maxVol = 10; // Evitar ativos extremamente voláteis
        if (a.volatility < minVol || a.volatility > maxVol) return false;
        
        // 4. Preço mínimo para evitar dust trades
        if (a.lastPrice < 0.001) return false;
        
        // 5. Priorizar majors e ativos conhecidos
        const majorSymbols = ['ETHUSDT', 'XRPUSDT', 'DOGEUSDT', 'ADAUSDT', 'AVAXUSDT', 'LINKUSDT', 'DOTUSDT', 'MATICUSDT', 'SHIBUSDT', 'LTCUSDT', 'TRXUSDT', 'ATOMUSDT', 'UNIUSDT', 'NEARUSDT', 'OPUSDT', 'ARBUSDT', 'SUIUSDT', 'APTUSDT', 'INJUSDT', 'SEIUSDT', 'WIFUSDT', 'PEPEUSDT', 'BONKUSDT', 'FLOKIUSDT', 'ORDIUSDT', 'TIAUSDT', 'JUPUSDT', 'WLDUSDT'];
        const isMajor = majorSymbols.includes(symbol);
        
        // Se não é major, exigir volume ainda maior
        if (!isMajor && a.volume24h < 2000000) return false;
        
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
        
        // Bonus para majors (exceto os blacklistados)
        const majorBonus = ['ETHUSDT', 'XRPUSDT'].includes(symbol) ? 0.10 : 0;
        
        // Penalidade para spread alto
        const spreadPenalty = a!.spread > 0.03 ? 0.1 : 0;
        
        const assetScore = (normalizedLiquidity * 0.25) + (normalizedVolatility * 0.20) + (normalizedVolume * 0.25) + whitelistBonus + majorBonus - spreadPenalty;
        
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
        .slice(0, 30);
      
      console.log(`🔥 ${topVolatileAssets.length} ativos após filtro avançado | Top 5: ${topVolatileAssets.slice(0, 5).map(a => `${a.instrument.symbol}(${a.assetScore.toFixed(2)})${a.isWhitelisted ? '⭐' : ''}`).join(', ')}`);

      // 🎯 ORDENS ARMADAS (S/R): armar + disparar a cada ciclo com base nos tickers atuais
      if (armedModeEnabled) {
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
      
      // 🆕 VERIFICAR SE TEM ATIVOS PARA ESTA HORA
      const currentHourUTC = new Date().getUTCHours();
      const hourAssets = getAssetsForCurrentHour();
      const hasGoodAssets = hourAssets.length > 0;
      
      if (!hasGoodAssets) {
        console.log(`⚠️ Hora ${currentHourUTC}h UTC sem ativos lucrativos específicos - usando premium symbols`);
      } else {
        console.log(`✅ Hora ${currentHourUTC}h UTC: ${hourAssets.length} ativos ideais: ${hourAssets.map(a => a.symbol).join(', ')}`);
      }

      let shouldStopTrading = false;
      let openedThisCycle = 0;
      const skipCounts = new Map<string, number>();
      const openPositionsLite = openPositions.map(p => ({ symbol: p.symbol, side: p.side }));
      
      // === SCALPING: LIMITES MAIS FLEXÍVEIS ===
      let buyCountThisCycle = 0;
      let sellCountThisCycle = 0;
      const MAX_SAME_DIRECTION_PER_CYCLE = 4; // Aumentado para scalping
      const MAX_TRADES_PER_CYCLE = 6; // Mais trades por ciclo para scalping
      
      // Contar posições abertas por direção
      const existingBuys = openPositions.filter(p => p.side === 'Buy').length;
      const existingSells = openPositions.filter(p => p.side === 'Sell').length;
      const MAX_IMBALANCE = 8; // Mais flexível para scalping
      
      for (const assetData of topVolatileAssets) {
        if (!isRunning || shouldStopTrading) break;
        
        // LIMITE DE TRADES POR CICLO
        if (openedThisCycle >= MAX_TRADES_PER_CYCLE) {
          console.log(`⚠️ Limite de ${MAX_TRADES_PER_CYCLE} trades/ciclo atingido`);
          break;
        }

        const { instrument, ticker, volatility, priceChange, volume24h } = assetData;
        const symbol = instrument.symbol;
        const isScalpAsset = topVolNow.includes(symbol);
        
        // 🆕 ANÁLISE BASEADA EM DADOS POR HORA
        const symbolAnalysis = analyzeSymbol(symbol);
        const isOptimalForHour = symbolAnalysis.isOptimalForHour;
        const isPremiumSymbol = symbolAnalysis.isPremium;
        
        // 🆕 FILTRO: Priorizar ativos ideais para esta hora
        if (!isOptimalForHour && !isPremiumSymbol) {
          // Se não é ativo ideal nem premium, pular (opera 24h com precisão)
          const reason = `Não é ativo ideal para ${currentHourUTC}h UTC`;
          skipCounts.set(reason, (skipCounts.get(reason) || 0) + 1);
          continue;
        }
        
        try {
          const currentPrice = parseFloat(ticker.lastPrice);
          const highPrice = parseFloat(ticker.highPrice24h);
          const lowPrice = parseFloat(ticker.lowPrice24h);
          
          // === THRESHOLDS AJUSTADOS POR ANÁLISE DE HORA ===
          let scoreThreshold = isOptimalForHour ? 30 : (isPremiumSymbol ? 35 : 45);
          let minConfirmations = isOptimalForHour ? 1 : 2;
          
          if (mlDecisionsEnabled && mlConfig?.is_enabled) {
            const patterns = mlConfig.optimal_patterns || {};
            if (patterns.bestSymbols?.includes(symbol)) scoreThreshold -= 5;
            const currentHour = new Date().getUTCHours();
            if (patterns.bestHours?.includes(currentHour)) scoreThreshold -= 3;
          }
          
          // 🆕 Bonus para ativo ideal da hora
          if (isOptimalForHour && symbolAnalysis.hourWinRate && symbolAnalysis.hourWinRate >= 70) {
            scoreThreshold -= 10; // Alta confiança
          }
          
          // Mínimo score
          scoreThreshold = Math.max(isOptimalForHour ? 20 : 30, scoreThreshold);
          
          // 🆕 Passar symbol e BTC trend para análise
          const analysisResult = analyzeSignal({
            currentPrice, highPrice, lowPrice, priceChange, volume24h, volatility,
            scoreThreshold, minConfirmations, currentBalance: balanceNow,
            symbol, // Para tracking de pullback
            btcPriceChange: btcTrend, // Para correlação BTC
          });

          if (!analysisResult.shouldTrade || !analysisResult.action) {
            const reason = analysisResult.skipReason || 'Sem motivo';
            skipCounts.set(reason, (skipCounts.get(reason) || 0) + 1);
            continue;
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
          
          if (mlConfig?.is_enabled && mlConfig?.recommended_leverage) {
            dynamicLeverage = Math.min(mlConfig.recommended_leverage, maxLeverageInstrument);
          }
          
          const leverage = Math.floor(dynamicLeverage);

          // 🚫 Verificar padrão perdedor ANTES de entrar
          const patternCheck = isPatternBlocked(symbol, analysisResult.action === 'BUY' ? 'Buy' : 'Sell', leverage);
          if (patternCheck.blocked) {
            console.log(`🚫 BLOQUEADO: ${symbol} - ${patternCheck.reason}`);
            continue;
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

          const freshBalance = balanceNow;
          if (freshBalance < 2) { // Reduzido para scalping com posições menores
            console.log(`⚠️ Saldo disponível muito baixo: $${freshBalance.toFixed(2)}`);
            shouldStopTrading = true;
            break;
          }
          
          // 🆕 Verificar exposição máxima do portfolio
          const exposureData = calculateExposure(openPositions, currentBalance);
          if (exposureData.isOverExposed) {
            console.log(`⚠️ Exposição máxima atingida: ${exposureData.exposurePercent.toFixed(1)}% > 80%`);
            continue;
          }

          // 🆕 Usar limite de tamanho baseado em volatilidade E saldo disponível
          const maxPositionForVol = volRisk.maxPositionSize;
          // CRÍTICO: Usar no máximo 20% do saldo DISPONÍVEL (não total)
          const maxMarginPerTrade = Math.min(freshBalance * 0.20, maxPositionForVol, 15);
          const positionValue = maxMarginPerTrade * leverage;
          // Limitar USD size baseado no saldo disponível
          let usdSize = Math.min(positionValue, freshBalance * 0.8, 50);

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
          if (requiredMargin > freshBalance * 0.35) {
            console.log(`⚠️ Margem ${requiredMargin.toFixed(2)} > 35% disponível ${freshBalance.toFixed(2)} - pulando`);
            continue;
          }

          if (parseFloat(orderValueUSD) < 5) continue;

          // 🆕 Calcular SL/TP baseado em DADOS HISTÓRICOS + estrutura de preço
          const priceRange = highPrice - lowPrice;
          const atrPercent = (priceRange / currentPrice) * 100;
          
          // Usar cálculo data-driven para símbolos ideais ou premium
          let stopLoss: string, takeProfit: string;
          if (isOptimalForHour || isPremiumSymbol) {
            const optimalSLTP = getOptimalStopTakeProfit(
              symbol, 
              currentPrice, 
              analysisResult.action === 'BUY' ? 'Buy' : 'Sell',
              volatility
            );
            stopLoss = optimalSLTP.stopLoss.toFixed(6);
            takeProfit = optimalSLTP.takeProfit.toFixed(6);
            console.log(`📊 ${symbol} SL/TP otimizado: ${optimalSLTP.reason}`);
          } else {
            const sltp = calculateStopTakeProfit(
              currentPrice, analysisResult.action, atrPercent, isScalpAsset, mlConfig,
              highPrice, lowPrice
            );
            stopLoss = sltp.stopLoss;
            takeProfit = sltp.takeProfit;
          }
          
          // 🔒 VALIDAÇÃO CRÍTICA: Garantir SL/TP no lado correto do preço (sem distorcer estratégia) 
          const slNum = parseFloat(stopLoss);
          const tpNum = parseFloat(takeProfit);
          const minSlPct = 0.001; // 0.10%
          const rr = 2.5; // 1:2.5

          if (analysisResult.action === 'BUY') {
            // BUY: SL abaixo, TP acima
            if (!Number.isFinite(slNum) || slNum >= currentPrice) {
              const corrected = (currentPrice * (1 - minSlPct)).toFixed(6);
              console.log(`⚠️ SL BUY corrigido: ${stopLoss} → ${corrected} (preço: ${currentPrice})`);
              stopLoss = corrected;
            }
            if (!Number.isFinite(tpNum) || tpNum <= currentPrice) {
              const corrected = (currentPrice * (1 + minSlPct * rr)).toFixed(6);
              console.log(`⚠️ TP BUY corrigido: ${takeProfit} → ${corrected} (preço: ${currentPrice})`);
              takeProfit = corrected;
            }
          } else {
            // SELL: SL acima, TP abaixo
            if (!Number.isFinite(slNum) || slNum <= currentPrice) {
              const corrected = (currentPrice * (1 + minSlPct)).toFixed(6);
              console.log(`⚠️ SL SELL corrigido: ${stopLoss} → ${corrected} (preço: ${currentPrice})`);
              stopLoss = corrected;
            }
            if (!Number.isFinite(tpNum) || tpNum >= currentPrice) {
              const corrected = (currentPrice * (1 - minSlPct * rr)).toFixed(6);
              console.log(`⚠️ TP SELL corrigido: ${takeProfit} → ${corrected} (preço: ${currentPrice})`);
              takeProfit = corrected;
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

          // Configurar alavancagem
          let finalLeverage = leverage;
          let leverageSuccess = false;
          
          if (!symbol || symbol.trim() === '') {
            console.error('Invalid symbol for leverage setting:', symbol);
            continue;
          }
          
          for (let attempts = 0; attempts < 3 && !leverageSuccess; attempts++) {
            const { data: leverageData, error } = await supabase.functions.invoke('bybit-trading', {
              body: {
                action: 'set_leverage', isTestnet: false,
                params: { category: 'linear', symbol: symbol.trim(), buyLeverage: finalLeverage.toString(), sellLeverage: finalLeverage.toString() }
              }
            });
            
            // Success if no error OR if response indicates leverage already set
            if (!error || leverageData?.data?.success || leverageData?.data?.retCode === 110043) {
              leverageSuccess = true;
            } else {
              console.log(`Leverage attempt ${attempts + 1} failed for ${symbol}, reducing from ${finalLeverage}`);
              finalLeverage = Math.max(Math.floor(finalLeverage * 0.7), 10);
            }
          }
          
          if (!leverageSuccess) continue;

          // Executar ordem - MODO ARMADO usa Limit, senão Market
          let orderType: 'Market' | 'Limit' = 'Market';
          let limitPrice: string | undefined;
          
          if (armedModeEnabled) {
            // 🎯 MODO ARMADO: Ordem Limit em nível melhor que preço atual
            // Para BUY: entrada abaixo do preço (esperar pullback)
            // Para SELL: entrada acima do preço (esperar pullback)
            const pullbackPct = 0.0008; // 0.08% pullback para melhor entrada
            
            if (analysisResult.action === 'BUY') {
              limitPrice = (currentPrice * (1 - pullbackPct)).toFixed(6);
            } else {
              limitPrice = (currentPrice * (1 + pullbackPct)).toFixed(6);
            }
            
            orderType = 'Limit';
            console.log(`🎯 ORDEM LIMITE ARMADA: ${symbol} ${analysisResult.action} @ ${limitPrice} (atual: ${currentPrice.toFixed(4)})`);
          }
          
          const orderParams: Record<string, any> = {
            category: 'linear', symbol,
            side: analysisResult.action === 'BUY' ? 'Buy' : 'Sell',
            orderType, qty: qtyStr,
            stopLoss, takeProfit,
            timeInForce: 'GTC', positionIdx: 0, reduceOnly: false
          };
          
          // Adicionar preço limite se modo armado
          if (orderType === 'Limit' && limitPrice) {
            orderParams.price = limitPrice;
          }
          
          const { data: orderData, error: orderError } = await supabase.functions.invoke('bybit-trading', {
            body: { action: 'place_order', isTestnet: false, params: orderParams }
          });

          if (!orderError && orderData?.success) {
            openedThisCycle++;
            // 🆕 Atualizar contadores de direção
            if (analysisResult.action === 'BUY') buyCountThisCycle++;
            if (analysisResult.action === 'SELL') sellCountThisCycle++;
            
            // 🎯 Status diferente para ordens limite vs market
            const orderStatus = orderType === 'Limit' ? 'PENDING' : 'OPEN';
            const entryPrice = orderType === 'Limit' && limitPrice ? parseFloat(limitPrice) : currentPrice;
            
            const tradeLog = {
              timestamp: new Date().toISOString(),
              symbol, side: analysisResult.action, leverage: finalLeverage,
              size: usdSize.toFixed(2), volatility: volatility.toFixed(2),
              signalScore: analysisResult.signalScore,
              signalQuality: analysisResult.signalQuality,
              exposure: exposureData.exposurePercent.toFixed(1),
              volRisk: volRisk.riskLevel,
              orderType,
              limitPrice: limitPrice || null
            };
            console.log(`✅ ${orderType === 'Limit' ? '🎯 LIMITE ARMADA' : 'TRADE'}:`, JSON.stringify(tradeLog));
            
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
              status: orderStatus,
              order_source: orderType === 'Limit' ? 'armed_limit' : 'market',
              exchange_order_id: orderData.data?.orderId
            });
            
            if (trailingStopEnabled) {
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
            
            if (scaleInOutEnabled) {
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
            // Position count will be updated on next sync
            
            toast({ title: `${isScalpAsset ? '⚡ SCALP' : '✅ TRADE'} ${symbol}`, description: `${analysisResult.action} ${finalLeverage}x | $${usdSize.toFixed(0)}` });
            
            // 🆕 DELAY MAIOR após trade bem sucedido - deixar mercado respirar
            await new Promise(resolve => setTimeout(resolve, 5000)); // 5 segundos
          } else {
            if (martingaleEnabled) setLossStreak(prev => Math.min(prev + 1, 3));
            setConsecutiveLosses(prev => prev + 1);
            
            const errorMsg = orderData?.error || orderError?.message || '';
            if (errorMsg.includes('ab not enough')) {
              setIsRunning(false);
              shouldStopTrading = true;
              break;
            }
          }

          await new Promise(resolve => setTimeout(resolve, 1500)); // Delay padrão entre ativos
        } catch (error) {
          console.error(`Erro ao processar ${symbol}:`, error);
        }
      }

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
    }
  };

  // Loop principal - otimizado com intervalos maiores
  useEffect(() => {
    if (!isRunning) return;
    
    // Executar imediatamente
    analyzeAndTrade();
    
    // Intervalo principal: 45s (era 30s)
    const interval = setInterval(() => {
      if (isRunning) analyzeAndTrade();
    }, 45000);

    // Smart exits: 30s (era 15s)
    const exitInterval = setInterval(updateSmartExits, 30000);
    
    // Sincronizar PnL a cada 60s para alimentar sistema anti-loss
    const pnlSyncInterval = setInterval(syncClosedPositionsPnL, 60000);
    
    // Sincronizar imediatamente ao iniciar
    syncClosedPositionsPnL();
    
    return () => {
      clearInterval(interval);
      clearInterval(exitInterval);
      clearInterval(pnlSyncInterval);
    };
  }, [isRunning, syncClosedPositionsPnL]);

  // Pyramiding
  useEffect(() => {
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
            body: { action: 'get_instruments', isTestnet: false, params: { category: 'linear', symbol: position.symbol } }
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
              action: 'place_order', isTestnet: false,
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
                action: 'set_trading_stop', isTestnet: false,
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
  }, [scaleInOutEnabled, isRunning, mlConfig, pyramidingTracking]);

  const cleanupOrphanPositions = useCallback(async () => {
    console.log('🧹 Sincronizando posições...');
    try {
      const userId = await getUserId();

      // Buscar posições reais do Bybit
      const { data: bybitData } = await supabase.functions.invoke('bybit-trading', {
        body: { action: 'get_positions', isTestnet: false, params: { category: 'linear', settleCoin: 'USDT' } }
      });

      const realPositions = (bybitData?.data || []).filter((p: any) => parseFloat(p.size || '0') > 0);
      const realSymbols = new Set(realPositions.map((p: any) => `${p.symbol}-${p.side}`));
      console.log(`📊 ${realPositions.length} posições reais no Bybit`);

      // Buscar posições "OPEN" do usuário no banco (ordenar para manter só 1 por símbolo+lado)
      const { data: dbOpenPositions, error: dbError } = await supabase
        .from('auto_trader_positions')
        .select('id, symbol, side, opened_at')
        .eq('user_id', userId)
        .eq('status', 'OPEN')
        .order('opened_at', { ascending: false });

      if (dbError) {
        console.log('⚠️ Erro ao buscar posições no banco:', dbError);
        return;
      }

      const idsToClose: string[] = [];
      const seenRealKeys = new Set<string>();

      for (const dbPos of (dbOpenPositions || [])) {
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
  }, [refetch]);

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

    const userId = await getUserId();

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

    toast({ title: "🚀 Trader iniciado", description: `${stats.blockedSymbols.length} símbolos bloqueados` });
  };

  const stopTrading = async () => {
    setIsRunning(false);
    orphanCleanupDoneRef.current = false;
    
    const userId = await getUserId();
    await supabase.from('auto_trader_config').update({ trader_is_running: false }).eq('user_id', userId);

    toast({ title: "⏸️ Trader pausado", description: `P&L Total: $${totalPnL.toFixed(2)}` });
  };

  const resetBankroll = async () => {
    await syncBybitBalance();
    setTotalPnL(0);
    setDailyPnL(0);
    setActiveTrades([]);
    setCycleCount(0);
    setConsecutiveLosses(0);
    toast({ title: "🔄 Reset Completo" });
  };

  return (
    <div className="space-y-4">
      <Card className="p-6 bg-gradient-to-br from-purple-500/10 to-blue-500/10 border-purple-500/20">
        {/* Header com 24/7 Badge */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="p-3 rounded-xl bg-gradient-to-br from-yellow-500/20 to-orange-500/20 border border-yellow-500/30">
                <Zap className="h-7 w-7 text-yellow-500" />
              </div>
              <div className="absolute -top-1 -right-1 flex items-center gap-0.5 bg-primary text-primary-foreground text-[9px] font-bold px-1.5 py-0.5 rounded-full animate-pulse">
                <Clock className="h-2.5 w-2.5" />
                24/7
              </div>
            </div>
            <div>
              <h3 className="text-2xl font-bold">Multi-Asset Trader</h3>
              <p className="text-sm text-muted-foreground">Estratégia com IA e alavancagem dinâmica</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Badge variant={isTestnet ? "outline" : "destructive"} className="text-sm px-3 py-1.5 animate-pulse">
              {isTestnet ? '🧪 TESTNET' : '⚡ CONTA REAL'}
            </Badge>
            <Badge 
              variant={getCorrelationRisk().level === 'low' ? 'default' : getCorrelationRisk().level === 'medium' ? 'secondary' : 'destructive'}
              className="text-xs flex items-center gap-1"
            >
              <Network className="h-3 w-3" />
              {getCorrelationRisk().message}
            </Badge>
          </div>
        </div>

        {/* Saldo Real em Destaque */}
        <Card className="p-5 mb-6 bg-gradient-to-br from-green-500/15 to-emerald-500/10 border-green-500/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-green-500/20">
                <Wallet className="h-8 w-8 text-green-400" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground font-medium">Saldo Total da Banca</span>
                  <Badge className="bg-green-500/20 text-green-400 border-0 text-[10px]">
                    AO VIVO
                  </Badge>
                </div>
                <div className="text-4xl font-bold text-green-400 font-mono tracking-tight">
                  ${currentBalance.toFixed(2)}
                </div>
                {lastSyncTime && (
                  <div className="text-xs text-muted-foreground mt-1">
                    Última atualização: {lastSyncTime.toLocaleTimeString()}
                  </div>
                )}
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs text-muted-foreground mb-1">P&L Hoje</div>
              <div className={`text-2xl font-bold font-mono ${dailyPnL >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {dailyPnL >= 0 ? '+' : ''}{dailyPnL.toFixed(2)}
              </div>
            </div>
          </div>
        </Card>

        {/* Status Cards */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <Card className="p-4 bg-background/50">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="h-4 w-4 text-blue-500" />
              <span className="text-xs text-muted-foreground">Alavancagem</span>
            </div>
            <div className="text-xl font-bold">{getLeverageForBalance(currentBalance, historicalWinRate)}x</div>
            <div className="text-xs text-muted-foreground">Win: {historicalWinRate.toFixed(0)}%</div>
          </Card>

          <Card className="p-4 bg-background/50">
            <div className="flex items-center gap-2 mb-1">
              <Zap className="h-4 w-4 text-yellow-500" />
              <span className="text-xs text-muted-foreground">Posições</span>
            </div>
            <div className="text-xl font-bold">{openPositionsCount}/{maxOpenPositions}</div>
            <div className="text-xs text-muted-foreground">{activeTrades.length} total</div>
          </Card>

          <Card className="p-4 bg-background/50">
            <div className="flex items-center gap-2 mb-1">
              <Target className="h-4 w-4 text-green-500" />
              <span className="text-xs text-muted-foreground">Proteção</span>
            </div>
            <div className="text-xl font-bold">{consecutiveLosses}/{MAX_CONSECUTIVE_LOSSES}</div>
            <div className="text-xs text-muted-foreground">Perdas seguidas</div>
          </Card>
        </div>

        {/* Proteções */}
        <div className="grid grid-cols-1 gap-3 mb-4">
          <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
            <div className="text-xs font-medium mb-1">📊 Posições Max</div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="h-6 w-6 p-0" onClick={() => setMaxOpenPositions(Math.max(1, maxOpenPositions - 1))} disabled={isRunning}>-</Button>
              <span className="text-sm font-bold">{maxOpenPositions}</span>
              <Button variant="outline" size="sm" className="h-6 w-6 p-0" onClick={() => setMaxOpenPositions(Math.min(200, maxOpenPositions + 1))} disabled={isRunning}>+</Button>
            </div>
          </div>
        </div>

        {/* Margem */}
        <Card className="p-4 bg-gradient-to-br from-purple-500/10 to-pink-500/10 border-purple-500/20 mb-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-purple-400" />
              <span className="text-sm font-medium">Gerenciamento de Margem</span>
            </div>
            <Badge variant="outline" className="text-purple-400 border-purple-400">{openPositionsCount}/{maxOpenPositions}</Badge>
          </div>
          
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Margem Total:</span>
              <span className="font-mono text-purple-400">${currentBalance.toFixed(2)}</span>
            </div>
            <Progress value={(openPositionsCount / maxOpenPositions) * 100} className="h-2 mt-2" />
          </div>
        </Card>

        {/* Mode Toggle */}
        <div className="flex items-center justify-between p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg mb-4">
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

        {/* Controls */}
        <div className="flex gap-2 mb-4">
          {!isRunning ? (
            <>
              <Button onClick={startTrading} className="flex-1 bg-gradient-to-r from-green-500 to-emerald-600" size="lg">
                <Play className="h-5 w-5 mr-2" />Iniciar Trader 24/7
              </Button>
              <Button onClick={resetBankroll} variant="outline" size="lg">Reset</Button>
            </>
          ) : (
            <Button onClick={stopTrading} variant="destructive" className="w-full" size="lg">
              <Square className="h-5 w-5 mr-2" />Parar Trader
            </Button>
          )}
        </div>

        {/* ML Card */}
        <Card className="p-4 bg-gradient-to-br from-purple-500/10 to-pink-500/10 border-purple-500/20 mb-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h4 className="text-sm font-semibold flex items-center gap-2">
                🧠 ML Adaptativo
                {mlConfig?.is_enabled && <Badge variant="default" className="text-xs">ATIVO</Badge>}
              </h4>
              <p className="text-xs text-muted-foreground mt-1">
                {mlConfig?.is_enabled ? `${mlConfig.trades_analyzed} trades | ${mlConfig.confidence_score?.toFixed(0)}% confiança` : 'Analise seu histórico'}
              </p>
            </div>
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
          
          {mlConfig?.is_enabled && (
            <div className="grid grid-cols-4 gap-2 text-xs">
              <div className="p-2 bg-background/50 rounded border"><div className="text-muted-foreground">Lev</div><div className="font-bold text-purple-400">{mlConfig.recommended_leverage}x</div></div>
              <div className="p-2 bg-background/50 rounded border"><div className="text-muted-foreground">SL</div><div className="font-bold text-red-400">{mlConfig.recommended_stop_loss_pct}%</div></div>
              <div className="p-2 bg-background/50 rounded border"><div className="text-muted-foreground">TP</div><div className="font-bold text-green-400">{mlConfig.recommended_take_profit_pct}%</div></div>
              <div className="p-2 bg-background/50 rounded border"><div className="text-muted-foreground">Pyram</div><div className="font-bold text-yellow-400">{mlConfig.optimal_patterns?.pyramiding?.maxLevels || 2}x</div></div>
            </div>
          )}
        </Card>

        {/* 🚫 Monitor Anti-Perdas */}
        <AntiLossMonitor 
          getBlockedStats={getBlockedStats} 
          blockedCount={blockedCount}
          forceUnblock={forceUnblock}
        />

        {/* Gestão de Saídas */}
        <Card className="p-4 bg-gradient-to-br from-blue-500/10 to-cyan-500/10 border-blue-500/20 mb-4">
          <div className="flex items-center gap-2 mb-3">
            <Brain className="h-5 w-5 text-blue-400" />
            <span className="text-sm font-medium">Gestão de Saídas</span>
          </div>
          
          <div className="grid grid-cols-2 gap-3">
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
        </Card>

        {/* 🎯 Sistema de Ordens Armadas S/R */}
        <Card className={`p-4 mb-4 transition-all duration-300 ${
          armedOrders.filter(o => o.status === 'armed').length > 0 
            ? 'bg-gradient-to-br from-amber-500/20 to-orange-500/20 border-amber-400 shadow-lg shadow-amber-500/20 animate-pulse' 
            : 'bg-gradient-to-br from-amber-500/10 to-orange-500/10 border-amber-500/20'
        }`}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Crosshair className={`h-5 w-5 ${armedOrders.filter(o => o.status === 'armed').length > 0 ? 'text-amber-300 animate-spin' : 'text-amber-400'}`} style={{ animationDuration: '3s' }} />
              <span className="text-sm font-medium">Ordens Armadas S/R</span>
              {armedOrders.filter(o => o.status === 'armed').length > 0 ? (
                <Badge className="bg-amber-500 text-black font-bold text-xs px-2 py-1 animate-bounce">
                  🎯 {armedOrders.filter(o => o.status === 'armed').length} ARMADA{armedOrders.filter(o => o.status === 'armed').length > 1 ? 'S' : ''}
                </Badge>
              ) : (
                <Badge variant="outline" className="text-[10px] text-amber-400">$0.20+ min</Badge>
              )}
            </div>
            <Switch checked={armedModeEnabled} onCheckedChange={setArmedModeEnabled} disabled={isRunning} />
          </div>
          
          {armedModeEnabled && (
            <>
              <div className="text-xs text-muted-foreground mb-2">
                Ordens limit em níveis de suporte/resistência com stops automáticos
              </div>
              
              {/* Ordens armadas ativas - DESTAQUE VISUAL */}
              {armedOrders.filter(o => o.status === 'armed').length > 0 ? (
                <div className="space-y-2 max-h-32 overflow-y-auto mb-3 p-2 bg-amber-500/10 rounded-lg border-2 border-amber-400/50">
                  <div className="text-xs text-amber-300 font-semibold mb-1">⚡ ORDENS PRONTAS PARA EXECUTAR:</div>
                  {armedOrders.filter(o => o.status === 'armed').slice(0, 5).map((order) => (
                    <div key={order.id} className="flex justify-between items-center text-xs p-2 bg-background/70 rounded border border-amber-400/40 hover:bg-amber-500/20 transition-colors">
                      <span className="font-bold text-amber-200">{order.symbol.replace('USDT', '')}</span>
                      <Badge variant={order.side === 'Buy' ? 'default' : 'destructive'} className="text-[10px] font-semibold">
                        {order.srType === 'support' ? '🟢 SUP' : '🔴 RES'} {order.side}
                      </Badge>
                      <span className="text-amber-300 font-mono">@{order.entryPrice.toFixed(4)}</span>
                      <div className="flex flex-col items-end">
                        <span className="text-red-400 text-[9px]">SL: {order.stopLoss.toFixed(4)}</span>
                        <span className="text-green-400 text-[9px]">TP: {order.takeProfit.toFixed(4)}</span>
                      </div>
                      <span className="text-green-400 font-bold">+${order.expectedProfit.toFixed(2)}</span>
                    </div>
                  ))}
                  <div className="text-[10px] text-amber-400/80 text-center mt-1">
                    💡 Ordens executam automaticamente quando preço atingir nível S/R
                  </div>
                </div>
              ) : (
                <div className="text-xs text-muted-foreground text-center py-3 mb-3 border border-dashed border-amber-500/30 rounded">
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
        </Card>

        {/* 🤖 AI Trading Intelligence */}
        <Card className="p-4 bg-gradient-to-br from-purple-500/10 to-pink-500/10 border-purple-500/20 mb-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-purple-400" />
              <span className="text-sm font-medium">AI Trading Intelligence</span>
              {lastTrainingTime && (
                <Badge variant="outline" className="text-[10px] text-purple-400">
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
                  <div className="font-bold text-green-400">{aiPatterns?.winRate?.toFixed(1) || '--'}%</div>
                </div>
                
                {/* Baleias */}
                <div className="p-2 bg-background/50 rounded border text-center">
                  <div className="text-[10px] text-muted-foreground">Baleias</div>
                  <div className={`font-bold ${whaleAnalysis?.whaleDirection === 'BULLISH' ? 'text-green-400' : whaleAnalysis?.whaleDirection === 'BEARISH' ? 'text-red-400' : 'text-yellow-400'}`}>
                    {whaleAnalysis?.whaleDirection || '--'}
                  </div>
                </div>
                
                {/* Sentimento */}
                <div className="p-2 bg-background/50 rounded border text-center">
                  <div className="text-[10px] text-muted-foreground">Sentimento</div>
                  <div className={`font-bold ${sentimentAnalysis?.sentiment === 'BULLISH' ? 'text-green-400' : sentimentAnalysis?.sentiment === 'BEARISH' ? 'text-red-400' : 'text-yellow-400'}`}>
                    {sentimentAnalysis?.sentiment || '--'}
                  </div>
                </div>
              </div>
              
              {/* Recomendações */}
              {aiRecommendations && (
                <div className="text-xs text-muted-foreground mb-2 p-2 bg-background/30 rounded">
                  <div className="flex flex-wrap gap-2">
                    <span>Lev: <span className="text-purple-400 font-medium">{aiRecommendations.optimalLeverage}x</span></span>
                    <span>SL: <span className="text-red-400 font-medium">{(aiRecommendations.optimalStopLoss * 100).toFixed(2)}%</span></span>
                    <span>TP: <span className="text-green-400 font-medium">{(aiRecommendations.optimalTakeProfit * 100).toFixed(2)}%</span></span>
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
        </Card>

        {/* 😱 Market Intelligence (Fear & Greed, Events, Whales) */}
        {aiIntelligenceEnabled && (
          <Card className="p-4 bg-gradient-to-br from-amber-500/10 to-orange-500/10 border-amber-500/20 mb-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="text-lg">😱</span>
                <span className="text-sm font-medium">Market Intelligence</span>
                {intelLastUpdate && (
                  <Badge variant="outline" className="text-[10px] text-amber-400">
                    {new Date(intelLastUpdate).toLocaleTimeString()}
                  </Badge>
                )}
              </div>
              {isIntelLoading && <span className="text-xs text-muted-foreground animate-pulse">Atualizando...</span>}
            </div>
            
            <div className="grid grid-cols-3 gap-2 mb-3">
              {/* Fear & Greed */}
              <div className={`p-2 rounded border text-center ${
                fearGreed?.sentiment === 'EXTREME_FEAR' || fearGreed?.sentiment === 'FEAR' 
                  ? 'bg-red-500/10 border-red-500/30' 
                  : fearGreed?.sentiment === 'EXTREME_GREED' || fearGreed?.sentiment === 'GREED'
                    ? 'bg-green-500/10 border-green-500/30'
                    : 'bg-background/50'
              }`}>
                <div className="text-[10px] text-muted-foreground">Fear & Greed</div>
                <div className={`font-bold text-lg ${
                  (fearGreed?.value || 50) <= 30 ? 'text-red-400' : 
                  (fearGreed?.value || 50) >= 70 ? 'text-green-400' : 'text-yellow-400'
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
              <div className="text-xs p-2 bg-background/30 rounded border-l-2 border-amber-500/50">
                <span className="text-amber-400 font-medium">💡 Conselho: </span>
                {fearGreed.tradingAdvice}
              </div>
            )}
            
            {/* High Impact Events Warning */}
            {marketEvents.filter(e => e.impact === 'HIGH').length > 0 && (
              <div className="mt-2 text-xs p-2 bg-red-500/10 rounded border border-red-500/20">
                <div className="text-red-400 font-medium mb-1">⚠️ Eventos de Alto Impacto:</div>
                {marketEvents.filter(e => e.impact === 'HIGH').slice(0, 2).map((e, i) => (
                  <div key={i} className="text-[10px] text-muted-foreground">• {e.title}</div>
                ))}
              </div>
            )}
          </Card>
        )}

        {/* Opções Avançadas */}
        <Card className="p-4 bg-background/50 mb-4">
          <div className="text-sm font-medium mb-3">⚙️ Opções Avançadas</div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
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
        </Card>

        {/* Recent Trades */}
        {activeTrades.length > 0 && (
          <Card className="p-4 bg-background/50">
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
          </Card>
        )}
      </Card>
    </div>
  );
};

export default MultiAssetTrader;
