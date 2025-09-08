import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip, Area, AreaChart } from "recharts";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CalendarIcon, TrendingUpIcon, BarChartIcon } from "lucide-react";

interface ProjectionData {
  date: string;
  price: number;
  confidence: number;
  scenario: 'bullish' | 'neutral' | 'bearish';
}

interface TimeframeProjection {
  timeframe: string;
  data: ProjectionData[];
  target_high: number;
  target_low: number;
  probability: number;
  key_factors: string[];
}

const fetchMarketProjections = async () => {
  const basePrice = 111000;
  
  const projections: TimeframeProjection[] = [
    {
      timeframe: 'Intraday',
      data: Array.from({ length: 24 }, (_, i) => ({
        date: `${String(i).padStart(2, '0')}:00`,
        price: basePrice + (Math.sin(i * 0.5) * 1000) + (Math.random() - 0.5) * 500,
        confidence: 85 - (i * 2) + Math.random() * 10,
        scenario: Math.random() > 0.6 ? 'bullish' : Math.random() > 0.3 ? 'bearish' : 'neutral'
      })),
      target_high: basePrice + 2500,
      target_low: basePrice - 1800,
      probability: 78,
      key_factors: ['Volume breakout pattern', 'Options flow bullish', 'Technical resistance test']
    },
    {
      timeframe: 'Semanal',
      data: Array.from({ length: 7 }, (_, i) => ({
        date: ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'][i],
        price: basePrice + (i * 800) + (Math.random() - 0.5) * 2000,
        confidence: 80 + Math.random() * 15,
        scenario: Math.random() > 0.5 ? 'bullish' : 'neutral'
      })),
      target_high: basePrice + 8500,
      target_low: basePrice - 5200,
      probability: 72,
      key_factors: ['Fed decision impact', 'Institutional adoption', 'Macro trends alignment']
    },
    {
      timeframe: 'Mensal',
      data: Array.from({ length: 30 }, (_, i) => ({
        date: `Dia ${i + 1}`,
        price: basePrice + (i * 400) + (Math.sin(i * 0.3) * 3000) + (Math.random() - 0.5) * 1500,
        confidence: 75 + Math.random() * 20,
        scenario: Math.random() > 0.4 ? 'bullish' : 'neutral'
      })),
      target_high: basePrice + 25000,
      target_low: basePrice - 15000,
      probability: 68,
      key_factors: ['Halving effects', 'ETF flows', 'Global adoption trends']
    },
    {
      timeframe: 'Anual',
      data: Array.from({ length: 12 }, (_, i) => ({
        date: ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'][i],
        price: basePrice + (i * 5000) + (Math.sin(i * 0.5) * 15000) + (Math.random() - 0.5) * 8000,
        confidence: 60 + Math.random() * 25,
        scenario: Math.random() > 0.3 ? 'bullish' : 'neutral'
      })),
      target_high: basePrice + 80000,
      target_low: basePrice - 35000,
      probability: 62,
      key_factors: ['Market cycle patterns', 'Regulatory clarity', 'Mass adoption curve']
    }
  ];

  return projections;
};

const MarketProjections = () => {
  const [selectedTimeframe, setSelectedTimeframe] = useState('Intraday');
  
  const { data: projections, isLoading } = useQuery({
    queryKey: ['marketProjections'],
    queryFn: fetchMarketProjections,
    refetchInterval: 30000
  });

  const currentProjection = projections?.find(p => p.timeframe === selectedTimeframe);

  if (isLoading) {
    return (
      <Card className="p-6 animate-pulse">
        <div className="h-6 bg-muted rounded mb-4"></div>
        <div className="h-64 bg-muted rounded mb-4"></div>
        <div className="space-y-2">
          {[1,2,3].map(i => (
            <div key={i} className="h-4 bg-muted rounded"></div>
          ))}
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xl font-bold flex items-center gap-2">
          <BarChartIcon className="w-5 h-5 text-primary" />
          Projeções IA - BTC/USD
        </h3>
        <div className="flex gap-2">
          {projections?.map(projection => (
            <button
              key={projection.timeframe}
              onClick={() => setSelectedTimeframe(projection.timeframe)}
              className={`px-3 py-1 rounded-md text-sm font-medium transition-all ${
                selectedTimeframe === projection.timeframe 
                  ? 'bg-primary text-primary-foreground' 
                  : 'bg-secondary hover:bg-secondary/80'
              }`}
            >
              {projection.timeframe}
            </button>
          ))}
        </div>
      </div>

      {currentProjection && (
        <>
          {/* Métricas de Projeção */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="text-center p-4 bg-green-500/10 rounded-lg border border-green-500/20">
              <div className="text-lg font-bold text-green-600">${currentProjection.target_high.toLocaleString()}</div>
              <div className="text-xs text-muted-foreground">Alvo Máximo</div>
            </div>
            <div className="text-center p-4 bg-red-500/10 rounded-lg border border-red-500/20">
              <div className="text-lg font-bold text-red-600">${currentProjection.target_low.toLocaleString()}</div>
              <div className="text-xs text-muted-foreground">Alvo Mínimo</div>
            </div>
            <div className="text-center p-4 bg-blue-500/10 rounded-lg border border-blue-500/20">
              <div className="text-lg font-bold text-blue-600">{currentProjection.probability}%</div>
              <div className="text-xs text-muted-foreground">Probabilidade</div>
            </div>
            <div className="text-center p-4 bg-purple-500/10 rounded-lg border border-purple-500/20">
              <div className="text-lg font-bold text-purple-600">
                {(currentProjection.data.reduce((acc, d) => acc + d.confidence, 0) / currentProjection.data.length).toFixed(0)}%
              </div>
              <div className="text-xs text-muted-foreground">Confiança Média</div>
            </div>
          </div>

          {/* Gráfico de Projeção */}
          <div className="h-80 mb-6">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={currentProjection.data}>
                <defs>
                  <linearGradient id="priceGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8884d8" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#8884d8" stopOpacity={0.1}/>
                  </linearGradient>
                </defs>
                <XAxis 
                  dataKey="date" 
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={12}
                />
                <YAxis 
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={12}
                  tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px'
                  }}
                  formatter={(value: any, name) => [
                    `$${Number(value).toLocaleString()}`,
                    'Preço Projetado'
                  ]}
                />
                <Area 
                  type="monotone" 
                  dataKey="price" 
                  stroke="#8884d8" 
                  fillOpacity={1}
                  fill="url(#priceGradient)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Fatores Chave */}
          <div className="space-y-4">
            <h4 className="font-semibold flex items-center gap-2">
              <CalendarIcon className="w-4 h-4" />
              Fatores Chave para {currentProjection.timeframe}
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {currentProjection.key_factors.map((factor, idx) => (
                <div key={idx} className="p-3 bg-muted/30 rounded-lg">
                  <div className="flex items-center gap-2">
                    <TrendingUpIcon className="w-4 h-4 text-primary" />
                    <span className="text-sm font-medium">{factor}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Cenários */}
          <div className="mt-6 p-4 bg-muted/20 rounded-lg">
            <h4 className="font-semibold mb-3">Análise de Cenários</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div>
                <Badge variant="default" className="mb-2 bg-green-500">Bullish</Badge>
                <p className="text-muted-foreground">
                  {currentProjection.data.filter(d => d.scenario === 'bullish').length} pontos de dados indicam tendência de alta
                </p>
              </div>
              <div>
                <Badge variant="secondary" className="mb-2">Neutral</Badge>
                <p className="text-muted-foreground">
                  {currentProjection.data.filter(d => d.scenario === 'neutral').length} pontos indicam consolidação
                </p>
              </div>
              <div>
                <Badge variant="destructive" className="mb-2">Bearish</Badge>
                <p className="text-muted-foreground">
                  {currentProjection.data.filter(d => d.scenario === 'bearish').length} pontos indicam pressão de baixa
                </p>
              </div>
            </div>
          </div>
        </>
      )}
    </Card>
  );
};

export default MarketProjections;