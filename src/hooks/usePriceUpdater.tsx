import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Hook para atualizar preços de posições abertas em tempo real
 * Busca preços atuais da Bybit a cada 10 segundos
 */
export const usePriceUpdater = () => {
  useEffect(() => {
    const updatePrices = async () => {
      try {
        // Buscar todas as posições abertas
        const { data: positions, error } = await supabase
          .from('auto_trader_positions')
          .select('id, symbol, side, entry_price, qty')
          .eq('status', 'OPEN');

        if (error || !positions || positions.length === 0) return;

        // Buscar preços atuais de todos os símbolos
        const { data: tickerData } = await supabase.functions.invoke('bybit-trading', {
          body: {
            action: 'get_ticker',
            isTestnet: false,
            params: { category: 'linear' }
          }
        });

        if (!tickerData?.success) return;

        const tickers = tickerData.data?.list || [];

        // Atualizar cada posição
        for (const position of positions) {
          const ticker = tickers.find((t: any) => t.symbol === position.symbol);
          if (!ticker) continue;

          const currentPrice = parseFloat(ticker.lastPrice);
          
          // Calcular P&L não realizado
          const unrealizedPnl = position.side === 'BUY' 
            ? (currentPrice - position.entry_price) * position.qty
            : (position.entry_price - currentPrice) * position.qty;

          // Atualizar no banco
          await supabase
            .from('auto_trader_positions')
            .update({
              current_price: currentPrice,
              unrealized_pnl: unrealizedPnl
            })
            .eq('id', position.id);
        }

        console.log(`🔄 Preços atualizados: ${positions.length} posições`);
      } catch (error) {
        console.error('Erro ao atualizar preços:', error);
      }
    };

    // Executar imediatamente e depois a cada 10 segundos
    updatePrices();
    const interval = setInterval(updatePrices, 10000);

    return () => clearInterval(interval);
  }, []);

  return null;
};
