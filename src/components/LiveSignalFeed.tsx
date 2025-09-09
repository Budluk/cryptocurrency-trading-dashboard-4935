import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUpIcon, TrendingDownIcon, ZapIcon, ClockIcon } from "lucide-react";

interface LiveSignal {
  id: string;
  symbol: 'BTC/USD';
  action: 'BUY' | 'SELL' | 'HOLD';
  price: number;
  confidence: number;
  timeframe: string;
  timestamp: number;
  reason: string;
  status: 'ACTIVE' | 'EXPIRED' | 'TRIGGERED';
  newsImpact?: {
    title: string;
    sentiment: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL';
    impact: 'HIGH' | 'MEDIUM' | 'LOW';
    priceEffect: number;
  };
  targetPrice?: number;
  stopLoss?: number;
  riskReward?: number;
}

const LiveSignalFeed = () => {
  const [signals, setSignals] = useState<LiveSignal[]>([]);
  const [isConnected, setIsConnected] = useState(true);

  useEffect(() => {
    const generateLiveSignal = (): LiveSignal => {
      const currentPrice = 111250 + (Math.random() - 0.5) * 300;
      
      // Indicadores para day trading - timeframes curtos
      const rsi = 30 + Math.random() * 40;
      const ema9 = currentPrice * (0.9995 + Math.random() * 0.001);
      const ema21 = currentPrice * (0.998 + Math.random() * 0.004);
      const volume = 0.8 + Math.random() * 0.8;
      const macd = (Math.random() - 0.5) * 100;
      const atr = currentPrice * (0.003 + Math.random() * 0.007);
      
      // Gerador de notícias de impacto
      const newsEvents = [
        { title: "Fed mantém taxa de juros", sentiment: "POSITIVE" as const, impact: "HIGH" as const, effect: 1.2 },
        { title: "Whale movimenta $500M BTC", sentiment: "NEGATIVE" as const, impact: "MEDIUM" as const, effect: -0.8 },
        { title: "BlackRock adiciona BTC ao ETF", sentiment: "POSITIVE" as const, impact: "HIGH" as const, effect: 2.1 },
        { title: "Correção técnica esperada", sentiment: "NEUTRAL" as const, impact: "LOW" as const, effect: -0.3 },
        { title: "Adoção institucional aumenta", sentiment: "POSITIVE" as const, impact: "MEDIUM" as const, effect: 1.5 }
      ];
      
      // Lógica otimizada para day trading
      let action: 'BUY' | 'SELL' | 'HOLD';
      let confidence: number;
      let reason: string;
      let timeframe: string;
      let newsImpact: any = undefined;
      let targetPrice: number;
      let stopLoss: number;
      let riskReward: number;
      
      // Day trading - foco em timeframes de 1m a 15m
      if (rsi < 30 && currentPrice > ema9 && ema9 > ema21 && macd > 0 && volume > 1.2) {
        action = 'BUY';
        confidence = 85 + Math.random() * 12;
        reason = `COMPRA: RSI(${rsi.toFixed(1)}) oversold + EMA crossover + MACD(+${macd.toFixed(1)}) + Volume alto`;
        timeframe = Math.random() > 0.8 ? '1m' : Math.random() > 0.5 ? '3m' : '5m';
        targetPrice = currentPrice + (atr * 1.5);
        stopLoss = currentPrice - (atr * 0.8);
        riskReward = 1.9;
        
        if (Math.random() > 0.6) {
          const news = newsEvents[Math.floor(Math.random() * newsEvents.length)];
          newsImpact = { ...news, priceEffect: news.effect };
        }
      } else if (rsi > 70 && currentPrice < ema9 && ema9 < ema21 && macd < 0 && volume > 1.0) {
        action = 'SELL';
        confidence = 82 + Math.random() * 15;
        reason = `VENDA: RSI(${rsi.toFixed(1)}) overbought + EMA bearish + MACD(-${Math.abs(macd).toFixed(1)}) + Volume confirmação`;
        timeframe = Math.random() > 0.7 ? '1m' : Math.random() > 0.4 ? '3m' : '5m';
        targetPrice = currentPrice - (atr * 1.8);
        stopLoss = currentPrice + (atr * 0.9);
        riskReward = 2.0;
        
        if (Math.random() > 0.5) {
          const news = newsEvents[Math.floor(Math.random() * newsEvents.length)];
          newsImpact = { ...news, priceEffect: news.effect };
        }
      } else if (Math.abs(rsi - 50) < 10 && Math.abs(currentPrice - ema21) < atr * 0.3) {
        action = 'HOLD';
        confidence = 60 + Math.random() * 25;
        reason = `AGUARDAR: RSI neutro(${rsi.toFixed(1)}) + Preço em consolidação próximo EMA21`;
        timeframe = Math.random() > 0.6 ? '5m' : '15m';
        targetPrice = currentPrice + (atr * 0.5);
        stopLoss = currentPrice - (atr * 0.5);
        riskReward = 1.0;
      } else {
        // Scalping rápido para day trading
        if (Math.random() > 0.5) {
          action = 'BUY';
          confidence = 75 + Math.random() * 18;
          reason = `SCALP BUY: Momentum + Volume(${volume.toFixed(2)}x) + Support EMA9`;
          targetPrice = currentPrice + (atr * 0.8);
          stopLoss = currentPrice - (atr * 0.4);
          riskReward = 2.0;
        } else {
          action = 'SELL';
          confidence = 73 + Math.random() * 20;
          reason = `SCALP SELL: Reversal + RSI(${rsi.toFixed(1)}) + Resistance EMA21`;
          targetPrice = currentPrice - (atr * 0.9);
          stopLoss = currentPrice + (atr * 0.45);
          riskReward = 2.0;
        }
        timeframe = Math.random() > 0.7 ? '1m' : '3m';
        
        if (Math.random() > 0.7) {
          const news = newsEvents[Math.floor(Math.random() * newsEvents.length)];
          newsImpact = { ...news, priceEffect: news.effect };
        }
      }

      return {
        id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
        symbol: 'BTC/USD',
        action,
        price: currentPrice,
        confidence: Math.floor(confidence),
        timeframe,
        timestamp: Date.now(),
        reason,
        status: 'ACTIVE',
        newsImpact,
        targetPrice: Math.round(targetPrice),
        stopLoss: Math.round(stopLoss),
        riskReward: Math.round(riskReward * 10) / 10
      };
    };

    // Adiciona sinal inicial
    setSignals([generateLiveSignal()]);

    const interval = setInterval(() => {
      setSignals(prev => {
        const newSignal = generateLiveSignal();
        const updated = [newSignal, ...prev.slice(0, 9)]; // Mantém últimos 10 sinais
        
        // Atualiza status dos sinais antigos
        return updated.map(signal => {
          const age = Date.now() - signal.timestamp;
          if (age > 300000) { // 5 minutos
            return { ...signal, status: 'EXPIRED' as const };
          } else if (age > 60000 && Math.random() > 0.7) { // 1 minuto + chance
            return { ...signal, status: 'TRIGGERED' as const };
          }
          return signal;
        });
      });
    }, 1800); // Novo sinal a cada 1.8 segundos para day trading

    return () => clearInterval(interval);
  }, []);

  const getSignalIcon = (action: string) => {
    switch (action) {
      case 'BUY': return <TrendingUpIcon className="w-4 h-4 text-green-500" />;
      case 'SELL': return <TrendingDownIcon className="w-4 h-4 text-red-500" />;
      default: return <ZapIcon className="w-4 h-4 text-yellow-500" />;
    }
  };

  const getSignalColor = (action: string) => {
    switch (action) {
      case 'BUY': return 'border-l-green-500 bg-green-50/5';
      case 'SELL': return 'border-l-red-500 bg-red-50/5';
      default: return 'border-l-yellow-500 bg-yellow-50/5';
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'ACTIVE': return <Badge variant="default" className="text-xs bg-green-500">ATIVO</Badge>;
      case 'TRIGGERED': return <Badge variant="default" className="text-xs bg-blue-500">EXECUTADO</Badge>;
      case 'EXPIRED': return <Badge variant="secondary" className="text-xs">EXPIRADO</Badge>;
      default: return null;
    }
  };

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold flex items-center gap-2">
          <ZapIcon className="w-5 h-5 text-primary" />
          Sinais Ao Vivo
        </h3>
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
          <span className="text-xs text-muted-foreground">
            {isConnected ? 'CONECTADO' : 'DESCONECTADO'}
          </span>
        </div>
      </div>

      <div className="space-y-3 max-h-96 overflow-y-auto">
        {signals.map((signal) => (
          <div
            key={signal.id}
            className={`p-3 border-l-4 rounded-r-lg transition-all duration-300 ${getSignalColor(signal.action)}`}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                {getSignalIcon(signal.action)}
                <span className="font-semibold text-sm">{signal.action}</span>
                <span className="text-xs text-muted-foreground">{signal.symbol}</span>
                <Badge variant="outline" className="text-xs">{signal.timeframe}</Badge>
              </div>
              {getStatusBadge(signal.status)}
            </div>

            <div className="flex items-center justify-between text-sm mb-2">
              <div>
                <span className="font-mono font-semibold">${signal.price.toLocaleString()}</span>
                <span className="text-muted-foreground ml-2">({signal.confidence}%)</span>
              </div>
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <ClockIcon className="w-3 h-3" />
                {new Date(signal.timestamp).toLocaleTimeString()}
              </div>
            </div>

            {signal.targetPrice && signal.stopLoss && (
              <div className="grid grid-cols-3 gap-2 text-xs mb-2">
                <div className="text-center p-1 bg-green-500/10 rounded">
                  <div className="text-green-600 font-semibold">Target</div>
                  <div className="font-mono">${signal.targetPrice.toLocaleString()}</div>
                </div>
                <div className="text-center p-1 bg-red-500/10 rounded">
                  <div className="text-red-600 font-semibold">Stop</div>
                  <div className="font-mono">${signal.stopLoss.toLocaleString()}</div>
                </div>
                <div className="text-center p-1 bg-blue-500/10 rounded">
                  <div className="text-blue-600 font-semibold">R:R</div>
                  <div className="font-mono">1:{signal.riskReward}</div>
                </div>
              </div>
            )}

            {signal.newsImpact && (
              <div className="bg-muted/30 p-2 rounded text-xs mb-2">
                <div className="flex items-center gap-1 mb-1">
                  <Badge variant="outline" className="text-xs px-1">{signal.newsImpact.impact}</Badge>
                  <span className={`font-semibold ${
                    signal.newsImpact.sentiment === 'POSITIVE' ? 'text-green-600' : 
                    signal.newsImpact.sentiment === 'NEGATIVE' ? 'text-red-600' : 'text-yellow-600'
                  }`}>
                    {signal.newsImpact.sentiment}
                  </span>
                </div>
                <div className="text-muted-foreground">{signal.newsImpact.title}</div>
                <div className={`font-mono ${signal.newsImpact.priceEffect > 0 ? 'text-green-600' : 'text-red-600'}`}>
                  Impacto: {signal.newsImpact.priceEffect > 0 ? '+' : ''}{signal.newsImpact.priceEffect}%
                </div>
              </div>
            )}

            <div className="text-xs text-muted-foreground truncate">
              {signal.reason}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
};

export default LiveSignalFeed;