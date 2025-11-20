import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Hook para atualizar preços de posições abertas em tempo real
 * Busca preços atuais da Bybit a cada 10 segundos
 */
export const usePriceUpdater = () => {
  useEffect(() => {
    let isActive = true;

    const updatePrices = async () => {
      if (!isActive) return;
      
      try {
        // Buscar posições abertas
        const { data: positions, error } = await supabase
          .from('auto_trader_positions')
          .select('id, symbol, side, entry_price, qty')
          .eq('status', 'OPEN')
          .limit(50);

        if (error) {
          console.error('Erro ao buscar posições:', error);
          return;
        }

        if (!positions || positions.length === 0) return;

        // Buscar apenas os símbolos únicos das posições
        const uniqueSymbols = [...new Set(positions.map(p => p.symbol))];
        
        // Buscar preços apenas dos símbolos necessários
        for (const symbol of uniqueSymbols) {
          if (!isActive) break;
          
          try {
            const { data: tickerData } = await supabase.functions.invoke('bybit-trading', {
              body: {
                action: 'get_ticker',
                isTestnet: false,
                params: { 
                  category: 'linear',
                  symbol: symbol
                }
              }
            });

            if (!tickerData?.success || !tickerData.data?.list?.[0]) continue;

            const ticker = tickerData.data.list[0];
            const currentPrice = parseFloat(ticker.lastPrice);

            // Atualizar todas as posições deste símbolo de uma vez
            const positionsToUpdate = positions.filter(p => p.symbol === symbol);
            
            for (const position of positionsToUpdate) {
              if (!isActive) break;
              
              const unrealizedPnl = position.side === 'BUY' 
                ? (currentPrice - position.entry_price) * position.qty
                : (position.entry_price - currentPrice) * position.qty;

              await supabase
                .from('auto_trader_positions')
                .update({
                  current_price: currentPrice,
                  unrealized_pnl: unrealizedPnl
                })
                .eq('id', position.id);
            }
          } catch (err) {
            console.error(`Erro ao atualizar ${symbol}:`, err);
          }
        }
      } catch (error) {
        console.error('Erro geral ao atualizar preços:', error);
      }
    };

    // Esperar 5 segundos antes da primeira execução
    const initialTimeout = setTimeout(() => {
      if (isActive) updatePrices();
    }, 5000);
    
    // Depois executar a cada 30 segundos (reduzido de 10s)
    const interval = setInterval(() => {
      if (isActive) updatePrices();
    }, 30000);

    return () => {
      isActive = false;
      clearTimeout(initialTimeout);
      clearInterval(interval);
    };
  }, []);

  return null;
};
