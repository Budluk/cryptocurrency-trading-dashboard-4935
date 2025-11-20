import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TrendingUp, TrendingDown, Minimize2, Maximize2, Activity, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Position {
  id: string;
  symbol: string;
  side: string; // BUY ou SELL
  entry_price: number;
  qty: number;
  current_price: number | null;
  unrealized_pnl: number;
  opened_at: string;
  stop_loss: number | null;
  take_profit: number | null;
}

export const FloatingPositionsWidget = () => {
  const [isMinimized, setIsMinimized] = useState(false);
  const [isVisible, setIsVisible] = useState(true);
  const { toast } = useToast();

  const { data: positions, refetch } = useQuery({
    queryKey: ['floating-positions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('auto_trader_positions')
        .select('*')
        .eq('status', 'OPEN')
        .order('opened_at', { ascending: false })
        .limit(5);

      if (error) throw error;
      return data as Position[];
    },
    refetchInterval: false, // DESABILITADO
  });

  // Realtime updates
  useEffect(() => {
    const channel = supabase
      .channel('floating-positions')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'auto_trader_positions',
          filter: 'status=eq.OPEN'
        },
        () => {
          refetch();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [refetch]);

  const closePosition = async (positionId: string, symbol: string) => {
    try {
      const position = positions?.find(p => p.id === positionId);
      if (!position) return;

      const { error } = await supabase
        .from('auto_trader_positions')
        .update({
          status: 'CLOSED',
          closed_at: new Date().toISOString(),
          close_reason: 'Fechamento Manual (Widget)',
          realized_pnl: position.unrealized_pnl,
          exit_price: position.current_price
        })
        .eq('id', positionId);

      if (error) throw error;

      toast({
        title: "✅ Posição Fechada",
        description: `${symbol} - P&L: ${position.unrealized_pnl >= 0 ? '+' : ''}$${position.unrealized_pnl.toFixed(2)}`,
      });

      refetch();
    } catch (error: any) {
      toast({
        title: "❌ Erro ao fechar",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  if (!isVisible || !positions || positions.length === 0) {
    return null;
  }

  const totalPnL = positions.reduce((sum, p) => sum + (p.unrealized_pnl || 0), 0);
  const pnlColor = totalPnL >= 0 ? "text-green-500" : "text-red-500";

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-sm">
      <Card className="backdrop-blur-xl bg-background/95 border-2 shadow-2xl">
        <div className="flex items-center justify-between p-3 border-b border-border">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary animate-pulse" />
            <span className="text-sm font-semibold">Operações Ativas</span>
            <Badge variant="secondary" className="text-xs">
              {positions.length}
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-xs font-bold ${pnlColor}`}>
              {totalPnL >= 0 ? '+' : ''}{totalPnL.toFixed(2)} USDT
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              onClick={() => setIsMinimized(!isMinimized)}
            >
              {isMinimized ? (
                <Maximize2 className="h-3 w-3" />
              ) : (
                <Minimize2 className="h-3 w-3" />
              )}
            </Button>
          </div>
        </div>

        {!isMinimized && (
          <div className="p-3 space-y-2 max-h-[400px] overflow-y-auto">
            {positions.map((position) => {
              const pnl = position.unrealized_pnl || 0;
              const pnlPercent = position.entry_price 
                ? ((pnl / (position.entry_price * position.qty)) * 100)
                : 0;
              const isProfit = pnl >= 0;

              return (
                <div
                  key={position.id}
                  className={`p-2 rounded-lg border ${
                    isProfit 
                      ? 'bg-green-500/10 border-green-500/30' 
                      : 'bg-red-500/10 border-red-500/30'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold">{position.symbol}</span>
                      <Badge 
                        variant={position.side === 'Buy' ? 'default' : 'destructive'}
                        className="text-xs px-1 py-0"
                      >
                        {position.side}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-1">
                      {isProfit ? (
                        <TrendingUp className="h-3 w-3 text-green-500" />
                      ) : (
                        <TrendingDown className="h-3 w-3 text-red-500" />
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-5 w-5 p-0 hover:bg-destructive/20"
                        onClick={() => closePosition(position.id, position.symbol)}
                      >
                        <X className="h-3 w-3 text-destructive" />
                      </Button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-muted-foreground">Entrada:</span>
                      <span className="ml-1 font-medium">${position.entry_price.toFixed(4)}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Atual:</span>
                      <span className="ml-1 font-medium">
                        ${position.current_price?.toFixed(4) || '---'}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">P&L:</span>
                      <span className={`ml-1 font-bold ${isProfit ? 'text-green-500' : 'text-red-500'}`}>
                        {pnl >= 0 ? '+' : ''}{pnl.toFixed(2)}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">%:</span>
                      <span className={`ml-1 font-bold ${isProfit ? 'text-green-500' : 'text-red-500'}`}>
                        {pnlPercent >= 0 ? '+' : ''}{pnlPercent.toFixed(2)}%
                      </span>
                    </div>
                  </div>

                  {(position.stop_loss || position.take_profit) && (
                    <div className="mt-1 pt-1 border-t border-border/50 text-xs">
                      {position.stop_loss && (
                        <span className="text-red-400 mr-2">
                          SL: ${position.stop_loss.toFixed(4)}
                        </span>
                      )}
                      {position.take_profit && (
                        <span className="text-green-400">
                          TP: ${position.take_profit.toFixed(4)}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
};
