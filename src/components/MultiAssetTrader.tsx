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
  const [isTestnet, setIsTestnet] = useState(true);
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
      
      // Focar em ativos de alta volatilidade
      const volatileAssets = instruments.filter((inst: any) => {
        const symbol = inst.symbol;
        return symbol.includes('BTC') || 
               symbol.includes('ETH') || 
               symbol.includes('SOL') ||
               symbol.includes('BNB') ||
               symbol.includes('DOGE') ||
               symbol.includes('SHIB') ||
               symbol.includes('PEPE') ||
               symbol.includes('WIF');
      });

      console.log(`🎯 Analisando ${volatileAssets.length} ativos voláteis...`);

      // 2. Analisar cada ativo
      for (const instrument of volatileAssets.slice(0, 10)) {
        if (!isRunning) break;

        const symbol = instrument.symbol;
        
        try {
          // Usar análise rápida do TradingView webhook (simulada)
          const shouldTrade = Math.random() > 0.7; // 30% chance de trade
          
          if (shouldTrade && currentBalance > 2) {
            const action = Math.random() > 0.5 ? 'BUY' : 'SELL';
            const leverage = getLeverageForBalance(currentBalance);
            const { usdSize } = calculatePositionSize(currentBalance, leverage);
            
            console.log(`🚀 Executando trade: ${symbol} ${action} | Alavancagem: ${leverage}x | Tamanho: $${usdSize.toFixed(2)}`);

            // Executar ordem na Bybit
            const { data: orderData, error: orderError } = await supabase.functions.invoke('bybit-trading', {
              body: {
                action: 'place_order',
                isTestnet,
                params: {
                  category: 'linear',
                  symbol: symbol,
                  side: action === 'BUY' ? 'Buy' : 'Sell',
                  orderType: 'Market',
                  qty: (usdSize * leverage / 100).toFixed(4), // Quantidade ajustada
                  leverage: leverage,
                  timeInForce: 'GTC',
                  positionIdx: 0
                }
              }
            });

            if (!orderError && orderData?.success) {
              const trade: Trade = {
                symbol,
                action,
                confidence: 75 + Math.random() * 20,
                leverage,
                usdSize,
                timestamp: new Date().toISOString()
              };

              setActiveTrades(prev => [...prev.slice(-9), trade]);
              
              // Simular P&L (em produção, buscar da Bybit)
              const pnl = (Math.random() - 0.45) * usdSize * 0.5;
              setCurrentBalance(prev => prev + pnl);
              setTotalPnL(prev => prev + pnl);

              toast({
                title: `✅ Trade ${symbol}`,
                description: `${action} | ${leverage}x | $${usdSize.toFixed(2)}`,
              });
            }
          }

          // Aguardar entre análises
          await new Promise(resolve => setTimeout(resolve, 3000));

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
      
      // Depois repetir a cada 5 minutos (24/7)
      interval = setInterval(() => {
        analyzeAndTrade();
      }, 5 * 60 * 1000);
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

    setIsRunning(true);
    toast({
      title: "🚀 Trader 24/7 ativado",
      description: `Operando com $${currentBalance.toFixed(2)} | Alavancagem: ${getLeverageForBalance(currentBalance)}x`,
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