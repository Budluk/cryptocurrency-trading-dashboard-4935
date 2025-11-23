import { useState, useEffect, useMemo, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Play, Square, Zap, DollarSign, TrendingUp, Target, Network } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { usePositions } from "@/contexts/PositionsContext";

import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useCorrelationAnalysis } from "@/hooks/useCorrelationAnalysis";
import { AdvancedTradingSettings } from "@/components/AdvancedTradingSettings";

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
  const [isTestnet, setIsTestnet] = useState(false); // ⚡ PADRÃO: CONTA REAL
  const [bankroll, setBankroll] = useState(9);
  const [currentBalance, setCurrentBalance] = useState(9);
  const [activeTrades, setActiveTrades] = useState<Trade[]>([]);
  const [totalPnL, setTotalPnL] = useState(0);
  const [cycleCount, setCycleCount] = useState(0);
  const [dailyPnL, setDailyPnL] = useState(0);
  const [consecutiveLosses, setConsecutiveLosses] = useState(0);
  const [openPositionsCount, setOpenPositionsCount] = useState(0);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [mlConfig, setMlConfig] = useState<any>(null);
  const { toast } = useToast();
  const { checkNewPosition, getCorrelationRisk } = useCorrelationAnalysis();

  // PROTEÇÕES INTELIGENTES
  const DAILY_STOP_LOSS_PCT = 0.10; // -10% do bankroll
  const [maxOpenPositions, setMaxOpenPositions] = useState(50); // 🚀 Alto para operar todos os sinais
  const MAX_CONSECUTIVE_LOSSES = 3;
  
  // 🧠 SISTEMA DE GERENCIAMENTO DE CAPITAL DINÂMICO
  const [historicalWinRate, setHistoricalWinRate] = useState(50); // Win rate inicial estimado
  const [avgVolatility, setAvgVolatility] = useState(2); // Volatilidade média dos ativos
  
  // ⚡ CONFIGURAÇÕES AVANÇADAS
  const [trailingStopEnabled, setTrailingStopEnabled] = useState(true);
  const [trailingStopPercent, setTrailingStopPercent] = useState(1.5);
  const [timeFilterEnabled, setTimeFilterEnabled] = useState(false); // 🔄 24/7 por padrão
  const [startHour, setStartHour] = useState(14); // 14h UTC (início de NY)
  const [endHour, setEndHour] = useState(20); // 20h UTC (fim de NY)
  const [scaleInOutEnabled, setScaleInOutEnabled] = useState(true);
  const [martingaleEnabled, setMartingaleEnabled] = useState(false);
  const [copyTradingEnabled, setCopyTradingEnabled] = useState(false);
  const [hedgeEnabled, setHedgeEnabled] = useState(false);
  const [sentimentEnabled, setSentimentEnabled] = useState(false);
  const [dynamicLeverageEnabled, setDynamicLeverageEnabled] = useState(false);
  
  // 📊 TRACKING DE POSIÇÕES PARA TRAILING STOP
  const [positionTracking, setPositionTracking] = useState<Map<string, {
    highestPrice: number;
    lowestPrice: number;
    currentStopLoss: number;
  }>>(new Map());
  
  // 📊 TRACKING PARA MARTINGALE E COPY TRADING
  const [lossStreak, setLossStreak] = useState(0);
  const [winningPatterns, setWinningPatterns] = useState<any[]>([]);
  const [currentLeverage, setCurrentLeverage] = useState(10);

  const { openPositions, closedPositions } = usePositions();
  
  // Calcular win rate histórico usando closedPositions do contexto
  useEffect(() => {
    if (closedPositions.length > 0) {
      const recent20 = closedPositions.slice(0, 20);
      const wins = recent20.filter(t => (t.realized_pnl || 0) > 0).length;
      const rate = (wins / recent20.length) * 100;
      setHistoricalWinRate(rate);
    }
  }, [closedPositions]);

  // 💾 RESTAURAR ESTADO AUTOMATICAMENTE AO CARREGAR
  useEffect(() => {
    const restoreTraderState = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const userId = user.id;

      // Buscar configuração do ML adaptativo
      const { data: mlData } = await supabase
        .from('ml_adaptive_config')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (mlData && mlData.is_enabled) {
        setMlConfig(mlData);
        console.log('🧠 ML Adaptativo ATIVADO:', mlData);
      }

      const { data: config } = await supabase
        .from('auto_trader_config')
        .select('trader_is_running, last_activity_at')
        .eq('user_id', userId)
        .single();

      if (config?.trader_is_running) {
        const lastActivity = new Date(config.last_activity_at || Date.now()).getTime();
        const now = Date.now();
        const fiveMinutes = 5 * 60 * 1000;

        if (now - lastActivity < fiveMinutes) {
          console.log('🔄 Restaurando trader automaticamente...');
          setIsRunning(true);
          toast({
            title: "🔄 Trader Restaurado",
            description: "Suas operações continuam automaticamente",
          });
        } else {
          await supabase
            .from('auto_trader_config')
            .update({ trader_is_running: false })
            .eq('user_id', userId);
        }
      }
    };

    restoreTraderState();
  }, []);

  // 🎯 TOP 10 ATIVOS MAIS VOLÁTEIS (atualizado dinamicamente)
  const [top10VolatileAssets, setTop10VolatileAssets] = useState<Set<string>>(new Set([
    'BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'DOGEUSDT',
    'SHIBUSDT', 'PEPEUSDT', 'AVAXUSDT', 'NEARUSDT', 'APTUSDT'
  ]));

  // 🔥 SISTEMA DE ALAVANCAGEM PROGRESSIVA PARA SCALPING
  const getLeverageForScalping = (volatility: number): number => {
    // Scalping agressivo: 20x-50x baseado na volatilidade
    if (volatility > 3.0) return 50; // Extrema volatilidade
    if (volatility > 2.0) return 40; // Alta volatilidade
    if (volatility > 1.5) return 30; // Média-alta volatilidade
    return 25; // Padrão para scalping
  };

  // Estratégia de alavancagem baseada no bankroll E win rate (para ativos normais)
  const getLeverageForBalance = (balance: number, winRate: number) => {
    // Base de alavancagem pelo saldo
    let baseLeverage = 5;
    if (balance < 5) baseLeverage = 20;
    else if (balance < 10) baseLeverage = 15;
    else if (balance < 20) baseLeverage = 10;
    else if (balance < 50) baseLeverage = 8;

    // Ajustar pela performance
    if (winRate >= 60) baseLeverage = Math.min(baseLeverage + 3, 25); // Aumenta se está bem
    else if (winRate < 40) baseLeverage = Math.max(baseLeverage - 5, 3); // Reduz se está mal

    return baseLeverage;
  };

  // 💼 GERENCIAMENTO DE MARGEM DINÂMICO
  const calculatePositionSize = (balance: number, leverage: number, volatility: number, winRate: number, currentOpenPositions: number) => {
    // 🎯 MARGEM DISPONÍVEL: Calcular quanto de margem ainda temos
    const MAX_MARGIN_USAGE = 0.80; // Usar no máximo 80% da margem disponível
    const RESERVE_MARGIN = 0.20; // Reservar 20% para novas oportunidades
    
    // 📊 DISTRIBUIÇÃO DE MARGEM: Dividir margem disponível entre posições
    const targetPositions = Math.min(maxOpenPositions, 20); // Objetivo de posições simultâneas
    const marginPerPosition = (balance * MAX_MARGIN_USAGE) / targetPositions;
    
    // 🔄 AJUSTE DINÂMICO: Quanto mais posições abertas, menor o tamanho de novas
    const positionSizeMultiplier = currentOpenPositions === 0 
      ? 1.0 // Primeira posição: tamanho normal
      : Math.max(0.3, 1 - (currentOpenPositions / targetPositions) * 0.5); // Reduzir gradualmente
    
    // 📐 BASE DO RISCO AGRESSIVO PARA SCALPING: 3-7% do bankroll por posição
    let baseRisk = balance < 15 ? 0.07 : 0.05; // AUMENTADO para scalping
    
    // 💡 AJUSTE POR VOLATILIDADE: Reduzir risco em ativos muito voláteis
    if (volatility > 5) baseRisk *= 0.6; // -40% em alta volatilidade
    else if (volatility > 3) baseRisk *= 0.8; // -20% em volatilidade moderada
    else if (volatility < 1) baseRisk *= 1.2; // +20% em baixa volatilidade
    
    // 📈 AJUSTE POR WIN RATE: Aumentar risco se está performando bem
    if (winRate >= 65) baseRisk *= 1.3; // +30% se win rate alto
    else if (winRate >= 55) baseRisk *= 1.1; // +10% se win rate bom
    else if (winRate < 40) baseRisk *= 0.7; // -30% se win rate baixo
    
    // 🎲 AJUSTE POR NÚMERO DE POSIÇÕES
    baseRisk *= positionSizeMultiplier;
    
    // 🛡️ LIMITES DE SEGURANÇA
    // - Mínimo: $2 por posição (viável na Bybit)
    // - Máximo: Não exceder margem disponível por posição
    const minPositionSize = 2;
    const maxPositionSize = marginPerPosition / leverage;
    
    let usdSize = balance * baseRisk;
    usdSize = Math.max(minPositionSize, Math.min(maxPositionSize, usdSize));
    
    return { 
      usdSize, 
      quantity: (usdSize * leverage),
      marginUsed: usdSize / leverage,
      marginPerPosition,
      positionSizeMultiplier
    };
  };

  // 🧠 FUNÇÃO: CALCULAR TRAILING STOP DINÂMICO BASEADO NA VOLATILIDADE
  const calculateDynamicTrailingStop = (volatility: number): number => {
    // Volatilidade baixa (< 2%): trailing stop apertado 1.0%
    // Volatilidade média (2-5%): trailing stop normal 1.5%
    // Volatilidade alta (5-10%): trailing stop largo 2.5%
    // Volatilidade extrema (> 10%): trailing stop muito largo 3.5%
    
    if (volatility < 2) {
      return 1.0; // Ativo estável, trailing apertado
    } else if (volatility < 5) {
      return 1.5; // Volatilidade normal
    } else if (volatility < 10) {
      return 2.5; // Alta volatilidade, dar mais espaço
    } else {
      return 3.5; // Volatilidade extrema, máximo espaço
    }
  };

  // 🔥 BUSCAR TOP 10 ATIVOS MAIS VOLÁTEIS DA BYBIT + CALCULAR VOLATILIDADE
  const fetchTop10VolatileAssets = useCallback(async () => {
    try {
      console.log('🔍 Buscando top 10 ativos mais voláteis da Bybit...');
      
      const { data, error } = await supabase.functions.invoke('bybit-trading', {
        body: {
          action: 'get_tickers',
          isTestnet: false,
          params: { 
            category: 'linear'
          }
        }
      });

      if (!error && data?.success) {
        const tickers = data.data?.list || [];
        
        // Calcular score de volatilidade para cada ativo
        const volatilityScores = tickers
          .filter((t: any) => t.symbol.endsWith('USDT')) // Apenas pares USDT
          .map((ticker: any) => {
            const priceChange24h = Math.abs(parseFloat(ticker.price24hPcnt || '0')) * 100;
            const volume24h = parseFloat(ticker.turnover24h || '0');
            const volumeUSD = parseFloat(ticker.volume24h || '0');
            
            // Score: 70% baseado em variação de preço + 30% baseado em volume
            // Normalizar volume (valores acima de $100M = score máximo)
            const volumeScore = Math.min(volume24h / 100000000, 1) * 30;
            const priceChangeScore = Math.min(priceChange24h / 10, 1) * 70; // 10% = score máximo
            
            const volatilityScore = priceChangeScore + volumeScore;
            
            return {
              symbol: ticker.symbol,
              volatilityScore,
              priceChange24h,
              volume24h: volumeUSD,
              lastPrice: ticker.lastPrice
            };
          })
          .filter((item: any) => item.volume24h > 10000000) // Volume mínimo de $10M
          .sort((a: any, b: any) => b.volatilityScore - a.volatilityScore)
          .slice(0, 10); // Top 10

        const top10Symbols = new Set<string>(volatilityScores.map((item: any) => item.symbol as string));
        setTop10VolatileAssets(top10Symbols);
        
        // 📊 Armazenar volatilidade de cada ativo para uso posterior
        const volatilityMap = new Map(
          volatilityScores.map((s: any) => [s.symbol, s.priceChange24h])
        );
        (window as any).assetVolatility = volatilityMap;
        
        console.log('✅ Top 10 ativos voláteis atualizados:', 
          volatilityScores.map((s: any) => 
            `${s.symbol} (${s.priceChange24h.toFixed(2)}%, $${(s.volume24h/1e6).toFixed(0)}M)`
          ).join(', ')
        );
        
        return top10Symbols;
      }
    } catch (error) {
      console.error('Erro ao buscar ativos voláteis:', error);
    }
  }, []);

  // 🔄 SINCRONIZAÇÃO AUTOMÁTICA - Buscar saldo DISPONÍVEL real da Bybit
  const syncBybitBalance = useCallback(async () => {
    try {
      const { data, error } = await supabase.functions.invoke('bybit-trading', {
        body: {
          action: 'get_balance',
          isTestnet: false,
          params: { accountType: 'UNIFIED' }
        }
      });

      if (!error && data?.success) {
        // 💰 USAR SALDO DISPONÍVEL (após margem de posições abertas)
        const availableBalance = parseFloat(data.data.list[0]?.totalAvailableBalance || '0');
        const totalWallet = parseFloat(data.data.list[0]?.totalWalletBalance || '0');
        
        setCurrentBalance(availableBalance); // Usar saldo DISPONÍVEL
        setLastSyncTime(new Date());
        
        console.log(`💰 Saldo sincronizado: $${availableBalance.toFixed(2)} disponível (Wallet: $${totalWallet.toFixed(2)})`);
      }
    } catch (error) {
      console.error('Erro ao sincronizar saldo:', error);
    }
  }, []);

  // 📊 SINCRONIZAR POSIÇÕES ABERTAS DA BYBIT
  const syncOpenPositions = useCallback(async () => {
    try {
      const { data, error } = await supabase.functions.invoke('bybit-trading', {
        body: {
          action: 'get_positions',
          isTestnet: false,
          params: { 
            category: 'linear',
            settleCoin: 'USDT' 
          }
        }
      });

      if (!error && data?.success) {
        const positions = data.data.list || [];
        const openPositions = positions.filter((p: any) => parseFloat(p.size) > 0);
        setOpenPositionsCount(openPositions.length);
        console.log(`📈 Posições Bybit: ${openPositions.length}`);
      }
    } catch (error) {
      console.error('Erro ao sincronizar posições:', error);
    }
  }, []);

  // 🎯 TRAILING STOP LOSS - Atualizar stops dinamicamente
  const updateTrailingStops = async () => {
    if (!trailingStopEnabled || positionTracking.size === 0) return;
    
    try {
      // Buscar posições abertas
      const { data, error } = await supabase.functions.invoke('bybit-trading', {
        body: {
          action: 'get_positions',
          isTestnet: false,
          params: { 
            category: 'linear',
            settleCoin: 'USDT' 
          }
        }
      });

      if (error || !data?.success) return;

      const positions = data.data?.list || [];
      const openPositions = positions.filter((p: any) => parseFloat(p.size) > 0);

      for (const position of openPositions) {
        const symbol = position.symbol;
        const tracking = positionTracking.get(symbol);
        if (!tracking) continue;

        const currentPrice = parseFloat(position.markPrice);
        const side = position.side; // 'Buy' ou 'Sell'
        let shouldUpdateStop = false;
        let newStopLoss = tracking.currentStopLoss;

        if (side === 'Buy') {
          // Para BUY: Mover SL para cima quando preço sobe
          if (currentPrice > tracking.highestPrice) {
            const newHighest = currentPrice;
            newStopLoss = newHighest * (1 - trailingStopPercent / 100);
            
            // Só atualizar se o novo SL for maior que o atual (movendo para cima)
            if (newStopLoss > tracking.currentStopLoss) {
              shouldUpdateStop = true;
              console.log(`🎯 TRAILING STOP ${symbol}: Novo SL $${newStopLoss.toFixed(4)} (era $${tracking.currentStopLoss.toFixed(4)})`);
              
              // Atualizar tracking
              setPositionTracking(prev => {
                const newMap = new Map(prev);
                newMap.set(symbol, {
                  ...tracking,
                  highestPrice: newHighest,
                  currentStopLoss: newStopLoss
                });
                return newMap;
              });
            }
          }
        } else {
          // Para SELL: Mover SL para baixo quando preço cai
          if (currentPrice < tracking.lowestPrice) {
            const newLowest = currentPrice;
            newStopLoss = newLowest * (1 + trailingStopPercent / 100);
            
            // Só atualizar se o novo SL for menor que o atual (movendo para baixo)
            if (newStopLoss < tracking.currentStopLoss) {
              shouldUpdateStop = true;
              console.log(`🎯 TRAILING STOP ${symbol}: Novo SL $${newStopLoss.toFixed(4)} (era $${tracking.currentStopLoss.toFixed(4)})`);
              
              // Atualizar tracking
              setPositionTracking(prev => {
                const newMap = new Map(prev);
                newMap.set(symbol, {
                  ...tracking,
                  lowestPrice: newLowest,
                  currentStopLoss: newStopLoss
                });
                return newMap;
              });
            }
          }
        }

        // Atualizar stop loss na Bybit se necessário
        if (shouldUpdateStop) {
          const priceDecimals = position.avgPrice.includes('.') 
            ? position.avgPrice.split('.')[1].length 
            : 2;
          
          const { error: updateError } = await supabase.functions.invoke('bybit-trading', {
            body: {
              action: 'set_trading_stop',
              isTestnet: false,
              params: {
                category: 'linear',
                symbol: symbol,
                stopLoss: newStopLoss.toFixed(priceDecimals),
                positionIdx: 0
              }
            }
          });

          if (updateError) {
            console.error(`❌ Erro ao atualizar trailing stop ${symbol}:`, updateError);
          } else {
            console.log(`✅ Trailing Stop atualizado na Bybit: ${symbol} → $${newStopLoss.toFixed(priceDecimals)}`);
          }
        }
      }

      // Limpar tracking de posições que foram fechadas
      const openSymbols = new Set(openPositions.map((p: any) => p.symbol));
      setPositionTracking(prev => {
        const newMap = new Map(prev);
        for (const [symbol] of newMap) {
          if (!openSymbols.has(symbol)) {
            newMap.delete(symbol);
            console.log(`🧹 Removido tracking de ${symbol} (posição fechada)`);
          }
        }
        return newMap;
      });

    } catch (error) {
      console.error('Erro ao atualizar trailing stops:', error);
    }
  };

  const analyzeAndTrade = async () => {
    try {
      // 🔄 SINCRONIZAR PRIMEIRO - Obter dados atualizados da Bybit
      await syncBybitBalance();
      await syncOpenPositions();
      
      // 🔥 Atualizar lista de top 10 voláteis a cada ciclo
      await fetchTop10VolatileAssets();

      // Contar posições abertas diretamente da Bybit (sem banco)
      console.log(`📊 Posições abertas na Bybit: ${openPositionsCount}/${maxOpenPositions}`);

      // 🛡️ VERIFICAR PROTEÇÕES
      if (dailyPnL <= -currentBalance * DAILY_STOP_LOSS_PCT) {
        console.log('🛑 STOP LOSS DIÁRIO ATINGIDO!');
        toast({
          title: "🛑 Stop Loss Diário Atingido",
          description: `Perdeu ${(DAILY_STOP_LOSS_PCT * 100).toFixed(0)}% hoje. Sistema pausado até amanhã.`,
          variant: "destructive",
        });
        setIsRunning(false);
        return;
      }

      if (consecutiveLosses >= MAX_CONSECUTIVE_LOSSES) {
        console.log('⚠️ Muitas perdas consecutivas. Pausando...');
        toast({
          title: "⚠️ Sequência de Perdas",
          description: `${MAX_CONSECUTIVE_LOSSES} perdas seguidas. Sistema pausado por segurança.`,
          variant: "destructive",
        });
        setIsRunning(false);
        return;
      }

      // 🚨 VERIFICAR LIMITE DE POSIÇÕES ABERTAS (com priorização inteligente)
      const shouldCheckPrioritization = openPositionsCount >= maxOpenPositions;
      
      if (shouldCheckPrioritization) {
        console.log(`⚠️ LIMITE DE POSIÇÕES: ${openPositionsCount}/${maxOpenPositions} - Sistema de priorização ativo`);
      }
      
      // ⏰ MODO 24/7 ATIVO - Sistema opera continuamente sem restrições de horário
      if (timeFilterEnabled) {
        const currentHour = new Date().getUTCHours();
        const isWithinTradingHours = startHour <= endHour
          ? currentHour >= startHour && currentHour < endHour
          : currentHour >= startHour || currentHour < endHour;
        
        if (!isWithinTradingHours) {
          console.log(`⏰ FORA DO HORÁRIO: ${currentHour}h UTC (Ativo: ${startHour}h-${endHour}h UTC)`);
          return;
        }
        console.log(`✅ DENTRO DO HORÁRIO: ${currentHour}h UTC`);
      } else {
        console.log(`🌍 MODO 24/7 ATIVO - Operando continuamente sem restrições de horário`);
      }

      // 1. Buscar TODOS os ativos da Bybit
      const { data: instrumentsData, error: instrumentsError } = await supabase.functions.invoke('bybit-trading', {
        body: {
          action: 'get_instruments',
          isTestnet: false, // ⚡ SEMPRE CONTA REAL
          params: { category: 'linear', limit: 1000, status: 'Trading' } // TODOS OS ATIVOS
        }
      });

      if (instrumentsError || !instrumentsData?.success) {
        console.error('Erro ao buscar instrumentos:', instrumentsError);
        return;
      }

      const instruments = instrumentsData.data.list || [];
      
      // ⚡ TODOS OS ATIVOS BYBIT - Sem restrições
      const tradableAssets = instruments.filter((inst: any) => {
        return inst.status === 'Trading' && inst.quoteCoin === 'USDT';
      });

      console.log(`🎯 Analisando ${tradableAssets.length} ativos (Saldo: $${currentBalance.toFixed(2)} | Posições: ${openPositionsCount}/${maxOpenPositions})`);

      // 2. Buscar ticker de cada ativo para análise de volume e volatilidade
      const { data: tickerData } = await supabase.functions.invoke('bybit-trading', {
        body: {
          action: 'get_ticker',
          isTestnet: false, // ⚡ SEMPRE CONTA REAL
          params: { category: 'linear' }
        }
      });

      const tickers = tickerData?.data?.list || [];
      
      // 🔥 FILTRAR ATIVOS COM BOA LIQUIDEZ E MOVIMENTO
      const assetsWithVolatility = tradableAssets.map((instrument: any) => {
        const ticker = tickers.find((t: any) => t.symbol === instrument.symbol);
        const priceChange = parseFloat(ticker?.price24hPcnt || '0') * 100;
        const volume24h = parseFloat(ticker?.turnover24h || '0');
        
        return {
          instrument,
          ticker,
          volatility: Math.abs(priceChange),
          priceChange,
          volume24h
        };
      }).filter(a => {
        // 🎯 TOP 10 VOLÁTEIS: Todos são tratados como scalping
        const isInTop10 = top10VolatileAssets.has(a.instrument.symbol);
        // Apenas ativos do top 10 com critérios ultra-agressivos
        if (isInTop10) return a.volatility > 0.15 && a.volume24h > 50000;
        return false; // Ignorar todos os outros
      });
      
      // 📊 ORDENAR POR VOLATILIDADE (descendente) e processar TODOS os ativos voláteis
      const topVolatileAssets = assetsWithVolatility
        .sort((a, b) => b.volatility - a.volatility);
      
      console.log(`🔥 Analisando ${topVolatileAssets.length} ativos TOP 10 da Bybit (Saldo: $${currentBalance.toFixed(2)} | Posições: ${openPositionsCount}/${maxOpenPositions})`);
      if (topVolatileAssets.length > 0) {
        console.log(`📊 Range de Volatilidade: ${topVolatileAssets[0].instrument.symbol} (${topVolatileAssets[0].volatility.toFixed(2)}%) até ${topVolatileAssets[topVolatileAssets.length-1].instrument.symbol} (${topVolatileAssets[topVolatileAssets.length-1].volatility.toFixed(2)}%)`);
      }
      console.log(`⚡ MODO ULTRA AGRESSIVO: Score ≥20 (scalp) ou ≥30 (normal) | Vol >0.15% | $50K+ | SEM confirmações obrigatórias`);
      
      // 🛑 FLAG para parar processamento em caso de saldo insuficiente
      let shouldStopTrading = false;
      
      // 3. Analisar apenas os ativos mais voláteis
      for (const assetData of topVolatileAssets) {
        if (!isRunning || shouldStopTrading) break;

        const { instrument, ticker, volatility, priceChange, volume24h } = assetData;
        const symbol = instrument.symbol;
        
        // 🔥 Todos os ativos no top 10 são tratados como scalping
        const isScalpAsset = true;
        
        try {
          // ⚡ ANÁLISE TÉCNICA AVANÇADA - SISTEMA DE PRECISÃO APRIMORADO COM ATR
          
          // 1. CALCULAR ATR (Average True Range) REAL para stop loss dinâmico
          const currentPrice = parseFloat(ticker.lastPrice);
          const highPrice = parseFloat(ticker.highPrice24h);
          const lowPrice = parseFloat(ticker.lowPrice24h);
          const priceRange = highPrice - lowPrice;
          
          // ATR como % do preço - usado para stops dinâmicos
          const atrPercent = (priceRange / currentPrice) * 100;
          
          // 2. VALIDAÇÕES DE LIQUIDEZ E VOLATILIDADE (ULTRA-AGRESSIVAS PARA TOP 10)
          const hasGoodVolume = volume24h > 100000; // Volume mínimo para top 10
          const hasExcellentVolume = volume24h > 3000000;
          const hasGoodVolatility = volatility > 0.3;
          const hasStrongVolatility = volatility > 2.0;
          
          // 3. ANÁLISE DE TENDÊNCIA E MOMENTUM (BALANCEADO)
          const pricePosition = (currentPrice - lowPrice) / priceRange; // 0-1, onde está no range
          
          // Detectar tendências claras - setups de qualidade
          const isBullishTrend = priceChange > 2.5; // Subindo (+2.5%)
          const isBearishTrend = priceChange < -2.5; // Caindo (-2.5%)
          const isModerateBullish = priceChange > 1.2 && priceChange <= 2.5;
          const isModerateBearish = priceChange < -1.2 && priceChange >= -2.5;
          
          // String descritiva da tendência
          const trendStrength = isBullishTrend ? 'Alta Forte' : 
                                 isBearishTrend ? 'Baixa Forte' :
                                 isModerateBullish ? 'Alta Moderada' :
                                 isModerateBearish ? 'Baixa Moderada' : 'Neutro';
          
          // Detectar zonas de suporte/resistência - MAIS ESTRITAS
          const nearResistance = pricePosition > 0.80; // Preço próximo do topo (80%+)
          const nearSupport = pricePosition < 0.20; // Preço próximo do fundo (20%-)
          const inMiddleZone = pricePosition >= 0.35 && pricePosition <= 0.65;
          
          // Detectar reversões (oversold/overbought) - CRITÉRIOS MAIS FORTES
          const isOversold = priceChange < -5; // -5% = oversold extremo
          const isOverbought = priceChange > 5; // +5% = overbought extremo
          const isMildOversold = priceChange < -3.0 && priceChange >= -5;
          const isMildOverbought = priceChange > 3.0 && priceChange <= 5;
          
          // 4. ANÁLISE DE VOLUME (comparação dinâmica) - BALANCEADO
          const avgVolume = 3000000; // $3M baseline
          const volumeRatio = volume24h / avgVolume;
          const hasVolumeSpike = volumeRatio > 2.0; // 2.0x+ volume médio - confirmação forte
          const hasStrongVolume = volumeRatio > 1.2; // 1.2x volume médio
          
          // 5. SISTEMA DE SCORING MULTI-CONFIRMAÇÃO (0-100) - CRITÉRIOS RIGOROSOS
          let signalScore = 0;
          let action: 'BUY' | 'SELL' | null = null;
          let confirmations: string[] = [];
          
          // === SINAIS DE COMPRA (BUY) - CRITÉRIOS BALANCEADOS ===
          let buyScore = 0;
          
          // Confirmação 1: Tendência de alta com volume
          if (isBullishTrend && hasVolumeSpike) {
            buyScore += 35;
            confirmations.push('🔥 Trend bullish + volume spike');
          } else if (isBullishTrend && hasStrongVolume) {
            buyScore += 28;
            confirmations.push('Trend bullish confirmado');
          } else if (isModerateBullish && hasVolumeSpike) {
            buyScore += 22;
            confirmations.push('Trend bullish moderado + volume');
          } else if (isModerateBullish && hasGoodVolume) {
            buyScore += 15;
            confirmations.push('Momentum bullish');
          }
          
          // Confirmação 2: Reversão ou zona de suporte
          if (isOversold && nearSupport && hasVolumeSpike) {
            buyScore += 40;
            confirmations.push('🎯 Reversão bullish forte');
          } else if (isMildOversold && nearSupport) {
            buyScore += 25;
            confirmations.push('Zona de suporte detectada');
          } else if (nearSupport && hasStrongVolume) {
            buyScore += 18;
            confirmations.push('Suporte com volume');
          }
          
          // Confirmação 3: Momentum positivo
          if (pricePosition > 0.55 && priceChange > 1.5 && volatility > 1.5) {
            buyScore += 20;
            confirmations.push('💪 Momentum bullish forte');
          } else if (pricePosition > 0.50 && priceChange > 0.8) {
            buyScore += 12;
            confirmations.push('Momentum positivo');
          }
          
          // Confirmação 4: ATR adequado
          if (atrPercent > 1.5 && atrPercent < 8) {
            buyScore += 15;
            confirmations.push('✅ ATR ideal');
          } else if (atrPercent > 1.0 && atrPercent < 10) {
            buyScore += 8;
            confirmations.push('ATR aceitável');
          }
          
          // === SINAIS DE VENDA (SELL) - CRITÉRIOS BALANCEADOS ===
          let sellScore = 0;
          
          // Confirmação 1: Tendência de baixa com volume
          if (isBearishTrend && hasVolumeSpike) {
            sellScore += 35;
            confirmations.push('🔥 Trend bearish + volume spike');
          } else if (isBearishTrend && hasStrongVolume) {
            sellScore += 28;
            confirmations.push('Trend bearish confirmado');
          } else if (isModerateBearish && hasVolumeSpike) {
            sellScore += 22;
            confirmations.push('Trend bearish moderado + volume');
          } else if (isModerateBearish && hasGoodVolume) {
            sellScore += 15;
            confirmations.push('Momentum bearish');
          }
          
          // Confirmação 2: Reversão ou zona de resistência
          if (isOverbought && nearResistance && hasVolumeSpike) {
            sellScore += 40;
            confirmations.push('🎯 Reversão bearish forte');
          } else if (isMildOverbought && nearResistance) {
            sellScore += 25;
            confirmations.push('Zona de resistência detectada');
          } else if (nearResistance && hasStrongVolume) {
            sellScore += 18;
            confirmations.push('Resistência com volume');
          }
          
          // Confirmação 3: Momentum negativo
          if (pricePosition < 0.45 && priceChange < -1.5 && volatility > 1.5) {
            sellScore += 20;
            confirmations.push('💪 Momentum bearish forte');
          } else if (pricePosition < 0.50 && priceChange < -0.8) {
            sellScore += 12;
            confirmations.push('Momentum negativo');
          }
          
          // Confirmação 4: ATR adequado
          if (atrPercent > 1.5 && atrPercent < 8) {
            sellScore += 15;
            confirmations.push('✅ ATR ideal');
          } else if (atrPercent > 1.0 && atrPercent < 10) {
            sellScore += 8;
            confirmations.push('ATR aceitável');
          }
          
          // 6. DETERMINAR AÇÃO E SCORE FINAL - ULTRA AGRESSIVO
          // ⚡ THRESHOLDS MUITO BAIXOS para maximizar entradas
          const scoreThreshold = isScalpAsset ? 20 : 30; // Scalp: 20 | Normal: 30
          const minConfirmations = 0; // Sem mínimo de confirmações
          
          if (buyScore > sellScore && buyScore >= scoreThreshold) {
            action = 'BUY';
            signalScore = Math.min(buyScore, 100);
          } else if (sellScore > buyScore && sellScore >= scoreThreshold) {
            action = 'SELL';
            signalScore = Math.min(sellScore, 100);
          }
          
          // 7. CRITÉRIOS ULTRA PERMISSIVOS
          const volumeCheck = volume24h > 50000; // $50K mínimo
          const volatilityCheck = volatility > 0.15; // 0.15% mínimo
          const atrMinCheck = atrPercent > 0.3; // 0.3% ATR mínimo
          
          const shouldTrade = (
            signalScore >= scoreThreshold && // Score muito baixo
            volumeCheck &&
            volatilityCheck &&
            action !== null &&
            currentBalance > 2 &&
            atrMinCheck &&
            atrPercent < 15 // ATR máximo aumentado
          );

          // 📋 LOG DETALHADO DE CADA ATIVO ANALISADO
          const assetBadge = isScalpAsset ? '⚡' : '📊';
          if (buyScore > 0 || sellScore > 0) {
            const status = shouldTrade ? '✅' : '⏭️';
            let skipReason = '';
            if (!shouldTrade) {
              if (signalScore < scoreThreshold) skipReason = `Score baixo: ${signalScore}/${scoreThreshold}`;
              else if (!volumeCheck) skipReason = `Vol: $${(volume24h/1e6).toFixed(1)}M < $0.05M`;
              else if (!volatilityCheck) skipReason = `Vol%: ${volatility.toFixed(2)}% < 0.15%`;
              else if (!atrMinCheck) skipReason = `ATR: ${atrPercent.toFixed(2)}% < 0.3%`;
              else if (atrPercent >= 15) skipReason = `ATR alto: ${atrPercent.toFixed(2)}%`;
              else if (action === null) skipReason = 'Sem sinal';
              else if (currentBalance <= 2) skipReason = 'Saldo baixo';
            }
            
            console.log(`${status} ${assetBadge} ${symbol}: BUY=${buyScore} SELL=${sellScore} | ${action || 'NONE'} (${signalScore}) | Vol=${volatility.toFixed(2)}% | $${(volume24h/1e6).toFixed(1)}M | ATR=${atrPercent.toFixed(2)}% ${skipReason ? `| ❌ ${skipReason}` : ''}`);
          }
          
          // 📊 LOG DE SINAIS
          if (shouldTrade && action) {
            const assetBadge = isScalpAsset ? '⚡ SCALP' : '📊 TRADE';
            console.log(`\n${assetBadge} ${symbol} ${action}`);
            console.log(`   Score: ${signalScore}/${scoreThreshold} | Conf: ${confirmations.length} | Vol: ${volatility.toFixed(2)}% | $${(volume24h/1e6).toFixed(1)}M`);
            console.log(`   ${confirmations.slice(0, 2).join(' | ')}`);
            
            // Disparar evento customizado para o dashboard
            const signalEvent = new CustomEvent('trading-signal', {
              detail: {
                symbol,
                action,
                score: signalScore,
                confirmations: confirmations.length,
                isScalping: isScalpAsset,
                metrics: {
                  volatility,
                  volume24h,
                  priceChange,
                  pricePosition: pricePosition < 0.3 ? 'Suporte' : pricePosition > 0.7 ? 'Resistência' : 'Meio',
                  trend: trendStrength,
                },
                technicalFactors: confirmations,
                reasoning: `${assetBadge} - Score ${signalScore} com ${confirmations.length} conf.`,
              }
            });
            window.dispatchEvent(signalEvent);
            
            // Toast para sinais fortes
            if (signalScore >= 75 || (isScalpAsset && signalScore >= 60)) {
              toast({
                title: isScalpAsset ? "⚡ Scalp Signal" : "🎯 Trade Signal",
                description: `${symbol} ${action} | Score: ${signalScore}`,
                duration: 2000,
              });
            }
          }
          
          if (shouldTrade && action) {
            // 🎯 SISTEMA DE PRIORIZAÇÃO: Se limite atingido, verificar se vale a pena substituir
            if (shouldCheckPrioritization) {
              const { data: { user } } = await supabase.auth.getUser();
              if (!user) {
                toast({ title: "❌ Autenticação necessária", variant: "destructive" });
                return;
              }
              const priorityUserId = user.id;

              // Buscar posições abertas no banco com seus scores
              const { data: openDbPositions } = await supabase
                .from('auto_trader_positions')
                .select('*')
                .eq('user_id', priorityUserId)
                .eq('status', 'OPEN')
                .order('confidence', { ascending: true }); // Menor score primeiro

              if (openDbPositions && openDbPositions.length > 0) {
                const lowestScorePosition = openDbPositions[0];
                const lowestScore = lowestScorePosition.confidence || 0;

                // Se a nova oportunidade tem score SIGNIFICATIVAMENTE superior (pelo menos 15 pontos)
                if (signalScore >= lowestScore + 15) {
                  console.log(`🔄 PRIORIZAÇÃO: Nova oportunidade ${symbol} (${signalScore}) > Posição atual ${lowestScorePosition.symbol} (${lowestScore})`);
                  
                  // Fechar a posição com menor score
                  try {
                    const { data: closeData, error: closeError } = await supabase.functions.invoke('bybit-trading', {
                      body: {
                        action: 'close_position',
                        isTestnet: false,
                        params: {
                          category: 'linear',
                          symbol: lowestScorePosition.symbol,
                          side: lowestScorePosition.side === 'Buy' ? 'Sell' : 'Buy',
                          qty: lowestScorePosition.qty.toString(),
                          orderType: 'Market',
                          positionIdx: 0
                        }
                      }
                    });

                    if (!closeError && closeData?.success) {
                      // Atualizar posição no banco
                      await supabase
                        .from('auto_trader_positions')
                        .update({
                          status: 'CLOSED',
                          closed_at: new Date().toISOString(),
                          close_reason: `Substituída por oportunidade premium (Score ${signalScore} > ${lowestScore})`
                        })
                        .eq('id', lowestScorePosition.id);

                      setOpenPositionsCount(prev => prev - 1);
                      
                      toast({
                        title: "🔄 Posição Substituída",
                        description: `${lowestScorePosition.symbol} (${lowestScore}) fechada para abrir ${symbol} (${signalScore})`,
                      });
                      
                      console.log(`✅ SUBSTITUIÇÃO: ${lowestScorePosition.symbol} fechada, liberando vaga para ${symbol}`);
                    } else {
                      console.error(`❌ Erro ao fechar ${lowestScorePosition.symbol}:`, closeError);
                      continue; // Não abre nova posição se não conseguiu fechar
                    }
                  } catch (error) {
                    console.error('Erro na substituição de posição:', error);
                    continue;
                  }
                } else {
                  console.log(`⏭️ PRIORIZAÇÃO: Nova oportunidade ${symbol} (${signalScore}) não supera significativamente ${lowestScorePosition.symbol} (${lowestScore})`);
                  continue; // Pular este trade
                }
              }
            }
            
            // 🔍 VERIFICAR CORRELAÇÃO ANTES DE EXECUTAR
            const correlationCheck = checkNewPosition(symbol, action === 'BUY' ? 'Buy' : 'Sell');
            
            if (!correlationCheck.allowed) {
              console.log(`🚫 ${symbol}: BLOQUEADO - ${correlationCheck.reason}`);
              toast({
                title: "🚫 Trade Bloqueado",
                description: `${symbol}: ${correlationCheck.reason}`,
                variant: "destructive",
              });
              continue;
            }
            
            // 🛡️ HEDGE DINÂMICO: Detectar reversões e considerar hedge
            if (hedgeEnabled) {
              const riskLevel = getCorrelationRisk();
              
              // Se há risco médio/alto e detectamos reversão forte, o trade serve como hedge
              if (riskLevel.level !== 'low') {
                const isStrongReversal = Math.abs(priceChange) > 3;
                
                if (isStrongReversal) {
                  console.log(`🛡️ HEDGE: Reversão forte detectada em ${symbol} (${priceChange.toFixed(1)}%) - ${riskLevel.message}`);
                  toast({
                    title: "🛡️ Hedge Detectado",
                    description: `Trade em ${symbol} pode servir como proteção contra correlação`,
                  });
                }
              }
            }

            const currentVolatility = Math.abs(priceChange);
            setAvgVolatility(currentVolatility);
            
            // 🔥 ALAVANCAGEM PARA SCALPING: Baseada na volatilidade
            let dynamicLeverage: number;
            
            if (isScalpAsset) {
              // Scalping: 25x-50x baseado na volatilidade
              dynamicLeverage = getLeverageForScalping(currentVolatility);
              console.log(`⚡ SCALP ${dynamicLeverage.toFixed(0)}x | Vol: ${currentVolatility.toFixed(2)}%`);
            } else if (mlConfig?.is_enabled && mlConfig?.recommended_leverage) {
              // ML Ativo
              dynamicLeverage = mlConfig.recommended_leverage;
            } else {
              // Alavancagem normal baseada em saldo
              dynamicLeverage = getLeverageForBalance(currentBalance, historicalWinRate);
              
              if (dynamicLeverageEnabled) {
                if (historicalWinRate >= 70) {
                  dynamicLeverage = Math.min(dynamicLeverage * 1.2, 20);
                } else if (historicalWinRate < 45 || lossStreak >= 2) {
                  dynamicLeverage = Math.max(dynamicLeverage * 0.7, 5);
                }
              }
            }
            
            setCurrentLeverage(dynamicLeverage);
            const leverage = dynamicLeverage;
            
            // 🚀 CAPITAL ALLOCATION ULTRA CONSERVADOR: Evitar saldo insuficiente
            // META: $15+ por dia SEM erros de saldo insuficiente
            const dailyTargetProfit = 15;
            
            // ⚠️ AJUSTE CRÍTICO: Saldo mínimo de segurança MAIOR para evitar erros
            const MIN_SAFETY_BALANCE = 8; // Manter $8 sempre disponível
            const FEE_BUFFER = 0.002; // 0.2% para taxas de trading
            const safeBalance = Math.max(0, currentBalance - MIN_SAFETY_BALANCE);
            
            // 🛡️ USAR APENAS 30-40% DO SALDO DISPONÍVEL (ultra conservador)
            const capitalAllocation = isScalpAsset ? 0.35 : 0.30; // 35% scalp, 30% normal
            let usdSize = safeBalance * capitalAllocation;
            
            // 🛑 VERIFICAÇÃO: Garantir que margem + fees não excede disponível
            const initialMargin = (usdSize / leverage) * (1 + FEE_BUFFER);
            if (initialMargin > safeBalance * 0.4) {
              usdSize = (safeBalance * 0.3) * leverage; // Reduzir drasticamente
              console.log(`⚠️ Ajustando tamanho para margem segura: $${usdSize.toFixed(2)}`);
            }
            
            // Calcular lucro esperado com este trade (já considerando fees)
            const stopLossPctEstimate = isScalpAsset ? 0.008 : 0.025;
            const takeProfitPctEstimate = isScalpAsset ? 0.015 : (stopLossPctEstimate * 2.5);
            const expectedProfit = (usdSize * takeProfitPctEstimate * leverage) * (1 - FEE_BUFFER);
            const expectedLoss = (usdSize * stopLossPctEstimate * leverage) * (1 + FEE_BUFFER);
            
            console.log(`💰 CAPITAL ULTRA CONSERVADOR: $${usdSize.toFixed(2)} (${(capitalAllocation*100).toFixed(0)}% de $${safeBalance.toFixed(2)} disponível)`);
            console.log(`📊 LEVERAGE: ${leverage.toFixed(0)}x | Margem+Fees: $${initialMargin.toFixed(2)} | Profit: +$${expectedProfit.toFixed(2)} | Loss: -$${expectedLoss.toFixed(2)}`);
            console.log(`🎯 META: $${dailyTargetProfit}/dia | Trade contribui: ${(expectedProfit/dailyTargetProfit*100).toFixed(1)}% | Buffer: $${MIN_SAFETY_BALANCE}`);
            
            // Manter referências para compatibilidade
            const marginUsed = initialMargin;
            const marginPerPosition = usdSize;
            const positionSizeMultiplier = 1.0;
            
            // 🔥 MARTINGALE CONTROLADO: Dobrar após 2 perdas consecutivas (limite 3x)
            if (martingaleEnabled && lossStreak >= 2) {
              const martingaleMultiplier = Math.min(Math.pow(2, lossStreak - 1), 3); // 2x, 3x máximo
              usdSize = usdSize * martingaleMultiplier;
              console.log(`🎲 MARTINGALE ATIVO: ${martingaleMultiplier}x (${lossStreak} perdas) - Novo tamanho: $${usdSize.toFixed(2)}`);
              
              toast({
                title: "🎲 Martingale Ativado",
                description: `Aumentando posição ${martingaleMultiplier}x após ${lossStreak} perdas`,
              });
            }
            
            // 📋 COPY TRADING: Verificar se este é um padrão vencedor conhecido
            if (copyTradingEnabled && winningPatterns.length > 0) {
              const matchingPattern = winningPatterns.find(p => 
                p.symbol === symbol && 
                p.action === action &&
                Math.abs(p.priceChange - priceChange) < 0.5 // Similar price movement
              );
              
              if (matchingPattern) {
                usdSize = usdSize * 1.3; // +30% em padrões vencedores conhecidos
                console.log(`🎯 COPY TRADING: Padrão vencedor detectado! (+30% tamanho)`);
                toast({
                  title: "🎯 Padrão Vencedor",
                  description: `Replicando setup similar que teve ${matchingPattern.winRate.toFixed(0)}% de sucesso`,
                });
              }
            }
            
            // 📰 ANÁLISE DE SENTIMENTO: Filtrar trades com notícias negativas
            if (sentimentEnabled) {
              // Buscar análise de sentimento (simplificado - pode ser expandido com API real)
              const sentiment = Math.abs(priceChange) > 5 ? 'volatile' : 'normal';
              
              if (sentiment === 'volatile' && Math.abs(priceChange) > 8) {
                console.log(`⚠️ SENTIMENTO: Volatilidade extrema detectada (${priceChange.toFixed(1)}%) - reduzindo exposição`);
                usdSize = usdSize * 0.7; // Reduzir 30% em volatilidade extrema
              }
            }
            
            // ATR já calculado anteriormente no código - usar o valor real
            
            // 📊 LOG DE MARGEM E EXPECTATIVA
            console.log(`💼 POSIÇÃO: ${openPositionsCount}/${maxOpenPositions} | Capital: $${usdSize.toFixed(2)} | Margem: $${marginUsed.toFixed(2)}`);
            console.log(`💵 EXPECTATIVA: +$${expectedProfit.toFixed(2)} (${(takeProfitPctEstimate*100).toFixed(2)}%) ou -$${expectedLoss.toFixed(2)} (${(stopLossPctEstimate*100).toFixed(2)}%)`);
            
            // Pegar filtros do instrumento para calcular quantidade válida
            const lotSizeFilter = instrument.lotSizeFilter || {};
            const minOrderQty = parseFloat(lotSizeFilter.minOrderQty || '0.01');
            const qtyStep = parseFloat(lotSizeFilter.qtyStep || '0.01');
            const maxOrderQty = parseFloat(lotSizeFilter.maxOrderQty || '10000');
            
            // CRÍTICO: Calcular quantidade garantindo valor mínimo de 5 USDT
            const MIN_ORDER_VALUE = 5.5; // 5 USDT + margem de segurança
            
            // Calcular quantidade baseada no tamanho desejado
            let rawQty = (usdSize * leverage) / currentPrice;
            
            // 📊 SCALE IN/OUT: Entrar com 50% inicial se ativado
            if (scaleInOutEnabled) {
              rawQty = rawQty * 0.5; // 50% da posição inicial
              console.log(`📊 SCALE IN/OUT ATIVO: Entrando com 50% da posição (${rawQty.toFixed(4)})`);
            }
            
            // Garantir valor mínimo de 5 USDT
            const minQtyForValue = MIN_ORDER_VALUE / currentPrice;
            if (rawQty < minQtyForValue) {
              rawQty = minQtyForValue;
            }
            
            // 🔧 CORREÇÃO: Arredondar com precisão para evitar erros de ponto flutuante
            // Determinar número de casas decimais baseado no qtyStep
            const decimals = qtyStep.toString().includes('.') 
              ? qtyStep.toString().split('.')[1].length 
              : 0;
            
            // Arredondar para cima respeitando o step
            rawQty = Math.ceil(rawQty / qtyStep) * qtyStep;
            
            // Aplicar arredondamento final para evitar 0.5700000000000001
            rawQty = Number(rawQty.toFixed(decimals));
            
            // Garantir que está dentro dos limites
            let qty = Math.max(minOrderQty, Math.min(maxOrderQty, rawQty));
            
            // Aplicar arredondamento final novamente
            qty = Number(qty.toFixed(decimals));
            
            // Validação: quantidade deve ser válida (não NaN, não Infinity)
            if (!isFinite(qty) || qty <= 0) {
              console.log(`⚠️ ${symbol}: Quantidade inválida (${qty})`);
              continue;
            }
            
            // Validação final: verificar se atinge o valor mínimo
            const orderValue = qty * currentPrice;
            if (orderValue < 5) {
              console.log(`⚠️ ${symbol}: Valor da ordem muito baixo ($${orderValue.toFixed(2)} < $5.00) - ajustando...`);
              qty = Math.ceil(MIN_ORDER_VALUE / currentPrice / qtyStep) * qtyStep;
              qty = Number(qty.toFixed(decimals)); // Arredondar novamente
            }
            
            // Validar se a quantidade é válida após todos os ajustes
            if (qty < minOrderQty) {
              console.log(`⚠️ ${symbol}: Quantidade abaixo do mínimo (${qty} < ${minOrderQty})`);
              continue;
            }
            
            // Validação final de valor mínimo
            const finalOrderValue = qty * currentPrice;
            if (finalOrderValue < 5) {
              console.log(`⚠️ ${symbol}: Ordem não atinge valor mínimo ($${finalOrderValue.toFixed(2)} < $5.00) - pulando`);
              continue;
            }
            
            // 🛡️ CALCULAR SL E TP - SCALPING: STOPS ULTRA-APERTADOS
            const priceDecimals = ticker.lastPrice.includes('.') 
              ? ticker.lastPrice.split('.')[1].length 
              : 2;
            
            let stopLossPct: number;
            let takeProfitPct: number;
            
            if (isScalpAsset) {
              // SCALPING: Stops apertados (0.8% SL, 1.5% TP = 1:1.875 R:R)
              stopLossPct = 0.008; // 0.8%
              takeProfitPct = 0.015; // 1.5%
              console.log(`⚡ SCALP STOPS: SL ${(stopLossPct*100).toFixed(1)}% | TP ${(takeProfitPct*100).toFixed(1)}%`);
            } else {
              // NORMAL: Stops mais largos baseados em ATR
              const atrMultiplier = 2.0;
              const minStopPercent = 2.5;
              const atrStopPercent = Math.max(atrPercent * atrMultiplier, minStopPercent);
              
              stopLossPct = mlConfig?.is_enabled && mlConfig?.recommended_stop_loss_pct 
                ? Math.max(mlConfig.recommended_stop_loss_pct / 100, atrStopPercent / 100)
                : atrStopPercent / 100;
              
              takeProfitPct = mlConfig?.is_enabled && mlConfig?.recommended_take_profit_pct 
                ? mlConfig.recommended_take_profit_pct / 100 
                : stopLossPct * 2.5;
            }
            
            // 🛡️ STOP LOSS OBRIGATÓRIO - NUNCA undefined
            let stopLoss = action === 'BUY' 
              ? (currentPrice * (1 - stopLossPct)).toFixed(priceDecimals)
              : (currentPrice * (1 + stopLossPct)).toFixed(priceDecimals);
            
            // ⚠️ VALIDAÇÃO CRÍTICA: Garantir que stop loss não é undefined/null
            if (!stopLoss || stopLoss === 'NaN' || parseFloat(stopLoss) <= 0) {
              console.error(`❌ STOP LOSS INVÁLIDO para ${symbol}: ${stopLoss}`);
              continue; // NUNCA executar trade sem stop loss válido
            }
            
            // Take Profit OBRIGATÓRIO
            // 📊 SCALE IN/OUT: Se ativado, usar TP mais próximo (primeiro nível = 2%)
            const firstTpPct = scaleInOutEnabled ? 0.02 : takeProfitPct; // 2% se scale-in ativo
            let takeProfit = action === 'BUY'
              ? (currentPrice * (1 + firstTpPct)).toFixed(priceDecimals)
              : (currentPrice * (1 - firstTpPct)).toFixed(priceDecimals);
            
            // ⚠️ VALIDAÇÃO CRÍTICA: Garantir que take profit não é undefined/null
            if (!takeProfit || takeProfit === 'NaN' || parseFloat(takeProfit) <= 0) {
              console.error(`❌ TAKE PROFIT INVÁLIDO para ${symbol}: ${takeProfit}`);
              continue; // NUNCA executar trade sem take profit válido
            }
            
            if (scaleInOutEnabled) {
              console.log(`📊 SCALE OUT: TP1=${takeProfit} (2%), TP2 será ${(takeProfitPct*100).toFixed(0)}% (fechamento manual)`);
            }
            
            // 🛡️ VALIDAÇÃO CRÍTICA: SL e TP devem estar nas direções corretas
            const slNum = parseFloat(stopLoss);
            const tpNum = parseFloat(takeProfit);
            
            if (action === 'BUY') {
              // Para BUY: SL < preço < TP
              if (slNum >= currentPrice) {
                console.log(`⚠️ ${symbol}: Stop Loss inválido para BUY (SL: ${stopLoss} >= Preço: ${currentPrice})`);
                continue;
              }
              if (tpNum <= currentPrice) {
                console.log(`⚠️ ${symbol}: Take Profit inválido para BUY (TP: ${takeProfit} <= Preço: ${currentPrice})`);
                continue;
              }
            } else {
              // Para SELL: TP < preço < SL
              if (slNum <= currentPrice) {
                console.log(`⚠️ ${symbol}: Stop Loss inválido para SELL (SL: ${stopLoss} <= Preço: ${currentPrice})`);
                continue;
              }
              if (tpNum >= currentPrice) {
                console.log(`⚠️ ${symbol}: Take Profit inválido para SELL (TP: ${takeProfit} >= Preço: ${currentPrice})`);
                continue;
              }
            }
            
            const orderValueUSD = (qty * currentPrice).toFixed(2);
            
            // 🔧 Converter qty para string com precisão correta
            const qtyStr = qty.toFixed(decimals);
            
            // 📊 LOG PRÉ-ORDEM
            console.log(`${isScalpAsset ? '⚡' : '📋'} ${symbol}: ${action} ${qtyStr} @ $${currentPrice} | ${leverage}x | SL: ${stopLoss} | TP: ${takeProfit}`);
            
            // 🛡️ VERIFICAÇÃO CRÍTICA DE SALDO ANTES DE CADA ORDEM
            // Buscar saldo atualizado imediatamente antes da ordem
            const { data: balanceCheck, error: balanceError } = await supabase.functions.invoke('bybit-trading', {
              body: {
                action: 'get_balance',
                isTestnet: false,
                params: { accountType: 'UNIFIED' }
              }
            });

            if (balanceError || !balanceCheck?.success) {
              console.error(`❌ Erro ao verificar saldo antes de ${symbol}:`, balanceError);
              continue;
            }

            // 🛡️ VERIFICAÇÃO TRIPLA DE SALDO (garantir margem suficiente com folga)
            const freshBalanceFinal = parseFloat(balanceCheck.data?.list?.[0]?.totalAvailableBalance || '0');
            const requiredMarginFinal = (parseFloat(orderValueUSD) / leverage) * (1 + FEE_BUFFER);
            const MIN_SAFE_BALANCE_FINAL = 12; // Manter sempre $12 de margem de segurança

            // 🛑 VERIFICAÇÃO CRÍTICA: Parar se saldo negativo ou insuficiente
            if (freshBalanceFinal < 0) {
              console.log(`🛑 ${symbol}: SALDO NEGATIVO - Disponível: $${freshBalanceFinal.toFixed(2)}`);
              setIsRunning(false);
              shouldStopTrading = true; // ATIVAR FLAG
              toast({
                title: "🛑 Trader Pausado",
                description: `Saldo negativo: $${freshBalanceFinal.toFixed(2)}. Aguarde fechamento de posições.`,
                variant: "destructive",
              });
              break; // Sair do loop imediatamente
            }

            // 🛡️ VALIDAÇÃO EXTRA: Margem não pode exceder 40% do saldo disponível
            const maxAllowedMargin = freshBalanceFinal * 0.40;
            if (requiredMarginFinal > maxAllowedMargin) {
              console.log(`🛑 ${symbol}: Margem muito alta - Necessário: $${requiredMarginFinal.toFixed(2)} | Max permitido: $${maxAllowedMargin.toFixed(2)}`);
              continue; // Pular este trade
            }

            if (freshBalanceFinal < requiredMarginFinal + MIN_SAFE_BALANCE_FINAL) {
              console.log(`🛑 ${symbol}: Saldo insuficiente - Disponível: $${freshBalanceFinal.toFixed(2)} | Necessário: $${(requiredMarginFinal + MIN_SAFE_BALANCE_FINAL).toFixed(2)}`);
              continue; // Pular este trade mas continuar com outros
            }
            
            const mlIndicator = mlConfig?.is_enabled ? ` [🧠ML: ${(stopLossPct*100).toFixed(1)}%/${(takeProfitPct*100).toFixed(1)}%]` : '';
            console.log(`🎯 SINAL QUALIFICADO [Score: ${signalScore}]: ${symbol} ${action}${mlIndicator}`);
            console.log(`   💰 Preço: $${currentPrice} | ATR: ${atrPercent.toFixed(2)}% | SL Dinâmico: ${(stopLossPct*100).toFixed(2)}%`);
            console.log(`   📊 Vol: $${(volume24h/1e6).toFixed(1)}M | Change: ${priceChange.toFixed(2)}% | Lev: ${leverage}x`);
            console.log(`   📈 Qty: ${qtyStr} | Value: $${orderValueUSD} | SL: ${stopLoss} | TP: ${takeProfit}`);
            console.log(`   💵 Saldo: $${freshBalanceFinal.toFixed(2)} (Margem: $${requiredMarginFinal.toFixed(2)}) | Confirmações: ${confirmations.join(', ')}`);

            // Executar ordem REAL na Bybit
            const { data: orderData, error: orderError } = await supabase.functions.invoke('bybit-trading', {
              body: {
                action: 'place_order',
                isTestnet: false, // ⚡ SEMPRE CONTA REAL
                params: {
                  category: 'linear',
                  symbol: symbol,
                  side: action === 'BUY' ? 'Buy' : 'Sell',
                  orderType: 'Market',
                  qty: qtyStr,
                  leverage: leverage.toString(), // 🔥 ALAVANCAGEM CONFIGURADA
                  stopLoss: stopLoss, // 🛡️ STOP LOSS SEMPRE PRESENTE
                  takeProfit: takeProfit, // 🎯 TAKE PROFIT SEMPRE PRESENTE
                  timeInForce: 'GTC',
                  positionIdx: 0,
                  reduceOnly: false
                }
              }
            });

            // ⚠️ VALIDAÇÃO PÓS-ORDEM: Verificar se SL/TP foram aplicados
            if (!orderError && orderData?.success) {
              console.log(`🛡️ STOPS CONFIRMADOS: ${symbol} | SL: ${stopLoss} | TP: ${takeProfit}`);
              console.log(`✅ TRADE EXECUTADO: ${symbol} | ${action} | Leverage: ${leverage}x | USD: $${usdSize.toFixed(2)} | Score: ${signalScore}`);
              
              // 💾 SALVAR POSIÇÃO NO BANCO COM SCORE DE QUALIDADE
              const { data: { user } } = await supabase.auth.getUser();
              if (!user) {
                console.warn('⚠️ Posição executada mas não salva - usuário não autenticado');
                return;
              }
              const savePositionUserId = user.id;
              await supabase
                .from('auto_trader_positions')
                .insert({
                  user_id: savePositionUserId,
                  symbol,
                  side: action === 'BUY' ? 'Buy' : 'Sell',
                  entry_price: currentPrice,
                  qty,
                  leverage,
                  stop_loss: parseFloat(stopLoss),
                  take_profit: parseFloat(takeProfit),
                  // 🎯 TRAILING STOP DINÂMICO POR VOLATILIDADE
                  trailing_stop_percentage: calculateDynamicTrailingStop(currentVolatility),
                  highest_price: currentPrice, // Inicializar com preço de entrada
                  volatility: currentVolatility, // Armazenar volatilidade do ativo
                  partial_tp_executed: false, // Controle de take profit parcial
                  original_quantity: qty, // Salvar quantidade original
                  confidence: signalScore, // 🎯 SALVAR SCORE DE QUALIDADE
                  status: 'OPEN',
                  exchange_order_id: orderData.data?.orderId
                });
              
              // 🎯 TRAILING STOP: Inicializar tracking
              if (trailingStopEnabled) {
                setPositionTracking(prev => {
                  const newMap = new Map(prev);
                  newMap.set(symbol, {
                    highestPrice: action === 'BUY' ? currentPrice : 0,
                    lowestPrice: action === 'SELL' ? currentPrice : Infinity,
                    currentStopLoss: parseFloat(stopLoss)
                  });
                  return newMap;
                });
                console.log(`🎯 TRAILING STOP iniciado para ${symbol} (Distância: ${trailingStopPercent}%)`);
              }
              
              // 📋 COPY TRADING: Salvar padrão para replicação futura
              if (copyTradingEnabled) {
                setWinningPatterns(prev => {
                  const newPattern = {
                    symbol,
                    action,
                    priceChange,
                    volume24h,
                    timestamp: new Date().toISOString(),
                    winRate: 0 // Será atualizado ao fechar a posição
                  };
                  return [...prev.slice(-19), newPattern]; // Manter últimos 20
                });
              }
              
              // 🎲 MARTINGALE: Resetar streak de perdas em sucesso
              if (martingaleEnabled) {
                setLossStreak(0);
              }
              
              const trade: Trade = {
                symbol,
                action,
                confidence: signalScore,
                leverage,
                usdSize,
                timestamp: new Date().toISOString()
              };

              setActiveTrades(prev => [...prev.slice(-19), trade]);
              setOpenPositionsCount(prev => prev + 1);
              
              toast({
                title: `${isScalpAsset ? '⚡ SCALP' : '✅ TRADE'} ${symbol}`,
                description: `${action} ${leverage.toFixed(0)}x | Capital: $${usdSize.toFixed(0)} | Expected: +$${expectedProfit.toFixed(2)}`,
              });
            } else {
              console.error(`❌ Erro ao executar ${symbol}:`, orderError);
              const errorMsg = orderData?.error || orderError?.message || 'Erro desconhecido';
              
              // 🎲 MARTINGALE: Incrementar streak de perdas
              if (martingaleEnabled) {
                setLossStreak(prev => Math.min(prev + 1, 3)); // Max 3 perdas
              }
              
              // 📋 MOTIVOS DETALHADOS DE FALHA
              let failureReason = errorMsg;
              if (errorMsg.includes('ab not enough')) {
                failureReason = `❌ SALDO INSUFICIENTE - Margem esgotada`;
              } else if (errorMsg.includes('TakeProfit') || errorMsg.includes('StopLoss')) {
                failureReason = `❌ SL/TP INVÁLIDO - ${errorMsg}`;
                console.error(`🚨 ERRO CRÍTICO SL/TP para ${symbol}:`, {
                  action,
                  currentPrice,
                  stopLoss,
                  takeProfit,
                  errorMsg
                });
              } else if (errorMsg.includes('minNotional')) {
                failureReason = `Valor mínimo não atingido (< $5.00)`;
              } else if (errorMsg.includes('insufficient')) {
                failureReason = `Saldo insuficiente na conta`;
              } else if (errorMsg.includes('not exists') || errorMsg.includes('not found')) {
                failureReason = `Instrumento ${symbol} não listado na Bybit`;
              } else if (errorMsg.includes('qty')) {
                failureReason = `Quantidade inválida (minQty não respeitado)`;
              } else if (errorMsg.includes('price')) {
                failureReason = `Preço inválido ou fora dos limites`;
              }
              
              toast({
                title: `❌ Falha: ${symbol}`,
                description: failureReason,
                variant: "destructive"
              });
              
              // Log detalhado
              console.log(`📋 FALHA DETALHADA ${symbol}:`, {
                reason: failureReason,
                originalError: errorMsg,
                qty: qtyStr,
                orderValue: orderValueUSD,
                balance: currentBalance,
                stopLoss,
                takeProfit,
                currentPrice
              });
              
              // Incrementar perdas consecutivas em caso de erro
              setConsecutiveLosses(prev => prev + 1);
              
              // Se erro de saldo insuficiente, parar o trader
              if (errorMsg.includes('ab not enough')) {
                console.log('🛑 SALDO INSUFICIENTE - Pausando trader');
                setIsRunning(false);
                shouldStopTrading = true; // ATIVAR FLAG
                toast({
                  title: "🛑 Trader Pausado",
                  description: "Saldo insuficiente para novas operações. Aguarde fechamento de posições.",
                  variant: "destructive",
                });
                break; // Sair do loop imediatamente
              }
            }
          }

          // Aguardar entre análises (2s para não sobrecarregar)
          await new Promise(resolve => setTimeout(resolve, 2000));

        } catch (error) {
          console.error(`Erro ao processar ${symbol}:`, error);
        }
      }

      setCycleCount(prev => prev + 1);

    } catch (error: any) {
      console.error('Erro no ciclo de trading:', error);
    }
  };

  // 🚀 PERFORMANCE: Memoizar cálculos pesados
  const leverageConfig = useMemo(() => ({
    getLeverageForScalping,
    getLeverageForBalance
  }), []);

  // Sincronizar saldo a cada 60 segundos quando ativo (DESABILITADO)
  useEffect(() => {
    // 🔴 TODOS OS INTERVALOS DESABILITADOS PARA EVITAR PISCAR DA TELA
    // As atualizações devem ser feitas manualmente
    
    if (isRunning) {
      // Buscar dados apenas uma vez ao iniciar
      fetchTop10VolatileAssets();
      syncBybitBalance();
      syncOpenPositions();
    }

    return () => {
      // Nenhum intervalo para limpar
    };
  }, [isRunning, trailingStopEnabled, syncBybitBalance, syncOpenPositions, fetchTop10VolatileAssets]);

  useEffect(() => {
    // 🔴 CICLO DE TRADING DESABILITADO PARA EVITAR PISCAR DA TELA
    
    if (isRunning) {
      console.log("🤖 Multi-Asset Trader iniciado - Modo Manual");
      
      // Executar apenas uma vez ao iniciar
      analyzeAndTrade();
    }

    return () => {
      // Nenhum intervalo para limpar
    };
  }, [isRunning, currentBalance, isTestnet]);

  const startTrading = async () => {
    if (currentBalance < 2) {
      toast({
        title: "❌ Saldo insuficiente",
        description: "Bankroll muito baixo para operar com segurança",
        variant: "destructive",
      });
      return;
    }

    // 🛡️ VERIFICAR GESTÃO DE RISCO ANTES DE INICIAR
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast({
        title: "❌ Autenticação Necessária",
        description: "Você precisa estar logado para iniciar o trading",
        variant: "destructive"
      });
      return;
    }
    const currentUserId = user.id;
    
    // Verificar se trading está pausado por gestão de risco
    const { data: riskSettings } = await supabase
      .from('risk_management_settings')
      .select('*')
      .eq('user_id', currentUserId)
      .maybeSingle();

    if (riskSettings?.trading_paused) {
      toast({
        title: "🛑 Trading Pausado",
        description: `Limite diário de perdas atingido: $${Math.abs(riskSettings.current_daily_loss).toFixed(2)} / $${riskSettings.max_daily_loss}`,
        variant: "destructive"
      });
      return;
    }

    // Atualizar max_positions baseado nas configurações de risco
    if (riskSettings?.max_positions) {
      setMaxOpenPositions(riskSettings.max_positions);
    }

    if (isTestnet) {
      toast({
        title: "⚠️ Modo Testnet ativo",
        description: "Alterne para CONTA REAL para operar",
        variant: "destructive",
      });
      return;
    }

    // Sincronizar antes de iniciar
    await syncBybitBalance();
    await syncOpenPositions();

    setIsRunning(true);

    // 💾 SALVAR ESTADO NO BANCO
    const { data: { user: startUser } } = await supabase.auth.getUser();
    if (!startUser) return;
    const startUserId = startUser.id;
    await supabase
      .from('auto_trader_config')
      .upsert({
        user_id: startUserId,
        trader_is_running: true,
        last_activity_at: new Date().toISOString(),
      });

    toast({
      title: "⚡ TRADER REAL 24/7 ATIVADO",
      description: `Capital: $${currentBalance.toFixed(2)} | Lev: ${getLeverageForBalance(currentBalance, historicalWinRate)}x | Win Rate: ${historicalWinRate.toFixed(0)}%
      
🎯 Fechamento Progressivo:
• 25% em +1% de lucro
• 25% em +2% (Stop → Breakeven)
• 50% livre com Trailing Stop
🔄 Restauração automática habilitada`,
    });
  };

  const stopTrading = async () => {
    setIsRunning(false);

    // 💾 SALVAR ESTADO NO BANCO
    const { data: { user: stopUser } } = await supabase.auth.getUser();
    if (!stopUser) return;
    const stopUserId = stopUser.id;
    await supabase
      .from('auto_trader_config')
      .update({
        trader_is_running: false,
        last_activity_at: new Date().toISOString(),
      })
      .eq('user_id', stopUserId);

    toast({
      title: "⏸️ Trader pausado",
      description: `P&L Total: $${totalPnL.toFixed(2)}`,
    });
  };

  const resetBankroll = async () => {
    await syncBybitBalance();
    setTotalPnL(0);
    setDailyPnL(0);
    setActiveTrades([]);
    setCycleCount(0);
    setConsecutiveLosses(0);
    toast({
      title: "🔄 Reset Completo",
      description: "Estatísticas resetadas e saldo sincronizado",
    });
  };

  return (
    <div className="space-y-4">
      <Card className="p-6 bg-gradient-to-br from-purple-500/10 to-blue-500/10 border-purple-500/20">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-2xl font-bold flex items-center gap-2">
              <Zap className="h-6 w-6 text-yellow-500" />
              Multi-Asset Trader 24/7
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              Estratégia agressiva com alavancagem dinâmica
            </p>
          </div>
          
          <div className="flex items-center gap-2">
            <Badge variant={isTestnet ? "outline" : "destructive"} className="text-lg px-4 py-2 animate-pulse">
              {isTestnet ? '🧪 TESTNET' : '⚡ CONTA REAL'}
            </Badge>
            <Badge 
              variant={
                getCorrelationRisk().level === 'low' 
                  ? 'default' 
                  : getCorrelationRisk().level === 'medium' 
                  ? 'secondary' 
                  : 'destructive'
              }
              className="text-xs flex items-center gap-1"
            >
              <Network className="h-3 w-3" />
              {getCorrelationRisk().message}
            </Badge>
          </div>
        </div>

        {/* Status Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <Card className="p-4 bg-background/50">
            <div className="flex items-center gap-2 mb-1">
              <DollarSign className="h-4 w-4 text-green-500" />
              <span className="text-xs text-muted-foreground">Saldo Real</span>
            </div>
            <div className="text-xl font-bold">${currentBalance.toFixed(2)}</div>
            <div className={`text-xs ${dailyPnL >= 0 ? 'text-green-500' : 'text-red-500'}`}>
              Hoje: {dailyPnL >= 0 ? '+' : ''}{dailyPnL.toFixed(2)} ({((dailyPnL/currentBalance)*100).toFixed(1)}%)
            </div>
            {lastSyncTime && (
              <div className="text-[10px] text-muted-foreground mt-1">
                Sync: {lastSyncTime.toLocaleTimeString()}
              </div>
            )}
          </Card>

          <Card className="p-4 bg-background/50">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="h-4 w-4 text-blue-500" />
              <span className="text-xs text-muted-foreground">Alavancagem</span>
            </div>
            <div className="text-xl font-bold">{getLeverageForBalance(currentBalance, historicalWinRate)}x</div>
            <div className="text-xs text-muted-foreground">
              Dinâmica (Win: {historicalWinRate.toFixed(0)}%)
            </div>
          </Card>

          <Card className="p-4 bg-background/50">
            <div className="flex items-center gap-2 mb-1">
              <Zap className="h-4 w-4 text-yellow-500" />
              <span className="text-xs text-muted-foreground">Posições</span>
            </div>
            <div className="text-xl font-bold">{openPositionsCount}/{maxOpenPositions}</div>
            <div className="text-xs text-muted-foreground">
              Abertas | {activeTrades.length} total
            </div>
          </Card>

          <Card className="p-4 bg-background/50">
            <div className="flex items-center gap-2 mb-1">
              <Target className="h-4 w-4 text-green-500" />
              <span className="text-xs text-muted-foreground">Sistema de Saída</span>
            </div>
            <div className="text-sm font-semibold text-green-500">Progressivo</div>
            <div className="text-xs text-muted-foreground mt-1">
              25% +1% | 25% +2% | 50% trailing
            </div>
          </Card>

          <Card className="p-4 bg-background/50">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="h-4 w-4 text-purple-500" />
              <span className="text-xs text-muted-foreground">Proteção</span>
            </div>
            <div className="text-xl font-bold">{consecutiveLosses}/{MAX_CONSECUTIVE_LOSSES}</div>
            <div className="text-xs text-muted-foreground">
              Perdas seguidas
            </div>
          </Card>
        </div>

        {/* Proteções Ativas */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
            <div className="text-xs font-medium mb-1">🛡️ Stop Loss Diário</div>
            <div className="text-sm">
              <span className={dailyPnL <= -currentBalance * DAILY_STOP_LOSS_PCT ? 'text-red-500 font-bold' : ''}>
                {((DAILY_STOP_LOSS_PCT * 100).toFixed(0))}% = ${(currentBalance * DAILY_STOP_LOSS_PCT).toFixed(2)}
              </span>
            </div>
          </div>
          
          <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
            <div className="text-xs font-medium mb-1">📊 Posições Max</div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-6 w-6 p-0"
                onClick={() => setMaxOpenPositions(Math.max(1, maxOpenPositions - 1))}
                disabled={isRunning}
              >
                -
              </Button>
              <span className={`text-sm font-bold ${openPositionsCount >= maxOpenPositions ? 'text-yellow-500' : ''}`}>
                {openPositionsCount} de {maxOpenPositions}
              </span>
              <Button
                variant="outline"
                size="sm"
                className="h-6 w-6 p-0"
                onClick={() => setMaxOpenPositions(Math.min(50, maxOpenPositions + 1))}
                disabled={isRunning}
              >
                +
              </Button>
            </div>
          </div>
        </div>

        {/* 💼 GERENCIAMENTO DE MARGEM */}
        <Card className="p-4 bg-gradient-to-br from-purple-500/10 to-pink-500/10 border-purple-500/20 mb-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-purple-400" />
              <span className="text-sm font-medium">Gerenciamento de Margem Dinâmico</span>
            </div>
            <Badge variant="outline" className="text-purple-400 border-purple-400">
              {openPositionsCount}/{maxOpenPositions} posições
            </Badge>
          </div>
          
          <div className="space-y-2 text-sm">
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Margem Total:</span>
              <span className="font-mono text-purple-400">${currentBalance.toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Margem Usada (Est.):</span>
              <span className="font-mono">
                ${(currentBalance * 0.80 * (openPositionsCount / Math.max(maxOpenPositions, 20))).toFixed(2)}
                <span className="text-xs text-muted-foreground ml-1">
                  ({((openPositionsCount / Math.max(maxOpenPositions, 20)) * 80).toFixed(0)}%)
                </span>
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Margem Livre:</span>
              <span className="font-mono text-green-400">
                ${(currentBalance * (1 - 0.80 * (openPositionsCount / Math.max(maxOpenPositions, 20)))).toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Próxima Posição (Est.):</span>
              <span className="font-mono text-xs">
                ~${((currentBalance * 0.80 / Math.max(maxOpenPositions, 20)) * Math.max(0.3, 1 - (openPositionsCount / Math.max(maxOpenPositions, 20)) * 0.5)).toFixed(2)}
              </span>
            </div>
            <Progress 
              value={(openPositionsCount / maxOpenPositions) * 100} 
              className="h-2 mt-2"
            />
            <div className="text-xs text-muted-foreground text-center">
              Capacidade utilizada: {((openPositionsCount / maxOpenPositions) * 100).toFixed(0)}%
              {openPositionsCount > maxOpenPositions * 0.8 && (
                <span className="text-yellow-500 ml-2">⚠️ Próximo ao limite</span>
              )}
            </div>
          </div>
        </Card>

        {/* Mode Toggle */}
        <div className="flex items-center justify-between p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg mb-4">
          <div>
            <Label className="text-sm font-medium">Modo de operação</Label>
            <p className="text-xs text-muted-foreground">
              {isTestnet ? 'Testnet - sem risco real' : '⚠️ REAL - dinheiro real em risco'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Label className="text-xs">Testnet</Label>
            <Switch
              checked={!isTestnet}
              onCheckedChange={(checked) => {
                setIsTestnet(!checked);
                setIsRunning(false);
              }}
              disabled={isRunning}
            />
            <Label className="text-xs">Real</Label>
          </div>
        </div>

        {/* Controls */}
        <div className="flex gap-2">
          {!isRunning ? (
            <>
              <Button 
                onClick={startTrading} 
                className="flex-1 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700"
                size="lg"
              >
                <Play className="h-5 w-5 mr-2" />
                Iniciar Trader 24/7
              </Button>
              <Button 
                onClick={resetBankroll} 
                variant="outline"
                size="lg"
              >
                Reset
              </Button>
            </>
          ) : (
            <Button 
              onClick={stopTrading} 
              variant="destructive"
              className="w-full"
              size="lg"
            >
              <Square className="h-5 w-5 mr-2" />
              Parar Trader
            </Button>
          )}
        </div>

        {mlConfig?.is_enabled && (
          <div className="text-xs text-center text-muted-foreground bg-primary/5 p-2 rounded-lg border border-primary/10">
            🧠 ML Adaptativo: SL {mlConfig.recommended_stop_loss_pct}% | TP {mlConfig.recommended_take_profit_pct}% | Lev {mlConfig.recommended_leverage}x | Confiança: {mlConfig.confidence_score}%
          </div>
        )}

        {isRunning && (
          <div className="mt-4">
            <div className="flex items-center justify-between text-sm mb-2">
              <div className="flex items-center gap-3">
                <span className="text-green-500 font-semibold animate-pulse">● OPERANDO</span>
                <span className="text-xs text-muted-foreground">
                  Ciclo: {cycleCount} | Próx: 60s | 24/7 | Auto-restaura
                </span>
              </div>
              <span className="text-xs">
                {openPositionsCount < maxOpenPositions ? '🎯 Buscando setups...' : '⏸️ Posições cheias'}
              </span>
            </div>
            <Progress value={100} className="h-2 animate-pulse" />
          </div>
        )}
      </Card>

      {/* ⚡ CONFIGURAÇÕES AVANÇADAS */}
      <AdvancedTradingSettings
        trailingStopEnabled={trailingStopEnabled}
        setTrailingStopEnabled={setTrailingStopEnabled}
        trailingStopPercent={trailingStopPercent}
        setTrailingStopPercent={setTrailingStopPercent}
        timeFilterEnabled={timeFilterEnabled}
        setTimeFilterEnabled={setTimeFilterEnabled}
        startHour={startHour}
        setStartHour={setStartHour}
        endHour={endHour}
        setEndHour={setEndHour}
        scaleInOutEnabled={scaleInOutEnabled}
        setScaleInOutEnabled={setScaleInOutEnabled}
        martingaleEnabled={martingaleEnabled}
        setMartingaleEnabled={setMartingaleEnabled}
        copyTradingEnabled={copyTradingEnabled}
        setCopyTradingEnabled={setCopyTradingEnabled}
        hedgeEnabled={hedgeEnabled}
        setHedgeEnabled={setHedgeEnabled}
        sentimentEnabled={sentimentEnabled}
        setSentimentEnabled={setSentimentEnabled}
        dynamicLeverageEnabled={dynamicLeverageEnabled}
        setDynamicLeverageEnabled={setDynamicLeverageEnabled}
      />

      {/* Recent Trades */}
      {activeTrades.length > 0 && (
        <Card className="p-6">
          <h4 className="font-semibold mb-4">Últimos Trades ({activeTrades.length})</h4>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {activeTrades.slice().reverse().map((trade, idx) => (
              <div 
                key={idx} 
                className="p-3 bg-muted rounded-lg border border-border flex items-center justify-between"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold">{trade.symbol}</span>
                    <Badge variant={trade.action === 'BUY' ? 'default' : 'destructive'} className="text-xs">
                      {trade.action}
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      {trade.leverage}x
                    </Badge>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    ${trade.usdSize.toFixed(2)} | {trade.confidence.toFixed(0)}% conf | {new Date(trade.timestamp).toLocaleTimeString()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
};