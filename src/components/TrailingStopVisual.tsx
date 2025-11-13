import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { TrendingUp, TrendingDown, Target, Activity } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface Position {
  id: string;
  symbol: string;
  side: string;
  entry_price: number;
  current_price: number;
  highest_price: number;
  qty: number;
  unrealized_pnl: number;
  trailing_stop_percentage: number;
  volatility: number;
}

export const TrailingStopVisual = () => {
  const [positions, setPositions] = useState<Position[]>([]);

  useEffect(() => {
    const fetchPositions = async () => {
      const { data } = await supabase
        .from('auto_trader_positions')
        .select('*')
        .eq('status', 'OPEN')
        .order('opened_at', { ascending: false });

      if (data) {
        setPositions(data as Position[]);
      }
    };

    fetchPositions();
    const interval = setInterval(fetchPositions, 3000);
    return () => clearInterval(interval);
  }, []);

  const calculateTrailingStop = (pos: Position) => {
    if (!pos.trailing_stop_percentage) return null;
    
    if (pos.side === 'BUY') {
      return pos.highest_price * (1 - pos.trailing_stop_percentage / 100);
    } else {
      return pos.highest_price * (1 + pos.trailing_stop_percentage / 100);
    }
  };

  const calculateProgress = (pos: Position) => {
    const trailingStop = calculateTrailingStop(pos);
    if (!trailingStop) return 0;

    if (pos.side === 'BUY') {
      const range = pos.highest_price - trailingStop;
      const current = pos.current_price - trailingStop;
      return (current / range) * 100;
    } else {
      const range = trailingStop - pos.highest_price;
      const current = trailingStop - pos.current_price;
      return (current / range) * 100;
    }
  };

  if (positions.length === 0) {
    return (
      <Card className="p-6 bg-card/50 backdrop-blur">
        <div className="flex items-center gap-2 mb-4">
          <Activity className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold">Trailing Stops Ativos</h3>
        </div>
        <p className="text-sm text-muted-foreground">Nenhuma posição aberta no momento</p>
      </Card>
    );
  }

  return (
    <Card className="p-6 bg-card/50 backdrop-blur">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Activity className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold">Trailing Stops Ativos</h3>
        </div>
        <Badge variant="outline" className="text-sm">
          {positions.length} {positions.length === 1 ? 'Posição' : 'Posições'}
        </Badge>
      </div>

      <div className="space-y-4">
        {positions.map((pos) => {
          const pnlPercent = pos.side === 'BUY'
            ? ((pos.current_price - pos.entry_price) / pos.entry_price) * 100
            : ((pos.entry_price - pos.current_price) / pos.entry_price) * 100;

          const trailingStop = calculateTrailingStop(pos);
          const progress = calculateProgress(pos);
          const isProfit = pnlPercent > 0;

          return (
            <div key={pos.id} className="p-4 bg-background/50 rounded-lg border border-border/50">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  {pos.side === 'BUY' ? (
                    <TrendingUp className="h-4 w-4 text-emerald-500" />
                  ) : (
                    <TrendingDown className="h-4 w-4 text-rose-500" />
                  )}
                  <span className="font-semibold">{pos.symbol}</span>
                  <Badge variant={pos.side === 'BUY' ? 'default' : 'destructive'} className="text-xs">
                    {pos.side}
                  </Badge>
                </div>

                <div className="text-right">
                  <div className={`text-sm font-semibold ${isProfit ? 'text-emerald-500' : 'text-rose-500'}`}>
                    {isProfit ? '+' : ''}{pnlPercent.toFixed(2)}%
                  </div>
                  <div className="text-xs text-muted-foreground">
                    ${pos.unrealized_pnl.toFixed(2)}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 mb-3 text-sm">
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Entrada</div>
                  <div className="font-mono text-xs">${pos.entry_price.toFixed(2)}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Atual</div>
                  <div className="font-mono text-xs font-semibold">${pos.current_price.toFixed(2)}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground mb-1">
                    {pos.side === 'BUY' ? 'Máximo' : 'Mínimo'}
                  </div>
                  <div className="font-mono text-xs text-primary">${pos.highest_price.toFixed(2)}</div>
                </div>
              </div>

              {trailingStop && (
                <>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2 text-xs">
                      <Target className="h-3 w-3 text-amber-500" />
                      <span className="text-muted-foreground">Trailing Stop</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">
                        {pos.trailing_stop_percentage}%
                      </Badge>
                      {pos.volatility > 0 && (
                        <Badge variant="secondary" className="text-xs">
                          Vol: {pos.volatility.toFixed(1)}%
                        </Badge>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Progress value={Math.min(progress, 100)} className="h-2" />
                    <div className="flex justify-between text-xs">
                      <span className="text-amber-500 font-mono">
                        Stop: ${trailingStop.toFixed(2)}
                      </span>
                      <span className="text-muted-foreground">
                        Distância: {Math.abs(((pos.current_price - trailingStop) / trailingStop) * 100).toFixed(2)}%
                      </span>
                    </div>
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
};
