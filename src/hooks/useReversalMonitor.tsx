import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useRealtimePrice } from "./useRealtimePrice";
import { getUserId } from "@/lib/anonymousUser";

interface ReversalPattern {
  symbol: string;
  direction: 'BULLISH' | 'BEARISH';
  severity: 'HIGH' | 'MEDIUM';
  timestamp: number;
}

interface Position {
  id: string;
  symbol: string;
  side: string;
  entry_price: number;
  qty: number;
  current_price: number | null;
  unrealized_pnl: number;
  status: string;
}

export const useReversalMonitor = (reversalPatterns: ReversalPattern[] = []) => {
  // Hook DESABILITADO temporariamente para evitar travamentos
  return;
  
  /* CÓDIGO ORIGINAL DESABILITADO
  const { toast } = useToast();
  const { getPrice } = useRealtimePrice();
  const [lastCheck, setLastCheck] = useState<number>(Date.now());

  useEffect(() => {
    if (reversalPatterns.length === 0) return;

    const checkReversals = async () => {
      try {
        const { data: positions, error } = await supabase
          .from('auto_trader_positions')
          .select('*')
          .eq('status', 'OPEN');

        if (error) throw error;
        if (!positions || positions.length === 0) return;

        for (const position of positions as Position[]) {
          // Atualizar preço em tempo real
          const symbol = position.symbol.replace('/', '').replace('USD', 'USDT');
          const livePrice = getPrice(symbol) || position.current_price || position.entry_price;

          // Verificar se há padrão de reversão relevante
          const relevantReversal = reversalPatterns.find(
            p => p.symbol.includes(position.symbol.replace('/', '')) && 
            Date.now() - p.timestamp < 3 * 60 * 1000 && // Últimos 3 minutos
            p.severity === 'HIGH'
          );

          if (relevantReversal) {
            let shouldClose = false;
            
            // Fechar LONG se reversão BEARISH detectada
            if (position.side === 'Buy' && relevantReversal.direction === 'BEARISH') {
              shouldClose = true;
              console.log(`🔄 Auto-fechamento: ${position.symbol} LONG - Reversão BEARISH detectada`);
            }
            
            // Fechar SHORT se reversão BULLISH detectada
            if (position.side === 'Sell' && relevantReversal.direction === 'BULLISH') {
              shouldClose = true;
              console.log(`🔄 Auto-fechamento: ${position.symbol} SHORT - Reversão BULLISH detectada`);
            }

            if (shouldClose) {
              // Calcular P&L final
              const realized_pnl = position.side === 'Buy'
                ? (livePrice - position.entry_price) * position.qty
                : (position.entry_price - livePrice) * position.qty;
              
              // Fechar posição
              const { error: closeError } = await supabase
                .from('auto_trader_positions')
                .update({
                  status: 'CLOSED',
                  closed_at: new Date().toISOString(),
                  close_reason: `Auto-fechamento: Reversão ${relevantReversal.direction} detectada`,
                  exit_price: livePrice,
                  realized_pnl,
                })
                .eq('id', position.id);

              if (!closeError) {
                const userId = await getUserId();
                await supabase.from('auto_trader_logs').insert({
                  user_id: userId,
                  log_type: 'REVERSAL_CLOSE',
                  position_id: position.id,
                  symbol: position.symbol,
                  message: `Fechado por reversão ${relevantReversal.direction} | P&L: $${realized_pnl.toFixed(2)}`,
                  metadata: { 
                    reversal_direction: relevantReversal.direction,
                    severity: relevantReversal.severity,
                    pnl: realized_pnl,
                    exit_price: livePrice,
                  },
                });

                // Notificar usuário
                toast({
                  title: "🔄 Posição fechada por reversão",
                  description: `${position.symbol}: Reversão ${relevantReversal.direction} detectada | P&L: ${realized_pnl > 0 ? '+' : ''}$${realized_pnl.toFixed(2)}`,
                  variant: realized_pnl > 0 ? "default" : "destructive",
                });
              }
            }
          }
        }

        setLastCheck(Date.now());
      } catch (error) {
        console.error('Erro no monitor de reversão:', error);
      }
    };

    // Executar imediatamente se houver novos padrões
    if (Date.now() - lastCheck > 5000) {
      checkReversals();
    }

    // 🔴 INTERVALO DESABILITADO para evitar piscar da tela
    // Verificação apenas quando necessário
    
    return () => {};
  }, [reversalPatterns, toast, getPrice, lastCheck]);

  return null;
  */ // FIM DO CÓDIGO DESABILITADO
};
