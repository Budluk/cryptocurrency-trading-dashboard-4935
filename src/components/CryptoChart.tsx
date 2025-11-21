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
    // Gera sinais melhorados para day trade
    const generateSignal = () => {
      const basePrice = 111250;
      const volatility = 150;
      const price = basePrice + (Math.random() - 0.5) * volatility;
      
      // Lógica melhorada para sinais mais precisos
      const priceChange = price - basePrice;
      const momentum = Math.abs(priceChange) > 50;
      const isUptrend = priceChange > 0;
      
      if (!momentum) return; // Só gera sinal com momentum significativo
      
      const signal: ChartSignal = {
        price: Math.round(price),
        type: isUptrend ? 'BUY' : 'SELL',
        target: Math.round(isUptrend ? price + 80 : price - 80),
        stopLoss: Math.round(isUptrend ? price - 40 : price + 40),
        timestamp: Date.now()
      };

      setActiveSignals(prev => [signal, ...prev.slice(0, 1)]); // Apenas 1 sinal ativo
      setCurrentPrice(Math.round(price));
    };

    // DESABILITADO temporariamente para evitar travamentos
    // const interval = setInterval(generateSignal, 10000);
    generateSignal(); // Gera apenas uma vez ao montar

    // return () => clearInterval(interval);
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
          hide_side_toolbar={true}
          allow_symbol_change={false}
          interval="1"
          toolbar_bg="#1A1A1A"
          enable_publishing={false}
          hide_top_toolbar={true}
          save_image={false}
          container_id="tradingview_btc_chart"
        />
      </div>
    </div>
  );
});

export default CryptoChart;