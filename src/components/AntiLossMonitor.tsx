import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Shield, ShieldAlert, ShieldCheck, TrendingDown, Clock, Activity, RefreshCw, Zap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getUserId } from "@/lib/anonymousUser";
import { useToast } from "@/hooks/use-toast";

interface AntiLossStats {
  blockedPatterns: Array<{
    key: string;
    reason: string;
    blockedUntil: number;
  }>;
  totalBlocked: number;
  blockedSymbols: string[];
  blockedHours: number[];
  recentLosses: number;
  recentWins: number;
  lastSync: string | null;
}

interface Props {
  getBlockedStats: () => {
    blockedPatterns: Array<{ key: string; reason: string; blockedUntil: number }>;
    totalBlocked: number;
    blockedSymbols: string[];
    blockedHours: number[];
  };
  blockedCount: number;
  forceUnblock?: (key: string) => void;
}

export const AntiLossMonitor = ({ getBlockedStats, blockedCount, forceUnblock }: Props) => {
  const [stats, setStats] = useState<AntiLossStats | null>(null);
  const [dbStats, setDbStats] = useState<{ losses: number; wins: number; pending: number }>({ losses: 0, wins: 0, pending: 0 });
  const [isLoading, setIsLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const { toast } = useToast();

  // Sincronizar PnL diretamente do Bybit
  const syncPnLFromBybit = async () => {
    try {
      const userId = await getUserId();
      
      // Buscar posições sem PnL
      const { data: pendingPositions } = await supabase
        .from('auto_trader_positions')
        .select('id, symbol, side, leverage, closed_at')
        .eq('user_id', userId)
        .eq('status', 'CLOSED')
        .is('realized_pnl', null)
        .limit(30);

      if (!pendingPositions?.length) {
        console.log('✅ Sem posições pendentes de PnL');
        return 0;
      }

      console.log(`🔄 Sincronizando ${pendingPositions.length} posições...`);

      // Buscar PnL do Bybit
      const { data: bybitData, error } = await supabase.functions.invoke('bybit-trading', {
        body: { action: 'get_closed_pnl', params: { category: 'linear', limit: 100 } }
      });

      if (error || !bybitData?.success) {
        console.error('❌ Erro Bybit:', error || bybitData?.error);
        return 0;
      }

      const pnlList = bybitData.data?.list || [];
      console.log(`📊 Bybit: ${pnlList.length} registros de PnL`);

      let syncedCount = 0;
      for (const pos of pendingPositions) {
        const match = pnlList.find((p: any) => p.symbol === pos.symbol);
        if (match) {
          const pnl = parseFloat(match.closedPnl);
          await supabase
            .from('auto_trader_positions')
            .update({ realized_pnl: pnl })
            .eq('id', pos.id);
          syncedCount++;
          console.log(`${pnl >= 0 ? '🟢' : '🔴'} ${pos.symbol}: $${pnl.toFixed(4)}`);
        }
      }
      
      console.log(`✅ Sincronizados: ${syncedCount}/${pendingPositions.length}`);
      return syncedCount;
    } catch (e) {
      console.error('❌ Erro sync:', e);
      return 0;
    }
  };

  const fetchStats = async () => {
    setIsLoading(true);
    try {
      const userId = await getUserId();
      const blockedStats = getBlockedStats();

      // Buscar trades das últimas 24h
      const { data: recentTrades } = await supabase
        .from('auto_trader_positions')
        .select('realized_pnl, status, closed_at')
        .eq('user_id', userId)
        .eq('status', 'CLOSED')
        .gte('closed_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

      // Contar pendentes (sem PnL)
      const { data: pendingPnl } = await supabase
        .from('auto_trader_positions')
        .select('id')
        .eq('user_id', userId)
        .eq('status', 'CLOSED')
        .is('realized_pnl', null);

      const losses = recentTrades?.filter(t => (t.realized_pnl || 0) < 0).length || 0;
      const wins = recentTrades?.filter(t => (t.realized_pnl || 0) > 0).length || 0;

      setDbStats({ 
        losses, 
        wins, 
        pending: pendingPnl?.length || 0 
      });

      setStats({
        ...blockedStats,
        recentLosses: losses,
        recentWins: wins,
        lastSync: new Date().toLocaleTimeString('pt-BR'),
      });
    } catch (error) {
      console.error('Erro ao buscar stats:', error);
    }
    setIsLoading(false);
  };

  // Auto-sync ao carregar se houver pendentes
  useEffect(() => {
    const autoSync = async () => {
      await fetchStats();
      // Se houver pendentes, sincronizar automaticamente
      if (dbStats.pending > 0) {
        await syncPnLFromBybit();
        await fetchStats();
      }
    };
    autoSync();
    
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, [blockedCount]);

  const getStatusColor = () => {
    if (blockedCount > 2) return 'text-red-500';
    if (blockedCount > 0) return 'text-yellow-500';
    return 'text-green-500';
  };

  const getStatusIcon = () => {
    if (blockedCount > 2) return <ShieldAlert className="h-5 w-5 text-red-500" />;
    if (blockedCount > 0) return <Shield className="h-5 w-5 text-yellow-500" />;
    return <ShieldCheck className="h-5 w-5 text-green-500" />;
  };

  return (
    <Card className="glass-card border-border/50">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            {getStatusIcon()}
            <span>Sistema Anti-Perdas</span>
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={fetchStats}
              disabled={isLoading}
              className="h-7 w-7 p-0"
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>
            <Badge variant={blockedCount > 0 ? "destructive" : "secondary"} className="text-xs">
              {blockedCount > 0 ? `${blockedCount} BLOQUEADOS` : 'ATIVO'}
            </Badge>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Status Grid */}
        <div className="grid grid-cols-4 gap-2">
          <div className="bg-background/50 rounded-lg p-2 text-center">
            <TrendingDown className="h-4 w-4 mx-auto text-red-400 mb-1" />
            <div className="text-lg font-bold text-red-400">{dbStats.losses}</div>
            <div className="text-[10px] text-muted-foreground">Perdas 24h</div>
          </div>
          <div className="bg-background/50 rounded-lg p-2 text-center">
            <Activity className="h-4 w-4 mx-auto text-green-400 mb-1" />
            <div className="text-lg font-bold text-green-400">{dbStats.wins}</div>
            <div className="text-[10px] text-muted-foreground">Ganhos 24h</div>
          </div>
          <div className="bg-background/50 rounded-lg p-2 text-center">
            <Shield className="h-4 w-4 mx-auto text-yellow-400 mb-1" />
            <div className="text-lg font-bold text-yellow-400">{blockedCount}</div>
            <div className="text-[10px] text-muted-foreground">Bloqueados</div>
          </div>
          <div className="bg-background/50 rounded-lg p-2 text-center">
            <Clock className="h-4 w-4 mx-auto text-blue-400 mb-1" />
            <div className="text-lg font-bold text-blue-400">{dbStats.pending}</div>
            <div className="text-[10px] text-muted-foreground">Sem PnL</div>
          </div>
        </div>

        {/* PnL Sync Status */}
        {dbStats.pending > 0 && (
          <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-2 flex items-center justify-between">
            <span className="text-xs text-yellow-400">
              ⚠️ {dbStats.pending} posições sem PnL
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                setIsSyncing(true);
                try {
                  const synced = await syncPnLFromBybit();
                  if (synced > 0) {
                    toast({ title: `✅ ${synced} PnLs sincronizados` });
                  } else {
                    toast({ title: "⚠️ Nenhum PnL encontrado no Bybit", variant: "destructive" });
                  }
                  await fetchStats();
                } catch (e) {
                  toast({ title: "❌ Erro na sincronização", variant: "destructive" });
                }
                setIsSyncing(false);
              }}
              disabled={isSyncing}
              className="h-6 text-xs px-2 border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/20"
            >
              {isSyncing ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Zap className="h-3 w-3 mr-1" />}
              Sincronizar
            </Button>
          </div>
        )}

        {/* Blocked Symbols */}
        {stats?.blockedSymbols && stats.blockedSymbols.length > 0 && (
          <div className="space-y-2">
            <div className="text-xs text-muted-foreground flex items-center gap-1">
              <ShieldAlert className="h-3 w-3" />
              Símbolos Bloqueados:
            </div>
            <div className="flex flex-wrap gap-1">
              {stats.blockedSymbols.map(symbol => (
                <Badge 
                  key={symbol} 
                  variant="outline" 
                  className="text-red-400 border-red-500/30 text-xs cursor-pointer hover:bg-red-500/20"
                  onClick={() => forceUnblock?.(symbol)}
                >
                  {symbol} ✕
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Blocked Hours */}
        {stats?.blockedHours && stats.blockedHours.length > 0 && (
          <div className="space-y-2">
            <div className="text-xs text-muted-foreground flex items-center gap-1">
              <Clock className="h-3 w-3" />
              Horários Bloqueados:
            </div>
            <div className="flex flex-wrap gap-1">
              {stats.blockedHours.map(hour => (
                <Badge key={hour} variant="outline" className="text-orange-400 border-orange-500/30 text-xs">
                  {hour}:00 UTC
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Blocked Patterns Detail */}
        {stats?.blockedPatterns && stats.blockedPatterns.length > 0 && (
          <div className="space-y-2">
            <div className="text-xs text-muted-foreground">Padrões Bloqueados:</div>
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {stats.blockedPatterns.map(pattern => {
                const remainingMs = pattern.blockedUntil - Date.now();
                const remainingMin = Math.max(0, Math.ceil(remainingMs / 60000));
                return (
                  <div 
                    key={pattern.key} 
                    className="bg-red-500/10 border border-red-500/20 rounded p-2 text-xs"
                  >
                    <div className="flex justify-between items-center">
                      <span className="text-red-300">{pattern.reason}</span>
                      <Badge variant="outline" className="text-xs text-muted-foreground">
                        {remainingMin}min
                      </Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* All Clear */}
        {blockedCount === 0 && dbStats.losses === 0 && (
          <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-3 text-center">
            <ShieldCheck className="h-6 w-6 mx-auto text-green-400 mb-1" />
            <div className="text-sm text-green-400 font-medium">Sistema Operando Normalmente</div>
            <div className="text-xs text-muted-foreground">Nenhum padrão perdedor detectado</div>
          </div>
        )}

        {/* Last Sync */}
        {stats?.lastSync && (
          <div className="text-[10px] text-muted-foreground text-right">
            Última atualização: {stats.lastSync}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
