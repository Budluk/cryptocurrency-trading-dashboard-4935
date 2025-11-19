import React, { createContext, useContext, useEffect, useState } from "react";

interface PriceData {
  [symbol: string]: number;
}

interface RealtimePriceContextType {
  prices: PriceData;
  getPrice: (symbol: string) => number | null;
  isConnected: boolean;
}

const RealtimePriceContext = createContext<RealtimePriceContextType | undefined>(undefined);

export const RealtimePriceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [prices, setPrices] = useState<PriceData>({});
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    let ws: WebSocket | null = null;
    let reconnectTimeout: NodeJS.Timeout;
    let reconnectAttempts = 0;
    const MAX_RECONNECT_ATTEMPTS = 3;

    const connect = () => {
      try {
        ws = new WebSocket('wss://stream.bybit.com/v5/public/linear');

        ws.onopen = () => {
          console.log('✅ Bybit WebSocket conectado');
          setIsConnected(true);
          reconnectAttempts = 0;

          const symbols = ['BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT', 'XRPUSDT', 'DOGEUSDT'];
          symbols.forEach(symbol => {
            ws?.send(JSON.stringify({
              op: 'subscribe',
              args: [`tickers.${symbol}`]
            }));
          });
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            
            if (data.topic && data.topic.startsWith('tickers.') && data.data) {
              const symbol = data.data.symbol;
              const lastPrice = parseFloat(data.data.lastPrice);
              
              if (symbol && !isNaN(lastPrice)) {
                setPrices(prev => ({
                  ...prev,
                  [symbol]: lastPrice
                }));
              }
            }
          } catch (error) {
            console.error('Erro ao processar mensagem do WebSocket:', error);
          }
        };

        ws.onerror = () => {
          setIsConnected(false);
        };

        ws.onclose = () => {
          setIsConnected(false);
          
          if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
            const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 10000);
            reconnectAttempts++;
            reconnectTimeout = setTimeout(connect, delay);
          }
        };
      } catch (error) {
        console.error('Erro ao criar WebSocket:', error);
      }
    };

    connect();

    return () => {
      if (ws) {
        ws.close();
      }
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
      }
    };
  }, []);

  const getPrice = (symbol: string): number | null => {
    if (prices[symbol]) return prices[symbol];
    
    if (!symbol.endsWith('USDT')) {
      const symbolWithUSDT = symbol + 'USDT';
      if (prices[symbolWithUSDT]) return prices[symbolWithUSDT];
    }
    
    if (symbol.endsWith('USDT')) {
      const symbolWithoutUSDT = symbol.slice(0, -4);
      if (prices[symbolWithoutUSDT]) return prices[symbolWithoutUSDT];
    }
    
    return null;
  };

  return (
    <RealtimePriceContext.Provider value={{ prices, getPrice, isConnected }}>
      {children}
    </RealtimePriceContext.Provider>
  );
};

export const useRealtimePrice = () => {
  const context = useContext(RealtimePriceContext);
  if (context === undefined) {
    throw new Error('useRealtimePrice must be used within a RealtimePriceProvider');
  }
  return context;
};
