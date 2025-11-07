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
  realized_pnl: number | null;
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

          // 🎯 FECHAMENTO PARCIAL PROGRESSIVO
          const pnlPercent = side === 'BUY' 
            ? ((current_price - entry_price) / entry_price) * 100
            : ((entry_price - current_price) / entry_price) * 100;

          // Calcular quantidade reduzida (detectar fechamentos anteriores)
          const qtyReduced = position.qty < entry_price * 0.75; // Se qty é menor que esperado, já houve fechamento

          // 📊 PRIMEIRO FECHAMENTO: 25% em +1% de lucro
          if (!shouldClose && pnlPercent >= 1.0 && pnlPercent < 1.95 && qty > 0.003) {
            // Verificar se ainda tem quantidade suficiente (não fechou ainda)
            console.log(`🎯 ${position.symbol}: Nível 1 (+${pnlPercent.toFixed(2)}%) - Fechando 25%`);
            
            const qtyToClose = qty * 0.25;
            const remainingQty = qty - qtyToClose;
            const partialPnl = side === 'BUY'
              ? (current_price - entry_price) * qtyToClose
              : (entry_price - current_price) * qtyToClose;

            await supabase
              .from('auto_trader_positions')
              .update({
                qty: remainingQty,
                realized_pnl: (position.realized_pnl || 0) + partialPnl,
              })
              .eq('id', id);

            toast({
              title: "🎯 Fechamento 1/3: +1%",
              description: `${position.symbol}: 25% fechado | P&L: +$${partialPnl.toFixed(2)} | Restante: ${(remainingQty / qty * 100).toFixed(0)}%`,
            });

            // Log
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
              await supabase.from('auto_trader_logs').insert({
                user_id: user.id,
                log_type: 'PARTIAL_TP',
                position_id: id,
                symbol: position.symbol,
                message: `Parcial 1/3: 25% fechado em +${pnlPercent.toFixed(2)}%`,
                metadata: { level: 1, pnl: partialPnl, remaining_qty: remainingQty },
              });
            }
          }

          // 📊 SEGUNDO FECHAMENTO: 25% em +2% de lucro e MOVE STOP PARA BREAKEVEN
          if (!shouldClose && pnlPercent >= 2.0 && pnlPercent < 2.95 && qty > 0.002) {
            console.log(`🎯 ${position.symbol}: Nível 2 (+${pnlPercent.toFixed(2)}%) - Fechando 25% e movendo stop para breakeven`);
            
            const qtyToClose = qty * 0.333; // 25% do total original (≈33% do que restou)
            const remainingQty = qty - qtyToClose;
            const partialPnl = side === 'BUY'
              ? (current_price - entry_price) * qtyToClose
              : (entry_price - current_price) * qtyToClose;

            await supabase
              .from('auto_trader_positions')
              .update({
                qty: remainingQty,
                stop_loss: entry_price, // 🛡️ MOVE STOP PARA BREAKEVEN
                realized_pnl: (position.realized_pnl || 0) + partialPnl,
              })
              .eq('id', id);

            toast({
              title: "🎯 Fechamento 2/3: +2%",
              description: `${position.symbol}: 25% fechado | Stop → Breakeven | 50% livre com trailing stop`,
            });

            // Log
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
              await supabase.from('auto_trader_logs').insert({
                user_id: user.id,
                log_type: 'PARTIAL_TP',
                position_id: id,
                symbol: position.symbol,
                message: `Parcial 2/3: 25% fechado em +${pnlPercent.toFixed(2)}% - Stop → Breakeven`,
                metadata: { level: 2, pnl: partialPnl, remaining_qty: remainingQty, new_stop: entry_price },
              });
            }
          }

          // 🚀 50% RESTANTE: Trailing stop automático (já implementado abaixo)

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
