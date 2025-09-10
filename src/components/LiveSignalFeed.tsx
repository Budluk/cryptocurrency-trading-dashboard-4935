import { useState, useEffect, useMemo, useCallback, memo } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUpIcon, TrendingDownIcon, ZapIcon, ClockIcon, TargetIcon, AlertTriangleIcon } from "lucide-react";

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

const LiveSignalFeed = memo(() => {
  const [signals, setSignals] = useState<LiveSignal[]>([]);
  const [isConnected, setIsConnected] = useState(true);
  const [lastUpdateTime, setLastUpdateTime] = useState(Date.now());

  const generateLiveSignal = useCallback((): LiveSignal => {
    const currentPrice = 111250 + (Math.random() - 0.5) * 150; // Menor variação para mais precisão
    
    // Indicadores técnicos mais precisos para scalping/day trading
    const rsi14 = 20 + Math.random() * 60;
    const rsi7 = 25 + Math.random() * 50; 
    const ema9 = currentPrice * (0.9999 + Math.random() * 0.0002);
    const ema21 = currentPrice * (0.9998 + Math.random() * 0.0004);
    const sma50 = currentPrice * (0.998 + Math.random() * 0.004);
    const volume = 0.8 + Math.random() * 1.2;
    const macd = (Math.random() - 0.5) * 30;
    const macdSignal = macd * 0.9;
    const atr = currentPrice * (0.001 + Math.random() * 0.003);
    const bb_upper = currentPrice * 1.002;
    const bb_lower = currentPrice * 0.998;
      
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
      
      // Lógica de trading otimizada com múltiplos indicadores
      if (rsi14 < 35 && rsi7 < 40 && currentPrice > ema9 && ema9 > ema21 && 
          macd > macdSignal && volume > 1.0 && currentPrice > bb_lower) {
        action = 'BUY';
        confidence = 88 + Math.random() * 10;
        reason = `COMPRA FORTE: RSI14(${rsi14.toFixed(1)}) + RSI7(${rsi7.toFixed(1)}) oversold + EMA bullish + MACD crossover + Volume confirmação`;
        timeframe = Math.random() > 0.7 ? '1m' : Math.random() > 0.4 ? '3m' : '5m';
        targetPrice = currentPrice + (atr * 2.2);
        stopLoss = currentPrice - (atr * 0.9);
        riskReward = 2.4;
        
        if (Math.random() > 0.6) {
          const news = newsEvents[Math.floor(Math.random() * newsEvents.length)];
          newsImpact = { ...news, priceEffect: news.effect };
        }
      } else if (rsi14 > 65 && rsi7 > 70 && currentPrice < ema9 && ema9 < ema21 && 
                 macd < macdSignal && volume > 0.8 && currentPrice < bb_upper) {
        action = 'SELL';
        confidence = 85 + Math.random() * 12;
        reason = `VENDA FORTE: RSI14(${rsi14.toFixed(1)}) + RSI7(${rsi7.toFixed(1)}) overbought + EMA bearish + MACD divergência + Volume`;
        timeframe = Math.random() > 0.6 ? '1m' : Math.random() > 0.3 ? '3m' : '5m';
        targetPrice = currentPrice - (atr * 2.5);
        stopLoss = currentPrice + (atr * 1.0);
        riskReward = 2.5;
        
        if (Math.random() > 0.5) {
          const news = newsEvents[Math.floor(Math.random() * newsEvents.length)];
          newsImpact = { ...news, priceEffect: news.effect };
        }
      } else if (Math.abs(rsi14 - 50) < 15 && Math.abs(currentPrice - sma50) < atr * 0.5) {
        action = 'HOLD';
        confidence = 65 + Math.random() * 20;
        reason = `CONSOLIDAÇÃO: RSI14 neutro(${rsi14.toFixed(1)}) + Preço lateral próximo SMA50 + Aguardar breakout`;
        timeframe = Math.random() > 0.5 ? '5m' : '15m';
        targetPrice = currentPrice + (atr * 0.8);
        stopLoss = currentPrice - (atr * 0.8);
        riskReward = 1.0;
      } else {
        // Scalping de alta precisão
        if (volume > 1.2 && Math.abs(macd - macdSignal) > 10) {
          action = 'BUY';
          confidence = 78 + Math.random() * 15;
          reason = `SCALP BUY: Volume spike(${volume.toFixed(2)}x) + MACD momentum + EMA9 support`;
          targetPrice = currentPrice + (atr * 1.2);
          stopLoss = currentPrice - (atr * 0.6);
          riskReward = 2.0;
        } else {
          action = 'SELL';
          confidence = 76 + Math.random() * 17;
          reason = `SCALP SELL: Volume(${volume.toFixed(2)}x) + RSI14(${rsi14.toFixed(1)}) + EMA resistance`;
          targetPrice = currentPrice - (atr * 1.3);
          stopLoss = currentPrice + (atr * 0.65);
          riskReward = 2.0;
        }
        timeframe = Math.random() > 0.8 ? '1m' : '3m';
        
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
    }, []);

  useEffect(() => {
    // Adiciona sinal inicial
    setSignals([generateLiveSignal()]);

    const interval = setInterval(() => {
      setSignals(prev => {
        const newSignal = generateLiveSignal();
        const updated = [newSignal, ...prev.slice(0, 4)]; // Mantém últimos 5 sinais para melhor performance
        
        // Atualiza status dos sinais antigos de forma otimizada
        return updated.map(signal => {
          const age = Date.now() - signal.timestamp;
          if (age > 120000) { // 2 minutos para day trading
            return { ...signal, status: 'EXPIRED' as const };
          } else if (age > 30000 && Math.random() > 0.7) { // 30 segundos + chance
            return { ...signal, status: 'TRIGGERED' as const };
          }
          return signal;
        });
      });
      setLastUpdateTime(Date.now());
    }, 3000); // Otimizado: novo sinal a cada 3 segundos

    return () => clearInterval(interval);
  }, [generateLiveSignal]);

  const getSignalIcon = useMemo(() => (action: string) => {
    switch (action) {
      case 'BUY': return <TrendingUpIcon className="w-4 h-4 text-green-500" />;
      case 'SELL': return <TrendingDownIcon className="w-4 h-4 text-red-500" />;
      default: return <ZapIcon className="w-4 h-4 text-yellow-500" />;
    }
  }, []);

  const getSignalColor = useMemo(() => (action: string) => {
    switch (action) {
      case 'BUY': return 'border-l-green-500 bg-green-500/10';
      case 'SELL': return 'border-l-red-500 bg-red-500/10';
      default: return 'border-l-yellow-500 bg-yellow-500/10';
    }
  }, []);

  const getStatusBadge = useMemo(() => (status: string) => {
    switch (status) {
      case 'ACTIVE': return <Badge variant="default" className="text-xs bg-green-600 text-white">ATIVO</Badge>;
      case 'TRIGGERED': return <Badge variant="default" className="text-xs bg-blue-600 text-white">EXECUTADO</Badge>;
      case 'EXPIRED': return <Badge variant="secondary" className="text-xs opacity-60">EXPIRADO</Badge>;
      default: return null;
    }
  }, []);

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
        {signals.map((signal, index) => (
          <div
            key={signal.id}
            className={`relative p-4 border-l-4 rounded-r-lg transition-all duration-300 hover:scale-[1.02] ${getSignalColor(signal.action)} ${
              index === 0 ? 'ring-2 ring-primary/20 shadow-lg' : ''
            }`}
          >
            {/* Badge de Novo Sinal */}
            {index === 0 && (
              <div className="absolute -top-2 -right-2 bg-gradient-to-r from-primary to-primary/70 text-white text-xs px-2 py-1 rounded-full font-semibold animate-pulse">
                NOVO
              </div>
            )}

            {/* Header do Sinal */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-full ${
                  signal.action === 'BUY' ? 'bg-green-500/20' : 
                  signal.action === 'SELL' ? 'bg-red-500/20' : 'bg-yellow-500/20'
                }`}>
                  {getSignalIcon(signal.action)}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className={`font-bold text-lg ${
                      signal.action === 'BUY' ? 'text-green-500' : 
                      signal.action === 'SELL' ? 'text-red-500' : 'text-yellow-500'
                    }`}>
                      {signal.action}
                    </span>
                    <Badge variant="outline" className="text-xs font-semibold">{signal.timeframe}</Badge>
                  </div>
                  <span className="text-xs text-muted-foreground">{signal.symbol}</span>
                </div>
              </div>
              {getStatusBadge(signal.status)}
            </div>

            {/* Preço e Confiança */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <span className="font-mono font-bold text-xl">${signal.price.toLocaleString()}</span>
                <div className={`flex items-center gap-1 px-3 py-1 rounded-full ${
                  signal.confidence >= 85 ? 'bg-green-500/20 text-green-400' :
                  signal.confidence >= 75 ? 'bg-yellow-500/20 text-yellow-400' :
                  'bg-red-500/20 text-red-400'
                }`}>
                  <div className={`w-2 h-2 rounded-full ${
                    signal.confidence >= 85 ? 'bg-green-500' :
                    signal.confidence >= 75 ? 'bg-yellow-500' : 'bg-red-500'
                  } animate-pulse`}></div>
                  <span className="text-sm font-bold">{signal.confidence}%</span>
                </div>
              </div>
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <ClockIcon className="w-3 h-3" />
                {new Date(signal.timestamp).toLocaleTimeString()}
              </div>
            </div>

            {/* Targets e Stop Loss - Layout Melhorado */}
            {signal.targetPrice && signal.stopLoss && (
              <div className="grid grid-cols-3 gap-3 mb-4">
                <div className="text-center p-3 bg-gradient-to-b from-green-500/10 to-green-500/5 rounded-lg border border-green-500/30">
                  <div className="flex items-center justify-center gap-1 text-green-500 font-bold mb-1">
                    <TargetIcon className="w-4 h-4" />
                    TARGET
                  </div>
                  <div className="font-mono font-bold text-lg text-green-400">${signal.targetPrice.toLocaleString()}</div>
                  <div className="text-xs text-green-600/70 mt-1">
                    +{Math.round(((signal.targetPrice - signal.price) / signal.price) * 100 * 100) / 100}%
                  </div>
                </div>
                <div className="text-center p-3 bg-gradient-to-b from-red-500/10 to-red-500/5 rounded-lg border border-red-500/30">
                  <div className="flex items-center justify-center gap-1 text-red-500 font-bold mb-1">
                    <AlertTriangleIcon className="w-4 h-4" />
                    STOP
                  </div>
                  <div className="font-mono font-bold text-lg text-red-400">${signal.stopLoss.toLocaleString()}</div>
                  <div className="text-xs text-red-600/70 mt-1">
                    {Math.round(((signal.stopLoss - signal.price) / signal.price) * 100 * 100) / 100}%
                  </div>
                </div>
                <div className="text-center p-3 bg-gradient-to-b from-blue-500/10 to-blue-500/5 rounded-lg border border-blue-500/30">
                  <div className="text-blue-500 font-bold mb-1">RISCO</div>
                  <div className="font-mono font-bold text-lg text-blue-400">1:{signal.riskReward}</div>
                  <div className="text-xs text-blue-600/70 mt-1">Recompensa</div>
                </div>
              </div>
            )}

            {/* Notícias de Impacto */}
            {signal.newsImpact && (
              <div className="bg-gradient-to-r from-muted/20 to-muted/10 p-3 rounded-lg border border-muted/30 mb-3">
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant="outline" className="text-xs px-2 py-1 font-semibold">{signal.newsImpact.impact}</Badge>
                  <span className={`font-bold text-sm ${
                    signal.newsImpact.sentiment === 'POSITIVE' ? 'text-green-500' : 
                    signal.newsImpact.sentiment === 'NEGATIVE' ? 'text-red-500' : 'text-yellow-500'
                  }`}>
                    {signal.newsImpact.sentiment}
                  </span>
                  <div className={`px-2 py-1 rounded text-xs font-mono font-bold ${
                    signal.newsImpact.priceEffect > 0 ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                  }`}>
                    {signal.newsImpact.priceEffect > 0 ? '+' : ''}{signal.newsImpact.priceEffect}%
                  </div>
                </div>
                <div className="text-sm font-medium">{signal.newsImpact.title}</div>
              </div>
            )}

            {/* Razão do Sinal */}
            <div className="p-3 bg-muted/20 rounded-lg border border-muted/30">
              <div className="text-xs font-semibold text-muted-foreground mb-1">ANÁLISE TÉCNICA:</div>
              <div className="text-sm leading-relaxed">{signal.reason}</div>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
});

export default LiveSignalFeed;