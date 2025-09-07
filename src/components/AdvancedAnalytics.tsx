import { useQuery } from "@tanstack/react-query";
import { LineChart, Line, AreaChart, Area, XAxis, YAxis, ResponsiveContainer, Tooltip, PieChart, Pie, Cell } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ActivityIcon, TargetIcon, AlertCircleIcon, TrendingUpIcon } from "lucide-react";

interface PerformanceMetric {
  timeframe: string;
  accuracy: number;
  profit: number;
  trades: number;
  winRate: number;
}

interface RiskMetric {
  label: string;
  value: number;
  status: 'low' | 'medium' | 'high';
  color: string;
}

const fetchAdvancedAnalytics = async () => {
  // Simulando métricas avançadas de performance
  const performanceData: PerformanceMetric[] = [
    { timeframe: '1W', accuracy: 78, profit: 12.5, trades: 25, winRate: 72 },
    { timeframe: '1M', accuracy: 75, profit: 45.2, trades: 120, winRate: 68 },
    { timeframe: '3M', accuracy: 82, profit: 156.8, trades: 380, winRate: 74 },
    { timeframe: '6M', accuracy: 79, profit: 298.4, trades: 720, winRate: 71 },
    { timeframe: '1Y', accuracy: 76, profit: 524.6, trades: 1450, winRate: 69 }
  ];

  const riskMetrics: RiskMetric[] = [
    { label: 'Volatilidade', value: 35, status: 'medium', color: '#8884d8' },
    { label: 'Correlação BTC', value: 78, status: 'high', color: '#82ca9d' },
    { label: 'Drawdown Máximo', value: 15, status: 'low', color: '#ffc658' },
    { label: 'Beta do Mercado', value: 1.2, status: 'medium', color: '#ff7300' },
    { label: 'Sharpe Ratio', value: 2.4, status: 'high', color: '#00ff88' }
  ];

  const confidenceData = [
    { session: 'Abertura Asia', confidence: 85, volume: 2.1, trend: 'bullish' },
    { session: 'Londres', confidence: 72, volume: 3.8, trend: 'bearish' },
    { session: 'Nova York', confidence: 91, volume: 5.2, trend: 'bullish' },
    { session: 'Fechamento', confidence: 67, volume: 1.9, trend: 'neutral' }
  ];

  const technicalLevels = [
    { type: 'Resistência', price: 115500, confidence: 89, tests: 12 },
    { type: 'Suporte', price: 108200, confidence: 92, tests: 18 },
    { type: 'Resistência', price: 122000, confidence: 74, tests: 7 },
    { type: 'Suporte', price: 102500, confidence: 85, tests: 15 }
  ];

  return { performanceData, riskMetrics, confidenceData, technicalLevels };
};

const chartConfig = {
  accuracy: {
    label: "Precisão",
    color: "hsl(var(--primary))",
  },
  profit: {
    label: "Lucro (%)",
    color: "hsl(var(--chart-2))",
  },
  winRate: {
    label: "Taxa de Acerto",
    color: "hsl(var(--chart-3))",
  },
} as const;

const AdvancedAnalytics = () => {
  const { data, isLoading, error } = useQuery({
    queryKey: ['advancedAnalytics'],
    queryFn: fetchAdvancedAnalytics,
    refetchInterval: 30000,
    retry: 1,
    retryOnMount: false
  });

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 80) return 'text-success';
    if (confidence >= 60) return 'text-warning';
    return 'text-destructive';
  };

  const getTrendIcon = (trend: string) => {
    if (trend === 'bullish') return <TrendingUpIcon className="w-4 h-4 text-success" />;
    if (trend === 'bearish') return <TrendingUpIcon className="w-4 h-4 text-destructive rotate-180" />;
    return <AlertCircleIcon className="w-4 h-4 text-warning" />;
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        {[1,2,3].map(i => (
          <Card key={i} className="p-6 animate-pulse">
            <div className="h-6 bg-muted rounded mb-4"></div>
            <div className="h-32 bg-muted rounded"></div>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Performance Overview */}
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-6">
          <ActivityIcon className="w-5 h-5" />
          <h3 className="text-lg font-semibold">Performance dos Sinais</h3>
          <Badge variant="outline" className="ml-auto">Backtest Histórico</Badge>
        </div>
        
        <ChartContainer config={chartConfig} className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data?.performanceData}>
              <XAxis dataKey="timeframe" />
              <YAxis />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Line 
                type="monotone" 
                dataKey="accuracy" 
                stroke="var(--color-accuracy)" 
                strokeWidth={2}
                name="Precisão (%)"
              />
              <Line 
                type="monotone" 
                dataKey="winRate" 
                stroke="var(--color-winRate)" 
                strokeWidth={2}
                name="Taxa de Acerto (%)"
              />
            </LineChart>
          </ResponsiveContainer>
        </ChartContainer>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
          {data?.performanceData.slice(-1)[0] && (
            <>
              <div className="text-center">
                <div className="text-2xl font-bold text-success">
                  {data.performanceData.slice(-1)[0].accuracy}%
                </div>
                <div className="text-xs text-muted-foreground">Precisão</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-primary">
                  +{data.performanceData.slice(-1)[0].profit}%
                </div>
                <div className="text-xs text-muted-foreground">Lucro Total</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold">
                  {data.performanceData.slice(-1)[0].trades}
                </div>
                <div className="text-xs text-muted-foreground">Trades</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-chart-3">
                  {data.performanceData.slice(-1)[0].winRate}%
                </div>
                <div className="text-xs text-muted-foreground">Win Rate</div>
              </div>
            </>
          )}
        </div>
      </Card>

      {/* Market Sessions Confidence */}
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-6">
          <TargetIcon className="w-5 h-5" />
          <h3 className="text-lg font-semibold">Confiança por Sessão de Mercado</h3>
        </div>

        <div className="space-y-4">
          {data?.confidenceData.map((session, idx) => (
            <div key={idx} className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
              <div className="flex items-center gap-3">
                {getTrendIcon(session.trend)}
                <div>
                  <div className="font-medium text-sm">{session.session}</div>
                  <div className="text-xs text-muted-foreground">
                    Volume: ${session.volume}B
                  </div>
                </div>
              </div>
              
              <div className="text-right">
                <div className={`text-lg font-bold ${getConfidenceColor(session.confidence)}`}>
                  {session.confidence}%
                </div>
                <Progress value={session.confidence} className="w-20 h-2" />
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Risk Metrics */}
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-6">
          <AlertCircleIcon className="w-5 h-5" />
          <h3 className="text-lg font-semibold">Métricas de Risco</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {data?.riskMetrics.map((metric, idx) => (
            <div key={idx} className="flex items-center justify-between p-3 rounded-lg bg-muted/20">
              <span className="text-sm font-medium">{metric.label}</span>
              <div className="text-right">
                <span className="font-mono font-semibold">
                  {metric.value}{metric.label.includes('Ratio') ? '' : '%'}
                </span>
                <Badge 
                  variant={metric.status === 'high' ? 'default' : metric.status === 'medium' ? 'secondary' : 'outline'}
                  className="ml-2 text-xs"
                >
                  {metric.status}
                </Badge>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Technical Levels */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-6">Níveis Técnicos Críticos</h3>
        
        <div className="space-y-3">
          {data?.technicalLevels.map((level, idx) => (
            <div key={idx} className="flex items-center justify-between p-3 rounded-lg bg-muted/20">
              <div className="flex items-center gap-3">
                <Badge variant={level.type === 'Resistência' ? 'destructive' : 'default'}>
                  {level.type}
                </Badge>
                <span className="font-mono font-semibold">
                  ${level.price.toLocaleString()}
                </span>
              </div>
              
              <div className="text-right text-sm">
                <div className={`font-semibold ${getConfidenceColor(level.confidence)}`}>
                  {level.confidence}% confiança
                </div>
                <div className="text-muted-foreground">
                  {level.tests} testes
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
};

export default AdvancedAnalytics;