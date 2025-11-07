import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TrendingUp, TrendingDown, X, Clock, Target, ShieldAlert, Radio } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Progress } from "@/components/ui/progress";
import { useRealtimePrice } from "@/hooks/useRealtimePrice";

export const ActiveTradesPanel = () => {
  const { toast } = useToast();
  const { getPrice, isConnected } = useRealtimePrice();

  // 🔄 Sincronizar posições da Bybit ao carregar
  const syncBybitPositions = async () => {
    try {
      console.log('🔄 Iniciando sincronização com Bybit...');
      
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

      if (error) {
        console.error('❌ Erro ao buscar posições da Bybit:', error);
        return;
      }

      if (!data?.success) {
        console.error('❌ Bybit retornou erro:', data?.error);
        return;
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.log('⚠️ Usuário não autenticado');
        return;
      }

      const positions = data.data.list || [];
      const openPositions = positions.filter((p: any) => parseFloat(p.size) > 0);
      
      console.log(`📊 Encontradas ${openPositions.length} posições abertas na Bybit`);

      // Buscar posições já existentes no banco
      const { data: dbPositions } = await supabase
        .from('auto_trader_positions')
        .select('symbol, side')
        .eq('status', 'OPEN')
        .eq('user_id', user.id);

      const existingPositions = new Set(
        (dbPositions || []).map(p => `${p.symbol}-${p.side}`)
      );

      let imported = 0;

      // Importar posições que não estão no banco
      for (const position of openPositions) {
        const symbol = position.symbol;
        const side = position.side;
        const posKey = `${symbol}-${side}`;

        if (!existingPositions.has(posKey)) {
          const entryPrice = parseFloat(position.avgPrice);
          const qty = parseFloat(position.size);
          const leverage = parseInt(position.leverage);
          const stopLoss = position.stopLoss ? parseFloat(position.stopLoss) : null;
          const takeProfit = position.takeProfit ? parseFloat(position.takeProfit) : null;
          const currentPrice = parseFloat(position.markPrice);
          const unrealizedPnl = parseFloat(position.unrealisedPnl);

          console.log(`💾 Importando: ${symbol} ${side} - Entry: ${entryPrice} - PnL: ${unrealizedPnl}`);

          const { error: insertError } = await supabase.from('auto_trader_positions').insert({
            user_id: user.id,
            symbol: symbol,
            side: side,
            qty: qty,
            entry_price: entryPrice,
            current_price: currentPrice,
            highest_price: side === 'Buy' ? currentPrice : currentPrice,
            stop_loss: stopLoss,
            take_profit: takeProfit,
            leverage: leverage,
            status: 'OPEN',
            confidence: 85,
            trailing_stop_percentage: 1.5,
            unrealized_pnl: unrealizedPnl,
            opened_at: position.createdTime ? new Date(parseInt(position.createdTime)).toISOString() : new Date().toISOString()
          });
          
          if (insertError) {
            console.error(`❌ Erro ao importar ${symbol}:`, insertError);
          } else {
            imported++;
          }
        }
      }

      if (imported > 0) {
        toast({
          title: "✅ Posições Sincronizadas",
          description: `${imported} posições da Bybit importadas`,
        });
        refetch();
      } else {
        console.log('✓ Todas as posições já estão sincronizadas');
      }
    } catch (error) {
      console.error('❌ Erro ao sincronizar:', error);
      toast({
        title: "❌ Erro na sincronização",
        description: "Não foi possível sincronizar com a Bybit",
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    syncBybitPositions();
  }, []);

  const { data: positions, refetch } = useQuery({
    queryKey: ['active-trades-panel'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('auto_trader_positions')
        .select('*')
        .eq('status', 'OPEN')
        .order('opened_at', { ascending: false });

      if (error) {
        console.error('Erro ao carregar posições:', error);
        throw error;
      }
      
      console.log('📊 Posições abertas carregadas:', data?.length || 0);
      return data;
    },
    refetchInterval: 10000, // Otimizado de 5s para 10s
  });

  const closePosition = async (positionId: string, symbol: string) => {
    try {
      const position = positions?.find(p => p.id === positionId);
      if (!position) return;

      const realized_pnl = position.unrealized_pnl || 0;
      
      const { error } = await supabase
        .from('auto_trader_positions')
        .update({
          status: 'CLOSED',
          closed_at: new Date().toISOString(),
          close_reason: 'Manual Close',
          realized_pnl,
        })
        .eq('id', positionId);

      if (error) throw error;

      toast({
        title: "✅ Posição fechada manualmente",
        description: `${symbol} - P&L: $${realized_pnl.toFixed(2)}`,
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

  const calculateDuration = (openedAt: string) => {
    const now = Date.now();
    const opened = new Date(openedAt).getTime();
    const diffMinutes = Math.floor((now - opened) / 60000);
    const hours = Math.floor(diffMinutes / 60);
    const minutes = diffMinutes % 60;
    
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  const calculateDistanceToStop = (currentPrice: number, stopLoss: number, entryPrice: number) => {
    if (!currentPrice || !stopLoss) return 0;
    return ((Math.abs(currentPrice - stopLoss) / entryPrice) * 100);
  };

  const calculateDistanceToTarget = (currentPrice: number, takeProfit: number, entryPrice: number) => {
    if (!currentPrice || !takeProfit) return 0;
    return ((Math.abs(takeProfit - currentPrice) / entryPrice) * 100);
  };

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-3">
            <h3 className="text-xl font-bold">Operações em Andamento</h3>
            {isConnected && (
              <Badge variant="outline" className="gap-1">
                <Radio className="h-3 w-3 text-green-500 animate-pulse" />
                Preços ao Vivo
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            {positions?.length || 0} posições ativas
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            size="sm" 
            variant="outline" 
            onClick={syncBybitPositions}
            className="gap-2"
          >
            🔄 Sincronizar
          </Button>
          {positions && positions.length > 0 && (
            <Badge variant="default" className="text-lg px-4 py-2">
              Total P&L: ${positions.reduce((sum, p) => sum + (p.unrealized_pnl || 0), 0).toFixed(2)}
            </Badge>
          )}
        </div>
      </div>

      {!positions || positions.length === 0 ? (
        <div className="text-center py-12 bg-muted/20 rounded-lg border-2 border-dashed border-border">
          <div className="mb-4">
            <TrendingUp className="w-16 h-16 mx-auto text-muted-foreground/40" />
          </div>
          <p className="text-lg font-semibold text-muted-foreground mb-2">
            Nenhuma operação ativa no momento
          </p>
          <p className="text-sm text-muted-foreground">
            O Auto Trader iniciará posições quando detectar oportunidades
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {positions.map((position) => {
            // Tentar obter preço ao vivo da Bybit
            const symbol = position.symbol.replace('/', '').replace('USD', 'USDT');
            const livePrice = getPrice(symbol);
            const displayPrice = livePrice || position.current_price || position.entry_price;
            
            // Recalcular P&L com preço ao vivo
            const livePnl = position.side === 'Buy'
              ? (displayPrice - position.entry_price) * position.qty
              : (position.entry_price - displayPrice) * position.qty;
            
            const pnlPercentage = ((livePnl || 0) / (position.entry_price * position.qty)) * 100;
            
            const distanceToStop = calculateDistanceToStop(
              displayPrice,
              position.stop_loss || 0,
              position.entry_price
            );
            
            const distanceToTarget = calculateDistanceToTarget(
              displayPrice,
              position.take_profit || 0,
              position.entry_price
            );

            return (
              <div 
                key={position.id}
                className="p-5 bg-muted/30 rounded-lg border-2 border-border hover:border-primary/50 transition-all"
              >
                {/* Header */}
                <div className="flex items-center justify-between mb-4">
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
                      <h4 className="font-bold text-lg">{position.symbol}</h4>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Clock className="w-3 h-3" />
                        <span>Aberto há {calculateDuration(position.opened_at)}</span>
                        <span>• {new Date(position.opened_at).toLocaleTimeString('pt-BR')}</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Badge variant={position.side === 'Buy' ? 'default' : 'destructive'}>
                      {position.side} {position.leverage}x
                    </Badge>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => closePosition(position.id, position.symbol)}
                      className="hover:bg-destructive/20"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                {/* Preços e Estatísticas */}
                <div className="grid grid-cols-5 gap-3 mb-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Entrada</p>
                    <p className="font-semibold">${position.entry_price.toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Atual {livePrice && '🟢'}</p>
                    <p className="font-semibold">${displayPrice.toFixed(2)}</p>
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
                    <p className="text-xs text-muted-foreground">Trailing</p>
                    <p className="font-semibold">{position.trailing_stop_percentage}%</p>
                  </div>
                </div>

                {/* Stop Loss e Take Profit */}
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="p-3 bg-red-500/10 rounded border border-red-500/30">
                    <div className="flex items-center gap-2 mb-2">
                      <ShieldAlert className="w-4 h-4 text-red-500" />
                      <span className="text-sm font-semibold">Stop Loss</span>
                    </div>
                    <p className="text-lg font-bold">${position.stop_loss?.toFixed(2) || 'N/A'}</p>
                    {position.stop_loss && (
                      <p className="text-xs text-red-500 mt-1">
                        {distanceToStop.toFixed(2)}% até atingir
                      </p>
                    )}
                  </div>
                  
                  <div className="p-3 bg-green-500/10 rounded border border-green-500/30">
                    <div className="flex items-center gap-2 mb-2">
                      <Target className="w-4 h-4 text-green-500" />
                      <span className="text-sm font-semibold">Take Profit</span>
                    </div>
                    <p className="text-lg font-bold">${position.take_profit?.toFixed(2) || 'N/A'}</p>
                    {position.take_profit && (
                      <p className="text-xs text-green-500 mt-1">
                        {distanceToTarget.toFixed(2)}% até atingir
                      </p>
                    )}
                  </div>
                </div>

                {/* P&L */}
                <div className="flex items-center justify-between pt-4 border-t border-border">
                  <div>
                    <p className="text-xs text-muted-foreground">P&L não realizado {livePrice && '(ao vivo)'}</p>
                    <p className={`text-2xl font-bold ${
                      livePnl > 0 ? 'text-green-500' : 
                      livePnl < 0 ? 'text-red-500' : 'text-muted-foreground'
                    }`}>
                      ${livePnl.toFixed(2)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">Variação %</p>
                    <p className={`text-xl font-bold ${
                      pnlPercentage > 0 ? 'text-green-500' : 
                      pnlPercentage < 0 ? 'text-red-500' : 'text-muted-foreground'
                    }`}>
                      {pnlPercentage > 0 ? '+' : ''}{pnlPercentage.toFixed(2)}%
                    </p>
                  </div>
                </div>

                {/* Barra de Progresso */}
                <div className="mt-3">
                  <div className="flex justify-between text-xs text-muted-foreground mb-1">
                    <span>SL</span>
                    <span>Entry</span>
                    <span>TP</span>
                  </div>
                  <Progress 
                    value={50 + (pnlPercentage * 5)} 
                    className="h-2" 
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
};
