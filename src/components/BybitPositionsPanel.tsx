import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Activity, TrendingUp, TrendingDown, RefreshCw, XCircle, ChevronDown, ChevronUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useState, lazy, Suspense } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const MiniChart = lazy(() => import("./MiniChart"));

interface BybitPosition {
  symbol: string;
  size: string;
  side: string;
  leverage: string;
  entryPrice: string;
  markPrice: string;
  unrealisedPnl: string;
  liqPrice: string;
  positionValue: string;
  [key: string]: unknown;
}

interface ConfirmCloseState {
  symbol?: string;
  side?: string;
  all?: boolean;
  size?: string;
  unrealisedPnl?: string;
}

export const BybitPositionsPanel = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [closingPosition, setClosingPosition] = useState<string | null>(null);
  const [confirmClose, setConfirmClose] = useState<ConfirmCloseState | null>(null);
  const [expandedCharts, setExpandedCharts] = useState<Record<string, boolean>>({});

  const toggleChart = (symbol: string) => {
    setExpandedCharts(prev => ({ ...prev, [symbol]: !prev[symbol] }));
  };
  
  const [bybitUnstable, setBybitUnstable] = useState(false);

  const { data: positions, refetch, isLoading } = useQuery({
    queryKey: ['bybit-positions'],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('bybit-trading', {
        body: {
          action: 'get_positions',
          isTestnet: false,
          params: { 
            category: 'linear',
            settleCoin: 'USDT' 
          }
        }
      });

      if (error) throw error;

      // Transient error → don't throw, return undefined to keep previous data
      if (data && !data.success && data.transient) {
        setBybitUnstable(true);
        return undefined; // useQuery will keep previous data
      }

      if (!data?.success) throw new Error(data?.error || 'Erro ao buscar posições');

      setBybitUnstable(false);
      const positions = Array.isArray(data.data) ? data.data : (data.data?.list || []);
      return positions.filter((p: BybitPosition) => parseFloat(p.size || '0') > 0);
    },
    refetchInterval: 15000,
    staleTime: 12000,
    gcTime: 300000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    placeholderData: (prev: BybitPosition[] | undefined) => prev, // keep previous data on error
    retry: (failureCount, error: Error) => {
      // Don't retry transient errors (already handled with cooldown)
      if ((error as any)?.transient) return false;
      return failureCount < 2;
    },
  });

  const { data: balanceData } = useQuery({
    queryKey: ['bybit-balance'],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('bybit-trading', {
        body: {
          action: 'get_balance',
          isTestnet: false,
          params: { accountType: 'UNIFIED' }
        }
      });

      if (error) throw error;

      if (data && !data.success && data.transient) {
        setBybitUnstable(true);
        return undefined;
      }

      if (!data?.success) throw new Error(data?.error || 'Erro ao buscar saldo');

      setBybitUnstable(false);
      const balanceData = data.data;
      return balanceData?.list?.[0] || balanceData || null;
    },
    refetchInterval: 20000,
    staleTime: 15000,
    gcTime: 300000,
    refetchOnWindowFocus: false,
    placeholderData: (prev: any) => prev,
    retry: (failureCount, error: any) => {
      if (error?.transient) return false;
      return failureCount < 2;
    },
  });

  const totalEquity = parseFloat(balanceData?.totalEquity || '0');
  const totalWalletBalance = parseFloat(balanceData?.totalWalletBalance || '0');
  const totalAvailableBalance = parseFloat(balanceData?.totalAvailableBalance || '0');

  const totalPnL = positions?.reduce((sum: number, p: any) => 
    sum + parseFloat(p.unrealisedPnl || 0), 0) || 0;

  // 🔴 MUTATION PARA FECHAR POSIÇÃO
  const closePositionMutation = useMutation({
    mutationFn: async ({ symbol, side, qty }: { symbol: string; side: string; qty: string }) => {
      const { data, error } = await supabase.functions.invoke('bybit-trading', {
        body: {
          action: 'place_order',
          isTestnet: false,
          params: {
            category: 'linear',
            symbol: symbol,
            side: side === 'Buy' ? 'Sell' : 'Buy', // ORDEM OPOSTA para fechar
            orderType: 'Market',
            qty: qty,
            reduceOnly: true, // IMPORTANTE: apenas reduzir posição existente
            timeInForce: 'GTC',
            positionIdx: 0
          }
        }
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Erro ao fechar posição');
      
      return data;
    },
    onSuccess: (data, variables) => {
      toast({
        title: "✅ Posição Fechada",
        description: `${variables.symbol} fechado com sucesso via stop manual`,
      });
      queryClient.invalidateQueries({ queryKey: ['bybit-positions'] });
      setClosingPosition(null);
      setConfirmClose(null);
    },
    onError: (error: any, variables) => {
      toast({
        title: "❌ Erro ao Fechar Posição",
        description: error.message || `Falha ao fechar ${variables.symbol}`,
        variant: "destructive"
      });
      setClosingPosition(null);
    }
  });

  const handleClosePosition = (position: any) => {
    setConfirmClose(position);
  };

  const confirmClosePosition = async () => {
    if (!confirmClose) return;
    
    // Fechar todas as posições
    if (confirmClose.all) {
      setClosingPosition('ALL');
      
      try {
        // Fechar cada posição sequencialmente
        for (const position of positions || []) {
          await closePositionMutation.mutateAsync({
            symbol: position.symbol,
            side: position.side,
            qty: position.size
          });
        }
        
        toast({
          title: "✅ Todas as Posições Fechadas",
          description: `${positions?.length || 0} posições fechadas com sucesso`,
        });
      } catch (error: any) {
        toast({
          title: "❌ Erro ao Fechar Posições",
          description: error.message || 'Algumas posições podem não ter sido fechadas',
          variant: "destructive"
        });
      } finally {
        setClosingPosition(null);
        setConfirmClose(null);
        queryClient.invalidateQueries({ queryKey: ['bybit-positions'] });
      }
    } else {
      // Fechar posição individual
      setClosingPosition(confirmClose.symbol);
      closePositionMutation.mutate({
        symbol: confirmClose.symbol,
        side: confirmClose.side,
        qty: confirmClose.size
      });
    }
  };

  return (
    <section aria-label="Conta e posições Bybit" className="space-y-5">
      {/* Único resumo de saldo/posições da Visão geral (P&L detalhado fica no DailyPnLSummary). */}
      <div aria-label="Resumo da conta Bybit" className="rounded-lg border border-border bg-card/60 p-3 sm:p-4">
        <div className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4 sm:gap-6">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Saldo total · USDT</p>
            <p className="mt-0.5 text-2xl font-semibold font-mono tabular-nums text-foreground">${totalEquity.toFixed(2)}</p>
          </div>
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Disponível</p>
            <p className="mt-0.5 text-base font-semibold font-mono tabular-nums text-success">${totalAvailableBalance.toFixed(2)}</p>
          </div>
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Carteira</p>
            <p className="mt-0.5 text-base font-semibold font-mono tabular-nums text-foreground">${totalWalletBalance.toFixed(2)}</p>
          </div>
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Posições abertas</p>
            <p className="mt-0.5 text-base font-semibold tabular-nums text-foreground">{positions?.length || 0}</p>
          </div>
        </div>
      </div>

      {/* Cabeçalho da lista: sem contadores/P&L duplicados do resumo e do DailyPnLSummary. */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="flex min-h-9 items-center gap-2 text-lg font-semibold sm:text-xl">
            <Activity className="h-5 w-5 text-primary" aria-hidden="true" />
            Posições abertas
          </h3>
          {bybitUnstable && (
            <Badge variant="outline" className="mt-1 border-warning/50 bg-warning/10 text-warning">
              ⚠ Bybit instável — mostrando último dado
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            aria-label="Atualizar posições"
            title="Atualizar posições"
            onClick={() => refetch()}
            disabled={isLoading}
            className="min-h-10 px-3 text-xs sm:text-sm"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} aria-hidden="true" />
          </Button>
          {positions && positions.length > 0 && (
            <Button
              size="sm"
              variant="destructive"
              aria-label="Fechar todas as posições"
              onClick={() => setConfirmClose({ all: true })}
              disabled={closingPosition === 'ALL'}
              className="min-h-10 px-3 text-xs sm:text-sm"
            >
              <XCircle className="h-4 w-4 sm:mr-1" aria-hidden="true" />
              <span className="hidden sm:inline">Fechar Todas</span>
            </Button>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Carregando posições da Bybit...</p>
        </div>
      ) : !positions || positions.length === 0 ? (
        <div className="text-center py-8 border-b border-border">
          <p className="text-lg font-semibold text-muted-foreground mb-2">
            Nenhuma posição aberta
          </p>
          <p className="text-sm text-muted-foreground">
            Sem operações em andamento
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {positions.map((position: any, idx: number) => {
            const pnl = parseFloat(position.unrealisedPnl || '0') || 0;
            const positionValue = parseFloat(position.positionValue || '1') || 1;
            const pnlPercentage = (pnl / positionValue) * 100;

            return (
              <div 
                key={`${position.symbol}-${idx}`}
                className={`p-3 sm:p-4 rounded-lg border transition-all ${
                  pnl > 0 
                    ? 'bg-success/5 border-success/30' 
                    : pnl < 0 
                    ? 'bg-destructive/5 border-destructive/30' 
                    : 'bg-muted/30 border-border'
                }`}
              >
                {/* Header Row - Symbol, Side, Chart Toggle */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2 sm:gap-3">
                    <div className={`p-2 rounded-lg ${
                      position.side === 'Buy' ? 'bg-success/20' : 'bg-destructive/20'
                    }`}>
                      {position.side === 'Buy' ? (
                        <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5 text-success" aria-hidden="true" />
                      ) : (
                        <TrendingDown className="w-4 h-4 sm:w-5 sm:h-5 text-destructive" aria-hidden="true" />
                      )}
                    </div>
                    <div>
                      <h4 className="font-bold text-sm sm:text-base">{position.symbol.replace('USDT', '')}</h4>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span className="font-mono">{position.size}</span>
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">
                          {position.leverage}x
                        </Badge>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label={expandedCharts[position.symbol] ? "Ocultar gráfico" : "Mostrar gráfico"}
                      title={expandedCharts[position.symbol] ? "Ocultar gráfico" : "Mostrar gráfico"}
                      onClick={() => toggleChart(position.symbol)}
                      className="h-8 w-8 p-0"
                    >
                      {expandedCharts[position.symbol] ? (
                        <ChevronUp className="h-4 w-4" aria-hidden="true" />
                      ) : (
                        <ChevronDown className="h-4 w-4" aria-hidden="true" />
                      )}
                    </Button>
                    <Badge 
                      variant={position.side === 'Buy' ? 'default' : 'destructive'} 
                      className="text-xs px-2 py-0.5"
                    >
                      {position.side === 'Buy' ? 'LONG' : 'SHORT'}
                    </Badge>
                  </div>
                </div>

                {/* Mini Chart Bybit com preços */}
                {expandedCharts[position.symbol] && (
                  <div className="mb-3">
                    <Suspense fallback={
                      <div className="h-[200px] sm:h-[280px] bg-muted/50 rounded-lg flex items-center justify-center">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                      </div>
                    }>
                      <MiniChart 
                        symbol={position.symbol} 
                        height={typeof window !== 'undefined' && window.innerWidth < 640 ? 200 : 280}
                        entryPrice={parseFloat(position.avgPrice)}
                        currentPrice={parseFloat(position.markPrice)}
                        stopLoss={position.stopLoss ? parseFloat(position.stopLoss) : undefined}
                        takeProfit={position.takeProfit ? parseFloat(position.takeProfit) : undefined}
                        side={position.side}
                      />
                    </Suspense>
                  </div>
                )}

                {/* Price Grid - Mobile Optimized 2x2 */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 mb-3">
                  <div className="bg-background/50 rounded-lg p-2 sm:p-2.5">
                    <p className="text-[10px] sm:text-xs text-muted-foreground uppercase">Entrada</p>
                    <p className="font-bold text-xs sm:text-sm font-mono">${(parseFloat(position.avgPrice) || 0).toFixed(2)}</p>
                  </div>
                  <div className="bg-background/50 rounded-lg p-2 sm:p-2.5">
                    <p className="text-[10px] sm:text-xs text-muted-foreground uppercase">Atual</p>
                    <p className="font-bold text-xs sm:text-sm font-mono">${(parseFloat(position.markPrice) || 0).toFixed(2)}</p>
                  </div>
                  <div className="bg-background/50 rounded-lg p-2 sm:p-2.5">
                    <p className="text-[10px] sm:text-xs text-destructive uppercase">SL</p>
                    <p className="font-bold text-xs sm:text-sm font-mono text-destructive">
                      {position.stopLoss ? `$${(parseFloat(position.stopLoss) || 0).toFixed(2)}` : '-'}
                    </p>
                  </div>
                  <div className="bg-background/50 rounded-lg p-2 sm:p-2.5">
                    <p className="text-[10px] sm:text-xs text-success uppercase">TP</p>
                    <p className="font-bold text-xs sm:text-sm font-mono text-success">
                      {position.takeProfit ? `$${(parseFloat(position.takeProfit) || 0).toFixed(2)}` : '-'}
                    </p>
                  </div>
                </div>

                {/* P&L and Close Button Row */}
                <div className="flex items-center justify-between pt-2 border-t border-border/50">
                  <div className="flex items-center gap-2 sm:gap-4">
                    <div className={`text-lg sm:text-xl font-bold font-mono ${
                      pnl > 0 ? 'text-success' : 
                      pnl < 0 ? 'text-destructive' : 'text-muted-foreground'
                    }`}>
                      {pnl >= 0 ? '+' : ''}${(pnl || 0).toFixed(2)}
                    </div>
                    <Badge 
                      variant={pnl >= 0 ? 'secondary' : 'destructive'}
                      className={`text-xs font-mono ${
                        pnl > 0 ? 'bg-success/20 text-success border-success/30' : 
                        pnl < 0 ? 'bg-destructive/20 text-destructive border-destructive/30' : ''
                      }`}
                    >
                      {pnlPercentage > 0 ? '+' : ''}{(pnlPercentage || 0).toFixed(2)}%
                    </Badge>
                  </div>
                  
                  <Button
                    variant="destructive"
                    size="sm"
                    aria-label={`Fechar posição ${position.symbol}`}
                    onClick={() => handleClosePosition(position)}
                    disabled={closingPosition === position.symbol}
                    className="min-h-10 px-4 text-xs sm:text-sm"
                  >
                    <XCircle className="h-4 w-4 mr-1 sm:mr-2" aria-hidden="true" />
                    {closingPosition === position.symbol ? '...' : 'Fechar'}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 🔴 DIALOG DE CONFIRMAÇÃO */}
      <AlertDialog open={!!confirmClose} onOpenChange={(open) => !open && setConfirmClose(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>⚠️ Confirmar Fechamento de Posição</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              {confirmClose?.all ? (
                <>
                  <p className="font-semibold text-foreground">
                    Você está prestes a fechar TODAS as {positions?.length || 0} posições abertas!
                  </p>
                  <div className="bg-muted p-3 rounded-lg space-y-1">
                    <p className="text-sm">Total de posições: <span className="font-bold">{positions?.length || 0}</span></p>
                    <p className="text-sm">
                      P&L Total: <span className={`font-bold ${
                        totalPnL > 0 ? 'text-success' : 'text-destructive'
                      }`}>
                        ${(totalPnL || 0).toFixed(2)}
                      </span>
                    </p>
                  </div>
                  <p className="text-xs text-destructive font-semibold mt-2">
                    ⚠️ ATENÇÃO: Esta ação fechará TODAS as posições ao preço de mercado e NÃO pode ser desfeita!
                  </p>
                </>
              ) : (
                <>
                  <p>Você está prestes a fechar manualmente esta posição:</p>
                  {confirmClose && (
                    <div className="bg-muted p-3 rounded-lg space-y-1">
                      <p className="font-semibold">{confirmClose.symbol}</p>
                      <p className="text-sm">Direção: <span className="font-bold">{confirmClose.side}</span></p>
                      <p className="text-sm">Quantidade: <span className="font-bold">{confirmClose.size}</span></p>
                      <p className="text-sm">
                        P&L Atual: <span className={`font-bold ${
                          parseFloat(confirmClose.unrealisedPnl ?? '0') > 0 ? 'text-success' : 'text-destructive'
                        }`}>
                          ${(parseFloat(confirmClose.unrealisedPnl) || 0).toFixed(2)}
                        </span>
                      </p>
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground mt-2">
                    Esta ação não pode ser desfeita. A posição será fechada imediatamente ao preço de mercado.
                  </p>
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmClosePosition} className="bg-destructive hover:bg-destructive">
              {confirmClose?.all ? 'Fechar Todas Agora' : 'Confirmar Fechamento'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
};