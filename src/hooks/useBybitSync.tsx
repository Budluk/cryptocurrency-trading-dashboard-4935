import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

/**
 * Sincronização otimizada com Bybit usando intervalo maior e debounce
 */
export const useBybitSync = (isEnabled: boolean = true) => {
  const { toast } = useToast();

  useEffect(() => {
    if (!isEnabled) return;
    
    let isActive = true;
    let isProcessing = false;

    const syncPositions = async () => {
      if (!isActive || isProcessing) return;
      isProcessing = true;
      
      try {
        // Verificar autenticação
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // Buscar posições abertas da Bybit
        const { data: bybitResponse, error: bybitError } = await supabase.functions.invoke('bybit-trading', {
          body: {
            action: 'get_positions',
            isTestnet: false,
            params: { 
              category: 'linear',
              settleCoin: 'USDT' 
            }
          }
        });

        if (bybitError || !bybitResponse?.success) {
          console.error('❌ Erro ao buscar posições da Bybit:', bybitError || bybitResponse?.error);
          return;
        }

        const bybitPositions = (bybitResponse.data?.list || []) as any[];
        const openBybitPositions = bybitPositions.filter((p: any) => parseFloat(p.size || 0) > 0);

        // Buscar posições do banco
        const { data: dbPositions, error: dbError } = await supabase
          .from('auto_trader_positions')
          .select('*')
          .eq('status', 'OPEN')
          .eq('user_id', user.id);

        if (dbError) {
          console.error('❌ Erro ao buscar posições do banco:', dbError);
          return;
        }

        const dbPositionsMap = new Map(
          (dbPositions || []).map((p: any) => [`${p.symbol}-${p.side}`, p])
        );

        const bybitPositionsMap = new Map(
          openBybitPositions.map((p: any) => [`${p.symbol}-${p.side}`, p])
        );

        let updated = 0;
        let closed = 0;
        let imported = 0;

        // 1. Atualizar posições existentes com dados da Bybit
        for (const [key, dbPosition] of dbPositionsMap) {
          const bybitPosition = bybitPositionsMap.get(key) as any;

          if (bybitPosition) {
            const currentPrice = parseFloat(bybitPosition.markPrice || bybitPosition.avgPrice || 0);
            const unrealizedPnl = parseFloat(bybitPosition.unrealisedPnl || 0);

            // Só atualizar se houver mudança significativa (> 0.5%)
            const priceDiff = Math.abs(currentPrice - dbPosition.current_price) / dbPosition.current_price * 100;
            
            if (priceDiff > 0.5) {
              await supabase
                .from('auto_trader_positions')
                .update({
                  current_price: currentPrice,
                  unrealized_pnl: unrealizedPnl,
                })
                .eq('id', dbPosition.id);

              updated++;
            }
          } else {
            // Posição não existe mais na Bybit - fechar no banco
            await supabase
              .from('auto_trader_positions')
              .update({
                status: 'CLOSED',
                closed_at: new Date().toISOString(),
                close_reason: 'Closed on Bybit',
                realized_pnl: dbPosition.unrealized_pnl || 0,
              })
              .eq('id', dbPosition.id);

            console.log(`🔒 Posição fechada: ${key}`);
            closed++;
          }
        }

        // 2. Importar novas posições que existem na Bybit mas não no banco
        for (const [key, bybitPosition] of bybitPositionsMap) {
          const position = bybitPosition as any;
          if (!dbPositionsMap.has(key)) {
            const symbol = position.symbol;
            const side = position.side;
            const entryPrice = parseFloat(position.avgPrice || 0);
            const qty = parseFloat(position.size || 0);
            const leverage = parseInt(position.leverage || 1);
            const stopLoss = position.stopLoss ? parseFloat(position.stopLoss) : null;
            const takeProfit = position.takeProfit ? parseFloat(position.takeProfit) : null;
            const currentPrice = parseFloat(position.markPrice || entryPrice);
            const unrealizedPnl = parseFloat(position.unrealisedPnl || 0);

            await supabase.from('auto_trader_positions').insert({
              user_id: user.id,
              symbol: symbol,
              side: side,
              qty: qty,
              entry_price: entryPrice,
              current_price: currentPrice,
              highest_price: currentPrice,
              stop_loss: stopLoss,
              take_profit: takeProfit,
              leverage: leverage,
              status: 'OPEN',
              confidence: 85,
              trailing_stop_percentage: 1.5,
              unrealized_pnl: unrealizedPnl,
              opened_at: position.createdTime 
                ? new Date(parseInt(position.createdTime)).toISOString() 
                : new Date().toISOString()
            });

            console.log(`✨ Nova posição importada: ${key}`);
            imported++;
          }
        }

        // Log resumo apenas se houver mudanças
        if (updated > 0 || closed > 0 || imported > 0) {
          console.log(`🔄 Sync: ${updated} atualizadas, ${closed} fechadas, ${imported} importadas`);
        }

      } catch (error) {
        console.error('❌ Erro na sincronização automática:', error);
      } finally {
        isProcessing = false;
      }
    };

    // Executar sincronização inicial após 2 segundos
    const initialSync = setTimeout(() => {
      if (isActive) syncPositions();
    }, 2000);
    
    // Sincronizar a cada 3 minutos
    const interval = setInterval(() => {
      if (isActive) syncPositions();
    }, 3 * 60 * 1000);
    
    return () => {
      isActive = false;
      clearTimeout(initialSync);
      clearInterval(interval);
    };
  }, [isEnabled, toast]);

  return null;
};
