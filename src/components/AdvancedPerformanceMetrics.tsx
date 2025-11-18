import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { TrendingUp, TrendingDown, Target, AlertTriangle, BarChart3, DollarSign } from "lucide-react";
import { Progress } from "@/components/ui/progress";

interface PositionStats {
  total_trades: number;
  winning_trades: number;
  losing_trades: number;
  total_pnl: number;
  avg_win: number;
  avg_loss: number;
  largest_win: number;
  largest_loss: number;
  win_rate: number;
  profit_factor: number;
  max_drawdown: number;
}

export const AdvancedPerformanceMetrics = () => {
  const { data: stats } = useQuery({
    queryKey: ['performance-metrics'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('auto_trader_positions')
        .select('realized_pnl, unrealized_pnl, status')
        .or('status.eq.CLOSED,status.eq.OPEN');

      if (error) throw error;

      const closedTrades = data.filter(t => t.status === 'CLOSED');
      const winningTrades = closedTrades.filter(t => (t.realized_pnl || 0) > 0);
      const losingTrades = closedTrades.filter(t => (t.realized_pnl || 0) < 0);

      const totalPnl = closedTrades.reduce((sum, t) => sum + (t.realized_pnl || 0), 0);
      const grossProfit = winningTrades.reduce((sum, t) => sum + (t.realized_pnl || 0), 0);
      const grossLoss = Math.abs(losingTrades.reduce((sum, t) => sum + (t.realized_pnl || 0), 0));

      const avgWin = winningTrades.length > 0 ? grossProfit / winningTrades.length : 0;
      const avgLoss = losingTrades.length > 0 ? grossLoss / losingTrades.length : 0;

      const largestWin = winningTrades.length > 0 
        ? Math.max(...winningTrades.map(t => t.realized_pnl || 0))
        : 0;
      const largestLoss = losingTrades.length > 0
        ? Math.min(...losingTrades.map(t => t.realized_pnl || 0))
        : 0;

      const winRate = closedTrades.length > 0 
        ? (winningTrades.length / closedTrades.length) * 100
        : 0;

      const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : 0;

      // Calcular max drawdown
      let peak = 0;
      let maxDrawdown = 0;
      let runningPnl = 0;
      
      closedTrades.forEach(trade => {
        runningPnl += trade.realized_pnl || 0;
        if (runningPnl > peak) peak = runningPnl;
        const drawdown = peak - runningPnl;
        if (drawdown > maxDrawdown) maxDrawdown = drawdown;
      });

      return {
        total_trades: closedTrades.length,
        winning_trades: winningTrades.length,
        losing_trades: losingTrades.length,
        total_pnl: totalPnl,
        avg_win: avgWin,
        avg_loss: avgLoss,
        largest_win: largestWin,
        largest_loss: largestLoss,
        win_rate: winRate,
        profit_factor: profitFactor,
        max_drawdown: maxDrawdown,
      } as PositionStats;
    },
    refetchInterval: 10000,
  });

  if (!stats) return null;

  return (
    <Card className="p-6">
      <div className="flex items-center gap-2 mb-6">
        <BarChart3 className="h-5 w-5 text-primary" />
        <h3 className="text-xl font-bold">Análise de Performance Avançada</h3>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Win Rate */}
        <div className="p-4 bg-muted/30 rounded-lg border">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">Win Rate</span>
            <Target className="h-4 w-4 text-primary" />
          </div>
          <div className="text-2xl font-bold mb-2">
            {(stats.win_rate || 0).toFixed(1)}%
          </div>
          <Progress value={stats.win_rate || 0} className="h-2" />
          <div className="mt-2 text-xs text-muted-foreground">
            {stats.winning_trades || 0}W / {stats.losing_trades || 0}L de {stats.total_trades || 0} trades
          </div>
        </div>

        {/* Profit Factor */}
        <div className="p-4 bg-muted/30 rounded-lg border">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">Profit Factor</span>
            <DollarSign className="h-4 w-4 text-primary" />
          </div>
          <div className={`text-2xl font-bold ${(stats.profit_factor || 0) >= 2 ? 'text-green-500' : (stats.profit_factor || 0) >= 1 ? 'text-yellow-500' : 'text-red-500'}`}>
            {(stats.profit_factor || 0).toFixed(2)}x
          </div>
          <div className="mt-2 text-xs text-muted-foreground">
            {(stats.profit_factor || 0) >= 2 ? 'Excelente' : (stats.profit_factor || 0) >= 1 ? 'Bom' : 'Precisa Melhorar'}
          </div>
        </div>

        {/* Max Drawdown */}
        <div className="p-4 bg-muted/30 rounded-lg border">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">Max Drawdown</span>
            <AlertTriangle className="h-4 w-4 text-destructive" />
          </div>
          <div className="text-2xl font-bold text-red-500">
            -${(stats.max_drawdown || 0).toFixed(2)}
          </div>
          <div className="mt-2 text-xs text-muted-foreground">
            Maior sequência de perdas
          </div>
        </div>

        {/* Média de Ganhos */}
        <div className="p-4 bg-muted/30 rounded-lg border">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">Média de Ganhos</span>
            <TrendingUp className="h-4 w-4 text-green-500" />
          </div>
          <div className="text-2xl font-bold text-green-500">
            +${(stats.avg_win || 0).toFixed(2)}
          </div>
          <div className="mt-2 text-xs text-muted-foreground">
            Por trade vencedor
          </div>
        </div>

        {/* Média de Perdas */}
        <div className="p-4 bg-muted/30 rounded-lg border">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">Média de Perdas</span>
            <TrendingDown className="h-4 w-4 text-red-500" />
          </div>
          <div className="text-2xl font-bold text-red-500">
            -${(stats.avg_loss || 0).toFixed(2)}
          </div>
          <div className="mt-2 text-xs text-muted-foreground">
            Por trade perdedor
          </div>
        </div>

        {/* P&L Total */}
        <div className="p-4 bg-muted/30 rounded-lg border">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">P&L Total</span>
            <BarChart3 className="h-4 w-4 text-primary" />
          </div>
          <div className={`text-2xl font-bold ${(stats.total_pnl || 0) >= 0 ? 'text-green-500' : 'text-red-500'}`}>
            {(stats.total_pnl || 0) >= 0 ? '+' : ''}${(stats.total_pnl || 0).toFixed(2)}
          </div>
          <div className="mt-2 text-xs text-muted-foreground">
            Em {stats.total_trades || 0} trades fechados
          </div>
        </div>

        {/* Melhor Trade */}
        <div className="p-4 bg-green-500/10 rounded-lg border border-green-500/30">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">Melhor Trade</span>
            <TrendingUp className="h-4 w-4 text-green-500" />
          </div>
          <div className="text-2xl font-bold text-green-500">
            +${(stats.largest_win || 0).toFixed(2)}
          </div>
          <div className="mt-2 text-xs text-muted-foreground">
            Maior lucro individual
          </div>
        </div>

        {/* Pior Trade */}
        <div className="p-4 bg-red-500/10 rounded-lg border border-red-500/30">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">Pior Trade</span>
            <TrendingDown className="h-4 w-4 text-red-500" />
          </div>
          <div className="text-2xl font-bold text-red-500">
            ${(stats.largest_loss || 0).toFixed(2)}
          </div>
          <div className="mt-2 text-xs text-muted-foreground">
            Maior perda individual
          </div>
        </div>

        {/* Risco/Retorno */}
        <div className="p-4 bg-muted/30 rounded-lg border">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">Razão Risco/Retorno</span>
            <Target className="h-4 w-4 text-primary" />
          </div>
          <div className="text-2xl font-bold text-primary">
            1:{(stats.avg_loss || 0) > 0 ? ((stats.avg_win || 0) / (stats.avg_loss || 1)).toFixed(2) : '0'}
          </div>
          <div className="mt-2 text-xs text-muted-foreground">
            Ganho médio vs perda média
          </div>
        </div>
      </div>

      {/* Recomendações */}
      <div className="mt-6 p-4 bg-primary/10 rounded-lg border border-primary/30">
        <h4 className="font-semibold mb-2 flex items-center gap-2">
          <Target className="h-4 w-4" />
          Recomendações
        </h4>
        <ul className="space-y-1 text-sm text-muted-foreground">
          {stats.win_rate < 50 && (
            <li>• Win rate abaixo de 50% - considere revisar os critérios de entrada</li>
          )}
          {stats.profit_factor < 1.5 && (
            <li>• Profit factor baixo - aumente a razão risco/retorno ou melhore a seleção de trades</li>
          )}
          {stats.avg_loss > stats.avg_win && (
            <li>• Perdas médias maiores que ganhos - considere stops loss mais apertados</li>
          )}
          {stats.max_drawdown > 100 && (
            <li>• Drawdown alto - reduza o tamanho das posições ou seja mais seletivo</li>
          )}
          {stats.win_rate >= 60 && stats.profit_factor >= 2 && (
            <li className="text-green-500">✅ Performance excelente! Continue com essa estratégia</li>
          )}
        </ul>
      </div>
    </Card>
  );
};
