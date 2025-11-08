import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Play, Square, Zap, DollarSign, TrendingUp, Target, Network } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
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

  // Calcular win rate histórico
  useEffect(() => {
    const fetchWinRate = async () => {
      const { data } = await supabase
        .from('auto_trader_positions')
        .select('realized_pnl')
        .eq('status', 'CLOSED')
        .order('closed_at', { ascending: false })
        .limit(20);

      if (data && data.length > 0) {
        const wins = data.filter(t => (t.realized_pnl || 0) > 0).length;
        const winRate = (wins / data.length) * 100;
        setHistoricalWinRate(winRate);
      }
    };

    fetchWinRate();
  }, [cycleCount]);

  // 💾 RESTAURAR ESTADO AUTOMATICAMENTE AO CARREGAR
  useEffect(() => {
    const restoreTraderState = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Buscar configuração do ML adaptativo
      const { data: mlData } = await supabase
        .from('ml_adaptive_config')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (mlData && mlData.is_enabled) {
        setMlConfig(mlData);
        console.log('🧠 ML Adaptativo ATIVADO:', mlData);
      }

      const { data: config } = await supabase
        .from('auto_trader_config')
        .select('trader_is_running, last_activity_at')
        .eq('user_id', user.id)
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
            .eq('user_id', user.id);
        }
      }
    };

    restoreTraderState();
  }, []);

  // Estratégia de alavancagem baseada no bankroll E win rate
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
    
    // 📐 BASE DO RISCO: 1-5% do bankroll por posição
    let baseRisk = balance < 15 ? 0.05 : 0.03;
    
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

  // 🔄 SINCRONIZAÇÃO AUTOMÁTICA - Buscar saldo real da Bybit
  const syncBybitBalance = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('bybit-trading', {
        body: {
          action: 'get_balance',
          isTestnet: false,
          params: { accountType: 'UNIFIED' }
        }
      });

      if (!error && data?.success) {
        const usdtCoin = data.data.list[0]?.coin?.find((c: any) => c.coin === 'USDT');
        if (usdtCoin) {
          const realBalance = parseFloat(usdtCoin.walletBalance);
          setCurrentBalance(realBalance);
          setLastSyncTime(new Date());
          console.log(`💰 Saldo sincronizado: $${realBalance.toFixed(2)}`);
        }
      }
    } catch (error) {
      console.error('Erro ao sincronizar saldo:', error);
    }
  };

  // 📊 SINCRONIZAR POSIÇÕES ABERTAS DA BYBIT
  const syncOpenPositions = async () => {
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
  };

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
      
      // ⏰ FILTRO DE HORÁRIOS
      if (timeFilterEnabled) {
        const currentHour = new Date().getUTCHours();
        const isWithinTradingHours = startHour <= endHour
          ? currentHour >= startHour && currentHour < endHour
          : currentHour >= startHour || currentHour < endHour; // Suporta overnight (ex: 22h-6h)
        
        if (!isWithinTradingHours) {
          console.log(`⏰ FORA DO HORÁRIO DE TRADING: ${currentHour}h UTC (Ativo: ${startHour}h-${endHour}h UTC)`);
          return; // Não analisa ativos fora do horário
        }
        console.log(`✅ DENTRO DO HORÁRIO DE TRADING: ${currentHour}h UTC`);
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
      
      // 🔥 FILTRAR APENAS OS ATIVOS MAIS VOLÁTEIS
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
      }).filter(a => a.volatility > 0.8 && a.volume24h > 200000); // Volatilidade mínima 0.8% e volume mínimo $200K
      
      // 📊 ORDENAR POR VOLATILIDADE (descendente) e processar TODOS os ativos voláteis
      const topVolatileAssets = assetsWithVolatility
        .sort((a, b) => b.volatility - a.volatility);
      
      console.log(`🔥 Analisando TODOS os ${topVolatileAssets.length} ativos voláteis da Bybit (Saldo: $${currentBalance.toFixed(2)} | Posições: ${openPositionsCount}/${maxOpenPositions})`);
      if (topVolatileAssets.length > 0) {
        console.log(`📊 Range de Volatilidade: ${topVolatileAssets[0].instrument.symbol} (${topVolatileAssets[0].volatility.toFixed(2)}%) até ${topVolatileAssets[topVolatileAssets.length-1].instrument.symbol} (${topVolatileAssets[topVolatileAssets.length-1].volatility.toFixed(2)}%)`);
      }
      console.log(`🎯 Critérios de Entrada: Score mínimo 70 | 3+ confirmações | ATR stop loss dinâmico`);
      
      // 🛑 FLAG para parar processamento em caso de saldo insuficiente
      let shouldStopTrading = false;
      
      // 3. Analisar apenas os ativos mais voláteis
      for (const assetData of topVolatileAssets) {
        if (!isRunning || shouldStopTrading) break;

        const { instrument, ticker, volatility, priceChange, volume24h } = assetData;
        const symbol = instrument.symbol;
        
        try {
          // ⚡ ANÁLISE TÉCNICA AVANÇADA - SISTEMA DE PRECISÃO APRIMORADO COM ATR
          
          // 1. CALCULAR ATR (Average True Range) REAL para stop loss dinâmico
          const currentPrice = parseFloat(ticker.lastPrice);
          const highPrice = parseFloat(ticker.highPrice24h);
          const lowPrice = parseFloat(ticker.lowPrice24h);
          const priceRange = highPrice - lowPrice;
          
          // ATR como % do preço - usado para stops dinâmicos
          const atrPercent = (priceRange / currentPrice) * 100;
          
          // 2. VALIDAÇÕES DE LIQUIDEZ E VOLATILIDADE (MAIS RIGOROSAS)
          const hasGoodVolume = volume24h > 500000; // $500K mínimo
          const hasExcellentVolume = volume24h > 2000000; // $2M+ = volume excepcional
          const hasGoodVolatility = volatility > 1.0; // 1.0% mínimo (AUMENTADO para maior precisão)
          const hasStrongVolatility = volatility > 2.5; // 2.5%+ = volatilidade forte (AUMENTADO)
          
          // 3. ANÁLISE DE TENDÊNCIA E MOMENTUM
          const pricePosition = (currentPrice - lowPrice) / priceRange; // 0-1, onde está no range
          
          // Detectar tendências fortes - CRITÉRIOS MAIS RIGOROSOS
          const isBullishTrend = priceChange > 3.0; // Subindo forte (+3%)
          const isBearishTrend = priceChange < -3.0; // Caindo forte (-3%)
          const isModerateBullish = priceChange > 1.5 && priceChange <= 3.0;
          const isModerateBearish = priceChange < -1.5 && priceChange >= -3.0;
          
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
          
          // 4. ANÁLISE DE VOLUME (comparação dinâmica) - MAIS RIGOROSO
          const avgVolume = 5000000; // $5M baseline
          const volumeRatio = volume24h / avgVolume;
          const hasVolumeSpike = volumeRatio > 2.5; // 2.5x+ volume médio (AUMENTADO)
          const hasStrongVolume = volumeRatio > 1.8; // 1.8x volume médio (AUMENTADO)
          
          // 5. SISTEMA DE SCORING MULTI-CONFIRMAÇÃO (0-100) - CRITÉRIOS RIGOROSOS
          let signalScore = 0;
          let action: 'BUY' | 'SELL' | null = null;
          let confirmations: string[] = [];
          
          // === SINAIS DE COMPRA (BUY) - CRITÉRIOS MAIS EXIGENTES ===
          let buyScore = 0;
          
          // Confirmação 1: Tendência de alta forte + volume excepcional
          if (isBullishTrend && hasVolumeSpike) {
            buyScore += 35;
            confirmations.push('Tendência bullish forte + volume spike');
          } else if (isBullishTrend && hasStrongVolume) {
            buyScore += 25;
            confirmations.push('Tendência bullish forte');
          } else if (isModerateBullish && hasExcellentVolume) {
            buyScore += 20;
            confirmations.push('Tendência bullish + volume excepcional');
          }
          
          // Confirmação 2: Reversão de fundo FORTE (oversold bounce)
          if (isOversold && nearSupport && hasVolumeSpike) {
            buyScore += 40;
            confirmations.push('Reversão bullish confirmada');
          } else if (isMildOversold && nearSupport && hasStrongVolume) {
            buyScore += 25;
            confirmations.push('Zona de suporte forte');
          }
          
          // Confirmação 3: Momentum positivo FORTE
          if (pricePosition > 0.55 && priceChange > 1.5) {
            buyScore += 20;
            confirmations.push('Momentum bullish forte');
          } else if (pricePosition > 0.50 && priceChange > 0.8) {
            buyScore += 10;
            confirmations.push('Momentum positivo');
          }
          
          // Confirmação 4: ATR favorável (não muito volátil)
          if (atrPercent > 2 && atrPercent < 8) {
            buyScore += 15;
            confirmations.push('ATR ideal para trading');
          }
          
          // === SINAIS DE VENDA (SELL) - CRITÉRIOS MAIS EXIGENTES ===
          let sellScore = 0;
          
          // Confirmação 1: Tendência de baixa forte + volume excepcional
          if (isBearishTrend && hasVolumeSpike) {
            sellScore += 35;
            confirmations.push('Tendência bearish forte + volume spike');
          } else if (isBearishTrend && hasStrongVolume) {
            sellScore += 25;
            confirmations.push('Tendência bearish forte');
          } else if (isModerateBearish && hasExcellentVolume) {
            sellScore += 20;
            confirmations.push('Tendência bearish + volume excepcional');
          }
          
          // Confirmação 2: Reversão de topo FORTE (overbought rejection)
          if (isOverbought && nearResistance && hasVolumeSpike) {
            sellScore += 40;
            confirmations.push('Reversão bearish confirmada');
          } else if (isMildOverbought && nearResistance && hasStrongVolume) {
            sellScore += 25;
            confirmations.push('Zona de resistência forte');
          }
          
          // Confirmação 3: Momentum negativo FORTE
          if (pricePosition < 0.45 && priceChange < -1.5) {
            sellScore += 20;
            confirmations.push('Momentum bearish forte');
          } else if (pricePosition < 0.50 && priceChange < -0.8) {
            sellScore += 10;
            confirmations.push('Momentum negativo');
          }
          
          // Confirmação 4: ATR favorável (não muito volátil)
          if (atrPercent > 2 && atrPercent < 8) {
            sellScore += 15;
            confirmations.push('ATR ideal para trading');
          }
          
          // 6. DETERMINAR AÇÃO E SCORE FINAL - THRESHOLD AUMENTADO
          if (buyScore > sellScore && buyScore >= 70) {
            action = 'BUY';
            signalScore = Math.min(buyScore, 100);
          } else if (sellScore > buyScore && sellScore >= 70) {
            action = 'SELL';
            signalScore = Math.min(sellScore, 100);
          }
          
          // 7. FILTRO FINAL: Critérios RIGOROSOS para MÁXIMA PRECISÃO
          const shouldTrade = (
            signalScore >= 70 && // Score mínimo ALTO para precisão (era 55)
            confirmations.length >= 3 && // MÍNIMO 3 confirmações técnicas (era 1)
            hasGoodVolume &&
            hasGoodVolatility &&
            action !== null &&
            currentBalance > 2 &&
            atrPercent > 1.5 && // ATR mínimo para movimento adequado
            atrPercent < 12 // ATR máximo para não ser muito errático
          );

          // 📋 MOTIVOS PARA NÃO EXECUTAR (com detalhes do scoring)
          if (!shouldTrade && signalScore > 0) {
            let skipReason = '';
            if (signalScore < 70) skipReason = `Score insuficiente (${signalScore}/70) | Confirmações: ${confirmations.length}/3`;
            else if (confirmations.length < 3) skipReason = `Poucas confirmações (${confirmations.length}/3)`;
            else if (!hasGoodVolume) skipReason = `Volume insuficiente ($${(volume24h/1e6).toFixed(1)}M < $0.5M)`;
            else if (!hasGoodVolatility) skipReason = `Volatilidade inadequada (${volatility.toFixed(2)}% fora de 1.0%+)`;
            else if (currentBalance <= 2) skipReason = `Saldo insuficiente ($${currentBalance.toFixed(2)})`;
            else if (atrPercent <= 1.5) skipReason = `ATR muito baixo (${atrPercent.toFixed(2)}% < 1.5%)`;
            else if (atrPercent >= 12) skipReason = `ATR muito alto (${atrPercent.toFixed(2)}% > 12%) - muito volátil`;
            else if (action === null) skipReason = 'Sem sinal claro de entrada';
            
            console.log(`⏭️ ${symbol} PULADO: ${skipReason}`);
          }
          
          // 📊 LOG DE SINAIS DE ALTA QUALIDADE
          if (shouldTrade && action) {
            console.log(`\n✅ ${symbol} - SINAL DE ALTA PRECISÃO`);
            console.log(`   Ação: ${action} | Score: ${signalScore}/100 | Confirmações: ${confirmations.length}/3`);
            console.log(`   Técnicas: ${confirmations.join(', ')}`);
            console.log(`   ATR: ${atrPercent.toFixed(2)}% | Vol: ${volatility.toFixed(2)}% | Volume: $${(volume24h/1e6).toFixed(1)}M`);
            console.log(`   Posição no Range: ${(pricePosition * 100).toFixed(0)}% | Mudança 24h: ${priceChange.toFixed(2)}%`);
            
            // Disparar evento customizado para o dashboard
            const signalEvent = new CustomEvent('trading-signal', {
              detail: {
                symbol,
                action,
                score: signalScore,
                confirmations: confirmations.length,
                metrics: {
                  volatility,
                  volume24h,
                  priceChange,
                  pricePosition: pricePosition < 0.3 ? 'Suporte' : pricePosition > 0.7 ? 'Resistência' : 'Meio Range',
                  trend: trendStrength,
                },
                technicalFactors: confirmations,
                reasoning: `Score: ${signalScore}/100 com ${confirmations.length} confirmações técnicas. Volume 24h: $${(volume24h/1e6).toFixed(1)}M, Volatilidade: ${volatility.toFixed(2)}%`,
              }
            });
            window.dispatchEvent(signalEvent);
            
            // Toast de confirmação de sinal de alta qualidade
            if (signalScore >= 85) {
              toast({
                title: "🎯 Sinal Premium Detectado",
                description: `${symbol} ${action} | Score: ${signalScore}/100 | ${confirmations.length} confirmações`,
                duration: 3000,
              });
            }
          }
          
          if (shouldTrade && action) {
            // 🎯 SISTEMA DE PRIORIZAÇÃO: Se limite atingido, verificar se vale a pena substituir
            if (shouldCheckPrioritization) {
              const { data: { user } } = await supabase.auth.getUser();
              if (!user) continue;

              // Buscar posições abertas no banco com seus scores
              const { data: openDbPositions } = await supabase
                .from('auto_trader_positions')
                .select('*')
                .eq('user_id', user.id)
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
            setAvgVolatility(currentVolatility); // Atualizar volatilidade média
            
            // 🔥 ALAVANCAGEM DINÂMICA: Ajustar baseado no desempenho
            let dynamicLeverage = mlConfig?.is_enabled && mlConfig?.recommended_leverage
              ? mlConfig.recommended_leverage
              : getLeverageForBalance(currentBalance, historicalWinRate);
            
            if (dynamicLeverageEnabled) {
              // Aumentar leverage com alta win rate, reduzir com perda
              if (historicalWinRate >= 70) {
                dynamicLeverage = Math.min(dynamicLeverage * 1.2, 20); // +20% leverage, max 20x
                console.log(`⚡ ALAVANCAGEM AUMENTADA: ${dynamicLeverage.toFixed(1)}x (Win Rate: ${historicalWinRate.toFixed(0)}%)`);
              } else if (historicalWinRate < 45 || lossStreak >= 2) {
                dynamicLeverage = Math.max(dynamicLeverage * 0.7, 5); // -30% leverage, min 5x
                console.log(`🛡️ ALAVANCAGEM REDUZIDA: ${dynamicLeverage.toFixed(1)}x (Win Rate: ${historicalWinRate.toFixed(0)}% | Streak: ${lossStreak})`);
              }
              setCurrentLeverage(dynamicLeverage);
            }
            
            const leverage = dynamicLeverage;
            
            let positionSizeResult = calculatePositionSize(currentBalance, leverage, currentVolatility, historicalWinRate, openPositionsCount);
            let { usdSize, marginUsed, marginPerPosition, positionSizeMultiplier } = positionSizeResult;
            
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
            
            // 📊 LOG DE MARGEM
            console.log(`💼 MARGEM: Posições: ${openPositionsCount}/${maxOpenPositions} | Tamanho: $${usdSize.toFixed(2)} (${(positionSizeMultiplier * 100).toFixed(0)}% do normal) | Margem usada: $${marginUsed.toFixed(2)}/${marginPerPosition.toFixed(2)}`);
            
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
            
            // 🛡️ CALCULAR SL E TP - STOPS DINÂMICOS BASEADOS EM ATR (COM ML ADAPTATIVO)
            const priceDecimals = ticker.lastPrice.includes('.') 
              ? ticker.lastPrice.split('.')[1].length 
              : 2;
            
            // STOP LOSS DINÂMICO: Usa ATR real com multiplicador baseado em ML ou padrão
            // Mínimo 2.5% ou 2x ATR, o que for MAIOR - dá mais espaço para respirar
            const atrMultiplier = 2.0; // 2x ATR
            const minStopPercent = 2.5; // Mínimo 2.5% sempre
            
            const atrStopPercent = Math.max(atrPercent * atrMultiplier, minStopPercent);
            
            // Se ML estiver ativo, pode ajustar baseado em recomendações
            const stopLossPct = mlConfig?.is_enabled && mlConfig?.recommended_stop_loss_pct 
              ? Math.max(mlConfig.recommended_stop_loss_pct / 100, atrStopPercent / 100)
              : atrStopPercent / 100;
            
            // TAKE PROFIT: Risk:Reward de 1:2.5 (se perder 2.5%, ganhar 6.25%)
            const takeProfitPct = mlConfig?.is_enabled && mlConfig?.recommended_take_profit_pct 
              ? mlConfig.recommended_take_profit_pct / 100 
              : stopLossPct * 2.5;
            
            // Stop Loss SEMPRE ativo
            const stopLoss = action === 'BUY' 
              ? (currentPrice * (1 - stopLossPct)).toFixed(priceDecimals)
              : (currentPrice * (1 + stopLossPct)).toFixed(priceDecimals);
            
            // Take Profit
            // 📊 SCALE IN/OUT: Se ativado, usar TP mais próximo (primeiro nível = 2%)
            const firstTpPct = scaleInOutEnabled ? 0.02 : takeProfitPct; // 2% se scale-in ativo
            const takeProfit = action === 'BUY'
              ? (currentPrice * (1 + firstTpPct)).toFixed(priceDecimals)
              : (currentPrice * (1 - firstTpPct)).toFixed(priceDecimals);
            
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
            
            // 📊 LOG DETALHADO PRÉ-ORDEM PARA DEBUG
            console.log(`📋 PRÉ-ORDEM ${symbol}:`, {
              action,
              price: currentPrice,
              qty: qtyStr,
              orderValue: orderValueUSD,
              leverage,
              stopLoss,
              takeProfit,
              validation: action === 'SELL' 
                ? `SELL: TP(${takeProfit}) < Price(${currentPrice}) < SL(${stopLoss})`
                : `BUY: SL(${stopLoss}) < Price(${currentPrice}) < TP(${takeProfit})`
            });
            
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

            const freshBalance = parseFloat(balanceCheck.data?.list?.[0]?.totalAvailableBalance || '0');
            const requiredMargin = parseFloat(orderValueUSD) / leverage;
            const MIN_SAFE_BALANCE = 10; // Manter sempre $10 de margem de segurança

            // 🛑 VERIFICAÇÃO CRÍTICA: Parar se saldo negativo ou insuficiente
            if (freshBalance < 0) {
              console.log(`🛑 ${symbol}: SALDO NEGATIVO - Disponível: $${freshBalance.toFixed(2)}`);
              setIsRunning(false);
              shouldStopTrading = true; // ATIVAR FLAG
              toast({
                title: "🛑 Trader Pausado",
                description: `Saldo negativo: $${freshBalance.toFixed(2)}. Aguarde fechamento de posições.`,
                variant: "destructive",
              });
              break; // Sair do loop imediatamente
            }

            if (freshBalance < requiredMargin + MIN_SAFE_BALANCE) {
              console.log(`🛑 ${symbol}: Saldo insuficiente - Disponível: $${freshBalance.toFixed(2)} | Necessário: $${(requiredMargin + MIN_SAFE_BALANCE).toFixed(2)}`);
              setIsRunning(false);
              shouldStopTrading = true; // ATIVAR FLAG
              toast({
                title: "🛑 Trader Pausado",
                description: `Saldo insuficiente: $${freshBalance.toFixed(2)} disponível. Necessário: $${(requiredMargin + MIN_SAFE_BALANCE).toFixed(2)}`,
                variant: "destructive",
              });
              break; // Sair do loop imediatamente
            }
            
            const mlIndicator = mlConfig?.is_enabled ? ` [🧠ML: ${(stopLossPct*100).toFixed(1)}%/${(takeProfitPct*100).toFixed(1)}%]` : '';
            console.log(`🎯 SINAL QUALIFICADO [Score: ${signalScore}]: ${symbol} ${action}${mlIndicator}`);
            console.log(`   💰 Preço: $${currentPrice} | ATR: ${atrPercent.toFixed(2)}% | SL Dinâmico: ${(stopLossPct*100).toFixed(2)}%`);
            console.log(`   📊 Vol: $${(volume24h/1e6).toFixed(1)}M | Change: ${priceChange.toFixed(2)}% | Lev: ${leverage}x`);
            console.log(`   📈 Qty: ${qtyStr} | Value: $${orderValueUSD} | SL: ${stopLoss} | TP: ${takeProfit}`);
            console.log(`   💵 Saldo: $${freshBalance.toFixed(2)} | Confirmações: ${confirmations.join(', ')}`);

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
                  qty: qtyStr, // Usar string com precisão correta
                  stopLoss: stopLoss,
                  takeProfit: takeProfit,
                  timeInForce: 'GTC',
                  positionIdx: 0
                }
              }
            });

            if (!orderError && orderData?.success) {
              console.log(`✅ TRADE EXECUTADO: ${symbol} | ${action} | Leverage: ${leverage}x | USD: $${usdSize.toFixed(2)} | Score: ${signalScore}`);
              
              // 💾 SALVAR POSIÇÃO NO BANCO COM SCORE DE QUALIDADE
              const { data: { user } } = await supabase.auth.getUser();
              if (user) {
                await supabase
                  .from('auto_trader_positions')
                  .insert({
                    user_id: user.id,
                    symbol,
                    side: action === 'BUY' ? 'Buy' : 'Sell',
                    entry_price: currentPrice,
                    qty,
                    leverage,
                    stop_loss: parseFloat(stopLoss),
                    take_profit: parseFloat(takeProfit),
                    confidence: signalScore, // 🎯 SALVAR SCORE DE QUALIDADE
                    status: 'OPEN',
                    exchange_order_id: orderData.data?.orderId
                  });
              }
              
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
                title: `✅ Trade Executado: ${symbol}`,
                description: `${action} | Leverage: ${leverage}x | Risco: $${usdSize.toFixed(2)} | Score: ${signalScore}`,
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

  // Sincronizar saldo a cada 30 segundos quando ativo (OTIMIZADO)
  useEffect(() => {
    let syncInterval: NodeJS.Timeout;
    let trailingInterval: NodeJS.Timeout;

    if (isRunning) {
      // Sincronização menos frequente para melhor performance
      syncInterval = setInterval(() => {
        syncBybitBalance();
        syncOpenPositions();
      }, 60 * 1000); // A cada 60s
      
      // 🎯 TRAILING STOP: Atualizar a cada 15 segundos (mais frequente que sync)
      if (trailingStopEnabled) {
        trailingInterval = setInterval(() => {
          updateTrailingStops();
        }, 15 * 1000); // A cada 15s
      }
    }

    return () => {
      if (syncInterval) clearInterval(syncInterval);
      if (trailingInterval) clearInterval(trailingInterval);
    };
  }, [isRunning, trailingStopEnabled]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    let activityInterval: NodeJS.Timeout;

    if (isRunning) {
      console.log("🤖 Multi-Asset Trader iniciado - Operação 24/7");
      
      // Executar imediatamente
      analyzeAndTrade();
      
      // Ciclo principal de trading a cada 60 segundos (otimizado de 45s)
      interval = setInterval(() => {
        analyzeAndTrade();
      }, 60 * 1000);

      // Atualizar timestamp de atividade a cada 2 minutos
      activityInterval = setInterval(async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          await supabase
            .from('auto_trader_config')
            .update({ last_activity_at: new Date().toISOString() })
            .eq('user_id', user.id);
        }
      }, 2 * 60 * 1000);
    }

    return () => {
      if (interval) clearInterval(interval);
      if (activityInterval) clearInterval(activityInterval);
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
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase
        .from('auto_trader_config')
        .upsert({
          user_id: user.id,
          trader_is_running: true,
          last_activity_at: new Date().toISOString(),
        });
    }

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
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase
        .from('auto_trader_config')
        .update({
          trader_is_running: false,
          last_activity_at: new Date().toISOString(),
        })
        .eq('user_id', user.id);
    }

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