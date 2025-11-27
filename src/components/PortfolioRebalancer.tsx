import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Scale, AlertTriangle, TrendingUp, TrendingDown, CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { getUserId } from "@/lib/anonymousUser";

export function PortfolioRebalancer() {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const queryClient = useQueryClient();

  const { data: config } = useQuery({
    queryKey: ['rebalance-config'],
    queryFn: async () => {
      const userId = await getUserId();

      const { data, error } = await supabase
        .from('portfolio_rebalance_config')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      return data;
    },
  });

  const { data: history } = useQuery({
    queryKey: ['rebalance-history'],
    queryFn: async () => {
      const userId = await getUserId();

      const { data, error } = await supabase
        .from('portfolio_rebalance_history')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(5);

      if (error) throw error;
      return data;
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async (enabled: boolean) => {
      const userId = await getUserId();

      if (config) {
        const { error } = await supabase
          .from('portfolio_rebalance_config')
          .update({ is_enabled: enabled })
          .eq('user_id', userId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('portfolio_rebalance_config')
          .insert({
            user_id: userId,
            is_enabled: enabled,
            target_allocations: {
              'BTCUSDT': 40,
              'ETHUSDT': 30,
              'BNBUSDT': 20,
              'SOLUSDT': 10,
            }
          });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rebalance-config'] });
      toast.success(config?.is_enabled ? 'Rebalanceamento desativado' : 'Rebalanceamento ativado');
    },
  });

  const runAnalysis = async () => {
    setIsAnalyzing(true);
    try {
      const { data, error } = await supabase.functions.invoke('portfolio-rebalancer');

      if (error) throw error;

      if (data.success) {
        if (data.needs_rebalance) {
          toast.warning(`Rebalanceamento necessário! ${data.recommendations.length} recomendações`);
        } else {
          toast.success('Portfolio balanceado corretamente!');
        }
        queryClient.invalidateQueries({ queryKey: ['rebalance-history'] });
      } else {
        toast.info(data.message);
      }
    } catch (error) {
      console.error('Analysis error:', error);
      toast.error('Erro ao analisar portfolio');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const getPriorityBadge = (priority: string) => {
    if (priority === 'high') return <Badge variant="destructive">Alta</Badge>;
    if (priority === 'medium') return <Badge className="bg-warning">Média</Badge>;
    return <Badge variant="secondary">Baixa</Badge>;
  };

  return (
    <Card className="border-primary/20">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Scale className="h-5 w-5 text-primary" />
              Rebalanceamento de Portfolio
            </CardTitle>
            <CardDescription>
              Ajuste automático de alocações baseado em performance e correlações
            </CardDescription>
          </div>
          {config && (
            <div className="flex items-center gap-3">
              <Label htmlFor="rebalance-enable">Ativar</Label>
              <Switch
                id="rebalance-enable"
                checked={config.is_enabled}
                onCheckedChange={(checked) => toggleMutation.mutate(checked)}
              />
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button
          onClick={runAnalysis}
          disabled={isAnalyzing}
          className="w-full"
          size="lg"
        >
          <Scale className={`mr-2 h-4 w-4 ${isAnalyzing ? 'animate-pulse' : ''}`} />
          {isAnalyzing ? 'Analisando Portfolio...' : 'Analisar Portfolio'}
        </Button>

        {config && config.is_enabled && (
          <div className="p-4 rounded-lg bg-muted/50 space-y-3">
            <div className="text-sm font-medium">Configuração Atual</div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-muted-foreground">Drift Máximo:</span>
                <span className="ml-2 font-semibold">{config.max_position_drift_pct}%</span>
              </div>
              <div>
                <span className="text-muted-foreground">Correlação Min:</span>
                <span className="ml-2 font-semibold">{(config.min_correlation_threshold * 100).toFixed(0)}%</span>
              </div>
              <div>
                <span className="text-muted-foreground">Frequência:</span>
                <span className="ml-2 font-semibold capitalize">{config.rebalance_frequency}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Auto-executar:</span>
                <span className="ml-2 font-semibold">{config.auto_execute ? 'Sim' : 'Não'}</span>
              </div>
            </div>
          </div>
        )}

        {history && history.length > 0 && (
          <div className="space-y-2">
            <div className="text-sm font-medium mb-3">Histórico de Rebalanceamentos</div>
            {history.map((record) => {
              const recommendations = record.recommendations as any[];
              const needsRebalance = recommendations.some((r: any) => r.priority === 'high');

              return (
                <div
                  key={record.id}
                  className={`p-3 rounded-lg border ${
                    needsRebalance ? 'bg-warning/10 border-warning/30' : 'bg-muted/30 border-border/50'
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      {needsRebalance ? (
                        <AlertTriangle className="h-4 w-4 text-warning" />
                      ) : (
                        <CheckCircle2 className="h-4 w-4 text-success" />
                      )}
                      <span className="text-sm font-semibold capitalize">
                        {record.rebalance_type}
                      </span>
                      <Badge variant="outline" className="text-xs">
                        {new Date(record.created_at).toLocaleDateString('pt-BR')}
                      </Badge>
                    </div>
                    {record.executed && (
                      <Badge className="bg-success text-xs">Executado</Badge>
                    )}
                  </div>

                  {recommendations.length > 0 && (
                    <div className="space-y-1 mt-2">
                      {recommendations.slice(0, 3).map((rec: any, idx: number) => (
                        <div key={idx} className="text-xs bg-background/50 p-2 rounded">
                          <div className="flex items-center justify-between">
                            <span className="font-medium">{rec.symbol || rec.symbols?.join(' & ')}</span>
                            {rec.priority && getPriorityBadge(rec.priority)}
                          </div>
                          <p className="text-muted-foreground mt-1">{rec.message}</p>
                          {rec.action && (
                            <div className="mt-1 flex items-center gap-1">
                              {rec.action === 'reduce' ? (
                                <TrendingDown className="h-3 w-3 text-destructive" />
                              ) : (
                                <TrendingUp className="h-3 w-3 text-success" />
                              )}
                              <span className="capitalize">{rec.action}</span>
                            </div>
                          )}
                        </div>
                      ))}
                      {recommendations.length > 3 && (
                        <div className="text-xs text-center text-muted-foreground">
                          +{recommendations.length - 3} mais recomendações
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {(!history || history.length === 0) && !isAnalyzing && (
          <div className="text-center py-8 text-muted-foreground">
            <Scale className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>Nenhum rebalanceamento registrado</p>
            <p className="text-xs mt-2">Execute uma análise para começar</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}