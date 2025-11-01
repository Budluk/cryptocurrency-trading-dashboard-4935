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
  const [isTestnet, setIsTestnet] = useState(false); // ⚡ CONTA REAL POR PADRÃO
  const [bankroll, setBankroll] = useState(9);
  const [currentBalance, setCurrentBalance] = useState(9);
  const [activeTrades, setActiveTrades] = useState<Trade[]>([]);
  const [totalPnL, setTotalPnL] = useState(0);
  const [cycleCount, setCycleCount] = useState(0);
  const { toast } = useToast();

  // Estratégia de alavancagem baseada no bankroll
  const getLeverageForBalance = (balance: number) => {
    if (balance < 5) return 20; // Máxima alavancagem quando muito baixo
    if (balance < 10) return 15;
    if (balance < 20) return 10;
    if (balance < 50) return 8;
    return 5; // Conservador quando tem capital
  };

  // Calcular tamanho da posição (1-5% do bankroll por trade)
  const calculatePositionSize = (balance: number, leverage: number) => {
    const riskPercent = balance < 15 ? 0.05 : 0.03; // 5% se baixo, 3% se ok
    const usdSize = balance * riskPercent;
    return { usdSize, quantity: (usdSize * leverage) };
  };

  const analyzeAndTrade = async () => {
    try {
      // 1. Buscar ativos mais voláteis da Bybit
      const { data: instrumentsData, error: instrumentsError } = await supabase.functions.invoke('bybit-trading', {
        body: {
          action: 'get_instruments',
          isTestnet,
          params: { category: 'linear', limit: 100, status: 'Trading' }
        }
      });

      if (instrumentsError || !instrumentsData?.success) {
        console.error('Erro ao buscar instrumentos:', instrumentsError);
        return;
      }

      const instruments = instrumentsData.data.list || [];
      
      // Focar em TODOS os ativos disponíveis para conta real
      const tradableAssets = instruments.filter((inst: any) => {
        return inst.status === 'Trading' && inst.quoteCoin === 'USDT';
      });

      console.log(`🎯 Analisando ${tradableAssets.length} ativos da Bybit (CONTA REAL)...`);

      // 2. Buscar ticker de cada ativo para análise de volume e volatilidade
      const { data: tickerData } = await supabase.functions.invoke('bybit-trading', {
        body: {
          action: 'get_ticker',
          isTestnet,
          params: { category: 'linear' }
        }
      });

      const tickers = tickerData?.data?.list || [];
      
      // 3. Analisar ativos com melhor volume/volatilidade
      for (const instrument of tradableAssets.slice(0, 20)) {
        if (!isRunning) break;

        const symbol = instrument.symbol;
        const ticker = tickers.find((t: any) => t.symbol === symbol);
        
        if (!ticker) continue;

        const volume24h = parseFloat(ticker.turnover24h || '0');
        const priceChange = parseFloat(ticker.price24hPcnt || '0') * 100;
        
        try {
          // Critérios de entrada baseados em dados reais:
          // 1. Volume 24h > $5M (liquidez suficiente)
          // 2. Variação de preço > 2% (volatilidade)
          // 3. Momento de entrada aleatório para diversificar
          const hasGoodVolume = volume24h > 5000000;
          const hasGoodVolatility = Math.abs(priceChange) > 2;
          const shouldTrade = Math.random() > 0.85 && hasGoodVolume && hasGoodVolatility; // 15% chance em ativos bons
          
          if (shouldTrade && currentBalance > 2) {
            // Determinar lado baseado na tendência de preço
            const action = priceChange > 0 ? 'BUY' : 'SELL'; // Seguir momentum
            const leverage = getLeverageForBalance(currentBalance);
            const { usdSize } = calculatePositionSize(currentBalance, leverage);
            
            const currentPrice = parseFloat(ticker.lastPrice);
            const atrEstimate = currentPrice * 0.02; // Estimar ATR como 2% do preço
            
            // Calcular SL e TP
            const stopLoss = action === 'BUY' 
              ? currentPrice - (atrEstimate * 1.5)
              : currentPrice + (atrEstimate * 1.5);
            
            const takeProfit = action === 'BUY'
              ? currentPrice + (atrEstimate * 3)
              : currentPrice - (atrEstimate * 3);
            
            console.log(`🚀 REAL TRADE: ${symbol} ${action} | Vol: $${(volume24h/1e6).toFixed(1)}M | Change: ${priceChange.toFixed(2)}% | Lev: ${leverage}x | Size: $${usdSize.toFixed(2)}`);

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
                  qty: (usdSize * leverage / currentPrice).toFixed(4),
                  stopLoss: stopLoss.toFixed(2),
                  takeProfit: takeProfit.toFixed(2),
                  timeInForce: 'GTC',
                  positionIdx: 0
                }
              }
            });

            if (!orderError && orderData?.success) {
              const trade: Trade = {
                symbol,
                action,
                confidence: 80 + Math.abs(priceChange) * 2, // Confiança baseada em volatilidade
                leverage,
                usdSize,
                timestamp: new Date().toISOString()
              };

              setActiveTrades(prev => [...prev.slice(-19), trade]); // Manter últimos 20 trades

              toast({
                title: `✅ Trade Real ${symbol}`,
                description: `${action} ${leverage}x | Vol: $${(volume24h/1e6).toFixed(1)}M`,
              });
            } else {
              console.error(`❌ Erro ao executar ${symbol}:`, orderError || orderData);
              toast({
                title: `❌ Falha ${symbol}`,
                description: orderError?.message || 'Erro ao executar ordem',
                variant: 'destructive'
              });
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

  useEffect(() => {
    let interval: NodeJS.Timeout;

    if (isRunning) {
      // Executar imediatamente
      analyzeAndTrade();
      
      // Depois repetir a cada 3 minutos (24/7 mais agressivo)
      interval = setInterval(() => {
        analyzeAndTrade();
      }, 3 * 60 * 1000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isRunning, currentBalance, isTestnet]);

  const startTrading = () => {
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

    setIsRunning(true);
    toast({
      title: "⚡ TRADER REAL 24/7 ATIVADO",
      description: `Capital: $${currentBalance.toFixed(2)} | Alavancagem: ${getLeverageForBalance(currentBalance)}x | Ciclo: 3min`,
    });
  };

  const stopTrading = () => {
    setIsRunning(false);
    toast({
      title: "⏸️ Trader pausado",
      description: `P&L Total: $${totalPnL.toFixed(2)}`,
    });
  };

  const resetBankroll = () => {
    setCurrentBalance(bankroll);
    setTotalPnL(0);
    setActiveTrades([]);
    setCycleCount(0);
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
              <span className="text-xs text-muted-foreground">Bankroll</span>
            </div>
            <div className="text-xl font-bold">${currentBalance.toFixed(2)}</div>
            <div className={`text-xs ${totalPnL >= 0 ? 'text-green-500' : 'text-red-500'}`}>
              {totalPnL >= 0 ? '+' : ''}{totalPnL.toFixed(2)} ({((totalPnL/bankroll)*100).toFixed(1)}%)
            </div>
          </Card>

          <Card className="p-4 bg-background/50">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="h-4 w-4 text-blue-500" />
              <span className="text-xs text-muted-foreground">Alavancagem</span>
            </div>
            <div className="text-xl font-bold">{getLeverageForBalance(currentBalance)}x</div>
            <div className="text-xs text-muted-foreground">
              Dinâmica
            </div>
          </Card>

          <Card className="p-4 bg-background/50">
            <div className="flex items-center gap-2 mb-1">
              <Zap className="h-4 w-4 text-yellow-500" />
              <span className="text-xs text-muted-foreground">Trades</span>
            </div>
            <div className="text-xl font-bold">{activeTrades.length}</div>
            <div className="text-xs text-muted-foreground">
              Executados
            </div>
          </Card>

          <Card className="p-4 bg-background/50">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="h-4 w-4 text-purple-500" />
              <span className="text-xs text-muted-foreground">Ciclos</span>
            </div>
            <div className="text-xl font-bold">{cycleCount}</div>
            <div className="text-xs text-muted-foreground">
              Completos
            </div>
          </Card>
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
              <span className="text-muted-foreground">Sistema operando...</span>
              <span className="text-green-500 font-semibold animate-pulse">● ATIVO</span>
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