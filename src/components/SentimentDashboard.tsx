import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { TrendingUp, TrendingDown, Minus, RefreshCw, AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export function SentimentDashboard() {
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const { data: sentiments, refetch } = useQuery({
    queryKey: ['sentiment-analysis'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sentiment_analysis')
        .select('*')
        .gte('analyzed_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .order('analyzed_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      return data;
    },
    refetchInterval: 60000, // 1 minuto
  });

  const runAnalysis = async () => {
    setIsAnalyzing(true);
    try {
      const { data, error } = await supabase.functions.invoke('sentiment-analysis', {
        body: { symbols: ['BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT'] }
      });

      if (error) throw error;

      toast.success(`Análise concluída! ${data.current_analysis.length} ativos analisados`);
      refetch();
    } catch (error) {
      console.error('Analysis error:', error);
      toast.error('Erro ao analisar sentimento');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const getSentimentIcon = (score: number) => {
    if (score > 0.2) return <TrendingUp className="h-5 w-5 text-success" />;
    if (score < -0.2) return <TrendingDown className="h-5 w-5 text-destructive" />;
    return <Minus className="h-5 w-5 text-muted-foreground" />;
  };

  const getSentimentBadge = (score: number) => {
    if (score > 0.2) return <Badge className="bg-success">Bullish</Badge>;
    if (score < -0.2) return <Badge variant="destructive">Bearish</Badge>;
    return <Badge variant="secondary">Neutro</Badge>;
  };

  // Calcular resumo
  const summary = sentiments ? {
    bullish: sentiments.filter(s => s.sentiment_score > 0.2).length,
    bearish: sentiments.filter(s => s.sentiment_score < -0.2).length,
    neutral: sentiments.filter(s => Math.abs(s.sentiment_score) <= 0.2).length,
    avgScore: sentiments.reduce((sum, s) => sum + s.sentiment_score, 0) / sentiments.length,
  } : null;

  return (
    <Card className="border-primary/20">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-primary" />
              Sentiment Analysis
            </CardTitle>
            <CardDescription>
              Análise de sentimento em tempo real de notícias e social media
            </CardDescription>
          </div>
          <Button
            onClick={runAnalysis}
            disabled={isAnalyzing}
            size="sm"
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${isAnalyzing ? 'animate-spin' : ''}`} />
            {isAnalyzing ? 'Analisando...' : 'Atualizar'}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {summary && (
          <div className="grid grid-cols-4 gap-4">
            <div className="p-3 rounded-lg bg-success/10 border border-success/20">
              <div className="text-2xl font-bold text-success">{summary.bullish}</div>
              <div className="text-xs text-muted-foreground">Bullish</div>
            </div>
            <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
              <div className="text-2xl font-bold text-destructive">{summary.bearish}</div>
              <div className="text-xs text-muted-foreground">Bearish</div>
            </div>
            <div className="p-3 rounded-lg bg-muted/50">
              <div className="text-2xl font-bold">{summary.neutral}</div>
              <div className="text-xs text-muted-foreground">Neutro</div>
            </div>
            <div className="p-3 rounded-lg bg-primary/10 border border-primary/20">
              <div className="text-2xl font-bold text-primary">
                {(summary.avgScore * 100).toFixed(0)}
              </div>
              <div className="text-xs text-muted-foreground">Score Médio</div>
            </div>
          </div>
        )}

        <div className="space-y-2">
          {sentiments && sentiments.length > 0 ? (
            sentiments.map((sentiment) => (
              <div
                key={sentiment.id}
                className="p-3 rounded-lg bg-muted/30 border border-border/50 hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3 flex-1">
                    {getSentimentIcon(sentiment.sentiment_score)}
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold">{sentiment.symbol}</span>
                        {getSentimentBadge(sentiment.sentiment_score)}
                        <Badge variant="outline" className="text-xs">
                          {sentiment.source}
                        </Badge>
                      </div>
                      {sentiment.content && (
                        <p className="text-sm text-muted-foreground mb-2">
                          {sentiment.content}
                        </p>
                      )}
                      {sentiment.keywords && sentiment.keywords.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {sentiment.keywords.map((keyword: string, idx: number) => (
                            <span
                              key={idx}
                              className="text-xs px-2 py-1 rounded bg-primary/10 text-primary"
                            >
                              {keyword}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold">
                      {(sentiment.sentiment_score * 100).toFixed(0)}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {sentiment.confidence.toFixed(0)}% conf.
                    </div>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <AlertCircle className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>Nenhuma análise recente</p>
              <p className="text-xs mt-2">Clique em "Atualizar" para iniciar</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}