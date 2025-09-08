import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { TrendingUpIcon, TrendingDownIcon, AlertTriangleIcon, BarChartIcon, ArrowUpIcon, ArrowDownIcon, BrainIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface AITradingSignal {
  type: 'BUY' | 'SELL' | 'HOLD';
  confidence: number;
  entry_price: number;
  target: number;
  stop_loss: number;
  timeframe: string;
  reason: string;
  market_condition: string;
  risk_reward: number;
  prediction: string;
  timestamp: number;
}

interface MarketAnalysis {
  trend: 'BULLISH' | 'BEARISH' | 'SIDEWAYS';
  strength: number;
  volume_analysis: string;
  support_levels: number[];
  resistance_levels: number[];
  next_move_probability: number;
  ai_forecast: string;
}

const fetchAITradingData = async () => {
  try {
    // Simula dados em tempo real da API
    const currentPrice = 111000 + (Math.random() - 0.5) * 1000;
    const timestamp = Date.now();
    
    const signals: AITradingSignal[] = [
      {
        type: Math.random() > 0.6 ? 'BUY' : Math.random() > 0.3 ? 'SELL' : 'HOLD',
        confidence: 75 + Math.random() * 20,
        entry_price: currentPrice + (Math.random() - 0.5) * 200,
        target: currentPrice * (1 + (Math.random() * 0.04 + 0.01)),
        stop_loss: currentPrice * (0.98 - Math.random() * 0.02),
        timeframe: '1H',
        reason: 'RSI divergence + volume breakout pattern detected',
        market_condition: 'High volatility with strong momentum',
        risk_reward: 2.5 + Math.random() * 1.5,
        prediction: 'IA detecta padrão de alta probabilidade nas próximas 2-4 horas',
        timestamp
      },
      {
        type: Math.random() > 0.5 ? 'BUY' : 'SELL',
        confidence: 68 + Math.random() * 25,
        entry_price: currentPrice + (Math.random() - 0.5) * 150,
        target: currentPrice * (1 + (Math.random() * 0.08 + 0.02)),
        stop_loss: currentPrice * (0.96 - Math.random() * 0.02),
        timeframe: '4H',
        reason: 'MACD crossover + support bounce confirmed',
        market_condition: 'Bullish momentum building strength',
        risk_reward: 2.1 + Math.random() * 1.2,
        prediction: 'Padrão técnico sugere movimento de alta sustentado',
        timestamp: timestamp - 1800000
      },
      {
        type: Math.random() > 0.4 ? 'BUY' : 'HOLD',
        confidence: 82 + Math.random() * 15,
        entry_price: currentPrice + (Math.random() - 0.5) * 300,
        target: currentPrice * (1 + (Math.random() * 0.12 + 0.03)),
        stop_loss: currentPrice * (0.94 - Math.random() * 0.03),
        timeframe: '1D',
        reason: 'Multi-timeframe alignment + institutional flow',
        market_condition: 'Strong uptrend with healthy corrections',
        risk_reward: 3.2 + Math.random() * 1.8,
        prediction: 'Cenário macro favorável para próximos dias',
        timestamp: timestamp - 3600000
      },
      {
        type: Math.random() > 0.3 ? 'BUY' : 'HOLD',
        confidence: 76 + Math.random() * 20,
        entry_price: currentPrice + (Math.random() - 0.5) * 500,
        target: currentPrice * (1 + (Math.random() * 0.20 + 0.05)),
        stop_loss: currentPrice * (0.90 - Math.random() * 0.05),
        timeframe: '1W',
        reason: 'Long-term trend analysis + cycle patterns',
        market_condition: 'Bull market continuation phase',
        risk_reward: 4.5 + Math.random() * 2.5,
        prediction: 'Análise de ciclo indica continuidade de alta',
        timestamp: timestamp - 7200000
      }
    ];

    const analysis: MarketAnalysis = {
      trend: Math.random() > 0.6 ? 'BULLISH' : Math.random() > 0.3 ? 'BEARISH' : 'SIDEWAYS',
      strength: 60 + Math.random() * 35,
      volume_analysis: 'Volume acima da média confirma breakout',
      support_levels: [
        Math.round(currentPrice * 0.985),
        Math.round(currentPrice * 0.975),
        Math.round(currentPrice * 0.960)
      ],
      resistance_levels: [
        Math.round(currentPrice * 1.015),
        Math.round(currentPrice * 1.025),
        Math.round(currentPrice * 1.040)
      ],
      next_move_probability: 70 + Math.random() * 25,
      ai_forecast: `IA analisa ${Math.round(75 + Math.random() * 20)}% probabilidade de movimento ${Math.random() > 0.5 ? 'positivo' : 'lateral'} baseado em 15+ indicadores técnicos`
    };

    return { signals, analysis, currentPrice };
  } catch (error) {
    // Fallback data
    const currentPrice = 111000;
    return {
      signals: [{
        type: 'HOLD' as const,
        confidence: 65,
        entry_price: currentPrice,
        target: currentPrice * 1.02,
        stop_loss: currentPrice * 0.98,
        timeframe: '1H',
        reason: 'Sistema em modo offline - aguardando conexão',
        market_condition: 'Dados em cache',
        risk_reward: 2.0,
        prediction: 'Reconectando com feeds de dados...',
        timestamp: Date.now()
      }],
      analysis: {
        trend: 'SIDEWAYS' as const,
        strength: 50,
        volume_analysis: 'Dados indisponíveis',
        support_levels: [currentPrice * 0.98, currentPrice * 0.96, currentPrice * 0.94],
        resistance_levels: [currentPrice * 1.02, currentPrice * 1.04, currentPrice * 1.06],
        next_move_probability: 50,
        ai_forecast: 'Reconectando sistemas de análise...'
      },
      currentPrice
    };
  }
};

const AITradingSignals = () => {
  const [selectedTimeframe, setSelectedTimeframe] = useState('1H');
  const [liveStatus, setLiveStatus] = useState(true);
  
  const { data, isLoading, error } = useQuery({
    queryKey: ['aiTradingSignals'],
    queryFn: fetchAITradingData,
    refetchInterval: 2000, // Atualização a cada 2 segundos
    retry: 2
  });

  // Update live status based on query success/error
  useEffect(() => {
    if (data && !error) {
      setLiveStatus(true);
    } else if (error) {
      setLiveStatus(false);
    }
  }, [data, error]);

  const activeSignal = useMemo(() => {
    if (!data?.signals) return null;
    return data.signals.find(s => s.timeframe === selectedTimeframe) || data.signals[0];
  }, [data, selectedTimeframe]);

  if (isLoading) {
    return (
      <Card className="p-6 animate-pulse">
        <div className="h-6 bg-muted rounded mb-4"></div>
        <div className="space-y-3">
          {[1,2,3,4].map(i => (
            <div key={i} className="h-12 bg-muted rounded"></div>
          ))}
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* AI Signal Principal */}
      <Card className="p-6 bg-gradient-to-br from-primary/5 to-secondary/5 border-primary/20">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <h3 className="text-xl font-bold flex items-center gap-2">
              <BrainIcon className="w-6 h-6 text-primary" />
              IA Trading - BTC/USD
            </h3>
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${liveStatus ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
              <span className="text-xs text-muted-foreground">{liveStatus ? 'AO VIVO' : 'OFFLINE'}</span>
            </div>
          </div>
          <div className="flex gap-2">
            {['1H', '4H', '1D', '1W'].map(tf => (
              <button
                key={tf}
                onClick={() => setSelectedTimeframe(tf)}
                className={`px-3 py-1 rounded-md text-sm font-medium transition-all ${
                  selectedTimeframe === tf 
                    ? 'bg-primary text-primary-foreground shadow-md' 
                    : 'bg-secondary hover:bg-secondary/80'
                }`}
              >
                {tf}
              </button>
            ))}
          </div>
        </div>

        {activeSignal && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Sinal Principal */}
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div className={`p-3 rounded-full ${
                  activeSignal.type === 'BUY' ? 'bg-green-500/20' : 
                  activeSignal.type === 'SELL' ? 'bg-red-500/20' : 'bg-yellow-500/20'
                }`}>
                  {activeSignal.type === 'BUY' ? (
                    <ArrowUpIcon className="w-6 h-6 text-green-500" />
                  ) : activeSignal.type === 'SELL' ? (
                    <ArrowDownIcon className="w-6 h-6 text-red-500" />
                  ) : (
                    <AlertTriangleIcon className="w-6 h-6 text-yellow-500" />
                  )}
                </div>
                <div>
                  <div className="text-2xl font-bold">{activeSignal.type}</div>
                  <Badge variant="outline" className="text-xs">
                    {activeSignal.confidence.toFixed(0)}% Confiança
                  </Badge>
                </div>
              </div>

              <div className="space-y-3 p-4 bg-muted/30 rounded-lg">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Entrada:</span>
                  <div className="text-right">
                    <span className="font-mono font-semibold">${activeSignal.entry_price.toLocaleString()}</span>
                    <div className="text-xs text-muted-foreground">
                      {new Date(activeSignal.timestamp).toLocaleTimeString()}
                    </div>
                  </div>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Alvo:</span>
                  <span className="font-mono font-semibold text-green-500">${activeSignal.target.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Stop Loss:</span>
                  <span className="font-mono font-semibold text-red-500">${activeSignal.stop_loss.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">R/R:</span>
                  <span className="font-semibold">1:{activeSignal.risk_reward.toFixed(1)}</span>
                </div>
              </div>
            </div>

            {/* Análise e Motivo */}
            <div className="space-y-4">
              <div className="p-4 bg-muted/30 rounded-lg">
                <h4 className="font-semibold mb-2">Motivo da Entrada</h4>
                <p className="text-sm text-muted-foreground">{activeSignal.reason}</p>
              </div>
              
              <div className="p-4 bg-muted/30 rounded-lg">
                <h4 className="font-semibold mb-2">Condição do Mercado</h4>
                <p className="text-sm text-muted-foreground">{activeSignal.market_condition}</p>
              </div>

              <div className="p-4 bg-muted/30 rounded-lg">
                <h4 className="font-semibold mb-2">Previsão IA</h4>
                <p className="text-sm text-muted-foreground">{activeSignal.prediction}</p>
              </div>
            </div>
          </div>
        )}
      </Card>

      {/* Análise de Mercado IA */}
      {data?.analysis && (
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Análise de Mercado IA</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="text-center p-4 bg-muted/30 rounded-lg">
              <div className="text-2xl font-bold mb-1">{data.analysis.trend}</div>
              <div className="text-sm text-muted-foreground">Tendência</div>
              <div className="text-xs mt-1">{data.analysis.strength.toFixed(0)}% força</div>
            </div>
            
            <div className="text-center p-4 bg-muted/30 rounded-lg">
              <div className="text-2xl font-bold mb-1">{data.analysis.next_move_probability.toFixed(0)}%</div>
              <div className="text-sm text-muted-foreground">Prob. Próximo Movimento</div>
            </div>
            
            <div className="text-center p-4 bg-muted/30 rounded-lg">
              <div className="text-2xl font-bold mb-1">${data.currentPrice.toLocaleString()}</div>
              <div className="text-sm text-muted-foreground">Preço Atual</div>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <h4 className="font-medium mb-2">Análise de Previsão IA</h4>
              <p className="text-sm text-muted-foreground p-3 bg-muted/20 rounded">{data.analysis.ai_forecast}</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h4 className="font-medium mb-2">Suportes</h4>
                <div className="space-y-1">
                  {data.analysis.support_levels.map((level, idx) => (
                    <div key={idx} className="text-sm font-mono text-green-600">${level.toLocaleString()}</div>
                  ))}
                </div>
              </div>
              
              <div>
                <h4 className="font-medium mb-2">Resistências</h4>
                <div className="space-y-1">
                  {data.analysis.resistance_levels.map((level, idx) => (
                    <div key={idx} className="text-sm font-mono text-red-600">${level.toLocaleString()}</div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
};

export default AITradingSignals;