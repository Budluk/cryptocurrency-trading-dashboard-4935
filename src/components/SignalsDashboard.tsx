import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TrendingUp, TrendingDown, Minus, Activity, Volume2, Target, Shield, CheckCircle2 } from "lucide-react";
import { useState, useEffect } from "react";

interface TechnicalSignal {
  id: string;
  symbol: string;
  action: "BUY" | "SELL" | "HOLD";
  score: number;
  confirmations: number;
  timestamp: Date;
  metrics: {
    volatility: number;
    volume24h: number;
    priceChange: number;
    pricePosition: string;
    trend: string;
  };
  technicalFactors: string[];
  reasoning: string;
}

export function SignalsDashboard() {
  const [signals, setSignals] = useState<TechnicalSignal[]>([]);
  const [filter, setFilter] = useState<"ALL" | "BUY" | "SELL" | "HOLD">("ALL");

  useEffect(() => {
    // Listen for custom events from MultiAssetTrader
    const handleSignal = (event: any) => {
      const newSignal: TechnicalSignal = {
        id: `${event.detail.symbol}-${Date.now()}`,
        ...event.detail,
        timestamp: new Date(),
      };
      
      setSignals(prev => [newSignal, ...prev].slice(0, 50)); // Keep last 50 signals
    };

    window.addEventListener('trading-signal', handleSignal);
    return () => window.removeEventListener('trading-signal', handleSignal);
  }, []);

  const filteredSignals = signals.filter(s => 
    filter === "ALL" ? true : s.action === filter
  );

  const getActionIcon = (action: string) => {
    switch (action) {
      case "BUY": return <TrendingUp className="h-5 w-5" />;
      case "SELL": return <TrendingDown className="h-5 w-5" />;
      default: return <Minus className="h-5 w-5" />;
    }
  };

  const getActionColor = (action: string) => {
    switch (action) {
      case "BUY": return "text-green-500";
      case "SELL": return "text-red-500";
      default: return "text-yellow-500";
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 85) return "text-green-500";
    if (score >= 70) return "text-yellow-500";
    return "text-orange-500";
  };

  const stats = {
    total: signals.length,
    buy: signals.filter(s => s.action === "BUY").length,
    sell: signals.filter(s => s.action === "SELL").length,
    avgScore: signals.length > 0 
      ? (signals.reduce((sum, s) => sum + s.score, 0) / signals.length).toFixed(1)
      : "0",
    premium: signals.filter(s => s.score >= 85).length,
  };

  return (
    <div className="space-y-4">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground">Total Sinais</div>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground">Compra</div>
            <div className="text-2xl font-bold text-green-500">{stats.buy}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground">Venda</div>
            <div className="text-2xl font-bold text-red-500">{stats.sell}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground">Score Médio</div>
            <div className="text-2xl font-bold">{stats.avgScore}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground">Premium</div>
            <div className="text-2xl font-bold text-yellow-500">{stats.premium}</div>
          </CardContent>
        </Card>
      </div>

      {/* Main Dashboard */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Sinais em Tempo Real
            </CardTitle>
            <Badge variant="outline" className="animate-pulse">
              Live
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs value={filter} onValueChange={(v) => setFilter(v as any)} className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="ALL">Todos ({signals.length})</TabsTrigger>
              <TabsTrigger value="BUY">Compra ({stats.buy})</TabsTrigger>
              <TabsTrigger value="SELL">Venda ({stats.sell})</TabsTrigger>
              <TabsTrigger value="HOLD">Hold ({signals.filter(s => s.action === "HOLD").length})</TabsTrigger>
            </TabsList>

            <TabsContent value={filter} className="space-y-3 mt-4">
              {filteredSignals.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Activity className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>Aguardando sinais de trading...</p>
                  <p className="text-sm mt-1">Os sinais aparecerão aqui em tempo real</p>
                </div>
              ) : (
                filteredSignals.map((signal) => (
                  <Card key={signal.id} className="border-l-4" style={{
                    borderLeftColor: signal.action === "BUY" ? "rgb(34, 197, 94)" : 
                                    signal.action === "SELL" ? "rgb(239, 68, 68)" : 
                                    "rgb(234, 179, 8)"
                  }}>
                    <CardContent className="p-4">
                      <div className="space-y-4">
                        {/* Header */}
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-lg bg-background ${getActionColor(signal.action)}`}>
                              {getActionIcon(signal.action)}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <h3 className="font-bold text-lg">{signal.symbol}</h3>
                                <Badge variant={signal.action === "BUY" ? "default" : "destructive"}>
                                  {signal.action}
                                </Badge>
                                {signal.score >= 85 && (
                                  <Badge variant="outline" className="bg-yellow-500/10 text-yellow-500 border-yellow-500/20">
                                    Premium
                                  </Badge>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground">
                                {signal.timestamp.toLocaleTimeString('pt-BR')}
                              </p>
                            </div>
                          </div>
                          
                          <div className="text-right">
                            <div className={`text-2xl font-bold ${getScoreColor(signal.score)}`}>
                              {signal.score}
                            </div>
                            <p className="text-xs text-muted-foreground">Score</p>
                          </div>
                        </div>

                        {/* Score Progress */}
                        <div className="space-y-1">
                          <div className="flex justify-between text-sm">
                            <span>Qualidade do Sinal</span>
                            <span className={getScoreColor(signal.score)}>{signal.score}/100</span>
                          </div>
                          <Progress value={signal.score} className="h-2" />
                        </div>

                        {/* Technical Confirmations */}
                        <div className="grid grid-cols-2 gap-3">
                          <div className="flex items-center gap-2 text-sm">
                            <CheckCircle2 className="h-4 w-4 text-green-500" />
                            <span className="text-muted-foreground">Confirmações:</span>
                            <span className="font-semibold">{signal.confirmations}</span>
                          </div>
                          <div className="flex items-center gap-2 text-sm">
                            <Activity className="h-4 w-4 text-blue-500" />
                            <span className="text-muted-foreground">Volatilidade:</span>
                            <span className="font-semibold">{signal.metrics.volatility.toFixed(2)}%</span>
                          </div>
                          <div className="flex items-center gap-2 text-sm">
                            <Volume2 className="h-4 w-4 text-purple-500" />
                            <span className="text-muted-foreground">Volume 24h:</span>
                            <span className="font-semibold">
                              ${(signal.metrics.volume24h / 1000000).toFixed(1)}M
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-sm">
                            <Target className="h-4 w-4 text-orange-500" />
                            <span className="text-muted-foreground">Variação:</span>
                            <span className={`font-semibold ${signal.metrics.priceChange > 0 ? 'text-green-500' : 'text-red-500'}`}>
                              {signal.metrics.priceChange > 0 ? '+' : ''}{signal.metrics.priceChange.toFixed(2)}%
                            </span>
                          </div>
                        </div>

                        {/* Metrics Badges */}
                        <div className="flex flex-wrap gap-2">
                          <Badge variant="outline" className="text-xs">
                            {signal.metrics.pricePosition}
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            {signal.metrics.trend}
                          </Badge>
                        </div>

                        {/* Technical Factors */}
                        {signal.technicalFactors && signal.technicalFactors.length > 0 && (
                          <div className="space-y-2">
                            <div className="flex items-center gap-2 text-sm font-medium">
                              <Shield className="h-4 w-4" />
                              Fatores Técnicos:
                            </div>
                            <div className="flex flex-wrap gap-1">
                              {signal.technicalFactors.map((factor, idx) => (
                                <Badge key={idx} variant="secondary" className="text-xs">
                                  {factor}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Reasoning */}
                        {signal.reasoning && (
                          <div className="text-sm text-muted-foreground bg-muted/30 p-3 rounded-lg">
                            {signal.reasoning}
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
