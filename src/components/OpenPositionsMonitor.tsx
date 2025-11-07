import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { TrendingUp, TrendingDown, X, Target, ShieldAlert, Edit2, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ProgressiveClosureIndicator } from "./ProgressiveClosureIndicator";

interface Position {
  id: string;
  symbol: string;
  side: string; // BUY ou SELL
  entry_price: number;
  qty: number;
  stop_loss: number | null;
  take_profit: number | null;
  current_price: number | null;
  unrealized_pnl: number;
  confidence: number;
  opened_at: string;
  status: string;
  trailing_stop_percentage?: number | null;
}

export const OpenPositionsMonitor = () => {
  const { toast } = useToast();
  const [selectedPosition, setSelectedPosition] = useState<string | null>(null);
  const [editingStopLoss, setEditingStopLoss] = useState<string | null>(null);
  const [newStopLoss, setNewStopLoss] = useState<string>("");

  const { data: positions, refetch } = useQuery({
    queryKey: ['open-positions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('auto_trader_positions')
        .select('*')
        .eq('status', 'OPEN')
        .order('opened_at', { ascending: false });

      if (error) throw error;
      return data as Position[];
    },
    refetchInterval: 15000, // Otimizado de 10s para 15s
    staleTime: 10000
  });

  // Realtime updates usando Supabase realtime
  useEffect(() => {
    const channel = supabase
      .channel('positions-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'auto_trader_positions',
          filter: 'status=eq.OPEN'
        },
        () => {
          refetch();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [refetch]);

  const updateStopLoss = async (positionId: string) => {
    try {
      const stopLossValue = parseFloat(newStopLoss);
      if (isNaN(stopLossValue) || stopLossValue <= 0) {
        toast({
          title: "❌ Valor inválido",
          description: "Digite um valor numérico válido para o stop loss",
          variant: "destructive",
        });
        return;
      }

      const { error } = await supabase
        .from('auto_trader_positions')
        .update({ stop_loss: stopLossValue })
        .eq('id', positionId);

      if (error) throw error;

      toast({
        title: "✅ Stop Loss atualizado",
        description: `Novo stop: $${stopLossValue.toFixed(2)}`,
      });

      setEditingStopLoss(null);
      setNewStopLoss("");
      refetch();
    } catch (error: any) {
      toast({
        title: "❌ Erro ao atualizar stop",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const closePosition = async (positionId: string, reason: string) => {
    try {
      const position = positions?.find(p => p.id === positionId);
      if (!position) return;

      const realized_pnl = position.unrealized_pnl;
      
      const { error } = await supabase
        .from('auto_trader_positions')
        .update({
          status: 'CLOSED',
          closed_at: new Date().toISOString(),
          close_reason: reason,
          realized_pnl,
        })
        .eq('id', positionId);

      if (error) throw error;

      // Log do fechamento
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.from('auto_trader_logs').insert([{
          user_id: user.id,
          log_type: 'TRADE' as any,
          position_id: positionId,
          symbol: position.symbol,
          message: `Posição fechada: ${reason}`,
          metadata: { pnl: realized_pnl, reason } as any,
        }]);
      }

      toast({
        title: "✅ Posição fechada",
        description: `${position.symbol} - P&L: $${realized_pnl.toFixed(2)}`,
      });

      refetch();
    } catch (error: any) {
      toast({
        title: "❌ Erro ao fechar posição",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const getPnLColor = (pnl: number) => {
    return pnl > 0 ? 'text-green-500' : pnl < 0 ? 'text-red-500' : 'text-muted-foreground';
  };

  const getPnLPercentage = (position: Position) => {
    if (!position.current_price) return 0;
    return ((position.unrealized_pnl / (position.entry_price * position.qty)) * 100);
  };

  // Indicador de saúde da posição
  const getHealthIndicator = (position: Position) => {
    const pnlPercent = getPnLPercentage(position);
    if (pnlPercent > 2) return { color: 'bg-green-500', status: 'Saudável' };
    if (pnlPercent > 0) return { color: 'bg-green-400', status: 'Lucro' };
    if (pnlPercent > -1) return { color: 'bg-yellow-500', status: 'Atenção' };
    if (pnlPercent > -3) return { color: 'bg-orange-500', status: 'Risco' };
    return { color: 'bg-red-500', status: 'Crítico' };
  };

  return (
    <div className="space-y-4">
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-xl font-bold">Posições Abertas</h3>
            <p className="text-sm text-muted-foreground">
              {positions?.length || 0} posições ativas
            </p>
          </div>
          <Badge variant="default" className="text-lg px-4 py-2">
            {positions?.reduce((sum, p) => sum + p.unrealized_pnl, 0).toFixed(2)} USD
          </Badge>
        </div>

        {positions && positions.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            Nenhuma posição aberta no momento
          </div>
        )}

        <div className="space-y-3">
          {positions?.map((position) => {
            const pnlPercentage = getPnLPercentage(position);
            const stopLossProgress = position.stop_loss 
              ? Math.abs((position.current_price! - position.entry_price) / (position.stop_loss - position.entry_price)) * 100
              : 0;
            const takeProfitProgress = position.take_profit
              ? Math.abs((position.current_price! - position.entry_price) / (position.take_profit - position.entry_price)) * 100
              : 0;

            const health = getHealthIndicator(position);
            
            return (
              <div 
                key={position.id}
                className="p-4 bg-muted/30 rounded-lg border-2 hover:border-primary/50 transition-colors relative overflow-hidden"
                style={{ borderColor: `hsl(var(--${health.color === 'bg-green-500' ? 'green' : health.color === 'bg-red-500' ? 'red' : 'yellow'}-500) / 0.3)` }}
              >
                {/* Indicador de Saúde */}
                <div className="absolute top-0 right-0 px-3 py-1 rounded-bl-lg text-xs font-semibold bg-background/80 backdrop-blur-sm">
                  <span className={`inline-block w-2 h-2 rounded-full ${health.color} mr-2`}></span>
                  {health.status}
                </div>
                
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-full ${
                      position.side === 'Buy' ? 'bg-green-500/20' : 'bg-red-500/20'
                    }`}>
                      {position.side === 'Buy' ? (
                        <TrendingUp className="w-5 h-5 text-green-500" />
                      ) : (
                        <TrendingDown className="w-5 h-5 text-red-500" />
                      )}
                    </div>
                    <div>
                      <h4 className="font-semibold text-lg">{position.symbol}</h4>
                      <p className="text-xs text-muted-foreground">
                        {new Date(position.opened_at).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Badge variant={position.side === 'Buy' ? 'default' : 'destructive'}>
                      {position.side}
                    </Badge>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => closePosition(position.id, 'Manual Close')}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-3">
                  <div>
                    <p className="text-xs text-muted-foreground">Entrada</p>
                    <p className="font-semibold">${position.entry_price.toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Atual</p>
                    <p className="font-semibold">${position.current_price?.toFixed(2) || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Quantidade</p>
                    <p className="font-semibold">{position.qty}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Confiança</p>
                    <p className="font-semibold">{position.confidence}%</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Abertura</p>
                    <p className="font-semibold text-xs">{new Date(position.opened_at).toLocaleTimeString('pt-BR')}</p>
                  </div>
                </div>

                {/* Estatísticas da Operação */}
                <div className="grid grid-cols-3 gap-2 mb-3 p-2 bg-background/40 rounded">
                  <div>
                    <p className="text-xs text-muted-foreground">Stop Loss</p>
                    <p className="font-semibold text-sm">${position.stop_loss?.toFixed(2) || 'N/A'}</p>
                    {position.stop_loss && position.current_price && (
                      <p className="text-xs text-red-500">
                        {((Math.abs(position.current_price - position.stop_loss) / position.entry_price) * 100).toFixed(2)}% até SL
                      </p>
                    )}
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Take Profit</p>
                    <p className="font-semibold text-sm">${position.take_profit?.toFixed(2) || 'N/A'}</p>
                    {position.take_profit && position.current_price && (
                      <p className="text-xs text-green-500">
                        {((Math.abs(position.take_profit - position.current_price) / position.entry_price) * 100).toFixed(2)}% até TP
                      </p>
                    )}
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Duração</p>
                    <p className="font-semibold text-sm">
                      {Math.floor((Date.now() - new Date(position.opened_at).getTime()) / 60000)}m
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {Math.floor((Date.now() - new Date(position.opened_at).getTime()) / 3600000)}h
                    </p>
                  </div>
                </div>

                <div className="space-y-2 mb-3">
                  {/* Stop Loss com edição manual */}
                  <div className="flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4 text-red-500" />
                    <div className="flex-1">
                      {editingStopLoss === position.id ? (
                        <div className="flex items-center gap-2">
                          <Input
                            type="number"
                            step="0.01"
                            placeholder="Novo Stop Loss"
                            value={newStopLoss}
                            onChange={(e) => setNewStopLoss(e.target.value)}
                            className="h-7 text-xs"
                          />
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 w-7 p-0"
                            onClick={() => updateStopLoss(position.id)}
                          >
                            <Check className="h-3 w-3 text-green-500" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 w-7 p-0"
                            onClick={() => {
                              setEditingStopLoss(null);
                              setNewStopLoss("");
                            }}
                          >
                            <X className="h-3 w-3 text-red-500" />
                          </Button>
                        </div>
                      ) : (
                        <>
                          <div className="flex justify-between text-xs mb-1">
                            <span className="flex items-center gap-2">
                              Stop Loss: ${position.stop_loss?.toFixed(2) || 'N/A'}
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-4 w-4 p-0"
                                onClick={() => {
                                  setEditingStopLoss(position.id);
                                  setNewStopLoss(position.stop_loss?.toString() || "");
                                }}
                              >
                                <Edit2 className="h-3 w-3" />
                              </Button>
                            </span>
                            <span className="text-red-500">{stopLossProgress.toFixed(0)}%</span>
                          </div>
                          {position.stop_loss && (
                            <Progress value={Math.min(stopLossProgress, 100)} className="h-1" />
                          )}
                        </>
                      )}
                    </div>
                  </div>
                  
                  {position.take_profit && (
                    <div className="flex items-center gap-2">
                      <Target className="w-4 h-4 text-green-500" />
                      <div className="flex-1">
                        <div className="flex justify-between text-xs mb-1">
                          <span>Take Profit: ${position.take_profit.toFixed(2)}</span>
                          <span className="text-green-500">{takeProfitProgress.toFixed(0)}%</span>
                        </div>
                        <Progress value={Math.min(takeProfitProgress, 100)} className="h-1" />
                      </div>
                    </div>
                  )}
                </div>

                {/* Indicador de Fechamento Progressivo */}
                {position.current_price && (
                  <div className="mb-3 p-3 bg-primary/5 rounded-lg border border-primary/20">
                    <ProgressiveClosureIndicator
                      entryPrice={position.entry_price}
                      currentPrice={position.current_price}
                      side={position.side}
                      qty={position.qty}
                    />
                  </div>
                )}

                <div className="flex items-center justify-between pt-3 border-t border-border">
                  <div>
                    <p className="text-xs text-muted-foreground">P&L não realizado</p>
                    <p className={`text-xl font-bold ${getPnLColor(position.unrealized_pnl)}`}>
                      ${position.unrealized_pnl.toFixed(2)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">Variação</p>
                    <p className={`text-lg font-semibold ${getPnLColor(pnlPercentage)}`}>
                      {pnlPercentage > 0 ? '+' : ''}{pnlPercentage.toFixed(2)}%
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
};