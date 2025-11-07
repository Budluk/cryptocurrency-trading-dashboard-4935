import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Play, Square, Zap, DollarSign, TrendingUp } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

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
  const [isTestnet, setIsTestnet] = useState(false); // ⚡ CONTA REAL - TODOS OS ATIVOS
  const [bankroll, setBankroll] = useState(9);
  const [currentBalance, setCurrentBalance] = useState(9);
  const [activeTrades, setActiveTrades] = useState<Trade[]>([]);
  const [totalPnL, setTotalPnL] = useState(0);
  const [cycleCount, setCycleCount] = useState(0);
  const [dailyPnL, setDailyPnL] = useState(0);
  const [consecutiveLosses, setConsecutiveLosses] = useState(0);
  const [openPositionsCount, setOpenPositionsCount] = useState(0);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const { toast } = useToast();

  // PROTEÇÕES INTELIGENTES
  const DAILY_STOP_LOSS_PCT = 0.10; // -10% do bankroll
  const MAX_OPEN_POSITIONS = 5;
  const MAX_CONSECUTIVE_LOSSES = 3;
  
  // 🧠 SISTEMA DE GERENCIAMENTO DE CAPITAL DINÂMICO
  const [historicalWinRate, setHistoricalWinRate] = useState(50); // Win rate inicial estimado
  const [avgVolatility, setAvgVolatility] = useState(2); // Volatilidade média dos ativos

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

  // 📊 SINCRONIZAR POSIÇÕES ABERTAS
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
        console.log(`📈 Posições abertas: ${openPositions.length}`);
      }
    } catch (error) {
      console.error('Erro ao sincronizar posições:', error);
    }
  };

  const analyzeAndTrade = async () => {
    try {
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

      // 🔄 Sincronizar saldo e posições
      await syncBybitBalance();
      await syncOpenPositions();

      // 1. Buscar ativos mais voláteis da Bybit
      const { data: instrumentsData, error: instrumentsError } = await supabase.functions.invoke('bybit-trading', {
        body: {
          action: 'get_instruments',
          isTestnet: false, // ⚡ SEMPRE CONTA REAL
          params: { category: 'linear', limit: 100, status: 'Trading' }
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
      
      // 3. Analisar TODOS os ativos disponíveis (não limitar a 20)
      for (const instrument of tradableAssets) {
        if (!isRunning) break;

        const symbol = instrument.symbol;
        const ticker = tickers.find((t: any) => t.symbol === symbol);
        
        if (!ticker) continue;

        const volume24h = parseFloat(ticker.turnover24h || '0');
        const priceChange = parseFloat(ticker.price24hPcnt || '0') * 100;
        
        try {
          // ⚡ ANÁLISE TÉCNICA AVANÇADA PARA SINAIS DE QUALIDADE
          
          // 1. VALIDAÇÕES DE LIQUIDEZ E VOLATILIDADE
          const hasGoodVolume = volume24h > 1000000; // $1M mínimo
          const hasGoodVolatility = Math.abs(priceChange) > 0.8; // 0.8% mínimo
          
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
          
          // 5. FILTRO FINAL: Apenas sinais com score >= 65 e validações OK
          const shouldTrade = (
            signalScore >= 65 &&
            hasGoodVolume &&
            hasGoodVolatility &&
            action !== null &&
            currentBalance > 2 &&
            Math.random() > 0.70 // 30% chance final para não sobrecarregar
          );

          // 📋 MOTIVOS PARA NÃO EXECUTAR
          if (!shouldTrade && signalScore > 0) {
            let skipReason = '';
            if (signalScore < 65) skipReason = `Score baixo (${signalScore}/65)`;
            else if (!hasGoodVolume) skipReason = `Volume baixo ($${(volume24h/1e6).toFixed(1)}M < $1M)`;
            else if (!hasGoodVolatility) skipReason = `Volatilidade baixa (${Math.abs(priceChange).toFixed(2)}% < 0.8%)`;
            else if (currentBalance <= 2) skipReason = `Saldo insuficiente ($${currentBalance.toFixed(2)})`;
            else if (action === null) skipReason = 'Sem sinal claro de entrada';
            else skipReason = 'Filtro de frequência (evitar overtrading)';
            
            console.log(`⏭️ ${symbol} PULADO: ${skipReason}`);
          }
          
          if (shouldTrade && action) {
            const currentVolatility = Math.abs(priceChange);
            setAvgVolatility(currentVolatility); // Atualizar volatilidade média
            
            const leverage = getLeverageForBalance(currentBalance, historicalWinRate);
            const { usdSize } = calculatePositionSize(currentBalance, leverage, currentVolatility, historicalWinRate);
            
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
            
            // 🛡️ CALCULAR SL E TP - STOPS OBRIGATÓRIOS
            const priceDecimals = ticker.lastPrice.includes('.') 
              ? ticker.lastPrice.split('.')[1].length 
              : 2;
            
            // Stop Loss SEMPRE ativo - 2% de distância
            const stopLoss = action === 'BUY' 
              ? (currentPrice * 0.98).toFixed(priceDecimals) // -2% para BUY
              : (currentPrice * 1.02).toFixed(priceDecimals); // +2% para SELL
            
            // Take Profit - 4% de distância (risco/retorno 1:2)
            const takeProfit = action === 'BUY'
              ? (currentPrice * 1.04).toFixed(priceDecimals) // +4% para BUY
              : (currentPrice * 0.96).toFixed(priceDecimals); // -4% para SELL
            
            // Validar que SL está correto para a direção
            if (action === 'BUY' && parseFloat(stopLoss) >= currentPrice) {
              console.log(`⚠️ ${symbol}: Stop Loss inválido para BUY (${stopLoss} >= ${currentPrice})`);
              continue;
            }
            if (action === 'SELL' && parseFloat(stopLoss) <= currentPrice) {
              console.log(`⚠️ ${symbol}: Stop Loss inválido para SELL (${stopLoss} <= ${currentPrice})`);
              continue;
            }
            
            const orderValueUSD = (qty * currentPrice).toFixed(2);
            
            // 🔧 Converter qty para string com precisão correta
            const qtyStr = qty.toFixed(decimals);
            
            console.log(`🎯 SINAL QUALIFICADO [Score: ${signalScore}]: ${symbol} ${action} | Vol: $${(volume24h/1e6).toFixed(1)}M | Change: ${priceChange.toFixed(2)}% | Lev: ${leverage}x | Qty: ${qtyStr} | Price: $${currentPrice} | Value: $${orderValueUSD} | SL: ${stopLoss} | TP: ${takeProfit}`);

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
              const trade: Trade = {
                symbol,
                action,
                confidence: signalScore, // Usar score real do sinal
                leverage,
                usdSize,
                timestamp: new Date().toISOString()
              };

              setActiveTrades(prev => [...prev.slice(-19), trade]);
              setOpenPositionsCount(prev => prev + 1);
              
              // 💾 SALVAR POSIÇÃO NA TABELA PARA MONITORAMENTO AUTOMÁTICO
              try {
                const { data: { user } } = await supabase.auth.getUser();
                if (user) {
                  await supabase.from('auto_trader_positions').insert({
                    user_id: user.id,
                    symbol: symbol,
                    side: action,
                    qty: qty,
                    entry_price: currentPrice,
                    current_price: currentPrice,
                    highest_price: currentPrice, // Iniciar com preço de entrada
                    stop_loss: parseFloat(stopLoss),
                    take_profit: parseFloat(takeProfit),
                    leverage: leverage,
                    status: 'OPEN',
                    confidence: signalScore,
                    trailing_stop_percentage: 1.5, // 1.5% trailing stop padrão
                    unrealized_pnl: 0,
                    exchange_order_id: orderData.data?.orderId,
                    opened_at: new Date().toISOString()
                  });
                  
                  console.log(`💾 Posição salva: ${symbol} ${action} @ ${currentPrice}`);
                }
              } catch (dbError) {
                console.error('Erro ao salvar posição no DB:', dbError);
              }
              
              toast({
                title: "✅ Ordem Executada",
                description: `${symbol} ${action} - Qty: ${qty} - Valor: $${orderValueUSD} | 🎯 Trailing Stop: 1.5%`,
              });
            } else {
              console.error(`❌ Erro ao executar ${symbol}:`, orderError);
              const errorMsg = orderData?.error || orderError?.message || 'Erro desconhecido';
              
              // 📋 MOTIVOS DETALHADOS DE FALHA
              let failureReason = errorMsg;
              if (errorMsg.includes('minNotional')) {
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
                balance: currentBalance
              });
              
              // Incrementar perdas consecutivas em caso de erro
              setConsecutiveLosses(prev => prev + 1);
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

  // Sincronizar saldo a cada 30 segundos quando ativo
  useEffect(() => {
    let syncInterval: NodeJS.Timeout;

    if (isRunning) {
      syncInterval = setInterval(() => {
        syncBybitBalance();
        syncOpenPositions();
      }, 30 * 1000);
    }

    return () => {
      if (syncInterval) clearInterval(syncInterval);
    };
  }, [isRunning]);

  useEffect(() => {
    let interval: NodeJS.Timeout;

    if (isRunning) {
      // Executar imediatamente
      analyzeAndTrade();
      
      // Depois repetir a cada 2 minutos (mais agressivo)
      interval = setInterval(() => {
        analyzeAndTrade();
      }, 2 * 60 * 1000);
    }

    return () => {
      if (interval) clearInterval(interval);
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
        description: "Alterne para REAL para operar com dinheiro real",
        variant: "destructive",
      });
      return;
    }

    // Sincronizar antes de iniciar
    await syncBybitBalance();
    await syncOpenPositions();

    setIsRunning(true);
    toast({
      title: "⚡ TRADER REAL 24/7 ATIVADO",
      description: `Capital: $${currentBalance.toFixed(2)} | Lev: ${getLeverageForBalance(currentBalance, historicalWinRate)}x | Win Rate: ${historicalWinRate.toFixed(0)}% | Ciclo: 2min`,
    });
  };

  const stopTrading = () => {
    setIsRunning(false);
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
          
          <Badge variant={isTestnet ? "outline" : "destructive"} className="text-lg px-4 py-2">
            {isTestnet ? '🧪 TESTNET' : '⚡ REAL'}
          </Badge>
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
              className="flex-1"
              size="lg"
            >
              <Square className="h-5 w-5 mr-2" />
              Parar Trader
            </Button>
          )}
        </div>

        {isRunning && (
          <div className="mt-4">
            <div className="flex items-center justify-between text-sm mb-2">
              <div className="flex items-center gap-3">
                <span className="text-green-500 font-semibold animate-pulse">● OPERANDO</span>
                <span className="text-xs text-muted-foreground">
                  Ciclo: {cycleCount} | Próx: 2min
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