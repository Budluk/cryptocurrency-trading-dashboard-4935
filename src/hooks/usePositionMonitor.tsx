import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Position {
  id: string;
  symbol: string;
  action: string;
  entry_price: number;
  quantity: number;
  stop_loss: number | null;
  take_profit: number | null;
  current_price: number | null;
  unrealized_pnl: number;
  trailing_stop_percentage: number | null;
  status: string;
}

export const usePositionMonitor = () => {
  const { toast } = useToast();
  const trailingStopPrices = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    const monitorPositions = async () => {
      try {
        const { data: positions, error } = await supabase
          .from('auto_trader_positions')
          .select('*')
          .eq('status', 'OPEN');

        if (error) throw error;

        for (const position of positions as Position[]) {
          if (!position.current_price) continue;

          const { id, action, entry_price, current_price, stop_loss, take_profit } = position;
          let shouldClose = false;
          let closeReason = '';
          let realized_pnl = position.unrealized_pnl;

          // Verificar Stop Loss
          if (stop_loss) {
            if (action === 'BUY' && current_price <= stop_loss) {
              shouldClose = true;
              closeReason = 'Stop Loss Atingido';
            } else if (action === 'SELL' && current_price >= stop_loss) {
              shouldClose = true;
              closeReason = 'Stop Loss Atingido';
            }
          }

          // Verificar Take Profit
          if (take_profit && !shouldClose) {
            if (action === 'BUY' && current_price >= take_profit) {
              shouldClose = true;
              closeReason = 'Take Profit Atingido';
            } else if (action === 'SELL' && current_price <= take_profit) {
              shouldClose = true;
              closeReason = 'Take Profit Atingido';
            }
          }

          // Implementar Trailing Stop
          if (position.trailing_stop_percentage && !shouldClose) {
            const trailingStopKey = id;
            let highestPrice = trailingStopPrices.current.get(trailingStopKey) || entry_price;

            if (action === 'BUY') {
              // Atualizar highest price se necessário
              if (current_price > highestPrice) {
                highestPrice = current_price;
                trailingStopPrices.current.set(trailingStopKey, highestPrice);
              }

              // Calcular trailing stop
              const trailingStopPrice = highestPrice * (1 - position.trailing_stop_percentage / 100);
              
              if (current_price <= trailingStopPrice) {
                shouldClose = true;
                closeReason = 'Trailing Stop Acionado';
                realized_pnl = (current_price - entry_price) * position.quantity;
              }
            } else if (action === 'SELL') {
              // Para vendas, acompanhar o preço mais baixo
              if (current_price < highestPrice) {
                highestPrice = current_price;
                trailingStopPrices.current.set(trailingStopKey, highestPrice);
              }

              const trailingStopPrice = highestPrice * (1 + position.trailing_stop_percentage / 100);
              
              if (current_price >= trailingStopPrice) {
                shouldClose = true;
                closeReason = 'Trailing Stop Acionado';
                realized_pnl = (entry_price - current_price) * position.quantity;
              }
            }
          }

          // Fechar posição se necessário
          if (shouldClose) {
            const { error: closeError } = await supabase
              .from('auto_trader_positions')
              .update({
                status: 'CLOSED',
                closed_at: new Date().toISOString(),
                close_reason: closeReason,
                realized_pnl,
              })
              .eq('id', id);

            if (!closeError) {
              // Log do fechamento
              const { data: { user } } = await supabase.auth.getUser();
              if (user) {
                await supabase.from('auto_trader_logs').insert([{
                  user_id: user.id,
                  log_type: 'AUTO_CLOSE' as any,
                  position_id: id,
                  symbol: position.symbol,
                  message: `Fechamento automático: ${closeReason}`,
                  metadata: { pnl: realized_pnl, reason: closeReason, price: current_price } as any,
                }]);
              }

              // Notificação
              toast({
                title: realized_pnl > 0 ? "🎯 Lucro garantido!" : "⚠️ Posição fechada",
                description: `${position.symbol}: ${closeReason} - P&L: $${realized_pnl.toFixed(2)}`,
                variant: realized_pnl > 0 ? "default" : "destructive",
              });

              // Limpar trailing stop armazenado
              trailingStopPrices.current.delete(id);
            }
          }
        }
      } catch (error) {
        console.error('Erro no monitoramento de posições:', error);
      }
    };

    // Executar imediatamente
    monitorPositions();

    // Executar a cada 10 segundos
    const interval = setInterval(monitorPositions, 10000);

    return () => clearInterval(interval);
  }, [toast]);

  return null;
};
