import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Progress } from "@/components/ui/progress";
import { Users, TrendingUp, Award, Target, UserPlus, Settings } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const CopyTradingDashboard = () => {
  const { toast } = useToast();
  const [selectedTrader, setSelectedTrader] = useState<string | null>(null);
  const [allocationPercent, setAllocationPercent] = useState(10);
  const [minConfidence, setMinConfidence] = useState(70);

  // Buscar top traders
  const { data: topTraders } = useQuery({
    queryKey: ['top-traders'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('trader_profiles')
        .select('*')
        .eq('is_public', true)
        .gte('total_trades', 10)
        .order('win_rate', { ascending: false })
        .limit(20);

      if (error) throw error;
      return data;
    },
    refetchInterval: false, // DESABILITADO
  });

  // Buscar seguidores do usuário atual
  const { data: myFollows, refetch: refetchFollows } = useQuery({
    queryKey: ['my-copy-follows'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('copy_trading_followers')
        .select(`
          *,
          trader_profiles!copy_trading_followers_trader_user_id_fkey(*)
        `)
        .limit(10);

      if (error) throw error;
      return data || [];
    },
  });

  // Configuração de copy trading do usuário
  const { data: copyConfig, refetch: refetchConfig } = useQuery({
    queryKey: ['copy-trading-config'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('copy_trading_config')
        .select('*')
        .limit(1)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') throw error;
      return data;
    },
  });

  const followTrader = async (traderId: string) => {
    toast({
      title: "ℹ️ Funcionalidade Desabilitada",
      description: "Sistema de copy trading requer autenticação",
      variant: "default",
    });
  };

  const unfollowTrader = async (followId: string) => {
    try {
      const { error } = await supabase
        .from('copy_trading_followers')
        .delete()
        .eq('id', followId);

      if (error) throw error;

      toast({
        title: "✅ Deixou de seguir trader",
      });

      refetchFollows();
    } catch (error: any) {
      toast({
        title: "❌ Erro ao deixar de seguir",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const toggleFollowActive = async (followId: string, isActive: boolean) => {
    try {
      const { error } = await supabase
        .from('copy_trading_followers')
        .update({ is_active: !isActive })
        .eq('id', followId);

      if (error) throw error;

      toast({
        title: `✅ Copy trading ${!isActive ? 'ativado' : 'pausado'}`,
      });

      refetchFollows();
    } catch (error: any) {
      toast({
        title: "❌ Erro ao atualizar",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const updateCopyConfig = async (updates: any) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from('copy_trading_config')
        .upsert({
          user_id: user.id,
          ...updates,
        });

      if (error) throw error;

      toast({
        title: "✅ Configuração atualizada",
      });

      refetchConfig();
    } catch (error: any) {
      toast({
        title: "❌ Erro ao atualizar configuração",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const getRankBadge = (index: number) => {
    if (index === 0) return { icon: "🥇", color: "bg-yellow-500" };
    if (index === 1) return { icon: "🥈", color: "bg-gray-400" };
    if (index === 2) return { icon: "🥉", color: "bg-orange-500" };
    return { icon: `#${index + 1}`, color: "bg-muted" };
  };

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-6">
          <Users className="w-6 h-6 text-primary" />
          <h2 className="text-2xl font-bold">Copy Trading</h2>
          <Badge variant="default" className="ml-auto">
            Beta
          </Badge>
        </div>

        <Tabs defaultValue="traders" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="traders">Top Traders</TabsTrigger>
            <TabsTrigger value="following">Seguindo ({myFollows?.length || 0})</TabsTrigger>
            <TabsTrigger value="config">Configurações</TabsTrigger>
          </TabsList>

          {/* Top Traders */}
          <TabsContent value="traders" className="space-y-4 mt-6">
            <div className="grid gap-4">
              {topTraders?.map((trader, index) => {
                const rank = getRankBadge(index);
                const isFollowing = myFollows?.some(f => f.trader_user_id === trader.user_id);

                return (
                  <div key={trader.id} className="p-4 bg-muted/30 rounded-lg border hover:border-primary/50 transition-all">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 ${rank.color} rounded-full flex items-center justify-center font-bold text-white`}>
                          {rank.icon}
                        </div>
                        <div>
                          <h4 className="font-bold text-lg">{trader.display_name}</h4>
                          {trader.bio && (
                            <p className="text-xs text-muted-foreground">{trader.bio}</p>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <Badge variant={trader.win_rate >= 60 ? 'default' : 'secondary'}>
                          {trader.win_rate.toFixed(1)}% Win Rate
                        </Badge>
                      </div>
                    </div>

                    <div className="grid grid-cols-4 gap-3 mb-3">
                      <div>
                        <p className="text-xs text-muted-foreground">Total Trades</p>
                        <p className="font-bold">{trader.total_trades}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Total P&L</p>
                        <p className={`font-bold ${trader.total_pnl > 0 ? 'text-green-500' : 'text-red-500'}`}>
                          ${trader.total_pnl.toFixed(2)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Profit Factor</p>
                        <p className="font-bold">{trader.profit_factor.toFixed(2)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Seguidores</p>
                        <p className="font-bold">{trader.followers_count}</p>
                      </div>
                    </div>

                    {!isFollowing ? (
                      selectedTrader === trader.user_id ? (
                        <div className="space-y-3 p-3 bg-background/50 rounded">
                          <div>
                            <Label>Alocação de Capital: {allocationPercent}%</Label>
                            <Slider
                              value={[allocationPercent]}
                              onValueChange={(v) => setAllocationPercent(v[0])}
                              min={1}
                              max={100}
                              step={1}
                              className="mt-2"
                            />
                          </div>
                          <div>
                            <Label>Confiança Mínima: {minConfidence}%</Label>
                            <Slider
                              value={[minConfidence]}
                              onValueChange={(v) => setMinConfidence(v[0])}
                              min={50}
                              max={95}
                              step={5}
                              className="mt-2"
                            />
                          </div>
                          <div className="flex gap-2">
                            <Button onClick={() => followTrader(trader.user_id)} className="flex-1">
                              <UserPlus className="w-4 h-4 mr-2" />
                              Confirmar
                            </Button>
                            <Button variant="outline" onClick={() => setSelectedTrader(null)}>
                              Cancelar
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <Button onClick={() => setSelectedTrader(trader.user_id)} className="w-full">
                          <UserPlus className="w-4 h-4 mr-2" />
                          Seguir Trader
                        </Button>
                      )
                    ) : (
                      <Badge variant="secondary" className="w-full justify-center">
                        Já está seguindo
                      </Badge>
                    )}
                  </div>
                );
              })}
            </div>
          </TabsContent>

          {/* Following */}
          <TabsContent value="following" className="space-y-4 mt-6">
            {myFollows && myFollows.length > 0 ? (
              myFollows.map((follow: any) => (
                <div key={follow.id} className="p-4 bg-muted/30 rounded-lg border">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h4 className="font-bold text-lg">{follow.trader_profiles?.display_name}</h4>
                      <p className="text-sm text-muted-foreground">
                        Alocação: {follow.capital_allocation_percent}% | Min. Conf: {follow.min_confidence}%
                      </p>
                    </div>
                    <Switch
                      checked={follow.is_active}
                      onCheckedChange={() => toggleFollowActive(follow.id, follow.is_active)}
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-3 mb-3">
                    <div>
                      <p className="text-xs text-muted-foreground">Win Rate</p>
                      <p className="font-bold">{follow.trader_profiles?.win_rate.toFixed(1)}%</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Total P&L</p>
                      <p className="font-bold">${follow.trader_profiles?.total_pnl.toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Trades</p>
                      <p className="font-bold">{follow.trader_profiles?.total_trades}</p>
                    </div>
                  </div>

                  <Button variant="destructive" size="sm" onClick={() => unfollowTrader(follow.id)} className="w-full">
                    Deixar de Seguir
                  </Button>
                </div>
              ))
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <Users className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <p>Você ainda não está seguindo nenhum trader</p>
              </div>
            )}
          </TabsContent>

          {/* Config */}
          <TabsContent value="config" className="space-y-4 mt-6">
            <Card className="p-6">
              <div className="space-y-4">
                <div>
                  <Label>Capital Total para Copy Trading (USD)</Label>
                  <Input
                    type="number"
                    defaultValue={copyConfig?.total_capital_for_copy || 100}
                    onBlur={(e) => updateCopyConfig({ total_capital_for_copy: parseFloat(e.target.value) })}
                  />
                </div>

                <div>
                  <Label>Win Rate Mínimo do Trader (%)</Label>
                  <Input
                    type="number"
                    defaultValue={copyConfig?.min_trader_win_rate || 60}
                    onBlur={(e) => updateCopyConfig({ min_trader_win_rate: parseFloat(e.target.value) })}
                  />
                </div>

                <div>
                  <Label>Drawdown Máximo do Trader (%)</Label>
                  <Input
                    type="number"
                    defaultValue={copyConfig?.max_trader_drawdown || 20}
                    onBlur={(e) => updateCopyConfig({ max_trader_drawdown: parseFloat(e.target.value) })}
                  />
                </div>

                <div>
                  <Label>Mínimo de Trades do Trader</Label>
                  <Input
                    type="number"
                    defaultValue={copyConfig?.min_trader_trades || 10}
                    onBlur={(e) => updateCopyConfig({ min_trader_trades: parseInt(e.target.value) })}
                  />
                </div>

                <div className="flex items-center justify-between p-3 bg-muted/30 rounded">
                  <Label>Copy Trading Ativo</Label>
                  <Switch
                    checked={copyConfig?.is_active || false}
                    onCheckedChange={(checked) => updateCopyConfig({ is_active: checked })}
                  />
                </div>
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      </Card>
    </div>
  );
};
