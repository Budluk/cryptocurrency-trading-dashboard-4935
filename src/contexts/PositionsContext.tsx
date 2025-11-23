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

  const fetchPositions = async () => {
    try {
      // Buscar posições abertas
      const { data: open, error: openError } = await supabase
        .from('auto_trader_positions')
        .select('*')
        .eq('status', 'OPEN')
        .order('opened_at', { ascending: false });

      if (openError) throw openError;

      // Buscar últimas 100 posições fechadas (aumentado para analytics)
      const { data: closed, error: closedError } = await supabase
        .from('auto_trader_positions')
        .select('*')
        .eq('status', 'CLOSED')
        .order('closed_at', { ascending: false })
        .limit(100);

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

    // 🔴 REALTIME DESABILITADO para evitar re-renders constantes
    // As posições serão atualizadas apenas via refetch manual
    
    // Atualização periódica a cada 30 segundos (menos agressivo)
    const intervalId = setInterval(() => {
      fetchPositions();
    }, 30000);

    return () => {
      clearInterval(intervalId);
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
