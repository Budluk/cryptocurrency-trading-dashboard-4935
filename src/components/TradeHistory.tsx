import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, Clock, DollarSign } from "lucide-react";
import { usePositions } from "@/contexts/PositionsContext";

interface Trade {
  id: string;
  symbol: string;
  side: string;
  entry_price: number;
  exit_price: number | null;
  quantity: number;
  leverage: number | null;
  realized_pnl: number | null;
  opened_at: string;
  closed_at: string | null;
  status: string;
  close_reason: string | null;
  confidence: number | null;
}

export const TradeHistory = () => {
  const { closedPositions, isLoading } = usePositions();
  
  const trades = closedPositions.slice(0, 50).map((t: any) => ({
    ...t,
    quantity: t.qty,
  })) as Trade[];

  const getPnLColor = (pnl: number) => {
    return pnl > 0 ? 'text-green-500' : pnl < 0 ? 'text-red-500' : 'text-muted-foreground';
  };

  const getTradeDuration = (openedAt: string, closedAt: string) => {
    const duration = new Date(closedAt).getTime() - new Date(openedAt).getTime();
    const minutes = Math.floor(duration / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ${hours % 24}h`;
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    return `${minutes}m`;
  };

  const totalPnL = trades.reduce((sum, trade) => sum + (trade.realized_pnl || 0), 0);
  const winningTrades = trades.filter(t => (t.realized_pnl || 0) > 0).length;
  const losingTrades = trades.filter(t => (t.realized_pnl || 0) < 0).length;
  const winRate = trades.length ? (winningTrades / trades.length) * 100 : 0;

  return (
    <div className="space-y-6">
      {/* Estatísticas Gerais */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4 bg-background/50">
          <div className="text-sm text-muted-foreground mb-1">Total de Trades</div>
          <div className="text-2xl font-bold">{trades.length}</div>
        </Card>
        
        <Card className="p-4 bg-background/50">
          <div className="text-sm text-muted-foreground mb-1">P&L Total</div>
          <div className={`text-2xl font-bold ${getPnLColor(totalPnL)}`}>
            ${totalPnL.toFixed(2)}
          </div>
        </Card>
        
        <Card className="p-4 bg-background/50">
          <div className="text-sm text-muted-foreground mb-1">Win Rate</div>
          <div className="text-2xl font-bold text-primary">{winRate.toFixed(1)}%</div>
          <div className="text-xs text-muted-foreground">
            {winningTrades}W / {losingTrades}L
          </div>
        </Card>
        
        <Card className="p-4 bg-background/50">
          <div className="text-sm text-muted-foreground mb-1">Média P&L</div>
          <div className={`text-2xl font-bold ${getPnLColor(totalPnL / (trades.length || 1))}`}>
            ${(totalPnL / (trades.length || 1)).toFixed(2)}
          </div>
        </Card>
      </div>

      {/* Histórico de Trades */}
      <Card className="p-6">
        <h3 className="text-xl font-bold mb-4">Histórico de Operações</h3>
        
        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">Carregando...</div>
        ) : trades.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            Nenhuma operação fechada ainda
          </div>
        ) : (
          <div className="space-y-3">
            {trades.map((trade) => {
              const pnlPercentage = trade.exit_price && trade.entry_price
                ? ((trade.exit_price - trade.entry_price) / trade.entry_price) * 100 * (trade.side === 'Buy' ? 1 : -1)
                : 0;

              return (
                <div 
                  key={trade.id}
                  className="p-4 bg-muted/30 rounded-lg border border-border hover:border-primary/30 transition-colors"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-full ${
                        trade.side === 'Buy' ? 'bg-green-500/20' : 'bg-red-500/20'
                      }`}>
                        {trade.side === 'Buy' ? (
                          <TrendingUp className="w-4 h-4 text-green-500" />
                        ) : (
                          <TrendingDown className="w-4 h-4 text-red-500" />
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-semibold">{trade.symbol}</h4>
                          <Badge variant={trade.side === 'Buy' ? 'default' : 'destructive'} className="text-xs">
                            {trade.side}
                          </Badge>
                          {trade.leverage && (
                            <Badge variant="outline" className="text-xs">
                              {trade.leverage}x
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {trade.closed_at && getTradeDuration(trade.opened_at, trade.closed_at)}
                          </span>
                          {trade.close_reason && (
                            <span className="text-[10px] px-2 py-0.5 bg-muted rounded">
                              {trade.close_reason}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    <div className="text-right">
                      <div className={`text-xl font-bold ${getPnLColor(trade.realized_pnl || 0)}`}>
                        {(trade.realized_pnl || 0) > 0 ? '+' : ''}${(trade.realized_pnl || 0).toFixed(2)}
                      </div>
                      <div className={`text-sm ${getPnLColor(pnlPercentage)}`}>
                        {pnlPercentage > 0 ? '+' : ''}{pnlPercentage.toFixed(2)}%
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
                    <div>
                      <div className="text-xs text-muted-foreground mb-1">🟢 Entrada</div>
                      <div className="font-semibold">${trade.entry_price.toFixed(2)}</div>
                      <div className="text-[10px] text-muted-foreground">
                        {new Date(trade.opened_at).toLocaleString('pt-BR', {
                          day: '2-digit',
                          month: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </div>
                    </div>
                    
                    <div>
                      <div className="text-xs text-muted-foreground mb-1">🔴 Saída</div>
                      <div className="font-semibold">${trade.exit_price?.toFixed(2) || '-'}</div>
                      <div className="text-[10px] text-muted-foreground">
                        {trade.closed_at ? new Date(trade.closed_at).toLocaleString('pt-BR', {
                          day: '2-digit',
                          month: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit'
                        }) : '-'}
                      </div>
                    </div>
                    
                    <div>
                      <div className="text-xs text-muted-foreground mb-1">Quantidade</div>
                      <div className="font-semibold">{trade.quantity}</div>
                    </div>
                    
                    <div>
                      <div className="text-xs text-muted-foreground mb-1">Volume</div>
                      <div className="font-semibold flex items-center gap-1">
                        <DollarSign className="w-3 h-3" />
                        {(trade.entry_price * trade.quantity).toFixed(2)}
                      </div>
                    </div>
                    
                    {trade.confidence && (
                      <div>
                        <div className="text-xs text-muted-foreground mb-1">Confiança</div>
                        <div className="font-semibold">{trade.confidence}%</div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
};
