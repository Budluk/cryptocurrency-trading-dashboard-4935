import { useState, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface BybitSyncState {
  currentBalance: number;
  openPositionsCount: number;
  lastSyncTime: Date | null;
  top10VolatileAssets: string[];
}

const syncCache: {
  balance?: { data: number; timestamp: number };
  positions?: { data: number; timestamp: number };
  volatileAssets?: { data: string[]; timestamp: number };
} = {};

const CACHE_TTL = 5000;
const VOLATILE_CACHE_TTL = 30000;

export function useBybitSync() {
  const [currentBalance, setCurrentBalance] = useState<number>(0);
  const [openPositionsCount, setOpenPositionsCount] = useState<number>(0);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [top10VolatileAssets, setTop10VolatileAssets] = useState<string[]>([]);
  
  const pendingRequests = useRef<Set<string>>(new Set());

  const syncBybitBalance = useCallback(async (): Promise<number> => {
    if (syncCache.balance && Date.now() - syncCache.balance.timestamp < CACHE_TTL) {
      setCurrentBalance(syncCache.balance.data);
      return syncCache.balance.data;
    }

    if (pendingRequests.current.has('balance')) {
      return currentBalance;
    }

    pendingRequests.current.add('balance');

    try {
      const { data, error } = await supabase.functions.invoke('bybit-trading', {
        body: { action: 'get_balance', isTestnet: false, params: { accountType: 'UNIFIED' } }
      });

      if (error) throw error;

      // Handle both formats: data.list[0] or data directly
      const responseData = data?.data;
      const balanceData = responseData?.list?.[0] || responseData || {};
      const balance = balanceData?.totalWalletBalance 
        ? parseFloat(balanceData.totalWalletBalance) 
        : 0;

      syncCache.balance = { data: balance, timestamp: Date.now() };
      setCurrentBalance(balance);
      setLastSyncTime(new Date());
      return balance;
    } catch (error) {
      console.error('Erro ao sincronizar saldo:', error);
      return currentBalance;
    } finally {
      pendingRequests.current.delete('balance');
    }
  }, [currentBalance]);

  const syncOpenPositions = useCallback(async (): Promise<number> => {
    if (syncCache.positions && Date.now() - syncCache.positions.timestamp < CACHE_TTL) {
      setOpenPositionsCount(syncCache.positions.data);
      return syncCache.positions.data;
    }

    if (pendingRequests.current.has('positions')) {
      return openPositionsCount;
    }

    pendingRequests.current.add('positions');

    try {
      const { data, error } = await supabase.functions.invoke('bybit-trading', {
        body: { action: 'get_positions', isTestnet: false, params: { category: 'linear', settleCoin: 'USDT' } }
      });

      if (error) throw error;

      const positions = data?.data?.list || data?.data || [];
      const activePositions = Array.isArray(positions) 
        ? positions.filter((p: any) => parseFloat(p.size || '0') > 0)
        : [];
      const count = activePositions.length;

      syncCache.positions = { data: count, timestamp: Date.now() };
      setOpenPositionsCount(count);
      setLastSyncTime(new Date());
      return count;
    } catch (error) {
      console.error('Erro ao sincronizar posições:', error);
      return openPositionsCount;
    } finally {
      pendingRequests.current.delete('positions');
    }
  }, [openPositionsCount]);

  const fetchTop10VolatileAssets = useCallback(async (): Promise<string[]> => {
    if (syncCache.volatileAssets && Date.now() - syncCache.volatileAssets.timestamp < VOLATILE_CACHE_TTL) {
      setTop10VolatileAssets(syncCache.volatileAssets.data);
      return syncCache.volatileAssets.data;
    }

    if (pendingRequests.current.has('volatile')) {
      return top10VolatileAssets;
    }

    pendingRequests.current.add('volatile');

    try {
      const { data, error } = await supabase.functions.invoke('bybit-trading', {
        body: { action: 'get_tickers', isTestnet: false, params: { category: 'linear' } }
      });

      if (error) throw error;

      const tickers = data?.data?.list || data?.data || [];
      
      const scored = tickers
        .filter((t: any) => t.symbol?.endsWith('USDT'))
        .map((t: any) => ({
          symbol: t.symbol,
          volatility: Math.abs(parseFloat(t.price24hPcnt || '0')) * 100,
          volume24h: parseFloat(t.turnover24h || '0')
        }))
        .filter((t: any) => t.volatility > 1.5 && t.volume24h > 100000)
        .sort((a: any, b: any) => b.volatility - a.volatility)
        .slice(0, 10)
        .map((t: any) => t.symbol);

      syncCache.volatileAssets = { data: scored, timestamp: Date.now() };
      setTop10VolatileAssets(scored);
      return scored;
    } catch (error) {
      console.error('Erro ao buscar ativos voláteis:', error);
      return top10VolatileAssets;
    } finally {
      pendingRequests.current.delete('volatile');
    }
  }, [top10VolatileAssets]);

  return {
    currentBalance,
    openPositionsCount,
    lastSyncTime,
    top10VolatileAssets,
    syncBybitBalance,
    syncOpenPositions,
    fetchTop10VolatileAssets
  };
}
