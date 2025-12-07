import { useState, useCallback } from 'react';
import { supabase } from "@/integrations/supabase/client";

export interface BybitSyncState {
  currentBalance: number;
  openPositionsCount: number;
  lastSyncTime: Date | null;
  top10VolatileAssets: Set<string>;
}

export const useBybitSync = () => {
  const [currentBalance, setCurrentBalance] = useState(0);
  const [openPositionsCount, setOpenPositionsCount] = useState(0);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [top10VolatileAssets, setTop10VolatileAssets] = useState<Set<string>>(new Set([
    'BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'DOGEUSDT',
    'SHIBUSDT', 'PEPEUSDT', 'AVAXUSDT', 'NEARUSDT', 'APTUSDT'
  ]));

  // 🔄 Sincronizar saldo da Bybit
  const syncBybitBalance = useCallback(async () => {
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
        console.log(`💰 Saldo sincronizado: $${availableBalance.toFixed(2)}`);
        return availableBalance;
      }
      return 0;
    } catch (error) {
      console.error('Erro ao sincronizar saldo:', error);
      return 0;
    }
  }, []);

  // 📊 Sincronizar posições abertas
  const syncOpenPositions = useCallback(async () => {
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
        console.log(`📈 Posições Bybit: ${openPositions.length}`);
        return openPositions;
      }
      return [];
    } catch (error) {
      console.error('Erro ao sincronizar posições:', error);
      return [];
    }
  }, []);

  // 🔥 Buscar top 10 ativos voláteis
  const fetchTop10VolatileAssets = useCallback(async () => {
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
    }
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
