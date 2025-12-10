import { useState, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

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
  openPositionsCount: number;
  lastSyncTime: Date | null;
  top10VolatileAssets: string[];
  scoredAssets: AssetScore[];
}

const syncCache: {
  balance?: { data: number; timestamp: number };
  positions?: { data: number; timestamp: number };
  volatileAssets?: { data: string[]; scoredAssets: AssetScore[]; timestamp: number };
} = {};

const CACHE_TTL = 5000;
const VOLATILE_CACHE_TTL = 30000;

// Stablecoins e tokens problemáticos para excluir
const EXCLUDED_ASSETS = [
  'USDCUSDT', 'DAIUSDT', 'BUSDUSDT', 'TUSDUSDT', 'USDPUSDT', 'FDUSDUSDT',
  'EURUSDT', 'GBPUSDT', 'JPYUSDT', 'AUDUSDT', // Forex
  'USTCUSDT', 'LUNAUSDT', // Collapsed tokens
];

export function useBybitSync() {
  const [currentBalance, setCurrentBalance] = useState<number>(0);
  const [openPositionsCount, setOpenPositionsCount] = useState<number>(0);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [top10VolatileAssets, setTop10VolatileAssets] = useState<string[]>([]);
  const [scoredAssets, setScoredAssets] = useState<AssetScore[]>([]);
  
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

      if (error) {
        console.error('❌ Erro API balance:', error);
        throw error;
      }
      
      if (!data?.success) {
        console.warn('⚠️ Bybit API error:', data?.error || data?.message);
        return currentBalance;
      }

      const balanceData = data?.data;
      let balance = 0;
      
      if (typeof balanceData?.totalWalletBalance === 'string' || typeof balanceData?.totalWalletBalance === 'number') {
        balance = parseFloat(String(balanceData.totalWalletBalance));
      } else if (balanceData?.list?.[0]?.totalWalletBalance) {
        balance = parseFloat(balanceData.list[0].totalWalletBalance);
      } else if (balanceData?.totalEquity) {
        balance = parseFloat(String(balanceData.totalEquity));
      }

      if (isNaN(balance)) balance = 0;

      syncCache.balance = { data: balance, timestamp: Date.now() };
      setCurrentBalance(balance);
      setLastSyncTime(new Date());
      console.log(`💰 Saldo: $${balance.toFixed(2)}`);
      return balance;
    } catch (error) {
      console.error('❌ Erro sync saldo:', error);
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
      
      if (data?.code || data?.error || data?.success === false) {
        console.warn('Bybit API error (positions):', data?.message || data?.error);
        return openPositionsCount;
      }

      const positions = Array.isArray(data?.data) ? data.data : (data?.data?.list || []);
      const activePositions = positions.filter((p: any) => parseFloat(p.size || '0') > 0);
      const count = activePositions.length;

      syncCache.positions = { data: count, timestamp: Date.now() };
      setOpenPositionsCount(count);
      setLastSyncTime(new Date());
      if (count > 0) console.log('📈 Posições Bybit:', count);
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
      setScoredAssets(syncCache.volatileAssets.scoredAssets);
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
      
      if (data?.code || data?.error || data?.success === false) {
        console.warn('Bybit API error (tickers):', data?.message || data?.error);
        return top10VolatileAssets;
      }

      const tickers = Array.isArray(data?.data) ? data.data : (data?.data?.list || []);
      
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
                 !symbol.includes('1000000'); // Tokens com muitos zeros geralmente são memecoins de baixa liquidez
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
          
          // Score composto:
          // - Volatilidade alta = bom para scalping (peso 40%)
          // - Volume alto = liquidez (peso 25%)
          // - Momentum forte = tendência clara (peso 20%)
          // - Funding rate extremo = possível reversão (peso 15%)
          
          const volScore = Math.min(volatility / 15, 1) * 40; // Max 40 pts
          const volumeScore = Math.min(Math.log10(volume24h + 1) / 8, 1) * 25; // Max 25 pts
          const momentumScore = Math.min(Math.abs(momentum1h) / 2, 1) * 20; // Max 20 pts
          const fundingScore = Math.abs(fundingRate) > 0.01 ? 15 : Math.abs(fundingRate) * 1500; // Max 15 pts
          
          const totalScore = volScore + volumeScore + momentumScore + fundingScore;
          
          return {
            symbol,
            volatility,
            volume24h,
            momentum: momentum1h,
            fundingRate,
            score: totalScore,
            trend
          };
        })
        .filter((t: AssetScore) => {
          // Filtros mínimos de qualidade
          return t.volatility > 2 && // Min 2% volatilidade 24h
                 t.volume24h > 500000 && // Min $500k volume
                 t.score > 20; // Score mínimo
        })
        .sort((a: AssetScore, b: AssetScore) => b.score - a.score)
        .slice(0, 20); // Top 20 para análise
      
      const topSymbols = scoredList.slice(0, 10).map(t => t.symbol);

      if (topSymbols.length > 0) {
        syncCache.volatileAssets = { 
          data: topSymbols, 
          scoredAssets: scoredList,
          timestamp: Date.now() 
        };
        setTop10VolatileAssets(topSymbols);
        setScoredAssets(scoredList);
        
        console.log('🎯 Top ativos por score:');
        scoredList.slice(0, 5).forEach((a, i) => {
          console.log(`  ${i+1}. ${a.symbol}: Score ${a.score.toFixed(1)} | Vol ${a.volatility.toFixed(1)}% | Vol24h $${(a.volume24h/1000000).toFixed(1)}M | ${a.trend}`);
        });
      }
      
      return topSymbols;
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
    scoredAssets,
    syncBybitBalance,
    syncOpenPositions,
    fetchTop10VolatileAssets
  };
}
