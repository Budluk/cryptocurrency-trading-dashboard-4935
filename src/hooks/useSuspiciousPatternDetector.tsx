import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

interface LargeOrder {
  symbol: string;
  side: string;
  value_usd: number;
  price: number;
  is_institutional: boolean;
  timestamp: number;
}

interface SuspiciousPattern {
  id: string;
  type: 'CLUSTER_ORDERS' | 'PRE_MOVEMENT';
  symbol: string;
  description: string;
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
  orders: LargeOrder[];
  detected_at: number;
}

export function useSuspiciousPatternDetector() {
  const [patterns, setPatterns] = useState<SuspiciousPattern[]>([]);
  const ordersHistoryRef = useRef<LargeOrder[]>([]);
  const priceHistoryRef = useRef<Map<string, { price: number; timestamp: number }[]>>(new Map());

  const addOrder = (order: LargeOrder) => {
    ordersHistoryRef.current.push(order);
    
    // Manter apenas últimas 100 ordens
    if (ordersHistoryRef.current.length > 100) {
      ordersHistoryRef.current = ordersHistoryRef.current.slice(-100);
    }

    // Detectar padrões após cada nova ordem
    detectPatterns();
  };

  const addPriceUpdate = (symbol: string, price: number) => {
    if (!priceHistoryRef.current.has(symbol)) {
      priceHistoryRef.current.set(symbol, []);
    }
    
    const history = priceHistoryRef.current.get(symbol)!;
    history.push({ price, timestamp: Date.now() });
    
    // Manter apenas últimos 50 pontos de preço
    if (history.length > 50) {
      priceHistoryRef.current.set(symbol, history.slice(-50));
    }
  };

  const detectPatterns = () => {
    const now = Date.now();
    const recentOrders = ordersHistoryRef.current.filter(o => now - o.timestamp < 5 * 60 * 1000); // Últimos 5 minutos

    // Padrão 1: Múltiplas ordens grandes do mesmo lado em curto período
    detectClusterOrders(recentOrders, now);

    // Padrão 2: Grandes ordens seguidas por movimentos significativos de preço
    detectPreMovementOrders(recentOrders, now);

    // Limpar padrões antigos (mais de 10 minutos)
    setPatterns(prev => prev.filter(p => now - p.detected_at < 10 * 60 * 1000));
  };

  const detectClusterOrders = (orders: LargeOrder[], now: number) => {
    const symbolGroups = new Map<string, { BUY: LargeOrder[]; SELL: LargeOrder[] }>();

    // Agrupar ordens por símbolo e lado
    orders.forEach(order => {
      if (!symbolGroups.has(order.symbol)) {
        symbolGroups.set(order.symbol, { BUY: [], SELL: [] });
      }
      const group = symbolGroups.get(order.symbol)!;
      group[order.side as 'BUY' | 'SELL'].push(order);
    });

    // Detectar clusters (3+ ordens do mesmo lado em 3 minutos)
    symbolGroups.forEach((group, symbol) => {
      ['BUY', 'SELL'].forEach(side => {
        const sideOrders = group[side as 'BUY' | 'SELL'];
        
        // Filtrar ordens dos últimos 3 minutos
        const recentSideOrders = sideOrders.filter(o => now - o.timestamp < 3 * 60 * 1000);
        
        if (recentSideOrders.length >= 3) {
          const totalValue = recentSideOrders.reduce((sum, o) => sum + o.value_usd, 0);
          const institutionalCount = recentSideOrders.filter(o => o.is_institutional).length;
          
          const patternId = `CLUSTER-${symbol}-${side}-${Math.floor(now / 60000)}`;
          
          // Verificar se já detectamos este padrão
          if (!patterns.some(p => p.id === patternId)) {
            const pattern: SuspiciousPattern = {
              id: patternId,
              type: 'CLUSTER_ORDERS',
              symbol,
              description: `${recentSideOrders.length} ordens de ${side} detectadas em 3 minutos (${formatVolume(totalValue)})${institutionalCount > 0 ? ` - ${institutionalCount} institucional(is)` : ''}`,
              severity: institutionalCount >= 2 ? 'HIGH' : totalValue > 5000000 ? 'HIGH' : 'MEDIUM',
              orders: recentSideOrders,
              detected_at: now,
            };

            setPatterns(prev => [...prev, pattern]);
            
            toast.error(
              `⚠️ Padrão Suspeito: ${pattern.description}`,
              { 
                duration: 8000,
                description: `Possível acumulação/distribuição em ${symbol}`
              }
            );
          }
        }
      });
    });
  };

  const detectPreMovementOrders = (orders: LargeOrder[], now: number) => {
    orders.forEach(order => {
      const priceHistory = priceHistoryRef.current.get(order.symbol);
      if (!priceHistory || priceHistory.length < 5) return;

      // Pegar preços antes e depois da ordem (janela de 2 minutos)
      const orderTime = order.timestamp;
      const pricesBefore = priceHistory.filter(p => 
        p.timestamp < orderTime && p.timestamp > orderTime - 2 * 60 * 1000
      );
      const pricesAfter = priceHistory.filter(p => 
        p.timestamp > orderTime && p.timestamp < orderTime + 2 * 60 * 1000
      );

      if (pricesBefore.length === 0 || pricesAfter.length === 0) return;

      const avgBefore = pricesBefore.reduce((sum, p) => sum + p.price, 0) / pricesBefore.length;
      const avgAfter = pricesAfter.reduce((sum, p) => sum + p.price, 0) / pricesAfter.length;
      
      const priceChange = ((avgAfter - avgBefore) / avgBefore) * 100;

      // Se houve movimento significativo (>1%) na direção da ordem
      const significantMove = Math.abs(priceChange) > 1;
      const sameDirection = (order.side === 'BUY' && priceChange > 0) || (order.side === 'SELL' && priceChange < 0);

      if (significantMove && sameDirection) {
        const patternId = `PRE_MOVEMENT-${order.symbol}-${orderTime}`;
        
        if (!patterns.some(p => p.id === patternId)) {
          const pattern: SuspiciousPattern = {
            id: patternId,
            type: 'PRE_MOVEMENT',
            symbol: order.symbol,
            description: `Grande ordem de ${order.side} (${formatVolume(order.value_usd)}) seguida por ${priceChange > 0 ? 'alta' : 'queda'} de ${Math.abs(priceChange).toFixed(2)}%`,
            severity: order.is_institutional ? 'HIGH' : 'MEDIUM',
            orders: [order],
            detected_at: now,
          };

          setPatterns(prev => [...prev, pattern]);
          
          toast.warning(
            `📊 Movimento Pós-Ordem: ${pattern.description}`,
            { 
              duration: 8000,
              description: `Possível manipulação ou insider em ${order.symbol}`
            }
          );
        }
      }
    });
  };

  const formatVolume = (volume: number) => {
    if (volume >= 1000000) {
      return `$${(volume / 1000000).toFixed(2)}M`;
    }
    return `$${(volume / 1000).toFixed(0)}K`;
  };

  return {
    patterns,
    addOrder,
    addPriceUpdate,
  };
}
