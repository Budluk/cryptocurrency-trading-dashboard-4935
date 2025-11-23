import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { TrendingUp, Activity, Zap, AlertTriangle } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar } from "recharts";
import { usePositions } from "@/contexts/PositionsContext";

interface VolatilityData {
  symbol: string;
  volatility: number;
  avgVolatility: number;
  priceChange24h: number;
  volume: number;
  scalping_score: number;
  trend: 'up' | 'down' | 'stable';
}

export const VolatilityDashboard = () => {
  const [volatilityData, setVolatilityData] = useState<VolatilityData[]>([]);
  const [highVolatilityAssets, setHighVolatilityAssets] = useState<VolatilityData[]>([]);

  // Usar posições abertas do contexto
  const { openPositions: positions } = usePositions();

  // Buscar dados históricos de mercado para calcular volatilidade
  const { data: marketData } = useQuery({
    queryKey: ['market-volatility'],
    queryFn: async () => {
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      
      const { data, error } = await supabase
        .from('market_data')
        .select('symbol, close_price, high_price, low_price, volume, timestamp')
        .gte('timestamp', twentyFourHoursAgo)
        .order('timestamp', { ascending: false });

      if (error) throw error;
      return data;
    },
    refetchInterval: false, // DESABILITADO
  });

  useEffect(() => {
    if (!marketData || marketData.length === 0) return;

    // Agrupar por símbolo e calcular volatilidade
    const symbolMap = new Map<string, any[]>();
    
    marketData.forEach(item => {
      if (!symbolMap.has(item.symbol)) {
        symbolMap.set(item.symbol, []);
      }
      symbolMap.get(item.symbol)?.push(item);
    });

    const volatilities: VolatilityData[] = [];

    symbolMap.forEach((data, symbol) => {
      if (data.length < 2) return;

      // Calcular volatilidade usando desvio padrão dos retornos
      const prices = data.map(d => d.close_price).slice(0, 24); // Últimas 24 horas
      const returns = [];
      
      for (let i = 1; i < prices.length; i++) {
        const return_val = (prices[i] - prices[i-1]) / prices[i-1];
        returns.push(return_val);
      }

      const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
      const variance = returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length;
      const volatility = Math.sqrt(variance) * 100; // Em percentual

      // Calcular variação de preço 24h
      const priceChange24h = ((prices[0] - prices[prices.length - 1]) / prices[prices.length - 1]) * 100;

      // Volume médio
      const avgVolume = data.reduce((sum, d) => sum + d.volume, 0) / data.length;

      // Score de scalping (alta volatilidade + alto volume = boa oportunidade)
      const normalizedVol = Math.min(volatility / 5, 1); // Normalizar para 0-1
      const normalizedVolume = Math.min(avgVolume / 1000000, 1); // Normalizar
      const scalping_score = (normalizedVol * 0.7 + normalizedVolume * 0.3) * 100;

      // Determinar tendência
      let trend: 'up' | 'down' | 'stable' = 'stable';
      if (priceChange24h > 2) trend = 'up';
      else if (priceChange24h < -2) trend = 'down';

      // Volatilidade média histórica (benchmark)
      const avgVolatility = 2.5; // Valor de referência

      volatilities.push({
        symbol: symbol.replace('USDT', '').replace('/USD', ''),
        volatility,
        avgVolatility,
        priceChange24h,
        volume: avgVolume,
        scalping_score,
        trend,
      });
    });

    // Ordenar por volatilidade
    volatilities.sort((a, b) => b.volatility - a.volatility);
    setVolatilityData(volatilities.slice(0, 20)); // Top 20

    // Filtrar ativos de alta volatilidade (>3% e score >60)
    const highVol = volatilities.filter(v => v.volatility > 3 && v.scalping_score > 60);
    setHighVolatilityAssets(highVol.slice(0, 5));

  }, [marketData]);

  const getVolatilityColor = (volatility: number) => {
    if (volatility > 4) return 'text-red-500';
    if (volatility > 2) return 'text-yellow-500';
    return 'text-green-500';
  };

  const getVolatilityBadge = (volatility: number) => {
    if (volatility > 4) return { variant: 'destructive' as const, label: 'Alta' };
    if (volatility > 2) return { variant: 'default' as const, label: 'Média' };
    return { variant: 'secondary' as const, label: 'Baixa' };
  };

  return (
    <div className="space-y-6">
      {/* Oportunidades de Scalping */}
      {highVolatilityAssets.length > 0 && (
        <Card className="p-6 border-2 border-primary/50 bg-primary/5">
          <div className="flex items-center gap-2 mb-4">
            <Zap className="w-5 h-5 text-primary animate-pulse" />
            <h3 className="text-lg font-semibold">🎯 Oportunidades High-Volatility</h3>
            <Badge variant="default" className="animate-pulse">
              {highVolatilityAssets.length} Ativos
            </Badge>
          </div>

          <div className="grid gap-3">
            {highVolatilityAssets.map((asset) => (
              <div 
                key={asset.symbol}
                className="p-4 bg-background rounded-lg border-2 border-primary/30 hover:border-primary/60 transition-all"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-full bg-primary/20">
                      <Activity className="w-4 h-4 text-primary" />
                    </div>
                    <div>
                      <h4 className="font-bold text-lg">{asset.symbol}</h4>
                      <p className="text-xs text-muted-foreground">Score: {asset.scalping_score.toFixed(0)}/100</p>
                    </div>
                  </div>
                  <Badge variant="default" className="text-lg px-3 py-1">
                    {asset.volatility.toFixed(2)}%
                  </Badge>
                </div>

                <div className="grid grid-cols-3 gap-2 text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground">Variação 24h</p>
                    <p className={`font-semibold ${asset.priceChange24h > 0 ? 'text-green-500' : 'text-red-500'}`}>
                      {asset.priceChange24h > 0 ? '+' : ''}{asset.priceChange24h.toFixed(2)}%
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Volume</p>
                    <p className="font-semibold">${(asset.volume / 1000).toFixed(0)}K</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Tendência</p>
                    <p className="font-semibold flex items-center gap-1">
                      {asset.trend === 'up' && <TrendingUp className="w-3 h-3 text-green-500" />}
                      {asset.trend === 'down' && <TrendingUp className="w-3 h-3 text-red-500 rotate-180" />}
                      {asset.trend === 'stable' && '→'}
                      {asset.trend.toUpperCase()}
                    </p>
                  </div>
                </div>

                <div className="mt-2">
                  <Progress value={asset.scalping_score} className="h-2" />
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Gráfico de Volatilidade Comparativa */}
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-6">
          <Activity className="w-5 h-5 text-primary" />
          <h3 className="text-lg font-semibold">Volatilidade Implícita por Ativo</h3>
        </div>

        {volatilityData.length > 0 ? (
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={volatilityData.slice(0, 10)}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
              <XAxis 
                dataKey="symbol" 
                tick={{ fontSize: 12 }}
                angle={-45}
                textAnchor="end"
                height={80}
              />
              <YAxis 
                label={{ value: 'Volatilidade (%)', angle: -90, position: 'insideLeft' }}
                tick={{ fontSize: 12 }}
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'hsl(var(--background))', 
                  border: '1px solid hsl(var(--border))' 
                }}
              />
              <Legend />
              <Bar 
                dataKey="volatility" 
                fill="hsl(var(--primary))" 
                name="Volatilidade Atual"
                radius={[8, 8, 0, 0]}
              />
              <Bar 
                dataKey="avgVolatility" 
                fill="hsl(var(--muted))" 
                name="Média Histórica"
                radius={[8, 8, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="text-center py-12 text-muted-foreground">
            <Activity className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>Aguardando dados de mercado...</p>
          </div>
        )}
      </Card>

      {/* Tabela de Volatilidade Detalhada */}
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-6">
          <AlertTriangle className="w-5 h-5 text-primary" />
          <h3 className="text-lg font-semibold">Ranking de Volatilidade</h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left p-3 text-sm font-semibold">#</th>
                <th className="text-left p-3 text-sm font-semibold">Ativo</th>
                <th className="text-left p-3 text-sm font-semibold">Volatilidade</th>
                <th className="text-left p-3 text-sm font-semibold">Var. 24h</th>
                <th className="text-left p-3 text-sm font-semibold">Score Scalping</th>
                <th className="text-left p-3 text-sm font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {volatilityData.slice(0, 15).map((asset, index) => {
                const badge = getVolatilityBadge(asset.volatility);
                return (
                  <tr key={asset.symbol} className="border-b border-border/50 hover:bg-muted/30">
                    <td className="p-3 text-sm font-semibold">{index + 1}</td>
                    <td className="p-3 text-sm font-bold">{asset.symbol}</td>
                    <td className="p-3">
                      <span className={`text-sm font-bold ${getVolatilityColor(asset.volatility)}`}>
                        {asset.volatility.toFixed(2)}%
                      </span>
                    </td>
                    <td className="p-3">
                      <span className={`text-sm font-semibold ${asset.priceChange24h > 0 ? 'text-green-500' : 'text-red-500'}`}>
                        {asset.priceChange24h > 0 ? '+' : ''}{asset.priceChange24h.toFixed(2)}%
                      </span>
                    </td>
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <Progress value={asset.scalping_score} className="h-2 w-20" />
                        <span className="text-xs font-semibold">{asset.scalping_score.toFixed(0)}</span>
                      </div>
                    </td>
                    <td className="p-3">
                      <Badge variant={badge.variant}>{badge.label}</Badge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {volatilityData.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            Nenhum dado disponível. Aguarde o sistema coletar dados de mercado.
          </div>
        )}
      </Card>
    </div>
  );
};
