import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
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

  const fetchPositions = async () => {
    try {
      // Buscar posições abertas
      const { data: open, error: openError } = await supabase
        .from('auto_trader_positions')
        .select('*')
        .eq('status', 'OPEN')
        .order('opened_at', { ascending: false });

      if (openError) throw openError;

      // Buscar últimas 20 posições fechadas
      const { data: closed, error: closedError } = await supabase
        .from('auto_trader_positions')
        .select('*')
        .eq('status', 'CLOSED')
        .order('closed_at', { ascending: false })
        .limit(20);

      if (closedError) throw closedError;

      setOpenPositions(open || []);
      setClosedPositions(closed || []);
    } catch (error) {
      console.error('Error fetching positions:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPositions();

    // Realtime subscription
    const channel = supabase
      .channel('positions-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'auto_trader_positions'
        },
        () => {
          fetchPositions();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return (
    <PositionsContext.Provider
      value={{
        openPositions,
        closedPositions,
        isLoading,
        refetch: fetchPositions
      }}
    >
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
