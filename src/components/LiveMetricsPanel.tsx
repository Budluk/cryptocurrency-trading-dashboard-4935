import { memo, useMemo, useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { usePositions } from "@/contexts/PositionsContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getUserId } from "@/lib/anonymousUser";
import { 
  TrendingUp, 
  TrendingDown, 
  Activity,
  Target,
  Clock,
  BarChart3,
  Flame,
  Snowflake,
  RefreshCw
} from "lucide-react";

export const LiveMetricsPanel = memo(() => {
  const { openPositions, closedPositions } = usePositions();
  const [lastUpdate, setLastUpdate] = useState(new Date());

  // Update timestamp every minute
  useEffect(() => {
    const interval = setInterval(() => setLastUpdate(new Date()), 60000);
    return () => clearInterval(interval);
  }, []);

  // Fetch ML config for recommendations
  const { data: mlConfig } = useQuery({
    queryKey: ['ml-live-metrics'],
    queryFn: async () => {
      const userId = await getUserId();
      const { data } = await supabase
        .from('ml_adaptive_config')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();
      return data;
    },
    staleTime: 30000,
  });

  const metrics = useMemo(() => {
    const now = new Date();
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);

    const last7Days = new Date(now);
    last7Days.setDate(last7Days.getDate() - 7);

    // Today's trades
    const closedToday = closedPositions.filter(p => 
      p.closed_at && new Date(p.closed_at) >= today
    );

    // Last 7 days trades
    const closedLast7Days = closedPositions.filter(p =>
      p.closed_at && new Date(p.closed_at) >= last7Days
    );

    // Calculate metrics
    const todayPnL = closedToday.reduce((sum, p) => sum + (p.realized_pnl || 0), 0);
    const unrealizedPnL = openPositions.reduce((sum, p) => sum + (p.unrealized_pnl || 0), 0);
    const weeklyPnL = closedLast7Days.reduce((sum, p) => sum + (p.realized_pnl || 0), 0);

    const todayWins = closedToday.filter(p => (p.realized_pnl || 0) > 0).length;
    const todayLosses = closedToday.filter(p => (p.realized_pnl || 0) < 0).length;
    const todayWinRate = closedToday.length > 0 ? (todayWins / closedToday.length) * 100 : 0;

    const weeklyWins = closedLast7Days.filter(p => (p.realized_pnl || 0) > 0).length;
    const weeklyWinRate = closedLast7Days.length > 0 ? (weeklyWins / closedLast7Days.length) * 100 : 0;

    // Calculate streaks
    const sortedTrades = [...closedPositions]
      .sort((a, b) => new Date(b.closed_at || 0).getTime() - new Date(a.closed_at || 0).getTime());
    
    let currentStreak = 0;
    let streakType: 'win' | 'loss' | 'none' = 'none';
    
    for (const trade of sortedTrades) {
      const isWin = (trade.realized_pnl || 0) > 0;
      if (currentStreak === 0) {
        streakType = isWin ? 'win' : 'loss';
        currentStreak = 1;
      } else if ((isWin && streakType === 'win') || (!isWin && streakType === 'loss')) {
        currentStreak++;
      } else {
        break;
      }
    }

    // Average trade duration
    const durations = closedToday
      .filter(p => p.opened_at && p.closed_at)
      .map(p => new Date(p.closed_at!).getTime() - new Date(p.opened_at).getTime());
    const avgDurationMs = durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : 0;
    const avgDurationMins = Math.round(avgDurationMs / 60000);

    // Best and worst trades today
    const bestTrade = closedToday.reduce((best, p) => 
      (p.realized_pnl || 0) > (best?.realized_pnl || -Infinity) ? p : best, null as any);
    const worstTrade = closedToday.reduce((worst, p) => 
      (p.realized_pnl || 0) < (worst?.realized_pnl || Infinity) ? p : worst, null as any);

    // Most traded symbol
    const symbolCounts = closedToday.reduce((acc, p) => {
      acc[p.symbol] = (acc[p.symbol] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    const mostTraded = Object.entries(symbolCounts).sort((a, b) => b[1] - a[1])[0];

    return {
      todayPnL,
      unrealizedPnL,
      weeklyPnL,
      todayWinRate,
      weeklyWinRate,
      todayTrades: closedToday.length,
      weeklyTrades: closedLast7Days.length,
      openCount: openPositions.length,
      currentStreak,
      streakType,
      avgDurationMins,
      bestTrade,
      worstTrade,
      mostTraded,
    };
  }, [openPositions, closedPositions]);

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <Card className="border-primary/20">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary animate-pulse" />
            Métricas ao Vivo
          </CardTitle>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <RefreshCw className="h-3 w-3" />
            {formatTime(lastUpdate)}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Quick Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {/* Today P&L */}
          <div className={`p-3 rounded-lg ${metrics.todayPnL >= 0 ? 'bg-success/10' : 'bg-destructive/10'}`}>
            <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
              {metrics.todayPnL >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
              P&L Hoje
            </div>
            <div className={`text-xl font-bold ${metrics.todayPnL >= 0 ? 'text-success' : 'text-destructive'}`}>
              {metrics.todayPnL >= 0 ? '+' : ''}${metrics.todayPnL.toFixed(2)}
            </div>
          </div>

          {/* Open P&L */}
          <div className={`p-3 rounded-lg ${metrics.unrealizedPnL >= 0 ? 'bg-primary/10' : 'bg-warning/10'}`}>
            <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
              <Activity className="h-3 w-3" />
              Aberto
            </div>
            <div className={`text-xl font-bold ${metrics.unrealizedPnL >= 0 ? 'text-primary' : 'text-warning'}`}>
              {metrics.unrealizedPnL >= 0 ? '+' : ''}${metrics.unrealizedPnL.toFixed(2)}
            </div>
          </div>

          {/* Win Rate Today */}
          <div className="p-3 rounded-lg bg-muted/30">
            <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
              <Target className="h-3 w-3" />
              Win Rate
            </div>
            <div className="text-xl font-bold">
              {metrics.todayWinRate.toFixed(0)}%
            </div>
            <Progress value={metrics.todayWinRate} className="h-1 mt-1" />
          </div>

          {/* Streak */}
          <div className={`p-3 rounded-lg ${
            metrics.streakType === 'win' ? 'bg-success/10' : 
            metrics.streakType === 'loss' ? 'bg-destructive/10' : 'bg-muted/30'
          }`}>
            <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
              {metrics.streakType === 'win' ? <Flame className="h-3 w-3" /> : <Snowflake className="h-3 w-3" />}
              Sequência
            </div>
            <div className={`text-xl font-bold ${
              metrics.streakType === 'win' ? 'text-success' : 
              metrics.streakType === 'loss' ? 'text-destructive' : ''
            }`}>
              {metrics.currentStreak} {metrics.streakType === 'win' ? '🔥' : metrics.streakType === 'loss' ? '❄️' : '-'}
            </div>
          </div>
        </div>

        {/* Secondary Stats */}
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="p-2 rounded-lg bg-muted/20">
            <div className="text-xs text-muted-foreground">Trades Hoje</div>
            <div className="text-lg font-semibold">{metrics.todayTrades}</div>
          </div>
          <div className="p-2 rounded-lg bg-muted/20">
            <div className="text-xs text-muted-foreground">Abertas</div>
            <div className="text-lg font-semibold text-primary">{metrics.openCount}</div>
          </div>
          <div className="p-2 rounded-lg bg-muted/20">
            <div className="text-xs text-muted-foreground">Duração Média</div>
            <div className="text-lg font-semibold">{metrics.avgDurationMins}m</div>
          </div>
        </div>

        {/* Best/Worst Trades */}
        {(metrics.bestTrade || metrics.worstTrade) && (
          <div className="grid grid-cols-2 gap-2">
            {metrics.bestTrade && metrics.bestTrade.realized_pnl > 0 && (
              <div className="p-2 rounded-lg bg-success/10 border border-success/20">
                <div className="flex items-center gap-1 text-xs text-success mb-1">
                  <TrendingUp className="h-3 w-3" />
                  Melhor Trade
                </div>
                <div className="text-sm font-semibold">{metrics.bestTrade.symbol}</div>
                <div className="text-success font-bold">+${metrics.bestTrade.realized_pnl.toFixed(2)}</div>
              </div>
            )}
            {metrics.worstTrade && metrics.worstTrade.realized_pnl < 0 && (
              <div className="p-2 rounded-lg bg-destructive/10 border border-destructive/20">
                <div className="flex items-center gap-1 text-xs text-destructive mb-1">
                  <TrendingDown className="h-3 w-3" />
                  Pior Trade
                </div>
                <div className="text-sm font-semibold">{metrics.worstTrade.symbol}</div>
                <div className="text-destructive font-bold">${metrics.worstTrade.realized_pnl.toFixed(2)}</div>
              </div>
            )}
          </div>
        )}

        {/* Weekly Summary */}
        <div className="p-3 rounded-lg bg-gradient-to-r from-primary/5 to-accent/5 border border-primary/10">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs text-muted-foreground flex items-center gap-1">
                <BarChart3 className="h-3 w-3" />
                Últimos 7 dias
              </div>
              <div className={`text-lg font-bold ${metrics.weeklyPnL >= 0 ? 'text-success' : 'text-destructive'}`}>
                {metrics.weeklyPnL >= 0 ? '+' : ''}${metrics.weeklyPnL.toFixed(2)}
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs text-muted-foreground">{metrics.weeklyTrades} trades</div>
              <div className="text-lg font-bold">{metrics.weeklyWinRate.toFixed(0)}% WR</div>
            </div>
          </div>
        </div>

        {/* ML Recommendations */}
        {mlConfig && mlConfig.is_enabled && (
          <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
            <div className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
              🧠 Recomendação ML
            </div>
            <div className="flex items-center justify-between text-sm">
              <div>
                <span className="text-muted-foreground">SL:</span>{' '}
                <span className="font-semibold text-destructive">{mlConfig.recommended_stop_loss_pct?.toFixed(2)}%</span>
              </div>
              <div>
                <span className="text-muted-foreground">TP:</span>{' '}
                <span className="font-semibold text-success">{mlConfig.recommended_take_profit_pct?.toFixed(2)}%</span>
              </div>
              <div>
                <span className="text-muted-foreground">Lev:</span>{' '}
                <span className="font-semibold text-primary">{mlConfig.recommended_leverage}x</span>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
});

LiveMetricsPanel.displayName = 'LiveMetricsPanel';
