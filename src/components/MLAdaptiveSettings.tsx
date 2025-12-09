import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getUserId } from "@/lib/anonymousUser";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Brain, TrendingUp, Target, Zap, BarChart3, Clock, Shield, Lightbulb, Activity, AlertTriangle, Database, Cloud, CheckCircle2, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

interface TrainingStatus {
  step: string;
  progress: number;
  details: string;
}

export function MLAdaptiveSettings() {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [trainingStatus, setTrainingStatus] = useState<TrainingStatus | null>(null);
  const [trainingLog, setTrainingLog] = useState<string[]>([]);
  const queryClient = useQueryClient();

  const { data: mlConfig, isLoading } = useQuery({
    queryKey: ['ml-adaptive-config'],
    queryFn: async () => {
      const userId = await getUserId();
      const { data, error } = await supabase
        .from('ml_adaptive_config')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      return data;
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async (enabled: boolean) => {
      const userId = await getUserId();
      if (mlConfig) {
        const { error } = await supabase
          .from('ml_adaptive_config')
          .update({ is_enabled: enabled })
          .eq('user_id', userId);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ml-adaptive-config'] });
      toast.success(mlConfig?.is_enabled ? 'ML desativado' : 'ML ativado');
    },
  });

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString('pt-BR');
    setTrainingLog(prev => [...prev, `[${timestamp}] ${message}`]);
  };

  const runAnalysis = async () => {
    setIsAnalyzing(true);
    setTrainingLog([]);
    setTrainingStatus({ step: 'Iniciando', progress: 0, details: 'Preparando análise...' });
    
    try {
      const userId = await getUserId();
      
      // Step 1: Starting
      addLog('🚀 Iniciando análise ML...');
      setTrainingStatus({ step: 'Conectando', progress: 10, details: 'Conectando às APIs...' });
      await new Promise(r => setTimeout(r, 300));
      
      // Step 2: Call ML function
      addLog('📡 Chamando API ml-adaptive-learning...');
      setTrainingStatus({ step: 'Bybit API', progress: 25, details: 'Conectando à função de treinamento...' });
      
      const startTime = Date.now();
      const { data, error } = await supabase.functions.invoke('ml-adaptive-learning', {
        body: { userId, minTrades: 10 }
      });
      
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      addLog(`⏱️ Resposta recebida em ${elapsed}s`);
      
      if (error) {
        addLog(`❌ Erro na função: ${error.message}`);
        throw error;
      }
      
      addLog(`📦 Dados recebidos: ${JSON.stringify(data).substring(0, 100)}...`);
      
      if (data.success) {
        // Show data sources
        const dataSources = data.analysis?.dataSources || {};
        addLog(`✅ Bybit: ${dataSources.bybitTrades || 0} trades carregados`);
        setTrainingStatus({ step: 'Database', progress: 40, details: 'Carregando trades do banco de dados...' });
        await new Promise(r => setTimeout(r, 200));
        
        addLog(`✅ Database: ${dataSources.dbTrades || 0} trades carregados`);
        addLog(`📊 Total: ${data.analysis.totalTrades} trades únicos para análise`);
        
        setTrainingStatus({ step: 'Processando', progress: 60, details: 'Calculando métricas de performance...' });
        await new Promise(r => setTimeout(r, 200));
        addLog('🧮 Calculando win rate, profit factor, drawdown...');
        
        setTrainingStatus({ step: 'IA Analysis', progress: 75, details: 'IA analisando padrões...' });
        await new Promise(r => setTimeout(r, 200));
        addLog('🤖 IA processando padrões de stop loss...');
        addLog('🤖 IA identificando melhores horários...');
        addLog('🤖 IA calculando alavancagem ideal...');
        
        setTrainingStatus({ step: 'Salvando', progress: 90, details: 'Salvando configurações otimizadas...' });
        await new Promise(r => setTimeout(r, 200));
        addLog('💾 Salvando parâmetros otimizados no banco...');
        
        setTrainingStatus({ step: 'Concluído', progress: 100, details: 'Treinamento finalizado!' });
        addLog(`✨ Análise concluída com sucesso!`);
        addLog(`📈 Confiança: ${data.analysis.confidenceScore}%`);
        
        toast.success(`Análise concluída! ${data.analysis.totalTrades} trades analisados`);
        queryClient.invalidateQueries({ queryKey: ['ml-adaptive-config'] });
      } else {
        addLog(`⚠️ ${data.message || 'Dados insuficientes para análise'}`);
        setTrainingStatus({ step: 'Aviso', progress: 100, details: data.message || 'Dados insuficientes' });
        toast.warning(data.message || 'Dados insuficientes');
      }
    } catch (error) {
      console.error('Analysis error:', error);
      addLog(`❌ Erro: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
      setTrainingStatus({ step: 'Erro', progress: 0, details: 'Falha na análise' });
      toast.error('Erro ao analisar trades');
    } finally {
      setIsAnalyzing(false);
      // Keep status visible for a few seconds after completion
      setTimeout(() => {
        if (!isAnalyzing) {
          setTrainingStatus(null);
        }
      }, 5000);
    }
  };

  const getConfidenceBadge = (score: number) => {
    if (score >= 70) return <Badge className="bg-success text-success-foreground">Alta</Badge>;
    if (score >= 50) return <Badge className="bg-warning text-warning-foreground">Média</Badge>;
    return <Badge variant="secondary">Baixa</Badge>;
  };

  const patterns = mlConfig?.optimal_patterns as any;
  const dynamicStops = patterns?.dynamicStops;
  const dynamicTP = patterns?.dynamicTP;
  const learningMetrics = patterns?.learningMetrics;
  const insights = patterns?.insights || [];
  const dataSources = patterns?.dataSources;

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-card to-card/80">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Brain className="h-5 w-5 text-primary animate-pulse" />
              IA Adaptativa
            </CardTitle>
            <CardDescription className="text-xs">
              Aprende com suas operações para otimizar stops
            </CardDescription>
          </div>
          {mlConfig && (
            <div className="flex items-center gap-2">
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
          className="w-full bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70"
          size="lg"
        >
          {isAnalyzing ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Brain className="mr-2 h-4 w-4" />
          )}
          {isAnalyzing ? 'Treinando IA...' : 'Treinar IA com Histórico'}
        </Button>

        {/* Training Status Panel */}
        {(isAnalyzing || trainingStatus) && (
          <div className="space-y-3 p-3 rounded-lg bg-muted/30 border border-primary/20 animate-in fade-in-50">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {trainingStatus?.step === 'Concluído' ? (
                  <CheckCircle2 className="h-4 w-4 text-success" />
                ) : trainingStatus?.step === 'Erro' ? (
                  <AlertTriangle className="h-4 w-4 text-destructive" />
                ) : (
                  <Loader2 className="h-4 w-4 text-primary animate-spin" />
                )}
                <span className="text-sm font-medium">{trainingStatus?.step}</span>
              </div>
              <span className="text-xs text-muted-foreground">{trainingStatus?.progress}%</span>
            </div>
            
            <Progress value={trainingStatus?.progress || 0} className="h-2" />
            
            <p className="text-xs text-muted-foreground">{trainingStatus?.details}</p>
            
            {/* Training Log */}
            {trainingLog.length > 0 && (
              <div className="mt-2 max-h-32 overflow-y-auto space-y-1 p-2 rounded bg-background/50 font-mono text-[10px]">
                {trainingLog.map((log, idx) => (
                  <div key={idx} className="text-muted-foreground">{log}</div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Data Sources Info */}
        {dataSources && mlConfig && mlConfig.trades_analyzed > 0 && (
          <div className="flex items-center gap-3 p-2 rounded-lg bg-muted/20 text-xs">
            <div className="flex items-center gap-1">
              <Cloud className="h-3 w-3 text-primary" />
              <span>Bybit: {dataSources.bybitTrades || 0}</span>
            </div>
            <div className="flex items-center gap-1">
              <Database className="h-3 w-3 text-primary" />
              <span>DB: {dataSources.dbTrades || 0}</span>
            </div>
            <div className="flex items-center gap-1 text-muted-foreground">
              = {dataSources.totalUnique || mlConfig.trades_analyzed} únicos
            </div>
          </div>
        )}

        {mlConfig && mlConfig.trades_analyzed > 0 && (
          <div className="space-y-4 pt-3 border-t border-border/50">
            {/* Confiança e Status */}
            <div className="flex items-center justify-between p-2 rounded-lg bg-muted/30">
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-primary" />
                <span className="text-sm">Confiança</span>
              </div>
              <div className="flex items-center gap-2">
                {getConfidenceBadge(mlConfig.confidence_score)}
                <span className="text-xs text-muted-foreground">
                  {mlConfig.trades_analyzed} trades
                </span>
              </div>
            </div>

            {/* Stops Dinâmicos */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Shield className="h-4 w-4 text-destructive" />
                Stops Adaptativos
              </div>
              
              <div className="grid grid-cols-2 gap-2">
                <div className="p-2.5 rounded-lg bg-destructive/10 border border-destructive/20">
                  <div className="text-xs text-muted-foreground">Stop Base</div>
                  <div className="text-xl font-bold text-destructive">
                    {mlConfig.recommended_stop_loss_pct?.toFixed(2)}%
                  </div>
                </div>
                
                <div className="p-2.5 rounded-lg bg-success/10 border border-success/20">
                  <div className="text-xs text-muted-foreground">Take Profit</div>
                  <div className="text-xl font-bold text-success">
                    {mlConfig.recommended_take_profit_pct?.toFixed(2)}%
                  </div>
                </div>
              </div>

              {/* Stops por Volatilidade */}
              {dynamicStops && (
                <div className="p-2.5 rounded-lg bg-muted/30 space-y-2">
                  <div className="text-xs text-muted-foreground flex items-center gap-1">
                    <Zap className="h-3 w-3" /> Por Volatilidade
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div>
                      <div className="text-xs text-muted-foreground">Baixa</div>
                      <div className="text-sm font-semibold text-success">
                        {dynamicStops.lowVolatility?.toFixed(1)}%
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Média</div>
                      <div className="text-sm font-semibold text-warning">
                        {dynamicStops.mediumVolatility?.toFixed(1)}%
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Alta</div>
                      <div className="text-sm font-semibold text-destructive">
                        {dynamicStops.highVolatility?.toFixed(1)}%
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Métricas de Aprendizado */}
            {learningMetrics && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <BarChart3 className="h-4 w-4 text-primary" />
                  Aprendizado
                </div>
                
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-2 rounded bg-muted/30">
                    <div className="text-muted-foreground">Stops Apertados</div>
                    <div className="font-semibold flex items-center gap-1">
                      {learningMetrics.stopsTooTight > 5 && (
                        <AlertTriangle className="h-3 w-3 text-warning" />
                      )}
                      {learningMetrics.stopsTooTight}
                    </div>
                  </div>
                  <div className="p-2 rounded bg-muted/30">
                    <div className="text-muted-foreground">Taxa Stop Out</div>
                    <div className="font-semibold">{learningMetrics.stoppedOutRate}%</div>
                  </div>
                  <div className="p-2 rounded bg-muted/30">
                    <div className="text-muted-foreground">Drawdown Médio</div>
                    <div className="font-semibold">{learningMetrics.avgDrawdownBeforeWin}%</div>
                  </div>
                  <div className="p-2 rounded bg-muted/30">
                    <div className="text-muted-foreground">Profit Factor</div>
                    <div className="font-semibold">{learningMetrics.profitFactor}</div>
                  </div>
                </div>
              </div>
            )}

            {/* Configurações Extras */}
            <div className="grid grid-cols-2 gap-2">
              <div className="p-2.5 rounded-lg bg-muted/30">
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Zap className="h-3 w-3" />
                  Alavancagem
                </div>
                <div className="text-lg font-bold text-primary">
                  {mlConfig.recommended_leverage}x
                </div>
              </div>
              
              <div className="p-2.5 rounded-lg bg-muted/30">
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <TrendingUp className="h-3 w-3" />
                  R:R Ratio
                </div>
                <div className="text-lg font-bold">
                  {patterns?.riskRewardRatio?.toFixed(1) || 'N/A'}
                </div>
              </div>
            </div>

            {/* Melhores Horários */}
            {patterns?.bestHours?.length > 0 && (
              <div className="p-2.5 rounded-lg bg-muted/30">
                <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
                  <Clock className="h-3 w-3" />
                  Melhores Horários (UTC)
                </div>
                <div className="flex gap-1">
                  {patterns.bestHours.map((hour: number) => (
                    <Badge key={hour} variant="outline" className="text-xs">
                      {hour}h
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Insights da IA */}
            {insights.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Lightbulb className="h-4 w-4 text-warning" />
                  Insights
                </div>
                <div className="space-y-1">
                  {insights.slice(0, 3).map((insight: string, idx: number) => (
                    <div key={idx} className="text-xs text-muted-foreground p-2 rounded bg-muted/20">
                      • {insight}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Recomendações */}
            {patterns?.recommendations && (
              <div className="p-2.5 rounded-lg bg-primary/5 border border-primary/20">
                <div className="text-xs text-muted-foreground mb-1">Recomendação</div>
                <div className="text-xs">{patterns.recommendations}</div>
              </div>
            )}

            {mlConfig.last_analysis_at && (
              <div className="text-[10px] text-muted-foreground text-center">
                Atualizado: {new Date(mlConfig.last_analysis_at).toLocaleString('pt-BR')}
              </div>
            )}
          </div>
        )}

        {(!mlConfig || mlConfig.trades_analyzed === 0) && !isAnalyzing && (
          <div className="text-center py-6 text-muted-foreground">
            <Brain className="h-10 w-10 mx-auto mb-2 opacity-50" />
            <p className="text-sm">Execute trades para a IA aprender</p>
            <p className="text-xs mt-1">Mínimo 10 trades fechados</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}