import { useState, useRef, useCallback } from 'react';
import { invokeBybit } from '@/lib/invokeBybit';

export interface AssetScore {
  symbol: string;
  volatility: number;
  volume24h: number;
  momentum: number;
  fundingRate: number;
  score: number;
  trend: 'bullish' | 'bearish' | 'neutral';
}

export interface BybitSyncState {
  currentBalance: number;
  availableBalance: number;
  openPositionsCount: number;
  lastSyncTime: Date | null;
  top10VolatileAssets: string[];
  scoredAssets: AssetScore[];
}

type SyncCache = {
  balance?: { data: number; available?: number; timestamp: number };
  positions?: { data: number; timestamp: number };
  volatileAssets?: { data: string[]; scoredAssets: AssetScore[]; timestamp: number };
};

const syncCache: Record<'real' | 'testnet', SyncCache> = {
  real: {},
  testnet: {},
};

const CACHE_TTL = 5000;
const VOLATILE_CACHE_TTL = 30000;

// Stablecoins e tokens problemáticos para excluir
const EXCLUDED_ASSETS = [
  'USDCUSDT', 'DAIUSDT', 'BUSDUSDT', 'TUSDUSDT', 'USDPUSDT', 'FDUSDUSDT',
  'EURUSDT', 'GBPUSDT', 'JPYUSDT', 'AUDUSDT', // Forex
  'USTCUSDT', 'LUNAUSDT', // Collapsed tokens
];

export function useBybitSync(isTestnet: boolean) {
  const [currentBalance, setCurrentBalance] = useState<number>(0);
  const [availableBalance, setAvailableBalance] = useState<number>(0);
  const [openPositionsCount, setOpenPositionsCount] = useState<number>(0);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [top10VolatileAssets, setTop10VolatileAssets] = useState<string[]>([]);
  const [scoredAssets, setScoredAssets] = useState<AssetScore[]>([]);

  const pendingRequests = useRef<Set<string>>(new Set());
  const modeKey: 'real' | 'testnet' = isTestnet ? 'testnet' : 'real';
  const cache = syncCache[modeKey];
  const reqKey = (name: 'balance' | 'positions' | 'volatile') => `${modeKey}:${name}`;

  const syncBybitBalance = useCallback(async (): Promise<number> => {
    if (cache.balance && Date.now() - cache.balance.timestamp < CACHE_TTL) {
      setCurrentBalance(cache.balance.data);
      setAvailableBalance(cache.balance.available ?? cache.balance.data);
      return cache.balance.available ?? cache.balance.data;
    }

    if (pendingRequests.current.has(reqKey('balance'))) {
      return availableBalance || currentBalance;
    }

    pendingRequests.current.add(reqKey('balance'));

    try {
      const data = await invokeBybit('get_balance', { accountType: 'UNIFIED' }, { isTestnet });

      if (!data.success) {
        if (data.transient) console.warn('⚠️ Balance: transient error, using cache');
        return availableBalance || currentBalance;
      }

      const balanceData = data.data;
      let balance = 0;
      let available = 0;

      // Extrair dados do balance - priorizar list[0] para conta UNIFIED
      const accountData = balanceData?.list?.[0] || balanceData;

      if (accountData?.totalWalletBalance) {
        balance = parseFloat(String(accountData.totalWalletBalance));
      } else if (balanceData?.totalEquity) {
        balance = parseFloat(String(balanceData.totalEquity));
      }

      // CRÍTICO: Usar availableBalance para saber quanto pode abrir novas posições
      if (accountData?.totalAvailableBalance) {
        available = parseFloat(String(accountData.totalAvailableBalance));
      } else {
        available = balance;
      }

      if (isNaN(balance)) balance = 0;
      if (isNaN(available)) available = 0;

      cache.balance = { data: balance, available, timestamp: Date.now() };
      setCurrentBalance(balance);
      setAvailableBalance(available);
      setLastSyncTime(new Date());

      console.log(`💰 [${modeKey.toUpperCase()}] Saldo: $${balance.toFixed(2)} | Disponível: $${available.toFixed(2)}`);
      return available;
    } catch (error) {
      console.error('❌ Erro sync saldo:', error);
      return availableBalance;
    } finally {
      pendingRequests.current.delete(reqKey('balance'));
    }
  }, [isTestnet, modeKey, cache, availableBalance, currentBalance]);

  const syncOpenPositions = useCallback(async (): Promise<number> => {
    if (cache.positions && Date.now() - cache.positions.timestamp < CACHE_TTL) {
      setOpenPositionsCount(cache.positions.data);
      return cache.positions.data;
    }

    if (pendingRequests.current.has(reqKey('positions'))) {
      return openPositionsCount;
    }

    pendingRequests.current.add(reqKey('positions'));

    try {
      const data = await invokeBybit('get_positions', { category: 'linear', settleCoin: 'USDT' }, { isTestnet });

      if (!data.success) {
        if (data.transient) console.warn('⚠️ Positions: transient error, using cache');
        return openPositionsCount;
      }

      const positions = Array.isArray(data.data) ? data.data : (data.data?.list || []);
      const activePositions = positions.filter((p: any) => parseFloat(p.size || '0') > 0);
      const count = activePositions.length;

      cache.positions = { data: count, timestamp: Date.now() };
      setOpenPositionsCount(count);
      setLastSyncTime(new Date());
      if (count > 0) console.log(`📈 [${modeKey.toUpperCase()}] Posições Bybit:`, count);
      return count;
    } catch (error) {
      console.error('Erro ao sincronizar posições:', error);
      return openPositionsCount;
    } finally {
      pendingRequests.current.delete(reqKey('positions'));
    }
  }, [isTestnet, modeKey, cache, openPositionsCount]);

  const fetchTop10VolatileAssets = useCallback(async (): Promise<string[]> => {
    if (cache.volatileAssets && Date.now() - cache.volatileAssets.timestamp < VOLATILE_CACHE_TTL) {
      setTop10VolatileAssets(cache.volatileAssets.data);
      setScoredAssets(cache.volatileAssets.scoredAssets);
      return cache.volatileAssets.data;
    }

    if (pendingRequests.current.has(reqKey('volatile'))) {
      return top10VolatileAssets;
    }

    pendingRequests.current.add(reqKey('volatile'));

    try {
      const data = await invokeBybit('get_tickers', { category: 'linear' }, { isTestnet });

      if (!data.success) {
        if (data.transient) console.warn('⚠️ Tickers: transient error, using cache');
        return top10VolatileAssets;
      }

      const tickers = Array.isArray(data.data) ? data.data : (data.data?.list || []);

      if (tickers.length === 0) {
        console.warn('Sem dados de tickers disponíveis');
        return top10VolatileAssets;
      }

      // Algoritmo de scoring avançado
      const scoredList: AssetScore[] = tickers
        .filter((t: any) => {
          const symbol = t.symbol || '';
          // Apenas USDT perpétuos, excluir stablecoins e tokens problemáticos
          return symbol.endsWith('USDT') &&
            !EXCLUDED_ASSETS.includes(symbol) &&
            !symbol.includes('1000000');
        })
        .map((t: any) => {
          const symbol = t.symbol;
          const volatility = Math.abs(parseFloat(t.price24hPcnt || '0')) * 100;
          const volume24h = parseFloat(t.turnover24h || '0');
          const fundingRate = parseFloat(t.fundingRate || '0') * 100;
          const priceChange = parseFloat(t.price24hPcnt || '0') * 100;
          const lastPrice = parseFloat(t.lastPrice || '0');
          const prevPrice1h = parseFloat(t.prevPrice1h || lastPrice);

          // Momentum 1h - movimento recente
          const momentum1h = lastPrice > 0 && prevPrice1h > 0
            ? ((lastPrice - prevPrice1h) / prevPrice1h) * 100
            : 0;

          // Determinar tendência
          let trend: 'bullish' | 'bearish' | 'neutral' = 'neutral';
          if (priceChange > 2 && momentum1h > 0.3) trend = 'bullish';
          else if (priceChange < -2 && momentum1h < -0.3) trend = 'bearish';

          const volScore = Math.min(volatility / 15, 1) * 40;
          const volumeScore = Math.min(Math.log10(volume24h + 1) / 8, 1) * 25;
          const momentumScore = Math.min(Math.abs(momentum1h) / 2, 1) * 20;
          const fundingScore = Math.abs(fundingRate) > 0.01 ? 15 : Math.abs(fundingRate) * 1500;

          const totalScore = volScore + volumeScore + momentumScore + fundingScore;

          return {
            symbol,
            volatility,
            volume24h,
            momentum: momentum1h,
            fundingRate,
            score: totalScore,
            trend,
          };
        })
        .filter((t: AssetScore) => {
          // Filtros mínimos de qualidade (um pouco mais flexível em TESTNET)
          const minVol = isTestnet ? 0.5 : 2;
          const minVolume = isTestnet ? 100000 : 500000;
          const minScore = isTestnet ? 10 : 20;
          return t.volatility > minVol && t.volume24h > minVolume && t.score > minScore;
        })
        .sort((a: AssetScore, b: AssetScore) => b.score - a.score)
        .slice(0, 20);

      const topSymbols = scoredList.slice(0, 10).map(t => t.symbol);

      if (topSymbols.length > 0) {
        cache.volatileAssets = {
          data: topSymbols,
          scoredAssets: scoredList,
          timestamp: Date.now(),
        };
        setTop10VolatileAssets(topSymbols);
        setScoredAssets(scoredList);

        console.log(`🎯 [${modeKey.toUpperCase()}] Top ativos por score:`);
        scoredList.slice(0, 5).forEach((a, i) => {
          console.log(`  ${i + 1}. ${a.symbol}: Score ${a.score.toFixed(1)} | Vol ${a.volatility.toFixed(1)}% | Vol24h $${(a.volume24h / 1000000).toFixed(1)}M | ${a.trend}`);
        });
      }

      return topSymbols;
    } catch (error) {
      console.error('Erro ao buscar ativos voláteis:', error);
      return top10VolatileAssets;
    } finally {
      pendingRequests.current.delete(reqKey('volatile'));
    }
  }, [isTestnet, modeKey, cache, top10VolatileAssets]);

  return {
    currentBalance,
    availableBalance,
    openPositionsCount,
    lastSyncTime,
    top10VolatileAssets,
    scoredAssets,
    syncBybitBalance,
    syncOpenPositions,
    fetchTop10VolatileAssets,
  };
}
