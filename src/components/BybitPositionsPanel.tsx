import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TrendingUp, TrendingDown, RefreshCw, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
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

export const BybitPositionsPanel = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [closingPosition, setClosingPosition] = useState<string | null>(null);
  const [confirmClose, setConfirmClose] = useState<any>(null);
  
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
      if (!data?.success) throw new Error(data?.error || 'Erro ao buscar posições');

      const positions = data.data?.list || [];
      return positions.filter((p: any) => parseFloat(p.size || 0) > 0);
    },
    refetchInterval: false, // DESABILITADO para evitar sobrecarga
  });

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
    <Card className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-xl font-bold">🔴 Posições na Bybit (Tempo Real)</h3>
          <p className="text-sm text-muted-foreground">
            {positions?.length || 0} posições abertas na exchange
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            size="sm" 
            variant="outline" 
            onClick={() => refetch()}
            disabled={isLoading}
            className="gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
          {positions && positions.length > 0 && (
            <>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => setConfirmClose({ all: true })}
                disabled={closingPosition === 'ALL'}
                className="gap-2"
              >
                <XCircle className="h-4 w-4" />
                Fechar Todas
              </Button>
              <Badge 
                variant={totalPnL >= 0 ? "default" : "destructive"} 
                className="text-lg px-4 py-2"
              >
                P&L Total: ${(totalPnL || 0).toFixed(2)}
              </Badge>
            </>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Carregando posições da Bybit...</p>
        </div>
      ) : !positions || positions.length === 0 ? (
        <div className="text-center py-12 bg-muted/20 rounded-lg border-2 border-dashed border-border">
          <p className="text-lg font-semibold text-muted-foreground mb-2">
            Nenhuma posição aberta na Bybit
          </p>
          <p className="text-sm text-muted-foreground">
            Todas as posições foram fechadas ou ainda não há operações
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {positions.map((position: any, idx: number) => {
            const pnl = parseFloat(position.unrealisedPnl || '0') || 0;
            const positionValue = parseFloat(position.positionValue || '1') || 1;
            const pnlPercentage = (pnl / positionValue) * 100;

            return (
              <div 
                key={idx}
                className="p-4 bg-muted/30 rounded-lg border border-border hover:border-primary/50 transition-all"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-full ${
                      position.side === 'Buy' ? 'bg-green-500/20' : 'bg-red-500/20'
                    }`}>
                      {position.side === 'Buy' ? (
                        <TrendingUp className="w-4 h-4 text-green-500" />
                      ) : (
                        <TrendingDown className="w-4 h-4 text-red-500" />
                      )}
                    </div>
                    <div>
                      <h4 className="font-bold">{position.symbol}</h4>
                      <div className="flex gap-3 text-xs text-muted-foreground">
                        <span>Qty: {position.size}</span>
                        <span>Lev: {position.leverage}x</span>
                      </div>
                    </div>
                  </div>
                  
                  <Badge variant={position.side === 'Buy' ? 'default' : 'destructive'}>
                    {position.side}
                  </Badge>
                </div>

                <div className="grid grid-cols-4 gap-3 mt-3 text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground">Entrada</p>
                    <p className="font-semibold">${(parseFloat(position.avgPrice) || 0).toFixed(4)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Preço Atual</p>
                    <p className="font-semibold">${(parseFloat(position.markPrice) || 0).toFixed(4)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Stop Loss</p>
                    <p className="font-semibold">
                      {position.stopLoss ? `$${(parseFloat(position.stopLoss) || 0).toFixed(4)}` : 'N/A'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Take Profit</p>
                    <p className="font-semibold">
                      {position.takeProfit ? `$${(parseFloat(position.takeProfit) || 0).toFixed(4)}` : 'N/A'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between mt-3 pt-3 border-t border-border">
                  <div className="flex items-center gap-4">
                    <div>
                      <p className="text-xs text-muted-foreground">P&L não realizado</p>
                      <p className={`text-xl font-bold ${
                        pnl > 0 ? 'text-green-500' : 
                        pnl < 0 ? 'text-red-500' : 'text-muted-foreground'
                      }`}>
                        ${(pnl || 0).toFixed(2)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">Variação</p>
                      <p className={`text-lg font-bold ${
                        pnlPercentage > 0 ? 'text-green-500' : 
                        pnlPercentage < 0 ? 'text-red-500' : 'text-muted-foreground'
                      }`}>
                        {pnlPercentage > 0 ? '+' : ''}{(pnlPercentage || 0).toFixed(2)}%
                      </p>
                    </div>
                  </div>
                  
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => handleClosePosition(position)}
                    disabled={closingPosition === position.symbol}
                    className="gap-2"
                  >
                    <XCircle className="h-4 w-4" />
                    {closingPosition === position.symbol ? 'Fechando...' : 'Fechar Agora'}
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
                        totalPnL > 0 ? 'text-green-500' : 'text-red-500'
                      }`}>
                        ${(totalPnL || 0).toFixed(2)}
                      </span>
                    </p>
                  </div>
                  <p className="text-xs text-red-500 font-semibold mt-2">
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
                          parseFloat(confirmClose.unrealisedPnl) > 0 ? 'text-green-500' : 'text-red-500'
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
            <AlertDialogAction onClick={confirmClosePosition} className="bg-red-600 hover:bg-red-700">
              {confirmClose?.all ? 'Fechar Todas Agora' : 'Confirmar Fechamento'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
};