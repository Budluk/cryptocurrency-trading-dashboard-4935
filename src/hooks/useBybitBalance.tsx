import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface BybitBalanceState {
  balance: number | null;
  isLoading: boolean;
  isConnected: boolean;
  lastUpdated: Date | null;
}

const STORAGE_KEY = 'bybit_real_mode_active';
const BALANCE_KEY = 'bybit_balance';
const UPDATE_INTERVAL = 30000; // 30 segundos - intervalo conservador

export const useBybitBalance = () => {
  const [state, setState] = useState<BybitBalanceState>(() => ({
    balance: localStorage.getItem(BALANCE_KEY) ? parseFloat(localStorage.getItem(BALANCE_KEY)!) : null,
    isLoading: false,
    isConnected: localStorage.getItem(STORAGE_KEY) === 'true',
    lastUpdated: null,
  }));
  
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const isMountedRef = useRef(true);

  const fetchBalance = useCallback(async (silent = false) => {
    if (!isMountedRef.current) return null;
    
    if (!silent) {
      setState(prev => ({ ...prev, isLoading: true }));
    }

    try {
      const { data, error } = await supabase.functions.invoke('bybit-trading', {
        body: {
          action: 'get_balance',
          isTestnet: false,
          params: { accountType: 'UNIFIED' }
        }
      });

      if (!isMountedRef.current) return null;

      if (error) throw error;

      if (data?.success) {
        const walletBalance = data.data?.list?.[0]?.totalEquity || 0;
        const balanceNum = parseFloat(walletBalance);
        
        localStorage.setItem(BALANCE_KEY, balanceNum.toString());
        localStorage.setItem(STORAGE_KEY, 'true');
        
        setState({
          balance: balanceNum,
          isLoading: false,
          isConnected: true,
          lastUpdated: new Date(),
        });
        
        return balanceNum;
      } else {
        throw new Error(data?.error || 'Erro ao buscar saldo');
      }
    } catch (error) {
      console.error('❌ Erro ao buscar saldo Bybit:', error);
      if (isMountedRef.current) {
        setState(prev => ({ 
          ...prev, 
          isLoading: false,
          isConnected: false,
        }));
        localStorage.removeItem(STORAGE_KEY);
      }
      return null;
    }
  }, []);

  const testConnection = useCallback(async () => {
    setState(prev => ({ ...prev, isLoading: true }));
    const result = await fetchBalance(false);
    return result !== null;
  }, [fetchBalance]);

  // Atualização automática com intervalo conservador
  useEffect(() => {
    isMountedRef.current = true;
    
    // Buscar saldo inicial se conectado
    if (state.isConnected && !state.balance) {
      fetchBalance(true);
    }

    // Configurar intervalo de atualização
    if (state.isConnected) {
      intervalRef.current = setInterval(() => {
        if (isMountedRef.current) {
          fetchBalance(true); // Silent update
        }
      }, UPDATE_INTERVAL);
    }

    return () => {
      isMountedRef.current = false;
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [state.isConnected, fetchBalance]);

  return {
    ...state,
    fetchBalance: () => fetchBalance(false),
    testConnection,
  };
};
