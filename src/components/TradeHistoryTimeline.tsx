import { memo, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { usePositions } from "@/contexts/PositionsContext";
import { 
  Clock, 
  TrendingUp, 
  TrendingDown, 
  ChevronDown,
  ChevronUp,
  Filter,
  Calendar
} from "lucide-react";

export const TradeHistoryTimeline = memo(() => {
  const { closedPositions } = usePositions();
  const [filter, setFilter] = useState<'all' | 'wins' | 'losses'>('all');
  const [period, setPeriod] = useState<'today' | '7d' | '30d'>('today');
  const [expanded, setExpanded] = useState<string | null>(null);

  const filteredTrades = useMemo(() => {
    const now = new Date();
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);

    const periodStart = new Date(now);
    switch (period) {
      case 'today':
        periodStart.setHours(0, 0, 0, 0);
        break;
      case '7d':
        periodStart.setDate(periodStart.getDate() - 7);
        break;
      case '30d':
        periodStart.setDate(periodStart.getDate() - 30);
        break;
    }

    return closedPositions
      .filter(p => {
        if (!p.closed_at) return false;
        const closedDate = new Date(p.closed_at);
        if (closedDate < periodStart) return false;

        const pnl = p.realized_pnl || 0;
        if (filter === 'wins' && pnl <= 0) return false;
        if (filter === 'losses' && pnl >= 0) return false;

        return true;
      })
      .sort((a, b) => new Date(b.closed_at!).getTime() - new Date(a.closed_at!).getTime());
  }, [closedPositions, filter, period]);

  const stats = useMemo(() => {
    const totalPnL = filteredTrades.reduce((sum, p) => sum + (p.realized_pnl || 0), 0);
    const wins = filteredTrades.filter(p => (p.realized_pnl || 0) > 0).length;
    const losses = filteredTrades.filter(p => (p.realized_pnl || 0) < 0).length;
    return { totalPnL, wins, losses, total: filteredTrades.length };
  }, [filteredTrades]);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const tradeDate = new Date(date);
    tradeDate.setHours(0, 0, 0, 0);

    if (tradeDate.getTime() === today.getTime()) {
      return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  };

  const formatDuration = (opened: string, closed: string) => {
    const ms = new Date(closed).getTime() - new Date(opened).getTime();
    const mins = Math.floor(ms / 60000);
    const hours = Math.floor(mins / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ${hours % 24}h`;
    if (hours > 0) return `${hours}h ${mins % 60}m`;
    return `${mins}m`;
  };

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary" />
            Histórico de Trades
          </CardTitle>
          
          <div className="flex items-center gap-2">
            <Select value={period} onValueChange={(v: any) => setPeriod(v)}>
              <SelectTrigger className="w-24 h-8 text-xs">
                <Calendar className="h-3 w-3 mr-1" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="today">Hoje</SelectItem>
                <SelectItem value="7d">7 dias</SelectItem>
                <SelectItem value="30d">30 dias</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filter} onValueChange={(v: any) => setFilter(v)}>
              <SelectTrigger className="w-24 h-8 text-xs">
                <Filter className="h-3 w-3 mr-1" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="wins">Ganhos</SelectItem>
                <SelectItem value="losses">Perdas</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="flex items-center gap-4 mt-3 text-sm">
          <div className="flex items-center gap-1">
            <span className="text-muted-foreground">Total:</span>
            <span className={`font-bold ${stats.totalPnL >= 0 ? 'text-success' : 'text-destructive'}`}>
              {stats.totalPnL >= 0 ? '+' : ''}${stats.totalPnL.toFixed(2)}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="bg-success/10 text-success border-success/30 text-xs">
              {stats.wins}W
            </Badge>
            <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/30 text-xs">
              {stats.losses}L
            </Badge>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {filteredTrades.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>Nenhum trade encontrado</p>
          </div>
        ) : (
          <ScrollArea className="h-[400px] pr-3">
            <div className="space-y-2">
              {filteredTrades.map((trade) => {
                const pnl = trade.realized_pnl || 0;
                const isWin = pnl > 0;
                const isExpanded = expanded === trade.id;
                const pnlPercent = trade.entry_price > 0 
                  ? ((trade.current_price || trade.entry_price) / trade.entry_price - 1) * 100 * (trade.leverage || 1)
                  : 0;

                return (
                  <div 
                    key={trade.id}
                    className={`p-3 rounded-lg border transition-all cursor-pointer hover:bg-muted/30 ${
                      isWin ? 'border-success/20 bg-success/5' : 'border-destructive/20 bg-destructive/5'
                    }`}
                    onClick={() => setExpanded(isExpanded ? null : trade.id)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`p-1.5 rounded-full ${isWin ? 'bg-success/20' : 'bg-destructive/20'}`}>
                          {isWin ? (
                            <TrendingUp className="h-4 w-4 text-success" />
                          ) : (
                            <TrendingDown className="h-4 w-4 text-destructive" />
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold">{trade.symbol}</span>
                            <Badge variant="outline" className={`text-[10px] ${
                              trade.side === 'Buy' ? 'text-success border-success/30' : 'text-destructive border-destructive/30'
                            }`}>
                              {trade.side === 'Buy' ? 'LONG' : 'SHORT'}
                            </Badge>
                            {trade.leverage && (
                              <Badge variant="secondary" className="text-[10px]">
                                {trade.leverage}x
                              </Badge>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {formatDate(trade.closed_at!)}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <div className={`font-bold ${isWin ? 'text-success' : 'text-destructive'}`}>
                            {pnl >= 0 ? '+' : ''}${pnl.toFixed(2)}
                          </div>
                          <div className={`text-xs ${isWin ? 'text-success/70' : 'text-destructive/70'}`}>
                            {pnlPercent >= 0 ? '+' : ''}{pnlPercent.toFixed(2)}%
                          </div>
                        </div>
                        {isExpanded ? (
                          <ChevronUp className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        )}
                      </div>
                    </div>

                    {/* Expanded Details */}
                    {isExpanded && (
                      <div className="mt-3 pt-3 border-t border-border/50 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                        <div>
                          <div className="text-muted-foreground">Entrada</div>
                          <div className="font-semibold">${trade.entry_price.toFixed(4)}</div>
                        </div>
                        <div>
                          <div className="text-muted-foreground">Saída</div>
                          <div className="font-semibold">${(trade.current_price || 0).toFixed(4)}</div>
                        </div>
                        <div>
                          <div className="text-muted-foreground">Quantidade</div>
                          <div className="font-semibold">{trade.qty}</div>
                        </div>
                        <div>
                          <div className="text-muted-foreground">Duração</div>
                          <div className="font-semibold">{formatDuration(trade.opened_at, trade.closed_at!)}</div>
                        </div>
                        {trade.stop_loss && (
                          <div>
                            <div className="text-muted-foreground">Stop Loss</div>
                            <div className="font-semibold text-destructive">${trade.stop_loss.toFixed(4)}</div>
                          </div>
                        )}
                        {trade.take_profit && (
                          <div>
                            <div className="text-muted-foreground">Take Profit</div>
                            <div className="font-semibold text-success">${trade.take_profit.toFixed(4)}</div>
                          </div>
                        )}
                        {trade.close_reason && (
                          <div className="col-span-2">
                            <div className="text-muted-foreground">Motivo</div>
                            <div className="font-semibold">{trade.close_reason}</div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
});

TradeHistoryTimeline.displayName = 'TradeHistoryTimeline';
