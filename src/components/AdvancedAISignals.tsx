import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { BrainIcon, TrendingUpIcon, TrendingDownIcon, AlertTriangleIcon, RefreshCwIcon, NewspaperIcon, BarChartIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface AIAnalysisResult {
  success: boolean;
  timestamp: number;
  symbol: string;
  timeframe: string;
  market_data: {
    price: number;
    volume: number;
    indicators: {
      rsi: number;
      macd: number;
      volume_profile: number;
      trend_strength: number;
    };
  };
  news_analysis?: {
    sentiment: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
    impact: 'HIGH' | 'MEDIUM' | 'LOW';
    summary: string;
    confidence: number;
  };
  ai_prediction?: {
    action: 'BUY' | 'SELL' | 'HOLD';
    confidence: number;
    target: number;
    stop: number;
    reasoning: string;
    timeframe: string;
    risk_level: string;
  };
  ml_score: {
    overall: number;
    factors: {
      technical_score: number;
      fundamental_score: number;
      sentiment_score: number;
      volatility_score: number;
    };
    recommendation: string;
  };
  signal: any;
  analysis_quality: {
    news_available: boolean;
    ai_prediction_available: boolean;
    confidence_level: 'HIGH' | 'MEDIUM' | 'LOW';
  };
}

const AdvancedAISignals = () => {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [selectedTimeframe, setSelectedTimeframe] = useState('1h');
  const { toast } = useToast();

  const { data: aiAnalysis, isLoading, refetch } = useQuery({
    queryKey: ['ai-analysis', selectedTimeframe],
    queryFn: async () => {
      console.log('Calling AI analysis function...');
      const { data, error } = await supabase.functions.invoke('ai-market-analysis', {
        body: { 
          timeframe: selectedTimeframe,
          symbol: 'BTC/USD',
          analysis_type: 'comprehensive'
        }
      });

      if (error) {
        console.error('AI Analysis error:', error);
        throw error;
      }

      console.log('AI Analysis result:', data);
      return data as AIAnalysisResult;
    },
    refetchInterval: 60000, // Refetch every minute
    retry: 2,
    retryDelay: 3000
  });

  const handleManualRefresh = async () => {
    setIsAnalyzing(true);
    try {
      await refetch();
      toast({
        title: "Análise atualizada!",
        description: "Nova análise de IA foi gerada com dados em tempo real.",
      });
    } catch (error) {
      toast({
        title: "Erro na análise",
        description: "Não foi possível atualizar a análise. Tente novamente.",
        variant: "destructive"
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const getSignalColor = (action: string) => {
    switch (action) {
      case 'BUY': return 'text-green-500 bg-green-500/10 border-green-500/20';
      case 'SELL': return 'text-red-500 bg-red-500/10 border-red-500/20';
      default: return 'text-yellow-500 bg-yellow-500/10 border-yellow-500/20';
    }
  };

  const getRecommendationColor = (rec: string) => {
    if (rec.includes('STRONG_BUY') || rec.includes('BUY')) return 'text-green-500';
    if (rec.includes('STRONG_SELL') || rec.includes('SELL')) return 'text-red-500';
    return 'text-yellow-500';
  };

  if (isLoading) {
    return (
      <Card className="p-6 animate-pulse">
        <div className="h-6 bg-muted rounded mb-4"></div>
        <div className="space-y-4">
          {[1,2,3,4].map(i => (
            <div key={i} className="h-16 bg-muted rounded"></div>
          ))}
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="p-6 bg-gradient-to-br from-primary/5 to-secondary/5 border-primary/20">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <BrainIcon className="w-8 h-8 text-primary" />
            <div>
              <h2 className="text-2xl font-bold">IA Avançada + Machine Learning</h2>
              <p className="text-muted-foreground">Análise multifatorial com notícias em tempo real</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex gap-2">
              {['5m', '15m', '1h', '4h', '1d'].map(tf => (
                <Button
                  key={tf}
                  variant={selectedTimeframe === tf ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedTimeframe(tf)}
                >
                  {tf}
                </Button>
              ))}
            </div>
            <Button 
              onClick={handleManualRefresh} 
              disabled={isAnalyzing}
              variant="outline"
              size="sm"
            >
              <RefreshCwIcon className={`w-4 h-4 mr-2 ${isAnalyzing ? 'animate-spin' : ''}`} />
              {isAnalyzing ? 'Analisando...' : 'Atualizar'}
            </Button>
          </div>
        </div>

        {aiAnalysis && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-background/50 rounded-lg">
              <div className="text-2xl font-bold">${(aiAnalysis.market_data?.price || 0).toFixed(2)}</div>
              <div className="text-sm text-muted-foreground">Preço Atual</div>
            </div>
            <div className="text-center p-4 bg-background/50 rounded-lg">
              <div className={`text-2xl font-bold ${getRecommendationColor(aiAnalysis.ml_score?.recommendation || '')}`}>
                {(aiAnalysis.ml_score?.overall || 0).toFixed(0)}/100
              </div>
              <div className="text-sm text-muted-foreground">ML Score</div>
            </div>
            <div className="text-center p-4 bg-background/50 rounded-lg">
              <div className="text-2xl font-bold">
                {aiAnalysis.analysis_quality.confidence_level}
              </div>
              <div className="text-sm text-muted-foreground">Qualidade</div>
            </div>
            <div className="text-center p-4 bg-background/50 rounded-lg">
              <div className="text-2xl font-bold">
                {new Date(aiAnalysis.timestamp).toLocaleTimeString()}
              </div>
              <div className="text-sm text-muted-foreground">Última Análise</div>
            </div>
          </div>
        )}
      </Card>

      {aiAnalysis && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Sinal Principal da IA */}
          {aiAnalysis.ai_prediction && (
            <Card className="p-6">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <BrainIcon className="w-5 h-5 text-primary" />
                Sinal da IA Avançada
              </h3>
              
              <div className={`p-4 rounded-lg border ${getSignalColor(aiAnalysis.ai_prediction.action)}`}>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className={`p-3 rounded-full ${
                      aiAnalysis.ai_prediction.action === 'BUY' ? 'bg-green-500/20' : 
                      aiAnalysis.ai_prediction.action === 'SELL' ? 'bg-red-500/20' : 'bg-yellow-500/20'
                    }`}>
                      {aiAnalysis.ai_prediction.action === 'BUY' ? (
                        <TrendingUpIcon className="w-6 h-6 text-green-500" />
                      ) : aiAnalysis.ai_prediction.action === 'SELL' ? (
                        <TrendingDownIcon className="w-6 h-6 text-red-500" />
                      ) : (
                        <AlertTriangleIcon className="w-6 h-6 text-yellow-500" />
                      )}
                    </div>
                    <div>
                      <div className="text-2xl font-bold">{aiAnalysis.ai_prediction.action}</div>
                      <Badge variant="outline">
                        {aiAnalysis.ai_prediction.confidence}% Confiança
                      </Badge>
                    </div>
                  </div>
                  <Badge variant="secondary">{aiAnalysis.ai_prediction.timeframe}</Badge>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <div className="text-sm text-muted-foreground">Target</div>
                    <div className="font-mono font-bold text-green-500">
                      ${(aiAnalysis.ai_prediction?.target || 0).toFixed(2)}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Stop Loss</div>
                    <div className="font-mono font-bold text-red-500">
                      ${(aiAnalysis.ai_prediction?.stop || 0).toFixed(2)}
                    </div>
                  </div>
                </div>

                <div className="p-3 bg-muted/30 rounded">
                  <div className="text-xs font-semibold text-muted-foreground mb-1">REASONING</div>
                  <div className="text-sm">{aiAnalysis.ai_prediction.reasoning}</div>
                </div>
              </div>
            </Card>
          )}

          {/* Machine Learning Score */}
          <Card className="p-6">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <BarChartIcon className="w-5 h-5 text-purple-500" />
              Machine Learning Analysis
            </h3>
            
            <div className="space-y-4">
              <div className="text-center p-4 bg-gradient-to-r from-purple-500/10 to-blue-500/10 rounded-lg">
                <div className={`text-3xl font-bold ${getRecommendationColor(aiAnalysis.ml_score.recommendation)}`}>
                  {aiAnalysis.ml_score.recommendation}
                </div>
                <div className="text-sm text-muted-foreground">ML Recommendation</div>
                <Progress value={aiAnalysis.ml_score.overall} className="mt-2" />
              </div>

              <div className="space-y-3">
                <h4 className="font-medium">Fatores de Análise</h4>
                {Object.entries(aiAnalysis.ml_score.factors).map(([key, value]) => (
                  <div key={key} className="flex justify-between items-center">
                    <span className="text-sm capitalize">{key.replace('_', ' ')}</span>
                    <div className="flex items-center gap-2">
                      <div className={`w-3 h-3 rounded-full ${
                        value > 10 ? 'bg-green-500' : 
                        value > 0 ? 'bg-yellow-500' : 'bg-red-500'
                      }`}></div>
                      <span className="text-sm font-mono w-12">{value.toFixed(0)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Card>

          {/* Análise de Notícias */}
          {aiAnalysis.news_analysis && (
            <Card className="p-6">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <NewspaperIcon className="w-5 h-5 text-blue-500" />
                Análise de Notícias (Tempo Real)
              </h3>
              
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Sentimento</span>
                  <Badge variant={
                    aiAnalysis.news_analysis.sentiment === 'BULLISH' ? 'default' :
                    aiAnalysis.news_analysis.sentiment === 'BEARISH' ? 'destructive' : 'secondary'
                  }>
                    {aiAnalysis.news_analysis.sentiment}
                  </Badge>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Impacto</span>
                  <Badge variant="outline">{aiAnalysis.news_analysis.impact}</Badge>
                </div>

                <div>
                  <span className="text-sm text-muted-foreground block mb-2">Confiança</span>
                  <Progress value={aiAnalysis.news_analysis.confidence} className="mb-1" />
                  <span className="text-xs text-muted-foreground">{aiAnalysis.news_analysis.confidence}%</span>
                </div>

                <div className="p-3 bg-muted/30 rounded">
                  <div className="text-xs font-semibold text-muted-foreground mb-1">RESUMO DAS NOTÍCIAS</div>
                  <div className="text-sm">{aiAnalysis.news_analysis.summary}</div>
                </div>
              </div>
            </Card>
          )}

          {/* Indicadores Técnicos */}
          <Card className="p-6">
            <h3 className="font-semibold mb-4">Indicadores Técnicos</h3>
            
            <div className="space-y-4">
              {Object.entries(aiAnalysis.market_data.indicators).map(([key, value]) => (
                <div key={key} className="flex justify-between items-center">
                  <span className="text-sm capitalize">{key.replace('_', ' ')}</span>
                  <div className="text-right">
                    <div className="font-mono text-sm">{value.toFixed(2)}</div>
                    <Progress 
                      value={key === 'rsi' ? value : Math.min(100, Math.abs(value))} 
                      className="w-20 h-1 mt-1" 
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 p-3 bg-muted/30 rounded">
              <div className="text-xs font-semibold text-muted-foreground mb-1">VOLUME</div>
              <div className="font-mono text-sm">
                ${(aiAnalysis.market_data.volume / 1000000000).toFixed(2)}B
              </div>
            </div>
          </Card>
        </div>
      )}

      {!aiAnalysis && !isLoading && (
        <Card className="p-8 text-center">
          <BrainIcon className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-50" />
          <h3 className="font-semibold mb-2">Análise de IA Indisponível</h3>
          <p className="text-muted-foreground mb-4">
            Não foi possível carregar a análise. Verifique sua conexão ou tente novamente.
          </p>
          <Button onClick={handleManualRefresh} disabled={isAnalyzing}>
            <RefreshCwIcon className={`w-4 h-4 mr-2 ${isAnalyzing ? 'animate-spin' : ''}`} />
            Tentar Novamente
          </Button>
        </Card>
      )}
    </div>
  );
};

export default AdvancedAISignals;