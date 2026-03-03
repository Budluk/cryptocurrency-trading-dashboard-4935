import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { getUserId } from '@/lib/anonymousUser';
import { invokeBybit } from '@/lib/invokeBybit';
import { useContinuousMLTraining } from './useContinuousMLTraining';
import { useToast } from './use-toast';

interface BybitPosition {
  symbol: string;
  side: string;
  size: string;
  avgPrice: string;
  markPrice: string;
  leverage: string;
  unrealisedPnl: string;
  createdTime: string;
}

interface TrackedPosition {
  symbol: string;
  side: string;
  entryPrice: number;
  size: number;
  leverage: number;
  openedAt: string;
  isManual: boolean;
}

/**
 * 🧠 Hook para rastrear operações manuais do usuário e alimentar o sistema de ML
 * Detecta quando o usuário abre uma posição manualmente na Bybit e registra para aprendizado
 */
export const useManualTradeTracker = (isTestnet: boolean, isEnabled: boolean = true) => {
  const { toast } = useToast();
  const { addTradeToBuffer } = useContinuousMLTraining();
  
  // Posições conhecidas (abertas pelo bot ou já rastreadas)
  const knownPositions = useRef<Map<string, TrackedPosition>>(new Map());
  // IDs de posições que o bot abriu (para distinguir de manuais)
  const botOpenedPositions = useRef<Set<string>>(new Set());
  // Último snapshot de posições da Bybit
  const lastBybitSnapshot = useRef<Map<string, BybitPosition>>(new Map());
  
  // 🏷️ Marcar uma posição como aberta pelo bot
  const markAsBotOpened = useCallback((symbol: string) => {
    botOpenedPositions.current.add(symbol);
    console.log(`🤖 Posição ${symbol} marcada como aberta pelo bot`);
  }, []);

  // 🔍 Detectar novas posições que NÃO foram abertas pelo bot
  const detectManualTrades = useCallback(async (currentPositions: BybitPosition[]) => {
    const userId = await getUserId();

    const currentKeys = new Set(currentPositions.map(p => `${p.symbol}_${p.side}`));
    const previousKeys = new Set(lastBybitSnapshot.current.keys());

    for (const position of currentPositions) {
      const { symbol, side, avgPrice, size, leverage, createdTime } = position;
      const positionKey = `${symbol}_${side}`;

      // Posição já existia no snapshot anterior?
      const wasKnown = previousKeys.has(positionKey);
      const wasBotOpened = botOpenedPositions.current.has(symbol);

      // Nova posição detectada!
      if (!wasKnown && parseFloat(size) > 0) {
        const isManual = !wasBotOpened;

        const trackedPosition: TrackedPosition = {
          symbol,
          side,
          entryPrice: parseFloat(avgPrice),
          size: parseFloat(size),
          leverage: parseFloat(leverage),
          openedAt: createdTime || new Date().toISOString(),
          isManual,
        };

        knownPositions.current.set(positionKey, trackedPosition);

        if (isManual) {
          console.log(`🎯 OPERAÇÃO MANUAL DETECTADA: ${symbol} ${side} @ ${avgPrice}`);

          // Registrar no banco para a IA rastrear
          try {
            const { error } = await supabase
              .from('auto_trader_positions')
              .insert({
                user_id: userId,
                symbol,
                side: side === 'Buy' ? 'Buy' : 'Sell',
                entry_price: parseFloat(avgPrice),
                qty: parseFloat(size),
                leverage: parseFloat(leverage),
                status: 'OPEN',
                opened_at: new Date().toISOString(),
                order_source: 'MANUAL',
                confidence: 0,
              });

            if (!error) {
              toast({
                title: "🎓 Aprendendo com você",
                description: `Rastreando sua operação ${side} em ${symbol}`,
              });
              console.log(`✅ Operação manual ${symbol} registrada para aprendizado`);
            }
          } catch (err) {
            console.error('Erro ao registrar operação manual:', err);
          }
        }
      }
    }

    // Detectar posições que fecharam (por chave symbol_side)
    for (const [positionKey, prevPosition] of lastBybitSnapshot.current) {
      if (!currentKeys.has(positionKey)) {
        const tracked = knownPositions.current.get(positionKey);

        if (tracked) {
          const symbol = tracked.symbol;
          console.log(`📕 Posição fechada: ${symbol} (manual: ${tracked.isManual})`);

          // Buscar PnL real da Bybit
          try {
            const { data: closedPnlData } = await supabase.functions.invoke('bybit-trading', {
              body: {
                action: 'get_closed_pnl',
                isTestnet,
                params: { category: 'linear', symbol, limit: 1 }
              }
            });

            const closedTrade = closedPnlData?.data?.list?.[0];
            const realizedPnl = closedTrade ? parseFloat(closedTrade.closedPnl) : 0;
            const exitPrice = closedTrade ? parseFloat(closedTrade.avgExitPrice) : parseFloat(prevPosition.markPrice);

            // 🧠 Adicionar ao buffer de treinamento da IA
            addTradeToBuffer({
              symbol,
              side: tracked.side,
              entry_price: tracked.entryPrice,
              exit_price: exitPrice,
              realized_pnl: realizedPnl,
              leverage: tracked.leverage,
              volatility: 0,
              confidence: tracked.isManual ? 100 : 50,
              close_reason: tracked.isManual ? 'MANUAL_CLOSE' : 'AUTO_CLOSE',
              opened_at: tracked.openedAt,
              closed_at: new Date().toISOString(),
            });

            // Atualizar no banco (fechar apenas esse símbolo+lado)
            await supabase
              .from('auto_trader_positions')
              .update({
                status: 'CLOSED',
                exit_price: exitPrice,
                realized_pnl: realizedPnl,
                pnl: realizedPnl,
                closed_at: new Date().toISOString(),
                close_reason: tracked.isManual ? 'MANUAL_CLOSE' : 'AUTO_CLOSE',
              })
              .eq('symbol', symbol)
              .eq('side', tracked.side)
              .eq('status', 'OPEN')
              .eq('user_id', userId);

            if (tracked.isManual) {
              const emoji = realizedPnl >= 0 ? '✅' : '❌';
              toast({
                title: `${emoji} Trade manual finalizado`,
                description: `${symbol}: ${realizedPnl >= 0 ? '+' : ''}$${realizedPnl.toFixed(2)} - IA aprendeu!`,
              });
            }
          } catch (err) {
            console.error('Erro ao processar fechamento:', err);
          }

          // Limpar tracking
          knownPositions.current.delete(positionKey);
          botOpenedPositions.current.delete(symbol);
        }
      }
    }

    // Atualizar snapshot
    lastBybitSnapshot.current.clear();
    for (const pos of currentPositions) {
      if (parseFloat(pos.size) > 0) {
        lastBybitSnapshot.current.set(`${pos.symbol}_${pos.side}`, pos);
      }
    }
  }, [isTestnet, addTradeToBuffer, toast]);

  // 🔄 Sincronizar posições da Bybit periodicamente
  const syncPositions = useCallback(async () => {
    if (!isEnabled) return;
    
    try {
      const data = await invokeBybit('get_positions', { category: 'linear', settleCoin: 'USDT' }, { isTestnet });
      
      if (!data.success) return;
      
      const positions = Array.isArray(data.data) 
        ? data.data 
        : (data.data?.list || []);
      
      const activePositions = positions.filter((p: any) => parseFloat(p.size || '0') > 0);
      
      await detectManualTrades(activePositions);
    } catch (err) {
      console.error('Erro ao sincronizar posições para tracking:', err);
    }
  }, [isEnabled, isTestnet, detectManualTrades]);

  // ⏰ Iniciar monitoramento
  useEffect(() => {
    if (!isEnabled) return;
    
    console.log('🎓 Manual Trade Tracker ativado - IA vai aprender com suas operações!');
    
    // Sincronizar imediatamente
    syncPositions();
    
    // Sincronizar a cada 30 segundos para evitar rate-limit Bybit
    const interval = setInterval(syncPositions, 30000);
    
    return () => {
      clearInterval(interval);
      console.log('🎓 Manual Trade Tracker desativado');
    };
  }, [isEnabled, syncPositions]);

  return {
    markAsBotOpened,
    knownPositionsCount: knownPositions.current.size,
    manualTradesCount: Array.from(knownPositions.current.values()).filter(p => p.isManual).length,
  };
};
