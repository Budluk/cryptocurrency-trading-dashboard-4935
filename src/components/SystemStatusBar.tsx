import { memo } from "react";
import { usePositions } from "@/contexts/PositionsContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getUserId } from "@/lib/anonymousUser";
import { Brain, Wifi, WifiOff, Zap } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

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
        .maybeSingle();
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
        .maybeSingle();
      return data;
    },
    staleTime: 30000,
    refetchInterval: 60000,
  });

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

  const getBybitStatus = () => {
    // Consider connected if we have positions or recent activity
    if (openPositions.length > 0 || closedPositions.length > 0) {
      return { status: 'connected', label: 'Bybit', color: 'text-success' };
    }
    return { status: 'disconnected', label: 'Bybit', color: 'text-warning' };
  };

  const mlStatus = getMLStatus();
  const autoStatus = getAutoTraderStatus();
  const bybitStatus = getBybitStatus();

  // Apenas estado de conexão/serviços: contadores e P&L são exibidos no resumo da Visão geral.
  return (
    <TooltipProvider>
      <div role="status" aria-label="Status do sistema" className="flex min-h-9 flex-wrap items-center justify-end gap-1.5 rounded-lg border border-border/60 bg-background/60 px-2 py-1 text-xs">
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex min-h-8 items-center gap-1.5 rounded-md bg-secondary/60 px-2">
              {bybitStatus.status === 'connected' ? (
                <Wifi className={`h-3.5 w-3.5 ${bybitStatus.color}`} aria-hidden="true" />
              ) : (
                <WifiOff className={`h-3.5 w-3.5 ${bybitStatus.color}`} aria-hidden="true" />
              )}
              <span className="font-medium text-foreground">{bybitStatus.label}</span>
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <p>Status da conexão com Bybit</p>
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex min-h-8 items-center gap-1.5 rounded-md bg-secondary/60 px-2">
              <Brain className={`h-3.5 w-3.5 ${mlStatus.color}`} aria-hidden="true" />
              <span className="font-medium text-foreground">{mlStatus.label}</span>
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <p>IA Adaptativa: {mlConfig?.trades_analyzed || 0} trades analisados</p>
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex min-h-8 items-center gap-1.5 rounded-md bg-secondary/60 px-2">
              <Zap className={`h-3.5 w-3.5 ${autoStatus.color}`} aria-hidden="true" />
              <span className="font-medium text-foreground">{autoStatus.label}</span>
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <p>Auto Trader: {autoStatus.status === 'running' ? 'Executando' : 'Parado'}</p>
          </TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  );
});

SystemStatusBar.displayName = 'SystemStatusBar';
