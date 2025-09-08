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
  // Simulação de IA avançada para BTC/USD
  const currentPrice = 111000 + (Math.random() - 0.5) * 2000;
  
  const signals: AITradingSignal[] = [
    {
      type: Math.random() > 0.6 ? 'BUY' : Math.random() > 0.3 ? 'SELL' : 'HOLD',
      confidence: 75 + Math.random() * 20,
      entry_price: currentPrice + (Math.random() - 0.5) * 500,
      target: currentPrice + 1000 + Math.random() * 1500,
      stop_loss: currentPrice - 800 - Math.random() * 500,
      timeframe: '4H',
      reason: Math.random() > 0.5 ? 'RSI oversold + volume spike' : 'MA crossover + strong support',
      market_condition: Math.random() > 0.5 ? 'High volatility breakout' : 'Consolidation phase ending',
      risk_reward: 2.5 + Math.random() * 1.5,
      prediction: 'Strong upward momentum expected in next 24h',
      timestamp: Date.now()
    },
    {
      type: Math.random() > 0.4 ? 'SELL' : 'BUY',
      confidence: 68 + Math.random() * 25,
      entry_price: currentPrice + (Math.random() - 0.5) * 300,
      target: currentPrice - 800 - Math.random() * 1200,
      stop_loss: currentPrice + 600 + Math.random() * 400,
      timeframe: '1D',
      reason: 'Bearish divergence + resistance rejection',
      market_condition: 'Overbought conditions detected',
      risk_reward: 2.1 + Math.random() * 1.2,
      prediction: 'Correction likely before next leg up',
      timestamp: Date.now() - 3600000
    }
  ];

  const analysis: MarketAnalysis = {
    trend: Math.random() > 0.6 ? 'BULLISH' : Math.random() > 0.3 ? 'BEARISH' : 'SIDEWAYS',
    strength: 60 + Math.random() * 35,
    volume_analysis: 'Above average volume confirms breakout',
    support_levels: [109500, 108200, 106800],
    resistance_levels: [112500, 114200, 116000],
    next_move_probability: 70 + Math.random() * 25,
    ai_forecast: 'AI models suggest 72% probability of upward movement in next 48h based on pattern recognition and volume analysis'
  };

  return { signals, analysis, currentPrice };
};

const AITradingSignals = () => {
  const [selectedTimeframe, setSelectedTimeframe] = useState('4H');
  
  const { data, isLoading } = useQuery({
    queryKey: ['aiTradingSignals'],
    queryFn: fetchAITradingData,
    refetchInterval: 5000, // Atualização mais rápida
    retry: 1
  });

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
          <h3 className="text-xl font-bold flex items-center gap-2">
            <BrainIcon className="w-6 h-6 text-primary" />
            IA Trading - BTC/USD
          </h3>
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
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Entrada:</span>
                  <span className="font-mono font-semibold">${activeSignal.entry_price.toLocaleString()}</span>
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