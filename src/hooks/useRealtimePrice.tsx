import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface PriceData {
  [symbol: string]: number;
}

export function useRealtimePrice() {
  const [prices, setPrices] = useState<PriceData>({});
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    let ws: WebSocket | null = null;
    let reconnectTimeout: NodeJS.Timeout;
    let reconnectAttempts = 0;
    const MAX_RECONNECT_ATTEMPTS = 5;

    const connect = () => {
      try {
        // Conectar ao WebSocket da Bybit para preços em tempo real
        ws = new WebSocket('wss://stream.bybit.com/v5/public/linear');

        ws.onopen = () => {
          console.log('✅ Bybit WebSocket conectado para preços em tempo real');
          setIsConnected(true);
          reconnectAttempts = 0;

          // Subscrever aos principais pares
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
              const symbol = data.data.symbol; // Ex: BTCUSDT
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

        ws.onerror = (error) => {
          console.error('Erro no WebSocket de preços:', error);
          setIsConnected(false);
        };

        ws.onclose = () => {
          console.log('WebSocket de preços desconectado');
          setIsConnected(false);
          
          // Tentar reconectar com backoff exponencial
          if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
            const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000);
            reconnectAttempts++;
            console.log(`Tentando reconectar em ${delay}ms (tentativa ${reconnectAttempts})`);
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

  // Função auxiliar para obter preço por símbolo (com ou sem USDT)
  const getPrice = (symbol: string): number | null => {
    // Tentar primeiro com o símbolo exato
    if (prices[symbol]) return prices[symbol];
    
    // Tentar adicionar USDT
    if (!symbol.endsWith('USDT')) {
      const symbolWithUSDT = symbol + 'USDT';
      if (prices[symbolWithUSDT]) return prices[symbolWithUSDT];
    }
    
    // Tentar remover USDT
    if (symbol.endsWith('USDT')) {
      const symbolWithoutUSDT = symbol.slice(0, -4);
      if (prices[symbolWithoutUSDT]) return prices[symbolWithoutUSDT];
    }
    
    return null;
  };

  return {
    prices,
    getPrice,
    isConnected,
  };
}
