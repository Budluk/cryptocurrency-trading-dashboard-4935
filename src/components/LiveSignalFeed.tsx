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
}

const LiveSignalFeed = () => {
  const [signals, setSignals] = useState<LiveSignal[]>([]);
  const [isConnected, setIsConnected] = useState(true);

  useEffect(() => {
    const generateLiveSignal = (): LiveSignal => {
      const currentPrice = 111250 + (Math.random() - 0.5) * 400;
      
      // Indicadores técnicos para gerar sinais mais precisos
      const rsi = 25 + Math.random() * 50;
      const ema20 = currentPrice * (0.998 + Math.random() * 0.004);
      const volume = 0.7 + Math.random() * 0.6;
      const atr = currentPrice * (0.008 + Math.random() * 0.012);
      
      // Lógica profissional para determinação de sinal
      let action: 'BUY' | 'SELL' | 'HOLD';
      let confidence: number;
      let reason: string;
      let timeframe: string;
      
      if (rsi < 35 && currentPrice > ema20 && volume > 1.1) {
        action = 'BUY';
        confidence = 82 + Math.random() * 15;
        reason = `RSI(${rsi.toFixed(1)}) oversold + EMA20 support + Volume(${volume.toFixed(2)}x)`;
        timeframe = Math.random() > 0.7 ? '1m' : Math.random() > 0.4 ? '5m' : '15m';
      } else if (rsi > 65 && currentPrice < ema20 && volume > 0.9) {
        action = 'SELL';
        confidence = 78 + Math.random() * 17;
        reason = `RSI(${rsi.toFixed(1)}) overbought + EMA20 resistance + ATR(${(atr/currentPrice*100).toFixed(2)}%)`;
        timeframe = Math.random() > 0.6 ? '5m' : Math.random() > 0.3 ? '15m' : '1h';
      } else if (Math.abs(currentPrice - ema20) < atr * 0.5 && volume < 0.8) {
        action = 'HOLD';
        confidence = 65 + Math.random() * 20;
        reason = `Consolidação: Preço próximo EMA20, Volume baixo(${volume.toFixed(2)}x)`;
        timeframe = Math.random() > 0.5 ? '15m' : '1h';
      } else {
        // Sinais alternativos baseados em breakouts
        if (Math.random() > 0.6) {
          action = 'BUY';
          confidence = 71 + Math.random() * 20;
          reason = `Breakout tentativa + Volume confirmação(${volume.toFixed(2)}x)`;
        } else {
          action = 'SELL';
          confidence = 68 + Math.random() * 22;
          reason = `Breakdown pattern + RSI(${rsi.toFixed(1)}) divergência`;
        }
        timeframe = Math.random() > 0.5 ? '5m' : '15m';
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
        status: 'ACTIVE'
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
    }, 2500); // Novo sinal a cada 2.5 segundos

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

            <div className="flex items-center justify-between text-sm">
              <div>
                <span className="font-mono font-semibold">${signal.price.toLocaleString()}</span>
                <span className="text-muted-foreground ml-2">({signal.confidence}%)</span>
              </div>
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <ClockIcon className="w-3 h-3" />
                {new Date(signal.timestamp).toLocaleTimeString()}
              </div>
            </div>

            <div className="text-xs text-muted-foreground mt-1 truncate">
              {signal.reason}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
};

export default LiveSignalFeed;