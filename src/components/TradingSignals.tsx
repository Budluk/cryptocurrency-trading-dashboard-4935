import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { TrendingUpIcon, TrendingDownIcon, AlertTriangleIcon, BarChartIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface TechnicalIndicator {
  name: string;
  value: number;
  signal: 'BUY' | 'SELL' | 'NEUTRAL';
  confidence: number;
  timeframe: string;
}

interface MarketSentiment {
  fearGreedIndex: number;
  sentiment: string;
  confidence: number;
  volume24h: number;
  volatility: number;
}

const fetchTechnicalAnalysis = async (symbol: string) => {
  // Simulando dados de análise técnica real
  const indicators: TechnicalIndicator[] = [
    {
      name: "RSI (14)",
      value: Math.random() * 100,
      signal: Math.random() > 0.6 ? 'BUY' : Math.random() > 0.3 ? 'SELL' : 'NEUTRAL',
      confidence: 70 + Math.random() * 30,
      timeframe: "1D"
    },
    {
      name: "MACD",
      value: (Math.random() - 0.5) * 1000,
      signal: Math.random() > 0.5 ? 'BUY' : 'SELL',
      confidence: 60 + Math.random() * 40,
      timeframe: "4H"
    },
    {
      name: "Moving Average",
      value: 45000 + Math.random() * 20000,
      signal: Math.random() > 0.4 ? 'BUY' : 'NEUTRAL',
      confidence: 80 + Math.random() * 20,
      timeframe: "1H"
    },
    {
      name: "Bollinger Bands",
      value: Math.random(),
      signal: Math.random() > 0.6 ? 'SELL' : 'NEUTRAL',
      confidence: 65 + Math.random() * 25,
      timeframe: "1D"
    },
    {
      name: "Stochastic",
      value: Math.random() * 100,
      signal: Math.random() > 0.5 ? 'BUY' : 'SELL',
      confidence: 55 + Math.random() * 35,
      timeframe: "4H"
    }
  ];

  const sentiment: MarketSentiment = {
    fearGreedIndex: 20 + Math.random() * 60,
    sentiment: Math.random() > 0.5 ? 'Bullish' : 'Bearish',
    confidence: 70 + Math.random() * 30,
    volume24h: 25000000000 + Math.random() * 10000000000,
    volatility: 2 + Math.random() * 8
  };

  return { indicators, sentiment };
};

const TradingSignals = () => {
  const [selectedTimeframe, setSelectedTimeframe] = useState('1H');
  
  const { data, isLoading, error } = useQuery({
    queryKey: ['technicalAnalysis', 'BTC'],
    queryFn: () => fetchTechnicalAnalysis('BTC'),
    refetchInterval: 15000,
    retry: 1,
    retryOnMount: false
  });

  const overallSignal = useMemo(() => {
    if (!data?.indicators) return { signal: 'NEUTRAL', confidence: 0 };
    
    const signals = data.indicators;
    const buySignals = signals.filter(s => s.signal === 'BUY').length;
    const sellSignals = signals.filter(s => s.signal === 'SELL').length;
    
    const avgConfidence = signals.reduce((acc, s) => acc + s.confidence, 0) / signals.length;
    
    if (buySignals > sellSignals + 1) {
      return { signal: 'BUY', confidence: avgConfidence };
    } else if (sellSignals > buySignals + 1) {
      return { signal: 'SELL', confidence: avgConfidence };
    }
    return { signal: 'NEUTRAL', confidence: avgConfidence };
  }, [data]);

  const getSignalColor = (signal: string) => {
    switch (signal) {
      case 'BUY': return 'text-success';
      case 'SELL': return 'text-destructive';
      default: return 'text-warning';
    }
  };

  const getSignalIcon = (signal: string) => {
    switch (signal) {
      case 'BUY': return <TrendingUpIcon className="w-4 h-4" />;
      case 'SELL': return <TrendingDownIcon className="w-4 h-4" />;
      default: return <AlertTriangleIcon className="w-4 h-4" />;
    }
  };

  if (isLoading) {
    return (
      <Card className="p-6 animate-pulse">
        <div className="h-6 bg-muted rounded mb-4"></div>
        <div className="space-y-3">
          {[1,2,3,4,5].map(i => (
            <div key={i} className="h-4 bg-muted rounded"></div>
          ))}
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <BarChartIcon className="w-5 h-5" />
          Sinais de Trading - BTC/USD
        </h3>
        <div className="flex gap-2">
          {['1H', '4H', '1D'].map(tf => (
            <button
              key={tf}
              onClick={() => setSelectedTimeframe(tf)}
              className={`px-3 py-1 rounded text-sm transition-colors ${
                selectedTimeframe === tf 
                  ? 'bg-primary text-primary-foreground' 
                  : 'bg-muted hover:bg-muted/80'
              }`}
            >
              {tf}
            </button>
          ))}
        </div>
      </div>

      {/* Sinal Geral */}
      <div className="mb-6 p-4 rounded-lg bg-muted/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`${getSignalColor(overallSignal.signal)} flex items-center gap-2`}>
              {getSignalIcon(overallSignal.signal)}
              <span className="font-semibold">{overallSignal.signal}</span>
            </div>
            <Badge variant="outline">
              Confiança: {overallSignal.confidence.toFixed(0)}%
            </Badge>
          </div>
          <div className="text-sm text-muted-foreground">
            Análise Geral
          </div>
        </div>
      </div>

      {/* Indicadores Individuais */}
      <div className="space-y-3 mb-6">
        <h4 className="font-medium text-sm text-muted-foreground">INDICADORES TÉCNICOS</h4>
        {data?.indicators
          .filter(ind => ind.timeframe === selectedTimeframe || selectedTimeframe === '1H')
          .map((indicator, idx) => (
          <div key={idx} className="flex items-center justify-between p-3 rounded bg-muted/30">
            <div className="flex items-center gap-3">
              <span className="font-medium text-sm">{indicator.name}</span>
              <Badge 
                variant={indicator.signal === 'BUY' ? 'default' : indicator.signal === 'SELL' ? 'destructive' : 'secondary'}
                className="text-xs"
              >
                {indicator.signal}
              </Badge>
            </div>
            <div className="text-right">
              <div className="text-sm font-mono">
                {indicator.name === "Moving Average" 
                  ? `$${indicator.value.toLocaleString()}`
                  : indicator.value.toFixed(2)
                }
              </div>
              <div className="text-xs text-muted-foreground">
                {indicator.confidence.toFixed(0)}% confiança
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Sentimento do Mercado */}
      {data?.sentiment && (
        <div className="border-t pt-4">
          <h4 className="font-medium text-sm text-muted-foreground mb-3">SENTIMENTO DO MERCADO</h4>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <span className="text-muted-foreground">Fear & Greed:</span>
              <div className="font-semibold">{data.sentiment.fearGreedIndex.toFixed(0)}/100</div>
            </div>
            <div>
              <span className="text-muted-foreground">Tendência:</span>
              <div className={`font-semibold ${
                data.sentiment.sentiment === 'Bullish' ? 'text-success' : 'text-destructive'
              }`}>
                {data.sentiment.sentiment}
              </div>
            </div>
            <div>
              <span className="text-muted-foreground">Volume 24h:</span>
              <div className="font-semibold">${(data.sentiment.volume24h / 1e9).toFixed(1)}B</div>
            </div>
            <div>
              <span className="text-muted-foreground">Volatilidade:</span>
              <div className="font-semibold">{data.sentiment.volatility.toFixed(1)}%</div>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
};

export default TradingSignals;