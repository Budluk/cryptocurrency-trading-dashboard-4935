import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TrendingUpIcon, TrendingDownIcon, ActivityIcon, TargetIcon, ShieldIcon, CalendarIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';

interface PerformanceData {
  total_trades: number;
  winning_trades: number;
  win_rate: number;
  total_pnl: number;
  profit_factor: number;
  max_drawdown: number;
}

interface SignalHistory {
  id: string;
  signal_type: string;
  action: string;
  symbol: string;
  entry_price: number;
  target_price: number;
  confidence: number;
  actual_outcome: string;
  pnl_percentage: number;
  created_at: string;
  status: string;
}

const PerformanceDashboard = () => {
  const [period, setPeriod] = useState('7d');
  const [selectedMetric, setSelectedMetric] = useState('pnl');

  const { data: performance, isLoading: performanceLoading } = useQuery({
    queryKey: ['trading-performance', period],
    queryFn: async () => {
      const endDate = new Date();
      const startDate = new Date();
      
      switch (period) {
        case '1d':
          startDate.setDate(endDate.getDate() - 1);
          break;
        case '7d':
          startDate.setDate(endDate.getDate() - 7);
          break;
        case '30d':
          startDate.setDate(endDate.getDate() - 30);
          break;
        case '90d':
          startDate.setDate(endDate.getDate() - 90);
          break;
      }

      const { data, error } = await supabase.rpc('calculate_trading_performance', {
        user_uuid: null, // Will use auth.uid() in the function
        start_date: startDate.toISOString().split('T')[0],
        end_date: endDate.toISOString().split('T')[0]
      });

      if (error) throw error;
      return data?.[0] as PerformanceData;
    },
    refetchInterval: 30000
  });

  const { data: signalHistory } = useQuery({
    queryKey: ['signal-history', period],
    queryFn: async () => {
      const endDate = new Date();
      const startDate = new Date();
      
      switch (period) {
        case '1d':
          startDate.setDate(endDate.getDate() - 1);
          break;
        case '7d':
          startDate.setDate(endDate.getDate() - 7);
          break;
        case '30d':
          startDate.setDate(endDate.getDate() - 30);
          break;
        case '90d':
          startDate.setDate(endDate.getDate() - 90);
          break;
      }

      const { data, error } = await supabase
        .from('signal_history')
        .select('*')
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString())
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      return data as SignalHistory[];
    },
    refetchInterval: 30000
  });

  // Preparar dados para gráficos
  const chartData = signalHistory?.reduce((acc, signal, index) => {
    const date = new Date(signal.created_at).toLocaleDateString();
    const existingEntry = acc.find(entry => entry.date === date);
    
    if (existingEntry) {
      existingEntry.signals += 1;
      existingEntry.cumulative_pnl += signal.pnl_percentage || 0;
    } else {
      acc.push({
        date,
        signals: 1,
        cumulative_pnl: signal.pnl_percentage || 0,
        win_rate: signal.actual_outcome === 'WIN' ? 100 : 0
      });
    }
    
    return acc;
  }, [] as any[]) || [];

  const getPerformanceColor = (value: number, type: 'pnl' | 'percentage') => {
    if (type === 'pnl') {
      return value > 0 ? 'text-green-500' : value < 0 ? 'text-red-500' : 'text-muted-foreground';
    }
    return value > 60 ? 'text-green-500' : value > 40 ? 'text-yellow-500' : 'text-red-500';
  };

  if (performanceLoading) {
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
      {/* Header com controles */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold mb-2">Dashboard de Performance</h2>
          <p className="text-muted-foreground">Análise detalhada dos sinais e resultados</p>
        </div>
        <div className="flex gap-3">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1d">1 Dia</SelectItem>
              <SelectItem value="7d">7 Dias</SelectItem>
              <SelectItem value="30d">30 Dias</SelectItem>
              <SelectItem value="90d">90 Dias</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Métricas Principais */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-sm text-muted-foreground">TOTAL DE SINAIS</h3>
            <ActivityIcon className="w-5 h-5 text-primary" />
          </div>
          <div className="text-3xl font-bold">{performance?.total_trades || 0}</div>
          <p className="text-sm text-muted-foreground mt-2">
            {period === '1d' ? 'Hoje' : `Últimos ${period}`}
          </p>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-sm text-muted-foreground">WIN RATE</h3>
            <TargetIcon className="w-5 h-5 text-green-500" />
          </div>
          <div className={`text-3xl font-bold ${getPerformanceColor(performance?.win_rate || 0, 'percentage')}`}>
            {performance?.win_rate?.toFixed(1) || '0.0'}%
          </div>
          <Progress value={performance?.win_rate || 0} className="mt-3" />
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-sm text-muted-foreground">P&L TOTAL</h3>
            {(performance?.total_pnl || 0) > 0 ? 
              <TrendingUpIcon className="w-5 h-5 text-green-500" /> : 
              <TrendingDownIcon className="w-5 h-5 text-red-500" />
            }
          </div>
          <div className={`text-3xl font-bold ${getPerformanceColor(performance?.total_pnl || 0, 'pnl')}`}>
            ${performance?.total_pnl?.toFixed(2) || '0.00'}
          </div>
          <p className="text-sm text-muted-foreground mt-2">
            {performance?.winning_trades || 0} vitórias de {performance?.total_trades || 0}
          </p>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-sm text-muted-foreground">PROFIT FACTOR</h3>
            <ShieldIcon className="w-5 h-5 text-blue-500" />
          </div>
          <div className={`text-3xl font-bold ${getPerformanceColor(performance?.profit_factor || 0, 'pnl')}`}>
            {performance?.profit_factor?.toFixed(2) || '0.00'}
          </div>
          <p className="text-sm text-muted-foreground mt-2">
            Drawdown: {performance?.max_drawdown?.toFixed(1) || '0.0'}%
          </p>
        </Card>
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Gráfico de P&L Cumulativo */}
        <Card className="p-6">
          <h3 className="font-semibold mb-4">P&L Cumulativo</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip 
                formatter={(value: any, name: string) => [
                  `${value.toFixed(2)}%`, 
                  name === 'cumulative_pnl' ? 'P&L' : name
                ]}
              />
              <Line 
                type="monotone" 
                dataKey="cumulative_pnl" 
                stroke="hsl(var(--primary))" 
                strokeWidth={2}
                dot={{ fill: 'hsl(var(--primary))' }}
              />
            </LineChart>
          </ResponsiveContainer>
        </Card>

        {/* Gráfico de Distribuição de Sinais */}
        <Card className="p-6">
          <h3 className="font-semibold mb-4">Sinais por Dia</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="signals" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Histórico de Sinais */}
      <Card className="p-6">
        <h3 className="font-semibold mb-4">Histórico Recente</h3>
        <div className="space-y-3 max-h-80 overflow-y-auto">
          {signalHistory?.slice(0, 10).map((signal) => (
            <div key={signal.id} className="flex items-center justify-between p-4 bg-muted/30 rounded-lg">
              <div className="flex items-center gap-4">
                <div className={`p-2 rounded-full ${
                  signal.action === 'BUY' ? 'bg-green-500/20' : 
                  signal.action === 'SELL' ? 'bg-red-500/20' : 'bg-yellow-500/20'
                }`}>
                  {signal.action === 'BUY' ? (
                    <TrendingUpIcon className="w-4 h-4 text-green-500" />
                  ) : signal.action === 'SELL' ? (
                    <TrendingDownIcon className="w-4 h-4 text-red-500" />
                  ) : (
                    <ActivityIcon className="w-4 h-4 text-yellow-500" />
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{signal.action}</span>
                    <Badge variant="outline" className="text-xs">{signal.signal_type}</Badge>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    ${signal.entry_price.toFixed(2)} • {signal.confidence}% confiança
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className={`font-semibold ${
                  signal.actual_outcome === 'WIN' ? 'text-green-500' :
                  signal.actual_outcome === 'LOSS' ? 'text-red-500' : 'text-muted-foreground'
                }`}>
                  {signal.pnl_percentage ? `${signal.pnl_percentage > 0 ? '+' : ''}${signal.pnl_percentage.toFixed(2)}%` : 'Pendente'}
                </div>
                <div className="text-xs text-muted-foreground">
                  {new Date(signal.created_at).toLocaleDateString()}
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
};

export default PerformanceDashboard;