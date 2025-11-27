import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TrendingUpIcon, TrendingDownIcon, DollarSignIcon, ActivityIcon, PlusIcon, XIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { getUserId } from "@/lib/anonymousUser";

interface PaperTrade {
  id: string;
  symbol: string;
  action: 'BUY' | 'SELL';
  entry_price: number;
  quantity: number;
  stop_loss: number | null;
  take_profit: number | null;
  current_price: number | null;
  unrealized_pnl: number;
  opened_at: string;
  status: 'OPEN' | 'CLOSED' | 'CANCELLED';
  notes: string | null;
}

interface DemoAccount {
  id: string;
  current_balance: number;
  total_pnl: number;
  initial_balance: number;
}

const PaperTrading = () => {
  const [isCreatingTrade, setIsCreatingTrade] = useState(false);
  const [currentPrice, setCurrentPrice] = useState(111250);
  const [newTrade, setNewTrade] = useState({
    action: 'BUY' as 'BUY' | 'SELL',
    quantity: 0.1,
    stop_loss: '',
    take_profit: '',
    notes: ''
  });

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Simular preço atual - DESABILITADO para evitar travamentos
  useEffect(() => {
    // const interval = setInterval(() => {
    //   setCurrentPrice(prev => prev + (Math.random() - 0.5) * 20);
    // }, 3000);
    // return () => clearInterval(interval);
  }, []);

  // Fetch demo account
  const { data: demoAccount } = useQuery({
    queryKey: ['demo-account'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('demo_accounts')
        .select('*')
        .single();

      if (error) throw error;
      return data as DemoAccount;
    }
  });

  // Fetch open trades
  const { data: openTrades, isLoading: tradesLoading } = useQuery({
    queryKey: ['paper-trades'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('paper_trades')
        .select('*')
        .eq('status', 'OPEN')
        .order('opened_at', { ascending: false });

      if (error) throw error;
      return data as PaperTrade[];
    },
    refetchInterval: false, // DESABILITADO
  });

  // Create trade mutation
  const createTrade = useMutation({
    mutationFn: async (tradeData: any) => {
      if (!demoAccount) throw new Error('Demo account not found');

      const userId = await getUserId();

      const trade = {
        user_id: userId,
        demo_account_id: demoAccount.id,
        symbol: 'BTC/USD',
        action: tradeData.action,
        entry_price: currentPrice,
        quantity: tradeData.quantity,
        stop_loss: tradeData.stop_loss ? parseFloat(tradeData.stop_loss) : null,
        take_profit: tradeData.take_profit ? parseFloat(tradeData.take_profit) : null,
        current_price: currentPrice,
        notes: tradeData.notes || null
      };

      const { data, error } = await supabase
        .from('paper_trades')
        .insert([trade])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['paper-trades'] });
      queryClient.invalidateQueries({ queryKey: ['demo-account'] });
      setIsCreatingTrade(false);
      setNewTrade({
        action: 'BUY',
        quantity: 0.1,
        stop_loss: '',
        take_profit: '',
        notes: ''
      });
      toast({
        title: "Trade criado!",
        description: "Sua operação simulada foi aberta com sucesso.",
      });
    }
  });

  // Close trade mutation
  const closeTrade = useMutation({
    mutationFn: async ({ tradeId, closePrice }: { tradeId: string; closePrice: number }) => {
      const trade = openTrades?.find(t => t.id === tradeId);
      if (!trade) throw new Error('Trade not found');

      let realized_pnl;
      if (trade.action === 'BUY') {
        realized_pnl = (closePrice - trade.entry_price) * trade.quantity;
      } else {
        realized_pnl = (trade.entry_price - closePrice) * trade.quantity;
      }

      const { data, error } = await supabase
        .from('paper_trades')
        .update({
          status: 'CLOSED',
          current_price: closePrice,
          realized_pnl,
          closed_at: new Date().toISOString(),
          close_reason: 'MANUAL'
        })
        .eq('id', tradeId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['paper-trades'] });
      queryClient.invalidateQueries({ queryKey: ['demo-account'] });
      toast({
        title: "Trade fechado!",
        description: "Sua operação foi encerrada e o P&L foi calculado.",
      });
    }
  });

  // Update current prices
  useEffect(() => {
    if (openTrades?.length) {
      openTrades.forEach(trade => {
        const updateTrade = async () => {
          await supabase
            .from('paper_trades')
            .update({ current_price: currentPrice })
            .eq('id', trade.id);
        };
        updateTrade();
      });
    }
  }, [currentPrice, openTrades]);

  const calculateUnrealizedPnL = (trade: PaperTrade) => {
    if (!trade.current_price) return 0;
    
    if (trade.action === 'BUY') {
      return (trade.current_price - trade.entry_price) * trade.quantity;
    } else {
      return (trade.entry_price - trade.current_price) * trade.quantity;
    }
  };

  const totalUnrealizedPnL = openTrades?.reduce((sum, trade) => 
    sum + calculateUnrealizedPnL(trade), 0) || 0;

  const handleCreateTrade = () => {
    if (newTrade.quantity <= 0) {
      toast({
        title: "Erro",
        description: "Quantidade deve ser maior que zero.",
        variant: "destructive"
      });
      return;
    }
    createTrade.mutate(newTrade);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold mb-2">Paper Trading</h2>
          <p className="text-muted-foreground">Pratique trading sem risco financeiro</p>
        </div>
        <Dialog open={isCreatingTrade} onOpenChange={setIsCreatingTrade}>
          <DialogTrigger asChild>
            <Button className="flex items-center gap-2">
              <PlusIcon className="w-4 h-4" />
              Nova Operação
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nova Operação Simulada</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="p-4 bg-muted/30 rounded-lg">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Preço Atual BTC/USD:</span>
                  <span className="font-mono font-bold text-lg">${currentPrice.toFixed(2)}</span>
                </div>
              </div>

              <div>
                <Label>Tipo de Operação</Label>
                <Select 
                  value={newTrade.action} 
                  onValueChange={(value: 'BUY' | 'SELL') => setNewTrade({ ...newTrade, action: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="BUY">Compra (LONG)</SelectItem>
                    <SelectItem value="SELL">Venda (SHORT)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="quantity">Quantidade (BTC)</Label>
                <Input
                  id="quantity"
                  type="number"
                  step="0.001"
                  value={newTrade.quantity}
                  onChange={(e) => setNewTrade({ ...newTrade, quantity: parseFloat(e.target.value) || 0 })}
                  placeholder="0.1"
                />
                <div className="text-xs text-muted-foreground mt-1">
                  Valor: ${(newTrade.quantity * currentPrice).toFixed(2)}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="stop-loss">Stop Loss ($)</Label>
                  <Input
                    id="stop-loss"
                    type="number"
                    value={newTrade.stop_loss}
                    onChange={(e) => setNewTrade({ ...newTrade, stop_loss: e.target.value })}
                    placeholder="Opcional"
                  />
                </div>
                <div>
                  <Label htmlFor="take-profit">Take Profit ($)</Label>
                  <Input
                    id="take-profit"
                    type="number"
                    value={newTrade.take_profit}
                    onChange={(e) => setNewTrade({ ...newTrade, take_profit: e.target.value })}
                    placeholder="Opcional"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="notes">Notas (Opcional)</Label>
                <Input
                  id="notes"
                  value={newTrade.notes}
                  onChange={(e) => setNewTrade({ ...newTrade, notes: e.target.value })}
                  placeholder="Motivo da entrada, estratégia..."
                />
              </div>

              <Button onClick={handleCreateTrade} className="w-full" disabled={createTrade.isPending}>
                {createTrade.isPending ? 'Criando...' : `Abrir ${newTrade.action === 'BUY' ? 'Compra' : 'Venda'}`}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Account Summary */}
      {demoAccount && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <DollarSignIcon className="w-8 h-8 text-primary" />
              <div>
                <div className="text-sm text-muted-foreground">Saldo Atual</div>
                <div className="font-bold text-xl">${demoAccount.current_balance.toFixed(2)}</div>
              </div>
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center gap-3">
              <ActivityIcon className="w-8 h-8 text-blue-500" />
              <div>
                <div className="text-sm text-muted-foreground">P&L Total</div>
                <div className={`font-bold text-xl ${demoAccount.total_pnl >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                  ${demoAccount.total_pnl.toFixed(2)}
                </div>
              </div>
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center gap-3">
              <TrendingUpIcon className="w-8 h-8 text-green-500" />
              <div>
                <div className="text-sm text-muted-foreground">P&L Não Realizado</div>
                <div className={`font-bold text-xl ${totalUnrealizedPnL >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                  ${totalUnrealizedPnL.toFixed(2)}
                </div>
              </div>
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center gap-3">
              <ActivityIcon className="w-8 h-8 text-purple-500" />
              <div>
                <div className="text-sm text-muted-foreground">Posições Abertas</div>
                <div className="font-bold text-xl">{openTrades?.length || 0}</div>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Open Positions */}
      <Card className="p-6">
        <h3 className="font-semibold mb-4">Posições Abertas</h3>
        
        {tradesLoading ? (
          <div className="space-y-3">
            {[1,2,3].map(i => (
              <div key={i} className="h-20 bg-muted rounded animate-pulse"></div>
            ))}
          </div>
        ) : openTrades?.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <ActivityIcon className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>Nenhuma posição aberta</p>
            <p className="text-sm">Abra sua primeira operação simulada</p>
          </div>
        ) : (
          <div className="space-y-4">
            {openTrades?.map((trade) => {
              const unrealizedPnL = calculateUnrealizedPnL(trade);
              const pnlPercentage = (unrealizedPnL / (trade.entry_price * trade.quantity)) * 100;
              
              return (
                <div key={trade.id} className="p-4 border rounded-lg">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-full ${
                        trade.action === 'BUY' ? 'bg-green-500/20' : 'bg-red-500/20'
                      }`}>
                        {trade.action === 'BUY' ? (
                          <TrendingUpIcon className="w-4 h-4 text-green-500" />
                        ) : (
                          <TrendingDownIcon className="w-4 h-4 text-red-500" />
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold">{trade.action}</span>
                          <Badge variant="outline">{trade.symbol}</Badge>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {trade.quantity} BTC @ ${trade.entry_price.toFixed(2)}
                        </div>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => closeTrade.mutate({ tradeId: trade.id, closePrice: currentPrice })}
                      disabled={closeTrade.isPending}
                    >
                      <XIcon className="w-4 h-4 mr-1" />
                      Fechar
                    </Button>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <div className="text-muted-foreground">Preço Atual</div>
                      <div className="font-mono">${currentPrice.toFixed(2)}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">P&L</div>
                      <div className={`font-mono ${unrealizedPnL >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                        ${unrealizedPnL.toFixed(2)} ({pnlPercentage.toFixed(2)}%)
                      </div>
                    </div>
                    {trade.stop_loss && (
                      <div>
                        <div className="text-muted-foreground">Stop Loss</div>
                        <div className="font-mono text-red-500">${trade.stop_loss.toFixed(2)}</div>
                      </div>
                    )}
                    {trade.take_profit && (
                      <div>
                        <div className="text-muted-foreground">Take Profit</div>
                        <div className="font-mono text-green-500">${trade.take_profit.toFixed(2)}</div>
                      </div>
                    )}
                  </div>

                  {trade.notes && (
                    <div className="mt-3 p-2 bg-muted/30 rounded text-sm">
                      <span className="text-muted-foreground">Notas:</span> {trade.notes}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
};

export default PaperTrading;