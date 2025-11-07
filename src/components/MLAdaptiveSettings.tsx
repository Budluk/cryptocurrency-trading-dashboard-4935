import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Brain, TrendingUp, Target, Zap, BarChart3, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export function MLAdaptiveSettings() {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const queryClient = useQueryClient();

  const { data: mlConfig, isLoading } = useQuery({
    queryKey: ['ml-adaptive-config'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('ml_adaptive_config')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      return data;
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async (enabled: boolean) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      if (mlConfig) {
        const { error } = await supabase
          .from('ml_adaptive_config')
          .update({ is_enabled: enabled })
          .eq('user_id', user.id);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ml-adaptive-config'] });
      toast.success(mlConfig?.is_enabled ? 'ML Adaptativo desativado' : 'ML Adaptativo ativado');
    },
  });

  const runAnalysis = async () => {
    setIsAnalyzing(true);
    try {
      const { data, error } = await supabase.functions.invoke('ml-adaptive-learning');
      
      if (error) throw error;
      
      if (data.success) {
        toast.success(`Análise concluída! ${data.analysis.totalTrades} trades analisados`);
        queryClient.invalidateQueries({ queryKey: ['ml-adaptive-config'] });
      } else {
        toast.warning(data.message || 'Dados insuficientes para análise');
      }
    } catch (error) {
      console.error('Analysis error:', error);
      toast.error('Erro ao analisar trades históricos');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const getConfidenceBadge = (score: number) => {
    if (score >= 80) return <Badge className="bg-success">Alta Confiança</Badge>;
    if (score >= 50) return <Badge className="bg-warning">Média Confiança</Badge>;
    return <Badge variant="secondary">Baixa Confiança</Badge>;
  };

  return (
    <Card className="border-primary/20">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Brain className="h-5 w-5 text-primary" />
              ML Adaptativo
            </CardTitle>
            <CardDescription>
              Sistema que aprende com seus trades e otimiza automaticamente
            </CardDescription>
          </div>
          {mlConfig && (
            <div className="flex items-center gap-3">
              <Label htmlFor="ml-enable">Ativar</Label>
              <Switch
                id="ml-enable"
                checked={mlConfig.is_enabled}
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
          <Brain className="mr-2 h-4 w-4" />
          {isAnalyzing ? 'Analisando...' : 'Analisar Trades Históricos'}
        </Button>

        {mlConfig && mlConfig.trades_analyzed > 0 && (
          <div className="space-y-4 pt-4 border-t">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Confiança do Modelo</span>
              {getConfidenceBadge(mlConfig.confidence_score)}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2 p-3 rounded-lg bg-muted/50">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Target className="h-4 w-4" />
                  Stop Loss Ideal
                </div>
                <div className="text-2xl font-bold text-destructive">
                  {mlConfig.recommended_stop_loss_pct}%
                </div>
              </div>

              <div className="space-y-2 p-3 rounded-lg bg-muted/50">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <TrendingUp className="h-4 w-4" />
                  Take Profit Ideal
                </div>
                <div className="text-2xl font-bold text-success">
                  {mlConfig.recommended_take_profit_pct}%
                </div>
              </div>

              <div className="space-y-2 p-3 rounded-lg bg-muted/50">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Zap className="h-4 w-4" />
                  Alavancagem Ideal
                </div>
                <div className="text-2xl font-bold text-primary">
                  {mlConfig.recommended_leverage}x
                </div>
              </div>

              <div className="space-y-2 p-3 rounded-lg bg-muted/50">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <BarChart3 className="h-4 w-4" />
                  Trades Analisados
                </div>
                <div className="text-2xl font-bold">
                  {mlConfig.trades_analyzed}
                </div>
              </div>
            </div>

            {mlConfig.optimal_patterns && typeof mlConfig.optimal_patterns === 'object' && (
              <div className="space-y-2 p-3 rounded-lg bg-muted/50">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Clock className="h-4 w-4" />
                  Melhor Horário para Operar
                </div>
                <div className="text-lg font-semibold">
                  {(mlConfig.optimal_patterns as any).bestTimeToTrade || 'N/A'}
                </div>
                <div className="text-xs text-muted-foreground">
                  R/R Ratio: {(mlConfig.optimal_patterns as any).riskRewardRatio?.toFixed(2) || 'N/A'}
                </div>
              </div>
            )}

            {mlConfig.last_analysis_at && (
              <div className="text-xs text-muted-foreground text-center">
                Última análise: {new Date(mlConfig.last_analysis_at).toLocaleString('pt-BR')}
              </div>
            )}
          </div>
        )}

        {(!mlConfig || mlConfig.trades_analyzed === 0) && !isAnalyzing && (
          <div className="text-center py-8 text-muted-foreground">
            <Brain className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>Execute a análise para começar a usar o ML adaptativo</p>
            <p className="text-xs mt-2">Mínimo de 10 trades fechados necessário</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}