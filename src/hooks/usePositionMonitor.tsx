import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Position {
  id: string;
  symbol: string;
  side: string; // 'BUY' ou 'SELL'
  entry_price: number;
  qty: number;
  stop_loss: number | null;
  take_profit: number | null;
  current_price: number | null;
  highest_price: number | null;
  unrealized_pnl: number;
  trailing_stop_percentage: number | null;
  status: string;
  exchange_order_id: string | null;
}

export const usePositionMonitor = () => {
  const { toast } = useToast();

  useEffect(() => {
    const monitorPositions = async () => {
      try {
        const { data: positions, error } = await supabase
          .from('auto_trader_positions')
          .select('*')
          .eq('status', 'OPEN');

        if (error) throw error;
        if (!positions || positions.length === 0) return;

        for (const position of positions as Position[]) {
          if (!position.current_price) continue;

          const { 
            id, 
            side, 
            entry_price, 
            current_price, 
            highest_price,
            stop_loss, 
            take_profit,
            qty,
            trailing_stop_percentage
          } = position;
          
          let shouldClose = false;
          let closeReason = '';
          let exit_price = current_price;
          let realized_pnl = position.unrealized_pnl;
          let updatedHighestPrice = highest_price || entry_price;

          // 🎯 TRAILING STOP AUTOMÁTICO
          if (trailing_stop_percentage && trailing_stop_percentage > 0) {
            if (side === 'BUY') {
              // Para posições de compra: acompanhar o máximo preço
              if (current_price > updatedHighestPrice) {
                updatedHighestPrice = current_price;
                
                // Atualizar highest_price no banco imediatamente
                await supabase
                  .from('auto_trader_positions')
                  .update({ highest_price: updatedHighestPrice })
                  .eq('id', id);
                
                console.log(`📈 ${position.symbol} BUY: Novo máximo $${updatedHighestPrice.toFixed(2)} | Trailing: $${(updatedHighestPrice * (1 - trailing_stop_percentage / 100)).toFixed(2)}`);
              }

              // Calcular trailing stop baseado no highest price
              const trailingStopPrice = updatedHighestPrice * (1 - trailing_stop_percentage / 100);
              
              if (current_price <= trailingStopPrice) {
                shouldClose = true;
                closeReason = `Trailing Stop ${trailing_stop_percentage}%`;
                realized_pnl = (current_price - entry_price) * qty;
                console.log(`🛑 ${position.symbol} BUY: Trailing stop acionado! Max: $${updatedHighestPrice.toFixed(2)} → Atual: $${current_price.toFixed(2)}`);
              }
            } else if (side === 'SELL') {
              // Para posições de venda: acompanhar o mínimo preço
              if (current_price < updatedHighestPrice) {
                updatedHighestPrice = current_price;
                
                // Atualizar highest_price no banco
                await supabase
                  .from('auto_trader_positions')
                  .update({ highest_price: updatedHighestPrice })
                  .eq('id', id);
                
                console.log(`📉 ${position.symbol} SELL: Novo mínimo $${updatedHighestPrice.toFixed(2)} | Trailing: $${(updatedHighestPrice * (1 + trailing_stop_percentage / 100)).toFixed(2)}`);
              }

              const trailingStopPrice = updatedHighestPrice * (1 + trailing_stop_percentage / 100);
              
              if (current_price >= trailingStopPrice) {
                shouldClose = true;
                closeReason = `Trailing Stop ${trailing_stop_percentage}%`;
                realized_pnl = (entry_price - current_price) * qty;
                console.log(`🛑 ${position.symbol} SELL: Trailing stop acionado! Min: $${updatedHighestPrice.toFixed(2)} → Atual: $${current_price.toFixed(2)}`);
              }
            }
          }

          // Verificar Stop Loss tradicional (apenas se não foi trailing)
          if (stop_loss && !shouldClose) {
            if (side === 'BUY' && current_price <= stop_loss) {
              shouldClose = true;
              closeReason = 'Stop Loss Atingido';
              realized_pnl = (current_price - entry_price) * qty;
            } else if (side === 'SELL' && current_price >= stop_loss) {
              shouldClose = true;
              closeReason = 'Stop Loss Atingido';
              realized_pnl = (entry_price - current_price) * qty;
            }
          }

          // Verificar Take Profit
          if (take_profit && !shouldClose) {
            if (side === 'BUY' && current_price >= take_profit) {
              shouldClose = true;
              closeReason = 'Take Profit Atingido';
              realized_pnl = (current_price - entry_price) * qty;
            } else if (side === 'SELL' && current_price <= take_profit) {
              shouldClose = true;
              closeReason = 'Take Profit Atingido';
              realized_pnl = (entry_price - current_price) * qty;
            }
          }

          // 🎯 PARTIAL TAKE PROFIT - Fechar 50% em 1.5% de lucro
          const pnlPercent = side === 'BUY' 
            ? ((current_price - entry_price) / entry_price) * 100
            : ((entry_price - current_price) / entry_price) * 100;

          if (!shouldClose && pnlPercent >= 1.5 && qty > 0.002) { // 1.5% de lucro e quantidade suficiente
            console.log(`🎯 ${position.symbol}: Partial TP atingido (${pnlPercent.toFixed(2)}%) - Fechando 50%`);
            
            const halfQty = qty / 2;
            const partialPnl = side === 'BUY'
              ? (current_price - entry_price) * halfQty
              : (entry_price - current_price) * halfQty;

            // Atualizar posição: reduzir quantidade e mover stop para breakeven
            await supabase
              .from('auto_trader_positions')
              .update({
                qty: halfQty,
                stop_loss: entry_price, // Move stop para breakeven
                realized_pnl: partialPnl,
              })
              .eq('id', id);

            toast({
              title: "🎯 Partial Take Profit",
              description: `${position.symbol}: 50% fechado em +${pnlPercent.toFixed(2)}% | P&L: +$${partialPnl.toFixed(2)} | Stop movido para breakeven`,
            });

            // Log
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
              await supabase.from('auto_trader_logs').insert({
                user_id: user.id,
                log_type: 'PARTIAL_TP',
                position_id: id,
                symbol: position.symbol,
                message: `Partial TP: 50% fechado em +${pnlPercent.toFixed(2)}%`,
                metadata: { 
                  pnl: partialPnl,
                  remaining_qty: halfQty,
                  new_stop: entry_price
                },
              });
            }
          }

          // 🔥 FECHAR POSIÇÃO AUTOMATICAMENTE
          if (shouldClose) {
            console.log(`💰 Fechando ${position.symbol} ${side}: ${closeReason} | P&L: $${realized_pnl.toFixed(2)}`);
            
            // Atualizar no banco
            const { error: closeError } = await supabase
              .from('auto_trader_positions')
              .update({
                status: 'CLOSED',
                closed_at: new Date().toISOString(),
                close_reason: closeReason,
                exit_price: exit_price,
                realized_pnl: realized_pnl,
              })
              .eq('id', id);

            if (!closeError) {
              // Criar log
              const { data: { user } } = await supabase.auth.getUser();
              if (user) {
                await supabase.from('auto_trader_logs').insert({
                  user_id: user.id,
                  log_type: 'AUTO_CLOSE',
                  position_id: id,
                  symbol: position.symbol,
                  message: `${closeReason} - Entry: $${entry_price.toFixed(2)} → Exit: $${exit_price.toFixed(2)}`,
                  metadata: { 
                    pnl: realized_pnl, 
                    reason: closeReason, 
                    entry_price,
                    exit_price,
                    highest_price: updatedHighestPrice
                  },
                });
              }

              // Notificação
              const isProfitable = realized_pnl > 0;
              toast({
                title: isProfitable ? "🎯 Lucro Garantido!" : "⚠️ Posição Fechada",
                description: `${position.symbol}: ${closeReason}\nP&L: ${isProfitable ? '+' : ''}$${realized_pnl.toFixed(2)}`,
                variant: isProfitable ? "default" : "destructive",
              });
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
