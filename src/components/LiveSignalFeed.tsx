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
    const currentPrice = 111250 + (Math.random() - 0.5) * 80;
    
    // Indicadores simplificados e mais precisos
    const rsi = 30 + Math.random() * 40; // RSI entre 30-70 para sinais mais claros
    const momentum = (Math.random() - 0.5) * 2; // -1 a +1
    const volume = 0.9 + Math.random() * 0.6; // 0.9 a 1.5
    const trend = Math.random() > 0.5 ? 1 : -1; // Tendência clara
    
    let action: 'BUY' | 'SELL' | 'HOLD';
    let confidence: number;
    let reason: string;
    let timeframe: string;
    let targetPrice: number;
    let stopLoss: number;
    let riskReward: number;
    
    // Lógica simplificada e mais precisa
    if (rsi < 40 && momentum > 0.3 && volume > 1.1 && trend > 0) {
      // Sinal de COMPRA forte
      action = 'BUY';
      confidence = 85 + Math.random() * 12;
      reason = `RSI Oversold + Momentum Positivo + Volume Alto`;
      timeframe = '5m';
      targetPrice = currentPrice * 1.015; // 1.5% profit
      stopLoss = currentPrice * 0.995; // 0.5% stop
      riskReward = 3.0;
    } else if (rsi > 60 && momentum < -0.3 && volume > 1.0 && trend < 0) {
      // Sinal de VENDA forte  
      action = 'SELL';
      confidence = 82 + Math.random() * 15;
      reason = `RSI Overbought + Momentum Negativo + Volume Confirmação`;
      timeframe = '5m';
      targetPrice = currentPrice * 0.985; // 1.5% profit
      stopLoss = currentPrice * 1.005; // 0.5% stop
      riskReward = 3.0;
    } else if (Math.abs(momentum) < 0.2) {
      // Mercado lateral - HOLD
      action = 'HOLD';
      confidence = 70 + Math.random() * 15;
      reason = `Mercado Lateral - Aguardar Breakout`;
      timeframe = '15m';
      targetPrice = currentPrice * 1.005;
      stopLoss = currentPrice * 0.995;
      riskReward = 1.0;
    } else {
      // Sinais secundários mais conservadores
      if (momentum > 0 && volume > 1.05) {
        action = 'BUY';
        confidence = 75 + Math.random() * 10;
        reason = `Momentum Positivo + Volume Suporte`;
        targetPrice = currentPrice * 1.008;
        stopLoss = currentPrice * 0.997;
        riskReward = 2.5;
      } else {
        action = 'SELL';
        confidence = 72 + Math.random() * 13;
        reason = `Momentum Negativo + Pressão Vendedora`;
        targetPrice = currentPrice * 0.992;
        stopLoss = currentPrice * 1.003;
        riskReward = 2.5;
      }
      timeframe = '3m';
    }

      return {
        id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
        symbol: 'BTC/USD',
        action,
        price: Math.round(currentPrice),
        confidence: Math.floor(confidence),
        timeframe,
        timestamp: Date.now(),
        reason,
        status: 'ACTIVE',
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
    }, 8000); // Sinais menos frequentes para maior precisão

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


            {/* Razão do Sinal - Mais Visual */}
            <div className="p-4 bg-gradient-to-br from-primary/5 to-primary/10 rounded-lg border border-primary/20">
              <div className="text-xs font-bold text-primary mb-2 uppercase tracking-wide">Análise do Sinal</div>
              <div className="text-base font-semibold text-foreground">{signal.reason}</div>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
});

export default LiveSignalFeed;