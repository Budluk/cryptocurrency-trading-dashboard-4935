import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Play, Square, TrendingUp, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface AnalysisResult {
  symbol: string;
  action: string;
  confidence: number;
  entry_price: number;
  target_price: number;
  stop_loss: number;
  reasoning: string;
}

export const AutoTrader = () => {
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentSymbol, setCurrentSymbol] = useState("");
  const [analyzedCount, setAnalyzedCount] = useState(0);
  const [executedTrades, setExecutedTrades] = useState<AnalysisResult[]>([]);
  const [isTestnet, setIsTestnet] = useState(true);
  const { toast } = useToast();

  const startAutoTrading = async () => {
    setIsRunning(true);
    setProgress(0);
    setAnalyzedCount(0);
    setExecutedTrades([]);

    try {
      // 1. Buscar lista de instrumentos da Bybit
      toast({
        title: "🔍 Buscando ativos...",
        description: "Carregando lista de criptomoedas da Bybit",
      });

      const { data: instrumentsData, error: instrumentsError } = await supabase.functions.invoke('bybit-trading', {
        body: {
          action: 'get_instruments',
          isTestnet,
          params: { category: 'linear', limit: 50 }
        }
      });

      if (instrumentsError || !instrumentsData?.success) {
        throw new Error('Falha ao buscar instrumentos da Bybit');
      }

      const instruments = instrumentsData.data.list || [];
      const totalSymbols = instruments.length;

      toast({
        title: "✅ Ativos carregados",
        description: `${totalSymbols} ativos encontrados. Iniciando análise...`,
      });

      // 2. Analisar cada símbolo
      for (let i = 0; i < instruments.length && isRunning; i++) {
        const instrument = instruments[i];
        const symbol = instrument.symbol.replace('USDT', '/USD');
        
        setCurrentSymbol(symbol);
        setProgress((i / totalSymbols) * 100);

        try {
          // Analisar com IA
          const { data: analysisData, error: analysisError } = await supabase.functions.invoke('ai-market-analysis', {
            body: {
              symbol,
              timeframe: '1h',
              analysis_type: 'comprehensive'
            }
          });

          if (analysisError || !analysisData?.success) {
            console.error(`Erro ao analisar ${symbol}:`, analysisError);
            continue;
          }

          setAnalyzedCount(i + 1);

          const signal = analysisData.signal;
          
          // 3. Se confiança >= 85% e não for HOLD, executar trade
          if (signal.confidence >= 85 && signal.action !== 'HOLD') {
            console.log(`🎯 Sinal forte encontrado: ${symbol} - ${signal.action} (${signal.confidence}%)`);

            // Calcular quantidade baseada no saldo (exemplo: 1% do saldo por trade)
            const quantity = 0.01; // Ajustar conforme necessário

            const orderParams = {
              category: 'linear',
              symbol: instrument.symbol,
              side: signal.action === 'BUY' ? 'Buy' : 'Sell',
              orderType: 'Market',
              qty: quantity.toString(),
              timeInForce: 'GTC',
              positionIdx: 0
            };

            // Executar ordem
            const { data: orderData, error: orderError } = await supabase.functions.invoke('bybit-trading', {
              body: {
                action: 'place_order',
                isTestnet,
                params: orderParams
              }
            });

            if (!orderError && orderData?.success) {
              const tradeResult: AnalysisResult = {
                symbol,
                action: signal.action,
                confidence: signal.confidence,
                entry_price: signal.entry_price,
                target_price: signal.target_price,
                stop_loss: signal.stop_loss,
                reasoning: signal.reasoning
              };
              
              setExecutedTrades(prev => [...prev, tradeResult]);

              toast({
                title: `✅ Trade executado: ${symbol}`,
                description: `${signal.action} com ${signal.confidence}% de confiança`,
              });
            } else {
              console.error(`Erro ao executar ordem para ${symbol}:`, orderError);
            }
          }

          // Aguardar um pouco entre análises para não sobrecarregar
          await new Promise(resolve => setTimeout(resolve, 2000));

        } catch (error) {
          console.error(`Erro ao processar ${symbol}:`, error);
        }
      }

      setProgress(100);
      toast({
        title: "✅ Análise completa!",
        description: `${analyzedCount} ativos analisados, ${executedTrades.length} trades executados`,
      });

    } catch (error: any) {
      console.error('Erro no auto trader:', error);
      toast({
        title: "❌ Erro no auto trader",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsRunning(false);
    }
  };

  const stopAutoTrading = () => {
    setIsRunning(false);
    toast({
      title: "⏸️ Auto trader pausado",
      description: "Análise interrompida pelo usuário",
    });
  };

  return (
    <div className="space-y-4">
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-xl font-bold flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Auto Trader IA
            </h3>
            <p className="text-sm text-muted-foreground">
              Analisa todos os ativos e executa trades com confiança ≥ 85%
            </p>
          </div>
          
          <Badge variant={isTestnet ? "outline" : "destructive"}>
            {isTestnet ? 'TESTNET' : 'REAL'}
          </Badge>
        </div>

        <div className="flex items-center gap-2 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg mb-4">
          <AlertTriangle className="h-5 w-5 text-yellow-500" />
          <p className="text-sm text-yellow-700 dark:text-yellow-300">
            <strong>Atenção:</strong> Esta funcionalidade executa trades automaticamente. 
            Use apenas em modo TESTNET para testes iniciais.
          </p>
        </div>

        {isRunning && (
          <div className="space-y-3 mb-4">
            <div className="flex items-center justify-between text-sm">
              <span>Analisando: {currentSymbol}</span>
              <span>{analyzedCount} ativos processados</span>
            </div>
            <Progress value={progress} className="h-2" />
            <div className="text-xs text-muted-foreground text-center">
              {executedTrades.length} trades executados
            </div>
          </div>
        )}

        <div className="flex gap-2">
          {!isRunning ? (
            <Button 
              onClick={startAutoTrading} 
              className="flex-1"
            >
              <Play className="h-4 w-4 mr-2" />
              Iniciar Auto Trader
            </Button>
          ) : (
            <Button 
              onClick={stopAutoTrading} 
              variant="destructive"
              className="flex-1"
            >
              <Square className="h-4 w-4 mr-2" />
              Parar
            </Button>
          )}
        </div>
      </Card>

      {executedTrades.length > 0 && (
        <Card className="p-6">
          <h4 className="font-semibold mb-4">Trades Executados ({executedTrades.length})</h4>
          <div className="space-y-3">
            {executedTrades.map((trade, idx) => (
              <div 
                key={idx} 
                className="p-3 bg-muted rounded-lg border border-border"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold">{trade.symbol}</span>
                  <Badge variant={trade.action === 'BUY' ? 'default' : 'destructive'}>
                    {trade.action} - {trade.confidence}%
                  </Badge>
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs text-muted-foreground">
                  <div>
                    <div className="font-medium">Entrada</div>
                    <div>${trade.entry_price.toFixed(2)}</div>
                  </div>
                  <div>
                    <div className="font-medium">Alvo</div>
                    <div>${trade.target_price.toFixed(2)}</div>
                  </div>
                  <div>
                    <div className="font-medium">Stop</div>
                    <div>${trade.stop_loss.toFixed(2)}</div>
                  </div>
                </div>
                <p className="text-xs mt-2 text-muted-foreground line-clamp-2">
                  {trade.reasoning}
                </p>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
};
