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

      <div className="h-[500px] w-full">
        <TradingViewWidget
          symbol="BINANCE:BTCUSDT"
          theme="Dark"
          locale="en"
          autosize
          hide_side_toolbar={false}
          allow_symbol_change={false}
          interval="5"
          toolbar_bg="#1A1A1A"
          enable_publishing={false}
          hide_top_toolbar={false}
          save_image={false}
          container_id="tradingview_btc_chart"
          studies={[
            "RSI@tv-basicstudies",
            "MACD@tv-basicstudies", 
            "Volume@tv-basicstudies",
            "BB@tv-basicstudies",
            "EMA@tv-basicstudies"
          ]}
          withdateranges={true}
          range="4H"
        />
      </div>
    </div>
  );
});

export default CryptoChart;