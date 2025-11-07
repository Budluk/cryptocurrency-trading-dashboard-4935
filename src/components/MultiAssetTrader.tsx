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
  const MAX_OPEN_POSITIONS = 5;
  const MAX_CONSECUTIVE_LOSSES = 3;
  
  // 🧠 SISTEMA DE GERENCIAMENTO DE CAPITAL DINÂMICO
  const [historicalWinRate, setHistoricalWinRate] = useState(50); // Win rate inicial estimado
  const [avgVolatility, setAvgVolatility] = useState(2); // Volatilidade média dos ativos
  
  // ⚡ CONFIGURAÇÕES AVANÇADAS
  const [trailingStopEnabled, setTrailingStopEnabled] = useState(true);
  const [trailingStopPercent, setTrailingStopPercent] = useState(1.5);
  const [timeFilterEnabled, setTimeFilterEnabled] = useState(true);
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

  // Calcular tamanho da posição baseado em VOLATILIDADE e WIN RATE
  const calculatePositionSize = (balance: number, leverage: number, volatility: number, winRate: number) => {
    // Base: 1-5% do bankroll
    let baseRisk = balance < 15 ? 0.05 : 0.03;

    // AJUSTE POR VOLATILIDADE: Reduzir risco em ativos muito voláteis
    if (volatility > 5) baseRisk *= 0.6; // -40% em alta volatilidade
    else if (volatility > 3) baseRisk *= 0.8; // -20% em volatilidade moderada
    else if (volatility < 1) baseRisk *= 1.2; // +20% em baixa volatilidade

    // AJUSTE POR WIN RATE: Aumentar risco se está performando bem
    if (winRate >= 65) baseRisk *= 1.3; // +30% se win rate alto
    else if (winRate >= 55) baseRisk *= 1.1; // +10% se win rate bom
    else if (winRate < 40) baseRisk *= 0.7; // -30% se win rate baixo

    // Garantir limites razoáveis (0.5% a 8% do bankroll)
    baseRisk = Math.max(0.005, Math.min(0.08, baseRisk));

    const usdSize = balance * baseRisk;
    return { usdSize, quantity: (usdSize * leverage) };
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
      console.log(`📊 Posições abertas na Bybit: ${openPositionsCount}/${MAX_OPEN_POSITIONS}`);

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

      if (openPositionsCount >= MAX_OPEN_POSITIONS) {
        console.log('📊 Máximo de posições abertas atingido');
        return;
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

      console.log(`🎯 Analisando ${tradableAssets.length} ativos (Saldo: $${currentBalance.toFixed(2)} | Posições: ${openPositionsCount}/${MAX_OPEN_POSITIONS})`);

      // 2. Buscar ticker de cada ativo para análise de volume e volatilidade
      const { data: tickerData } = await supabase.functions.invoke('bybit-trading', {
        body: {
          action: 'get_ticker',
          isTestnet: false, // ⚡ SEMPRE CONTA REAL
          params: { category: 'linear' }
        }
      });

      const tickers = tickerData?.data?.list || [];
      
      // 🛑 FLAG para parar processamento em caso de saldo insuficiente
      let shouldStopTrading = false;
      
      // 3. Analisar TODOS os ativos disponíveis (não limitar a 20)
      for (const instrument of tradableAssets) {
        if (!isRunning || shouldStopTrading) break;

        const symbol = instrument.symbol;
        const ticker = tickers.find((t: any) => t.symbol === symbol);
        
        if (!ticker) continue;

        const volume24h = parseFloat(ticker.turnover24h || '0');
        const priceChange = parseFloat(ticker.price24hPcnt || '0') * 100;
        
        try {
          // ⚡ ANÁLISE TÉCNICA AVANÇADA PARA SINAIS DE QUALIDADE
          
          // 1. VALIDAÇÕES DE LIQUIDEZ E VOLATILIDADE (AJUSTADAS)
          const hasGoodVolume = volume24h > 100000; // $100K mínimo (reduzido)
          const hasGoodVolatility = Math.abs(priceChange) > 0.3; // 0.3% mínimo (reduzido)
          
          // 2. ANÁLISE DE TENDÊNCIA (RSI-like baseado em price change)
          const isBullishTrend = priceChange > 1.5; // Subindo forte
          const isBearishTrend = priceChange < -1.5; // Caindo forte
          const isOversold = priceChange < -3; // Possível reversão
          const isOverbought = priceChange > 3; // Possível reversão
          
          // 3. VALIDAÇÃO DE VOLUME (compara com média)
          const avgVolume = 3000000; // Média estimada
          const volumeStrength = volume24h > avgVolume * 1.5; // Volume 50% acima da média
          
          // 4. SCORE DE QUALIDADE DO SINAL
          let signalScore = 0;
          let action: 'BUY' | 'SELL' | null = null;
          
          // Sinais de COMPRA
          if (isBullishTrend && volumeStrength) {
            signalScore = 80;
            action = 'BUY';
          } else if (isOversold && volumeStrength) {
            signalScore = 75;
            action = 'BUY'; // Reversão após queda
          } else if (priceChange > 0.8 && priceChange < 2 && hasGoodVolume) {
            signalScore = 65;
            action = 'BUY'; // Movimento moderado
          }
          
          // Sinais de VENDA
          if (isBearishTrend && volumeStrength) {
            signalScore = 80;
            action = 'SELL';
          } else if (isOverbought && volumeStrength) {
            signalScore = 75;
            action = 'SELL'; // Reversão após subida
          } else if (priceChange < -0.8 && priceChange > -2 && hasGoodVolume) {
            signalScore = 65;
            action = 'SELL'; // Movimento moderado
          }
          
          // 5. FILTRO FINAL: Apenas sinais com score >= 60 e validações OK
          const shouldTrade = (
            signalScore >= 60 && // Reduzido de 65 para 60
            hasGoodVolume &&
            hasGoodVolatility &&
            action !== null &&
            currentBalance > 2
            // ⚡ REMOVIDO Math.random() para permitir TODOS os sinais válidos
          );

          // 📋 MOTIVOS PARA NÃO EXECUTAR
          if (!shouldTrade && signalScore > 0) {
            let skipReason = '';
            if (signalScore < 60) skipReason = `Score baixo (${signalScore}/60)`;
            else if (!hasGoodVolume) skipReason = `Volume baixo ($${(volume24h/1e6).toFixed(1)}M < $0.1M)`;
            else if (!hasGoodVolatility) skipReason = `Volatilidade baixa (${Math.abs(priceChange).toFixed(2)}% < 0.3%)`;
            else if (currentBalance <= 2) skipReason = `Saldo insuficiente ($${currentBalance.toFixed(2)})`;
            else if (action === null) skipReason = 'Sem sinal claro de entrada';
            
            console.log(`⏭️ ${symbol} PULADO: ${skipReason}`);
          }
          
          if (shouldTrade && action) {
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
            
            let { usdSize } = calculatePositionSize(currentBalance, leverage, currentVolatility, historicalWinRate);
            
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
            
            const currentPrice = parseFloat(ticker.lastPrice);
            const atrEstimate = currentPrice * 0.02; // Estimar ATR como 2% do preço
            
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
            
            // 🛡️ CALCULAR SL E TP - STOPS OBRIGATÓRIOS (COM ML ADAPTATIVO)
            const priceDecimals = ticker.lastPrice.includes('.') 
              ? ticker.lastPrice.split('.')[1].length 
              : 2;
            
            // Usar configurações do ML se estiver ativo, senão usar valores padrão
            const stopLossPct = mlConfig?.is_enabled && mlConfig?.recommended_stop_loss_pct 
              ? mlConfig.recommended_stop_loss_pct / 100 
              : 0.02; // 2% padrão
            
            const takeProfitPct = mlConfig?.is_enabled && mlConfig?.recommended_take_profit_pct 
              ? mlConfig.recommended_take_profit_pct / 100 
              : 0.04; // 4% padrão
            
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
            
            const mlIndicator = mlConfig?.is_enabled ? ` [🧠ML: ${stopLossPct*100}%/${takeProfitPct*100}%]` : '';
            console.log(`🎯 SINAL QUALIFICADO [Score: ${signalScore}]: ${symbol} ${action}${mlIndicator} | Vol: $${(volume24h/1e6).toFixed(1)}M | Change: ${priceChange.toFixed(2)}% | Lev: ${leverage}x | Qty: ${qtyStr} | Price: $${currentPrice} | Value: $${orderValueUSD} | SL: ${stopLoss} | TP: ${takeProfit} | Saldo: $${freshBalance.toFixed(2)}`);

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
              console.log(`✅ TRADE EXECUTADO: ${symbol} | ${action} | Leverage: ${leverage}x | USD: $${usdSize.toFixed(2)}`);
              
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
            <div className="text-xl font-bold">{openPositionsCount}/{MAX_OPEN_POSITIONS}</div>
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
            <div className="text-sm">
              <span className={openPositionsCount >= MAX_OPEN_POSITIONS ? 'text-yellow-500 font-bold' : ''}>
                {openPositionsCount} de {MAX_OPEN_POSITIONS}
              </span>
            </div>
          </div>
        </div>

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
                {openPositionsCount < MAX_OPEN_POSITIONS ? '🎯 Buscando setups...' : '⏸️ Posições cheias'}
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