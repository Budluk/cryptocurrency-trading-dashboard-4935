import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TrendingUp, TrendingDown, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const BybitPositionsPanel = () => {
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
    refetchInterval: 5000, // Atualizar a cada 5 segundos
  });

  const totalPnL = positions?.reduce((sum: number, p: any) => 
    sum + parseFloat(p.unrealisedPnl || 0), 0) || 0;

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
            <Badge 
              variant={totalPnL >= 0 ? "default" : "destructive"} 
              className="text-lg px-4 py-2"
            >
              P&L Total: ${totalPnL.toFixed(2)}
            </Badge>
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
            const pnl = parseFloat(position.unrealisedPnl || 0);
            const pnlPercentage = (pnl / parseFloat(position.positionValue || 1)) * 100;

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
                    <p className="font-semibold">${parseFloat(position.avgPrice).toFixed(4)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Preço Atual</p>
                    <p className="font-semibold">${parseFloat(position.markPrice).toFixed(4)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Stop Loss</p>
                    <p className="font-semibold">
                      {position.stopLoss ? `$${parseFloat(position.stopLoss).toFixed(4)}` : 'N/A'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Take Profit</p>
                    <p className="font-semibold">
                      {position.takeProfit ? `$${parseFloat(position.takeProfit).toFixed(4)}` : 'N/A'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between mt-3 pt-3 border-t border-border">
                  <div>
                    <p className="text-xs text-muted-foreground">P&L não realizado</p>
                    <p className={`text-xl font-bold ${
                      pnl > 0 ? 'text-green-500' : 
                      pnl < 0 ? 'text-red-500' : 'text-muted-foreground'
                    }`}>
                      ${pnl.toFixed(2)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">Variação</p>
                    <p className={`text-lg font-bold ${
                      pnlPercentage > 0 ? 'text-green-500' : 
                      pnlPercentage < 0 ? 'text-red-500' : 'text-muted-foreground'
                    }`}>
                      {pnlPercentage > 0 ? '+' : ''}{pnlPercentage.toFixed(2)}%
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
};