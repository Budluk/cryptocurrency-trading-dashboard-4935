import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

interface TradeData {
  id: string;
  symbol: string;
  side: string; // Buy ou Sell
  entry_price: number;
  realized_pnl: number;
  opened_at: string;
  closed_at: string;
}

export const AdvancedPerformanceCharts = () => {
  const { data: trades } = useQuery({
    queryKey: ['closed-trades'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('auto_trader_positions')
        .select('*')
        .eq('status', 'CLOSED')
        .not('realized_pnl', 'is', null)
        .order('closed_at', { ascending: true })
        .limit(200);

      if (error) throw error;
      return data as TradeData[];
    },
    refetchInterval: 60000,
    staleTime: 30000
  });

  // Equity Curve - P&L cumulativo ao longo do tempo
  const equityCurveData = trades?.reduce((acc, trade, index) => {
    const previousEquity = index > 0 ? acc[index - 1].equity : 10000; // Começar com $10k
    const currentEquity = previousEquity + (trade.realized_pnl || 0);
    
    acc.push({
      date: new Date(trade.closed_at).toLocaleDateString(),
      equity: currentEquity,
      trade: index + 1,
    });
    
    return acc;
  }, [] as any[]) || [];

  // Distribuição de P&L
  const pnlDistribution = trades?.reduce((acc, trade) => {
    const pnl = trade.realized_pnl || 0;
    const bucket = Math.floor(pnl / 100) * 100; // Agrupar em buckets de $100
    
    const existing = acc.find(item => item.bucket === bucket);
    if (existing) {
      existing.count += 1;
    } else {
      acc.push({ bucket, count: 1, label: `$${bucket}` });
    }
    
    return acc;
  }, [] as any[]) || [];

  pnlDistribution.sort((a, b) => a.bucket - b.bucket);

  // Heatmap de Performance por Horário e Dia da Semana
  const heatmapData = trades?.reduce((acc, trade) => {
    const date = new Date(trade.closed_at);
    const dayOfWeek = date.getDay(); // 0 = Domingo
    const hour = date.getHours();
    
    const key = `${dayOfWeek}-${hour}`;
    if (!acc[key]) {
      acc[key] = {
        day: ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'][dayOfWeek],
        hour: `${hour}:00`,
        dayIndex: dayOfWeek,
        hourIndex: hour,
        pnl: 0,
        count: 0,
      };
    }
    
    acc[key].pnl += trade.realized_pnl || 0;
    acc[key].count += 1;
    
    return acc;
  }, {} as any) || {};

  const heatmapArray = Object.values(heatmapData).map((item: any) => ({
    ...item,
    avgPnl: item.count > 0 ? item.pnl / item.count : 0,
  }));

  // Performance por Ativo
  const performanceBySymbol = trades?.reduce((acc, trade) => {
    if (!acc[trade.symbol]) {
      acc[trade.symbol] = {
        symbol: trade.symbol,
        trades: 0,
        totalPnl: 0,
        wins: 0,
      };
    }
    
    acc[trade.symbol].trades += 1;
    acc[trade.symbol].totalPnl += trade.realized_pnl || 0;
    if ((trade.realized_pnl || 0) > 0) {
      acc[trade.symbol].wins += 1;
    }
    
    return acc;
  }, {} as any) || {};

  const symbolPerformance = Object.values(performanceBySymbol)
    .map((item: any) => ({
      ...item,
      winRate: (item.wins / item.trades) * 100,
    }))
    .sort((a: any, b: any) => b.totalPnl - a.totalPnl)
    .slice(0, 10);

  const getColor = (value: number) => {
    if (value > 0) return '#22c55e';
    if (value < 0) return '#ef4444';
    return '#94a3b8';
  };

  return (
    <div className="space-y-6">
      {/* Equity Curve */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Equity Curve (Evolução do Capital)</h3>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={equityCurveData}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis 
              dataKey="date" 
              stroke="hsl(var(--muted-foreground))"
              tick={{ fill: 'hsl(var(--muted-foreground))' }}
            />
            <YAxis 
              stroke="hsl(var(--muted-foreground))"
              tick={{ fill: 'hsl(var(--muted-foreground))' }}
              tickFormatter={(value) => `$${value.toLocaleString()}`}
            />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px',
              }}
              formatter={(value: any) => [`$${value.toLocaleString()}`, 'Capital']}
            />
            <Line 
              type="monotone" 
              dataKey="equity" 
              stroke="hsl(var(--primary))" 
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Distribuição de P&L */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Distribuição de P&L</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={pnlDistribution}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis 
                dataKey="label" 
                stroke="hsl(var(--muted-foreground))"
                tick={{ fill: 'hsl(var(--muted-foreground))' }}
              />
              <YAxis 
                stroke="hsl(var(--muted-foreground))"
                tick={{ fill: 'hsl(var(--muted-foreground))' }}
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                }}
              />
              <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                {pnlDistribution.map((entry, index) => (
                  <Cell key={index} fill={getColor(entry.bucket)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>

        {/* Performance por Ativo */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Top 10 Ativos por P&L</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={symbolPerformance} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis 
                type="number"
                stroke="hsl(var(--muted-foreground))"
                tick={{ fill: 'hsl(var(--muted-foreground))' }}
                tickFormatter={(value) => `$${value}`}
              />
              <YAxis 
                type="category"
                dataKey="symbol" 
                stroke="hsl(var(--muted-foreground))"
                tick={{ fill: 'hsl(var(--muted-foreground))' }}
                width={80}
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                }}
                formatter={(value: any, name: string) => {
                  if (name === 'totalPnl') return [`$${(value || 0).toFixed(2)}`, 'P&L Total'];
                  return [value, name];
                }}
              />
              <Bar dataKey="totalPnl" radius={[0, 4, 4, 0]}>
                {symbolPerformance.map((entry: any, index) => (
                  <Cell key={index} fill={getColor(entry.totalPnl)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Heatmap de Performance */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Heatmap: Performance por Dia e Horário</h3>
        <div className="overflow-x-auto">
          <div className="grid grid-cols-25 gap-1 min-w-[800px]">
            {/* Header com horários */}
            <div className="col-span-1"></div>
            {Array.from({ length: 24 }, (_, i) => (
              <div key={i} className="text-xs text-center text-muted-foreground p-1">
                {i}h
              </div>
            ))}
            
            {/* Linhas por dia da semana */}
            {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((day, dayIndex) => (
              <div key={day} className="contents">
                <div className="text-xs text-muted-foreground p-2 flex items-center">
                  {day}
                </div>
                {Array.from({ length: 24 }, (_, hourIndex) => {
                  const cell = heatmapArray.find(
                    item => item.dayIndex === dayIndex && item.hourIndex === hourIndex
                  );
                  const avgPnl = cell?.avgPnl || 0;
                  const intensity = Math.min(Math.abs(avgPnl) / 50, 1); // Normalizar para 0-1
                  
                  return (
                    <div
                      key={hourIndex}
                      className="aspect-square rounded transition-colors cursor-pointer hover:ring-2 hover:ring-primary"
                      style={{
                        backgroundColor: avgPnl > 0 
                          ? `rgba(34, 197, 94, ${intensity})` // Verde
                          : avgPnl < 0
                          ? `rgba(239, 68, 68, ${intensity})` // Vermelho
                          : 'hsl(var(--muted))',
                      }}
                      title={`${day} ${hourIndex}:00 - ${cell ? `${cell.count} trades, $${(avgPnl || 0).toFixed(2)} avg` : 'Sem dados'}`}
                    />
                  );
                })}
              </div>
            ))}
          </div>
          <div className="flex items-center justify-center gap-4 mt-4 text-xs text-muted-foreground">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded" style={{ backgroundColor: 'rgba(239, 68, 68, 0.8)' }}></div>
              <span>Perdas</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-muted"></div>
              <span>Sem dados</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded" style={{ backgroundColor: 'rgba(34, 197, 94, 0.8)' }}></div>
              <span>Lucros</span>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
};
