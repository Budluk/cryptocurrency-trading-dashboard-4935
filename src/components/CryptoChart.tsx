import TradingViewWidget from 'react-tradingview-widget';
import { useState, useEffect, memo } from 'react';
import { Badge } from '@/components/ui/badge';

interface ChartSignal {
  price: number;
  type: 'BUY' | 'SELL';
  target: number;
  stopLoss: number;
  timestamp: number;
}

const CryptoChart = memo(() => {
  const [activeSignals, setActiveSignals] = useState<ChartSignal[]>([]);
  const [currentPrice, setCurrentPrice] = useState(111250);

  useEffect(() => {
    // Simula sinais de entrada em tempo real
    const generateSignal = () => {
      const price = 111250 + (Math.random() - 0.5) * 500;
      const isRising = Math.random() > 0.5;
      
      const signal: ChartSignal = {
        price: price,
        type: isRising ? 'BUY' : 'SELL',
        target: isRising ? price + 200 : price - 200,
        stopLoss: isRising ? price - 100 : price + 100,
        timestamp: Date.now()
      };

      setActiveSignals(prev => [signal, ...prev.slice(0, 2)]);
      setCurrentPrice(price);
    };

    const interval = setInterval(generateSignal, 8000);
    generateSignal(); // Sinal inicial

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="glass-card p-6 rounded-lg mb-8 animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold">Bitcoin Price Chart</h2>
        <div className="flex items-center gap-3">
          <div className="text-sm">
            <span className="text-muted-foreground">Preço:</span>
            <span className="font-mono font-semibold ml-1">${currentPrice.toLocaleString()}</span>
          </div>
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
        </div>
      </div>

      {/* Sinais Ativos */}
      {activeSignals.length > 0 && (
        <div className="mb-4 space-y-2">
          {activeSignals.map((signal, index) => (
            <div key={signal.timestamp} className={`flex items-center gap-4 p-2 rounded border-l-4 text-xs ${
              signal.type === 'BUY' ? 'border-l-green-500 bg-green-500/5' : 'border-l-red-500 bg-red-500/5'
            }`}>
              <Badge variant={signal.type === 'BUY' ? 'default' : 'destructive'} className="text-xs">
                {signal.type}
              </Badge>
              <span className="font-mono">Entrada: ${signal.price.toLocaleString()}</span>
              <span className="font-mono text-green-600">Target: ${signal.target.toLocaleString()}</span>
              <span className="font-mono text-red-600">Stop: ${signal.stopLoss.toLocaleString()}</span>
              <span className="text-muted-foreground">
                {new Date(signal.timestamp).toLocaleTimeString()}
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="h-[500px] w-full relative">
        <TradingViewWidget
          symbol="BINANCE:BTCUSDT"
          theme="Dark"
          locale="en"
          autosize
          hide_side_toolbar={true}
          allow_symbol_change={false}
          interval="1"
          toolbar_bg="#1A1A1A"
          enable_publishing={false}
          hide_top_toolbar={false}
          save_image={false}
          container_id="tradingview_btc_chart"
          studies={[]}
          withdateranges={false}
          range="1D"
        />
        
        {/* Linhas de entrada e saída sobrepostas */}
        {activeSignals.map((signal, index) => (
          <div
            key={signal.timestamp}
            className="absolute top-0 left-0 w-full h-full pointer-events-none"
            style={{ zIndex: index + 1 }}
          >
            {/* Linha de entrada */}
            <div
              className={`absolute w-full h-0.5 ${
                signal.type === 'BUY' ? 'bg-green-500' : 'bg-red-500'
              } opacity-70`}
              style={{
                top: `${40 + (index * 5)}%`,
                boxShadow: `0 0 4px ${signal.type === 'BUY' ? '#10b981' : '#ef4444'}`
              }}
            />
            {/* Label da entrada */}
            <div
              className={`absolute text-xs font-mono px-2 py-1 rounded ${
                signal.type === 'BUY' 
                  ? 'bg-green-500/20 text-green-400 border border-green-500/30' 
                  : 'bg-red-500/20 text-red-400 border border-red-500/30'
              }`}
              style={{ top: `${38 + (index * 5)}%`, left: '10px' }}
            >
              {signal.type} ${signal.price.toLocaleString()}
            </div>
            
            {/* Linha de take profit */}
            <div
              className="absolute w-full h-0.5 bg-blue-500 opacity-50"
              style={{
                top: `${35 + (index * 5)}%`,
                boxShadow: '0 0 2px #3b82f6'
              }}
            />
            {/* Label do target */}
            <div
              className="absolute text-xs font-mono px-2 py-1 rounded bg-blue-500/20 text-blue-400 border border-blue-500/30"
              style={{ top: `${33 + (index * 5)}%`, right: '10px' }}
            >
              TP ${signal.target.toLocaleString()}
            </div>
            
            {/* Linha de stop loss */}
            <div
              className="absolute w-full h-0.5 bg-orange-500 opacity-50"
              style={{
                top: `${45 + (index * 5)}%`,
                boxShadow: '0 0 2px #f97316'
              }}
            />
            {/* Label do stop */}
            <div
              className="absolute text-xs font-mono px-2 py-1 rounded bg-orange-500/20 text-orange-400 border border-orange-500/30"
              style={{ top: `${47 + (index * 5)}%`, right: '10px' }}
            >
              SL ${signal.stopLoss.toLocaleString()}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
});

export default CryptoChart;