import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useRealtimePrice } from "./useRealtimePrice";
import { usePositions } from "@/contexts/PositionsContext";

export const usePositionMonitor = (reversalPatterns: any[] = []) => {
  const { toast } = useToast();
  const { getPrice } = useRealtimePrice();
  const { openPositions } = usePositions();

  useEffect(() => {
    if (!openPositions || openPositions.length === 0) return;

    // 🔴 DESABILITADO temporariamente para evitar travamentos
    return;

    // Debounce para evitar updates muito frequentes
    let isProcessing = false;

    const monitorPositions = async () => {
      if (isProcessing) return;
      isProcessing = true;

      try {
        for (const position of openPositions) {
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
          let needsUpdate = false;

          // 🎯 ATIVAR TRAILING STOP AUTOMÁTICO quando lucrativo
          const pnlPercentForTrailing = side === 'BUY' 
            ? ((current_price - entry_price) / entry_price) * 100
            : ((entry_price - current_price) / entry_price) * 100;

          // Ativar trailing stop automaticamente quando > +0.5% de lucro
          let activeTrailingStop = trailing_stop_percentage;
          if (pnlPercentForTrailing > 0.5 && (!trailing_stop_percentage || trailing_stop_percentage === 0)) {
            activeTrailingStop = 1.5;
            await supabase
              .from('auto_trader_positions')
              .update({ 
                trailing_stop_percentage: activeTrailingStop,
                highest_price: current_price 
              })
              .eq('id', id);
            console.log(`🎯 ${position.symbol}: Trailing stop ativado em +${pnlPercentForTrailing.toFixed(2)}%`);
            continue; // Skip resto do loop para esta posição
          }

          // 🎯 TRAILING STOP DINÂMICO - Acompanha preço
          if (activeTrailingStop && activeTrailingStop > 0) {
            if (side === 'BUY') {
              // Só atualizar se mudança > 0.1% para evitar updates constantes
              const priceChangePercent = ((current_price - updatedHighestPrice) / updatedHighestPrice) * 100;
              
              if (priceChangePercent > 0.1) {
                updatedHighestPrice = current_price;
                needsUpdate = true;
                
                const profitFromEntry = ((current_price - entry_price) / entry_price) * 100;
                console.log(`📈 ${position.symbol} BUY: Novo máximo $${updatedHighestPrice.toFixed(2)} (+${profitFromEntry.toFixed(2)}%)`);
              }

              const trailingStopPrice = updatedHighestPrice * (1 - activeTrailingStop / 100);
              
              if (current_price <= trailingStopPrice) {
                shouldClose = true;
                closeReason = `Trailing Stop ${activeTrailingStop}%`;
                realized_pnl = (current_price - entry_price) * qty;
                console.log(`🛑 ${position.symbol} BUY: Trailing stop acionado!`);
              }
            } else if (side === 'SELL') {
              const priceChangePercent = ((updatedHighestPrice - current_price) / updatedHighestPrice) * 100;
              
              if (priceChangePercent > 0.1) {
                updatedHighestPrice = current_price;
                needsUpdate = true;
                
                const profitFromEntry = ((entry_price - current_price) / entry_price) * 100;
                console.log(`📉 ${position.symbol} SELL: Novo mínimo $${updatedHighestPrice.toFixed(2)} (+${profitFromEntry.toFixed(2)}%)`);
              }

              const trailingStopPrice = updatedHighestPrice * (1 + activeTrailingStop / 100);
              
              if (current_price >= trailingStopPrice) {
                shouldClose = true;
                closeReason = `Trailing Stop ${activeTrailingStop}%`;
                realized_pnl = (entry_price - current_price) * qty;
                console.log(`🛑 ${position.symbol} SELL: Trailing stop acionado!`);
              }
            }
            
            // Atualizar apenas se houve mudança significativa
            if (needsUpdate && !shouldClose) {
              await supabase
                .from('auto_trader_positions')
                .update({ highest_price: updatedHighestPrice })
                .eq('id', id);
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
              
              // 🛡️ ATUALIZAR GESTÃO DE RISCO SE PERDA
              if (user && realized_pnl < 0) {
                const { data: riskSettings } = await supabase
                  .from('risk_management_settings')
                  .select('*')
                  .eq('user_id', user.id)
                  .maybeSingle();

                if (riskSettings) {
                  const newDailyLoss = riskSettings.current_daily_loss + realized_pnl;
                  const shouldPause = Math.abs(newDailyLoss) >= riskSettings.max_daily_loss;

                  await supabase
                    .from('risk_management_settings')
                    .update({
                      current_daily_loss: newDailyLoss,
                      trading_paused: shouldPause
                    })
                    .eq('user_id', user.id);

                  if (shouldPause) {
                    toast({
                      title: "🛑 Limite Diário Atingido",
                      description: `Trading pausado. Perda diária: $${Math.abs(newDailyLoss).toFixed(2)}`,
                      variant: "destructive"
                    });
                  }
                }
              }
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
      } finally {
        isProcessing = false;
      }
    };

    // Debounce de 5 segundos para evitar execuções muito frequentes
    const timeoutId = setTimeout(() => {
      monitorPositions();
    }, 5000);

    return () => clearTimeout(timeoutId);
  }, [openPositions, toast, getPrice]);
};
