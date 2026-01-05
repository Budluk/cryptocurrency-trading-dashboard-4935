import { memo, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { usePositions } from "@/contexts/PositionsContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getUserId } from "@/lib/anonymousUser";
import { 
  Activity, 
  Brain, 
  Wifi, 
  WifiOff, 
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Zap
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface SystemStatus {
  bybit: 'connected' | 'disconnected' | 'error';
  ml: 'active' | 'training' | 'inactive';
  autoTrader: 'running' | 'paused' | 'stopped';
}

export const SystemStatusBar = memo(() => {
  const { openPositions, closedPositions } = usePositions();

  // Fetch ML config status
  const { data: mlConfig } = useQuery({
    queryKey: ['ml-status-bar'],
    queryFn: async () => {
      const userId = await getUserId();
      const { data } = await supabase
        .from('ml_adaptive_config')
        .select('is_enabled, confidence_score, trades_analyzed, last_analysis_at')
        .eq('user_id', userId)
        .single();
      return data;
    },
    staleTime: 30000,
    refetchInterval: 60000,
  });

  // Fetch auto trader config
  const { data: autoTraderConfig } = useQuery({
    queryKey: ['auto-trader-status-bar'],
    queryFn: async () => {
      const userId = await getUserId();
      const { data } = await supabase
        .from('auto_trader_config')
        .select('is_active, trader_is_running, last_activity_at')
        .eq('user_id', userId)
        .single();
      return data;
    },
    staleTime: 30000,
    refetchInterval: 60000,
  });

  const stats = useMemo(() => {
    const now = new Date();
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);

    const closedToday = closedPositions.filter(p => 
      p.closed_at && new Date(p.closed_at) >= today
    );

    const todayPnL = closedToday.reduce((sum, p) => sum + (p.realized_pnl || 0), 0);
    const unrealizedPnL = openPositions.reduce((sum, p) => sum + (p.unrealized_pnl || 0), 0);
    const winCount = closedToday.filter(p => (p.realized_pnl || 0) > 0).length;
    const lossCount = closedToday.filter(p => (p.realized_pnl || 0) < 0).length;
    const winRate = closedToday.length > 0 ? (winCount / closedToday.length) * 100 : 0;

    return {
      openCount: openPositions.length,
      closedTodayCount: closedToday.length,
      todayPnL,
      unrealizedPnL,
      totalPnL: todayPnL + unrealizedPnL,
      winRate,
      winCount,
      lossCount,
    };
  }, [openPositions, closedPositions]);

  const getMLStatus = () => {
    if (!mlConfig) return { status: 'inactive', label: 'ML Inativo', color: 'text-muted-foreground' };
    if (mlConfig.is_enabled && mlConfig.confidence_score >= 70) {
      return { status: 'active', label: `ML ${mlConfig.confidence_score.toFixed(0)}%`, color: 'text-success' };
    }
    if (mlConfig.is_enabled) {
      return { status: 'training', label: 'ML Treinando', color: 'text-warning' };
    }
    return { status: 'inactive', label: 'ML Inativo', color: 'text-muted-foreground' };
  };

  const getAutoTraderStatus = () => {
    if (!autoTraderConfig) return { status: 'stopped', label: 'Auto OFF', color: 'text-muted-foreground' };
    if (autoTraderConfig.trader_is_running && autoTraderConfig.is_active) {
      return { status: 'running', label: 'Auto ON', color: 'text-success' };
    }
    if (autoTraderConfig.is_active) {
      return { status: 'paused', label: 'Auto Pausado', color: 'text-warning' };
    }
    return { status: 'stopped', label: 'Auto OFF', color: 'text-muted-foreground' };
  };

  const mlStatus = getMLStatus();
  const autoStatus = getAutoTraderStatus();

  const getBybitStatus = () => {
    // Consider connected if we have positions or recent activity
    if (openPositions.length > 0 || closedPositions.length > 0) {
      return { status: 'connected', label: 'Bybit', color: 'text-success' };
    }
    return { status: 'disconnected', label: 'Bybit', color: 'text-warning' };
  };

  const bybitStatus = getBybitStatus();

  return (
    <TooltipProvider>
      <div className="flex flex-wrap items-center gap-2 p-2 rounded-lg bg-card/50 backdrop-blur-sm border border-border/40 text-xs">
        {/* Connection Status */}
        <Tooltip>
          <TooltipTrigger asChild>
            <div className={`flex items-center gap-1.5 px-2 py-1 rounded-md bg-background/50 ${bybitStatus.color}`}>
              {bybitStatus.status === 'connected' ? (
                <Wifi className="h-3 w-3" />
              ) : (
                <WifiOff className="h-3 w-3" />
              )}
              <span className="font-medium">{bybitStatus.label}</span>
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <p>Status da conexão com Bybit</p>
          </TooltipContent>
        </Tooltip>

        {/* ML Status */}
        <Tooltip>
          <TooltipTrigger asChild>
            <div className={`flex items-center gap-1.5 px-2 py-1 rounded-md bg-background/50 ${mlStatus.color}`}>
              <Brain className="h-3 w-3" />
              <span className="font-medium">{mlStatus.label}</span>
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <p>IA Adaptativa: {mlConfig?.trades_analyzed || 0} trades analisados</p>
          </TooltipContent>
        </Tooltip>

        {/* Auto Trader Status */}
        <Tooltip>
          <TooltipTrigger asChild>
            <div className={`flex items-center gap-1.5 px-2 py-1 rounded-md bg-background/50 ${autoStatus.color}`}>
              <Zap className="h-3 w-3" />
              <span className="font-medium">{autoStatus.label}</span>
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <p>Auto Trader: {autoStatus.status === 'running' ? 'Executando' : 'Parado'}</p>
          </TooltipContent>
        </Tooltip>

        <div className="hidden sm:block h-4 w-px bg-border/50" />

        {/* Open Positions */}
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-background/50">
              <Activity className="h-3 w-3 text-primary" />
              <span className="font-medium">{stats.openCount}</span>
              <span className="text-muted-foreground">abertas</span>
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <p>{stats.openCount} posições abertas</p>
          </TooltipContent>
        </Tooltip>

        {/* Today's Trades */}
        {stats.closedTodayCount > 0 && (
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-background/50">
                <Clock className="h-3 w-3 text-muted-foreground" />
                <span className="text-success">{stats.winCount}W</span>
                <span className="text-muted-foreground">/</span>
                <span className="text-destructive">{stats.lossCount}L</span>
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p>Hoje: {stats.closedTodayCount} trades ({stats.winRate.toFixed(0)}% win rate)</p>
            </TooltipContent>
          </Tooltip>
        )}

        {/* Quick PnL */}
        {stats.totalPnL !== 0 && (
          <Tooltip>
            <TooltipTrigger asChild>
              <div className={`flex items-center gap-1.5 px-2 py-1 rounded-md ${
                stats.totalPnL > 0 ? 'bg-success/10' : 'bg-destructive/10'
              }`}>
                {stats.totalPnL > 0 ? (
                  <TrendingUp className="h-3 w-3 text-success" />
                ) : (
                  <TrendingDown className="h-3 w-3 text-destructive" />
                )}
                <span className={`font-bold ${stats.totalPnL > 0 ? 'text-success' : 'text-destructive'}`}>
                  {stats.totalPnL > 0 ? '+' : ''}${stats.totalPnL.toFixed(2)}
                </span>
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p>P&L Hoje: ${stats.todayPnL.toFixed(2)} realizado + ${stats.unrealizedPnL.toFixed(2)} aberto</p>
            </TooltipContent>
          </Tooltip>
        )}
      </div>
    </TooltipProvider>
  );
});

SystemStatusBar.displayName = 'SystemStatusBar';
