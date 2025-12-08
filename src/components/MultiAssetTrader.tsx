import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Play, Square, Zap, DollarSign, TrendingUp, Target, Network, Brain, ShieldAlert, Clock, Wallet } from "lucide-react";
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
import { getUserId } from "@/lib/anonymousUser";

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
  const { checkNewPosition, getCorrelationRisk } = useCorrelationAnalysis();
  const { processOpenPositions, clearPositionState, getAdaptiveTrailingConfig } = useSmartExitManager();
  const { addTradeToBuffer, triggerFullTraining, getMLRecommendations } = useContinuousMLTraining();
  const { 
    getLeverageForScalping, getLeverageForBalance, calculatePositionSize,
    calculateDynamicTrailingStop, calculateValidQuantity, calculateStopTakeProfit
  } = useTradingCalculations();
  const {
    currentBalance, setCurrentBalance, openPositionsCount, setOpenPositionsCount,
    lastSyncTime, top10VolatileAssets, syncBybitBalance, syncOpenPositions, fetchTop10VolatileAssets
  } = useBybitSync();
  const { analyzeSignal } = useSignalAnalysis();
  const { isPatternBlocked, recordTradeResult, getBlockedStats, blockedCount } = useLosingPatternBlocker();
  
  const lastMLCheck = useRef<number>(0);
  const lastClosedPositionsRef = useRef<string[]>([]);

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
          
          // 🚫 Registrar resultado para bloqueio de padrão perdedor
          recordTradeResult(
            trade.symbol,
            trade.side,
            trade.leverage || 10,
            trade.realized_pnl || 0
          );
        }
      }

      lastClosedPositionsRef.current = currentIds;
      const recent20 = closedPositions.slice(0, 20);
      const wins = recent20.filter(t => (t.realized_pnl || 0) > 0).length;
      setHistoricalWinRate((wins / recent20.length) * 100);
    }
  }, [closedPositions, addTradeToBuffer]);

  // Restaurar estado
  useEffect(() => {
    const restoreTraderState = async () => {
      const userId = await getUserId();
      const { data: mlData } = await supabase
        .from('ml_adaptive_config')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (mlData?.is_enabled) {
        setMlConfig(mlData);
        console.log('🧠 ML Adaptativo ATIVADO');
      }

      const { data: config } = await supabase
        .from('auto_trader_config')
        .select('trader_is_running, last_activity_at')
        .eq('user_id', userId)
        .single();

      if (config?.trader_is_running) {
        const lastActivity = new Date(config.last_activity_at || Date.now()).getTime();
        if (Date.now() - lastActivity < 5 * 60 * 1000) {
          setIsRunning(true);
          toast({ title: "🔄 Trader Restaurado", description: "Operações continuam automaticamente" });
        } else {
          await supabase.from('auto_trader_config').update({ trader_is_running: false }).eq('user_id', userId);
        }
      }
    };
    restoreTraderState();
  }, []);

  // Smart exits
  const updateSmartExits = async () => {
    if (!smartExitEnabled && !trailingStopEnabled) return;
    
    try {
      const { data, error } = await supabase.functions.invoke('bybit-trading', {
        body: { action: 'get_positions', isTestnet: false, params: { category: 'linear', settleCoin: 'USDT' } }
      });

      if (error || !data?.success) return;

      const positions = data.data?.list || [];
      const openPositionsData = positions.filter((p: any) => parseFloat(p.size) > 0);
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

      // Limpar tracking de posições fechadas
      const openSymbols = new Set(openPositionsData.map((p: any) => p.symbol));
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
      await syncBybitBalance();
      await syncOpenPositions();
      await fetchTop10VolatileAssets();

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

      if (instrumentsError || !instrumentsData?.success) return;

      const instruments = instrumentsData.data.list || [];
      const tradableAssets = instruments.filter((inst: any) => inst.status === 'Trading' && inst.quoteCoin === 'USDT');

      const { data: tickerData } = await supabase.functions.invoke('bybit-trading', {
        body: { action: 'get_ticker', isTestnet: false, params: { category: 'linear' } }
      });

      const tickers = tickerData?.data?.list || [];
      
      // Filtrar e ordenar por volatilidade
      const assetsWithVolatility = tradableAssets.map((instrument: any) => {
        const ticker = tickers.find((t: any) => t.symbol === instrument.symbol);
        const priceChange = parseFloat(ticker?.price24hPcnt || '0') * 100;
        const volume24h = parseFloat(ticker?.turnover24h || '0');
        return { instrument, ticker, volatility: Math.abs(priceChange), priceChange, volume24h };
      }).filter(a => {
        const isInTop10 = top10VolatileAssets.has(a.instrument.symbol);
        return isInTop10 ? (a.volatility > 0.1 && a.volume24h > 50000) : (a.volatility > 0.3 && a.volume24h > 200000);
      });
      
      const topVolatileAssets = assetsWithVolatility.sort((a, b) => b.volatility - a.volatility).slice(0, 50);

      let shouldStopTrading = false;
      
      for (const assetData of topVolatileAssets) {
        if (!isRunning || shouldStopTrading) break;

        const { instrument, ticker, volatility, priceChange, volume24h } = assetData;
        const symbol = instrument.symbol;
        const isScalpAsset = top10VolatileAssets.has(symbol);
        
        try {
          const currentPrice = parseFloat(ticker.lastPrice);
          const highPrice = parseFloat(ticker.highPrice24h);
          const lowPrice = parseFloat(ticker.lowPrice24h);
          
          // ML nas decisões - ULTRA AGRESSIVO
          let scoreThreshold = 25; // Muito baixo para entrar em mais operações
          let minConfirmations = 1;
          
          if (mlDecisionsEnabled && mlConfig?.is_enabled) {
            const patterns = mlConfig.optimal_patterns || {};
            if (patterns.bestSymbols?.includes(symbol)) scoreThreshold -= 10;
            const currentHour = new Date().getUTCHours();
            if (patterns.bestHours?.includes(currentHour)) scoreThreshold -= 5;
          }
          
          // Mínimo score de 15
          scoreThreshold = Math.max(15, scoreThreshold);
          
          const analysisResult = analyzeSignal({
            currentPrice, highPrice, lowPrice, priceChange, volume24h, volatility,
            scoreThreshold, minConfirmations, currentBalance
          });

          if (!analysisResult.shouldTrade || !analysisResult.action) continue;

          // Calcular alavancagem antes de verificar padrão
          const maxLeverageInstrument = parseFloat(instrument.leverageFilter?.maxLeverage || '25');
          let dynamicLeverage = isScalpAsset
            ? Math.min(getLeverageForScalping(volatility), maxLeverageInstrument)
            : Math.min(getLeverageForBalance(currentBalance, historicalWinRate), maxLeverageInstrument);
          
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

          // Verificar correlação
          const correlationCheck = checkNewPosition(symbol, analysisResult.action === 'BUY' ? 'Buy' : 'Sell');
          if (!correlationCheck.allowed) {
            console.log(`🚫 ${symbol}: ${correlationCheck.reason}`);
            continue;
          }

          // Calcular tamanho da posição
          const FEE_BUFFER = 0.001;
          const safeBalance = Math.max(0, currentBalance - 0.5);
          const baseAllocation = currentBalance < 5 ? 0.70 : (isScalpAsset ? 0.80 : 0.65);
          const positionValue = safeBalance * baseAllocation * leverage;
          let usdSize = positionValue;

          // Martingale
          if (martingaleEnabled && lossStreak >= 2) {
            const multiplier = Math.min(Math.pow(2, lossStreak - 1), 3);
            usdSize *= multiplier;
          }

          // Calcular quantidade
          const lotSizeFilter = instrument.lotSizeFilter || {};
          const minOrderQty = parseFloat(lotSizeFilter.minOrderQty || '0.01');
          const qtyStep = parseFloat(lotSizeFilter.qtyStep || '0.01');
          const maxOrderQty = parseFloat(lotSizeFilter.maxOrderQty || '10000');

          const { qty, qtyStr, orderValueUSD } = calculateValidQuantity(
            usdSize, currentPrice, leverage, minOrderQty, qtyStep, maxOrderQty
          );

          if (parseFloat(orderValueUSD) < 5) continue;

          // Calcular SL/TP
          const priceRange = highPrice - lowPrice;
          const atrPercent = (priceRange / currentPrice) * 100;
          const { stopLoss, takeProfit, stopLossPct, takeProfitPct } = calculateStopTakeProfit(
            currentPrice, analysisResult.action, atrPercent, isScalpAsset, mlConfig
          );

          // Verificar saldo
          const { data: balanceCheck } = await supabase.functions.invoke('bybit-trading', {
            body: { action: 'get_balance', isTestnet: false, params: { accountType: 'UNIFIED' } }
          });
          
          const freshBalance = parseFloat(balanceCheck?.data?.list?.[0]?.totalAvailableBalance || '0');
          const requiredMargin = (parseFloat(orderValueUSD) / leverage) * (1 + FEE_BUFFER);

          if (freshBalance < 0 || freshBalance < requiredMargin + 0.5) {
            if (freshBalance < 0) {
              setIsRunning(false);
              shouldStopTrading = true;
              toast({ title: "🛑 Trader Pausado", description: "Saldo negativo", variant: "destructive" });
              break;
            }
            continue;
          }

          // Configurar alavancagem
          let finalLeverage = leverage;
          let leverageSuccess = false;
          
          for (let attempts = 0; attempts < 3 && !leverageSuccess; attempts++) {
            const { error } = await supabase.functions.invoke('bybit-trading', {
              body: {
                action: 'set_leverage', isTestnet: false,
                params: { category: 'linear', symbol, buyLeverage: finalLeverage.toString(), sellLeverage: finalLeverage.toString() }
              }
            });
            
            if (!error) {
              leverageSuccess = true;
            } else {
              finalLeverage = Math.max(Math.floor(finalLeverage * 0.7), 10);
            }
          }
          
          if (!leverageSuccess) continue;

          // Executar ordem
          const { data: orderData, error: orderError } = await supabase.functions.invoke('bybit-trading', {
            body: {
              action: 'place_order', isTestnet: false,
              params: {
                category: 'linear', symbol,
                side: analysisResult.action === 'BUY' ? 'Buy' : 'Sell',
                orderType: 'Market', qty: qtyStr,
                stopLoss, takeProfit,
                timeInForce: 'GTC', positionIdx: 0, reduceOnly: false
              }
            }
          });

          if (!orderError && orderData?.success) {
            console.log(`✅ TRADE: ${symbol} ${analysisResult.action} | ${finalLeverage}x | $${usdSize.toFixed(2)}`);
            
            const saveUserId = await getUserId();
            await supabase.from('auto_trader_positions').insert({
              user_id: saveUserId, symbol,
              side: analysisResult.action === 'BUY' ? 'Buy' : 'Sell',
              entry_price: currentPrice, qty, leverage: finalLeverage,
              stop_loss: parseFloat(stopLoss), take_profit: parseFloat(takeProfit),
              trailing_stop_percentage: calculateDynamicTrailingStop(volatility),
              highest_price: currentPrice, volatility,
              partial_tp_executed: false, original_quantity: qty,
              confidence: analysisResult.signalScore, status: 'OPEN',
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
            setOpenPositionsCount(prev => prev + 1);
            
            toast({ title: `${isScalpAsset ? '⚡ SCALP' : '✅ TRADE'} ${symbol}`, description: `${analysisResult.action} ${finalLeverage}x | $${usdSize.toFixed(0)}` });
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

          await new Promise(resolve => setTimeout(resolve, 2000));
        } catch (error) {
          console.error(`Erro ao processar ${symbol}:`, error);
        }
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
    
    return () => {
      clearInterval(interval);
      clearInterval(exitInterval);
    };
  }, [isRunning]);

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
          const addQty = (tracking?.originalQty || position.qty) * 0.5;
          
          const { data: addOrder, error } = await supabase.functions.invoke('bybit-trading', {
            body: {
              action: 'place_order', isTestnet: false,
              params: {
                category: 'linear', symbol: position.symbol, side: position.side,
                orderType: 'Market', qty: addQty.toString(),
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

  const startTrading = async () => {
    setIsRunning(true);
    setConsecutiveLosses(0);
    
    const userId = await getUserId();
    await supabase.from('auto_trader_config').upsert({
      user_id: userId, trader_is_running: true, is_active: true, last_activity_at: new Date().toISOString()
    }, { onConflict: 'user_id' });

    toast({ title: "🚀 Trader iniciado", description: "Buscando oportunidades..." });
  };

  const stopTrading = async () => {
    setIsRunning(false);
    
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
                if (data.success) {
                  setMlConfig(data.config);
                  toast({ title: "🧠 ML Configurado!", description: `Leverage: ${data.recommendations.leverage}x` });
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

        {/* 🚫 Bloqueio de Padrões Perdedores */}
        <Card className="p-4 bg-gradient-to-br from-red-500/10 to-orange-500/10 border-red-500/20 mb-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-red-400" />
              <span className="text-sm font-medium">Bloqueio de Padrões</span>
            </div>
            {blockedCount > 0 && (
              <Badge variant="destructive" className="text-xs">
                {blockedCount} bloqueados
              </Badge>
            )}
          </div>
          
          <p className="text-xs text-muted-foreground mb-3">
            Bloqueia automaticamente símbolos, horários e alavancagens que geram perdas consecutivas.
          </p>

          {(() => {
            const stats = getBlockedStats();
            return (
              <div className="space-y-2 text-xs">
                {stats.blockedSymbols.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    <span className="text-muted-foreground">Símbolos:</span>
                    {stats.blockedSymbols.map(s => (
                      <Badge key={s} variant="outline" className="text-red-400 border-red-500/30">{s}</Badge>
                    ))}
                  </div>
                )}
                {stats.blockedHours.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    <span className="text-muted-foreground">Horários:</span>
                    {stats.blockedHours.map(h => (
                      <Badge key={h} variant="outline" className="text-orange-400 border-orange-500/30">{h}:00 UTC</Badge>
                    ))}
                  </div>
                )}
                {stats.totalBlocked === 0 && (
                  <p className="text-green-400">✓ Nenhum padrão bloqueado</p>
                )}
              </div>
            );
          })()}
        </Card>

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
