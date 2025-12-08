import { useState, useCallback, useRef } from 'react';
import { supabase } from "@/integrations/supabase/client";

export interface BybitSyncState {
  currentBalance: number;
  openPositionsCount: number;
  lastSyncTime: Date | null;
  top10VolatileAssets: Set<string>;
}

// Cache global para evitar chamadas duplicadas
const syncCache = {
  balance: { data: 0, timestamp: 0 },
  positions: { data: [] as any[], timestamp: 0 },
  volatile: { data: new Set<string>(), timestamp: 0 },
};

const CACHE_TTL = 5000; // 5 segundos de cache

export const useBybitSync = () => {
  const [currentBalance, setCurrentBalance] = useState(0);
  const [openPositionsCount, setOpenPositionsCount] = useState(0);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [top10VolatileAssets, setTop10VolatileAssets] = useState<Set<string>>(new Set([
    'BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'DOGEUSDT',
    'SHIBUSDT', 'PEPEUSDT', 'AVAXUSDT', 'NEARUSDT', 'APTUSDT'
  ]));
  
  const pendingRequests = useRef<Map<string, Promise<any>>>(new Map());

  // 🔄 Sincronizar saldo da Bybit (com cache)
  const syncBybitBalance = useCallback(async () => {
    const now = Date.now();
    
    // Verificar cache
    if (now - syncCache.balance.timestamp < CACHE_TTL && syncCache.balance.data > 0) {
      setCurrentBalance(syncCache.balance.data);
      return syncCache.balance.data;
    }
    
    // Verificar se já há uma requisição pendente
    if (pendingRequests.current.has('balance')) {
      return pendingRequests.current.get('balance');
    }
    
    const request = (async () => {
      try {
        const { data, error } = await supabase.functions.invoke('bybit-trading', {
          body: {
            action: 'get_balance',
            isTestnet: false,
            params: { accountType: 'UNIFIED' }
          }
        });

        if (!error && data?.success) {
          const availableBalance = parseFloat(data.data.list[0]?.totalAvailableBalance || '0');
          setCurrentBalance(availableBalance);
          setLastSyncTime(new Date());
          
          // Atualizar cache
          syncCache.balance = { data: availableBalance, timestamp: Date.now() };
          
          console.log(`💰 Saldo sincronizado: $${availableBalance.toFixed(2)}`);
          return availableBalance;
        }
        return 0;
      } catch (error) {
        console.error('Erro ao sincronizar saldo:', error);
        return 0;
      } finally {
        pendingRequests.current.delete('balance');
      }
    })();
    
    pendingRequests.current.set('balance', request);
    return request;
  }, []);

  // 📊 Sincronizar posições abertas (com cache)
  const syncOpenPositions = useCallback(async () => {
    const now = Date.now();
    
    // Verificar cache
    if (now - syncCache.positions.timestamp < CACHE_TTL) {
      const cached = syncCache.positions.data;
      setOpenPositionsCount(cached.length);
      return cached;
    }
    
    // Verificar se já há uma requisição pendente
    if (pendingRequests.current.has('positions')) {
      return pendingRequests.current.get('positions');
    }
    
    const request = (async () => {
      try {
        const { data, error } = await supabase.functions.invoke('bybit-trading', {
          body: {
            action: 'get_positions',
            isTestnet: false,
            params: { category: 'linear', settleCoin: 'USDT' }
          }
        });

        if (!error && data?.success) {
          const positions = data.data.list || [];
          const openPositions = positions.filter((p: any) => parseFloat(p.size) > 0);
          setOpenPositionsCount(openPositions.length);
          
          // Atualizar cache
          syncCache.positions = { data: openPositions, timestamp: Date.now() };
          
          console.log(`📈 Posições Bybit: ${openPositions.length}`);
          return openPositions;
        }
        return [];
      } catch (error) {
        console.error('Erro ao sincronizar posições:', error);
        return [];
      } finally {
        pendingRequests.current.delete('positions');
      }
    })();
    
    pendingRequests.current.set('positions', request);
    return request;
  }, []);

  // 🔥 Buscar top 10 ativos voláteis (com cache mais longo)
  const fetchTop10VolatileAssets = useCallback(async () => {
    const now = Date.now();
    const VOLATILE_CACHE_TTL = 30000; // 30 segundos para ativos voláteis
    
    // Verificar cache
    if (now - syncCache.volatile.timestamp < VOLATILE_CACHE_TTL && syncCache.volatile.data.size > 0) {
      setTop10VolatileAssets(syncCache.volatile.data);
      return syncCache.volatile.data;
    }
    
    // Verificar se já há uma requisição pendente
    if (pendingRequests.current.has('volatile')) {
      return pendingRequests.current.get('volatile');
    }
    
    const request = (async () => {
      try {
        const { data, error } = await supabase.functions.invoke('bybit-trading', {
          body: {
            action: 'get_tickers',
            isTestnet: false,
            params: { category: 'linear' }
          }
        });

        if (!error && data?.success) {
          const tickers = data.data?.list || [];
          
          const volatilityScores = tickers
            .filter((t: any) => t.symbol.endsWith('USDT'))
            .map((ticker: any) => {
              const priceChange24h = Math.abs(parseFloat(ticker.price24hPcnt || '0')) * 100;
              const volume24h = parseFloat(ticker.turnover24h || '0');
              const volumeUSD = parseFloat(ticker.volume24h || '0');
              
              const volumeScore = Math.min(volume24h / 100000000, 1) * 30;
              const priceChangeScore = Math.min(priceChange24h / 10, 1) * 70;
              const volatilityScore = priceChangeScore + volumeScore;
              
              return {
                symbol: ticker.symbol,
                volatilityScore,
                priceChange24h,
                volume24h: volumeUSD,
                lastPrice: ticker.lastPrice
              };
            })
            .filter((item: any) => item.volume24h > 10000000)
            .sort((a: any, b: any) => b.volatilityScore - a.volatilityScore)
            .slice(0, 10);

          const top10Symbols = new Set<string>(volatilityScores.map((item: any) => item.symbol as string));
          setTop10VolatileAssets(top10Symbols);
          
          // Atualizar cache
          syncCache.volatile = { data: top10Symbols, timestamp: Date.now() };
          
          // Armazenar volatilidade para uso posterior
          const volatilityMap = new Map(
            volatilityScores.map((s: any) => [s.symbol, s.priceChange24h])
          );
          (window as any).assetVolatility = volatilityMap;
          
          console.log('✅ Top 10 ativos voláteis:', Array.from(top10Symbols).join(', '));
          return top10Symbols;
        }
        return top10VolatileAssets;
      } catch (error) {
        console.error('Erro ao buscar ativos voláteis:', error);
        return top10VolatileAssets;
      } finally {
        pendingRequests.current.delete('volatile');
      }
    })();
    
    pendingRequests.current.set('volatile', request);
    return request;
  }, [top10VolatileAssets]);

  return {
    currentBalance,
    setCurrentBalance,
    openPositionsCount,
    setOpenPositionsCount,
    lastSyncTime,
    top10VolatileAssets,
    syncBybitBalance,
    syncOpenPositions,
    fetchTop10VolatileAssets,
  };
};
