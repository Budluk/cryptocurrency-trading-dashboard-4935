import { createContext, useContext, useEffect, useState, ReactNode, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface Position {
  id: string;
  symbol: string;
  side: string;
  entry_price: number;
  qty: number;
  current_price: number | null;
  unrealized_pnl: number;
  realized_pnl: number | null;
  status: string;
  opened_at: string;
  closed_at: string | null;
  stop_loss: number | null;
  take_profit: number | null;
  confidence: number | null;
  trailing_stop_percentage: number | null;
  close_reason: string | null;
  exit_price: number | null;
  leverage: number | null;
  highest_price: number | null;
  volatility: number | null;
  partial_tp_executed: boolean | null;
  exchange_order_id: string | null;
}

interface PositionsContextType {
  openPositions: Position[];
  closedPositions: Position[];
  isLoading: boolean;
  refetch: () => Promise<void>;
}

const PositionsContext = createContext<PositionsContextType | undefined>(undefined);

export const PositionsProvider = ({ children }: { children: ReactNode }) => {
  const [openPositions, setOpenPositions] = useState<Position[]>([]);
  const [closedPositions, setClosedPositions] = useState<Position[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchPositions = useCallback(async () => {
    try {
      setIsLoading(true);
      
      // Buscar ambas queries em paralelo para melhor performance
      const [openResult, closedResult] = await Promise.all([
        supabase
          .from('auto_trader_positions')
          .select('id, symbol, side, entry_price, qty, current_price, unrealized_pnl, realized_pnl, status, opened_at, closed_at, stop_loss, take_profit, confidence, trailing_stop_percentage, close_reason, exit_price, leverage, highest_price, volatility, partial_tp_executed, exchange_order_id')
          .eq('status', 'OPEN')
          .order('opened_at', { ascending: false }),
        supabase
          .from('auto_trader_positions')
          .select('id, symbol, side, entry_price, qty, current_price, unrealized_pnl, realized_pnl, status, opened_at, closed_at, stop_loss, take_profit, confidence, trailing_stop_percentage, close_reason, exit_price, leverage, highest_price, volatility, partial_tp_executed, exchange_order_id')
          .eq('status', 'CLOSED')
          .order('closed_at', { ascending: false })
          .limit(50) // Reduzido de 100 para 50
      ]);

      if (openResult.error) throw openResult.error;
      if (closedResult.error) throw closedResult.error;

      setOpenPositions(openResult.data || []);
      setClosedPositions(closedResult.data || []);
    } catch (error) {
      console.error('Error fetching positions:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    // Buscar posições apenas na montagem inicial (sem polling automático)
    fetchPositions();
  }, [fetchPositions]);

  const value = useMemo(() => ({
    openPositions,
    closedPositions,
    isLoading,
    refetch: fetchPositions
  }), [openPositions, closedPositions, isLoading, fetchPositions]);

  return (
    <PositionsContext.Provider value={value}>
      {children}
    </PositionsContext.Provider>
  );
};

export const usePositions = () => {
  const context = useContext(PositionsContext);
  if (context === undefined) {
    throw new Error('usePositions must be used within PositionsProvider');
  }
  return context;
};
