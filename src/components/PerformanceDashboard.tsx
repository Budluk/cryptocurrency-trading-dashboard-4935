import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TrendingUpIcon, TrendingDownIcon, ActivityIcon, TargetIcon, ShieldIcon, DollarSignIcon, PercentIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, AreaChart, Area } from 'recharts';
import { usePositions } from "@/contexts/PositionsContext";

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
    refetchInterval: 60000,
    staleTime: 30000
  });

  // Buscar histórico de trades do contexto filtrado por período
  const { closedPositions: allClosedTrades } = usePositions();
  
  const tradeHistory = useMemo(() => {
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

    return allClosedTrades.filter(trade => {
      if (!trade.closed_at) return false;
      const closedDate = new Date(trade.closed_at);
      return closedDate >= startDate && closedDate <= endDate;
    });
  }, [allClosedTrades, period]);

  // Calcular equity curve (saldo cumulativo) - memoizado
  const equityCurve = useMemo(() => {
    if (!tradeHistory) return [];
    
    return tradeHistory.reduce((acc, trade, index) => {
      const date = new Date(trade.closed_at).toLocaleDateString();
      const realizedPnl = (trade as any).realized_pnl || 0;
      
      const prevEquity = index > 0 ? acc[index - 1].equity : 10000;
      const newEquity = prevEquity + realizedPnl;
      
      acc.push({
        date,
        equity: newEquity,
        pnl: realizedPnl,
        drawdown: Math.min(0, newEquity - Math.max(...acc.map(d => d.equity || prevEquity), prevEquity))
      });
      
      return acc;
    }, [] as any[]);
  }, [tradeHistory]);

  // Calcular ROI e Sharpe Ratio - memoizado
  const initialBalance = 10000;
  const { roi, sharpeRatio, currentBalance } = useMemo(() => {
    const currentBalance = equityCurve.length > 0 ? equityCurve[equityCurve.length - 1].equity : initialBalance;
    const roi = ((currentBalance - initialBalance) / initialBalance) * 100;
    
    const returns = equityCurve.map(d => d.pnl);
    const avgReturn = returns.length > 0 ? returns.reduce((a, b) => a + b, 0) / returns.length : 0;
    const variance = returns.length > 0 ? returns.reduce((sq, n) => sq + Math.pow(n - avgReturn, 2), 0) / returns.length : 0;
    const stdDev = Math.sqrt(variance);
    const sharpeRatio = stdDev > 0 ? (avgReturn / stdDev) * Math.sqrt(252) : 0;
    
    return { roi, sharpeRatio, currentBalance };
  }, [equityCurve]);

  // Trades por símbolo para chart - memoizado
  const tradesBySymbol = useMemo(() => {
    if (!tradeHistory) return [];
    
    return tradeHistory.reduce((acc, trade) => {
      const existing = acc.find(item => item.symbol === trade.symbol);
      const realizedPnl = (trade as any).realized_pnl || 0;
      if (existing) {
        existing.count += 1;
        existing.totalPnl += realizedPnl;
      } else {
        acc.push({ symbol: trade.symbol, count: 1, totalPnl: realizedPnl });
      }
      return acc;
    }, [] as any[]);
  }, [tradeHistory]);

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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-sm text-muted-foreground">SALDO ATUAL</h3>
            <DollarSignIcon className="w-5 h-5 text-primary" />
          </div>
          <div className="text-3xl font-bold">${(currentBalance || 0).toFixed(2)}</div>
          <p className="text-sm text-muted-foreground mt-2">
            Inicial: ${(initialBalance || 0).toFixed(2)}
          </p>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-sm text-muted-foreground">ROI</h3>
            <PercentIcon className="w-5 h-5 text-green-500" />
          </div>
          <div className={`text-3xl font-bold ${getPerformanceColor(roi, 'pnl')}`}>
            {roi > 0 ? '+' : ''}{(roi || 0).toFixed(2)}%
          </div>
          <p className="text-sm text-muted-foreground mt-2">
            Retorno total
          </p>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-sm text-muted-foreground">TRADES</h3>
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
            <h3 className="font-semibold text-sm text-muted-foreground">SHARPE RATIO</h3>
            <ShieldIcon className="w-5 h-5 text-blue-500" />
          </div>
          <div className={`text-3xl font-bold ${getPerformanceColor(sharpeRatio, 'pnl')}`}>
            {(sharpeRatio || 0).toFixed(2)}
          </div>
          <p className="text-sm text-muted-foreground mt-2">
            Risco ajustado
          </p>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-sm text-muted-foreground">MAX DRAWDOWN</h3>
            <TrendingDownIcon className="w-5 h-5 text-red-500" />
          </div>
          <div className="text-3xl font-bold text-red-500">
            {performance?.max_drawdown?.toFixed(1) || '0.0'}%
          </div>
          <p className="text-sm text-muted-foreground mt-2">
            Maior queda
          </p>
        </Card>
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Equity Curve */}
        <Card className="p-6">
          <h3 className="font-semibold mb-4">📈 Equity Curve (Evolução do Saldo)</h3>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={equityCurve}>
              <defs>
                <linearGradient id="equityGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip 
                formatter={(value: any) => [`$${(value || 0).toFixed(2)}`, 'Saldo']}
              />
              <Area 
                type="monotone" 
                dataKey="equity" 
                stroke="hsl(var(--primary))" 
                strokeWidth={2}
                fill="url(#equityGradient)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </Card>

        {/* Performance por Símbolo */}
        <Card className="p-6">
          <h3 className="font-semibold mb-4">🎯 Performance por Símbolo</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={tradesBySymbol.slice(0, 8)}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="symbol" />
              <YAxis />
              <Tooltip 
                formatter={(value: any, name: string) => [
                  name === 'totalPnl' ? `$${(value || 0).toFixed(2)}` : value,
                  name === 'totalPnl' ? 'P&L Total' : 'Trades'
                ]}
              />
              <Bar dataKey="totalPnl" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Histórico de Trades */}
      <Card className="p-6">
        <h3 className="font-semibold mb-4">📊 Histórico Recente de Trades</h3>
        <div className="space-y-3 max-h-80 overflow-y-auto">
          {tradeHistory?.slice(0, 10).map((trade) => (
            <div key={trade.id} className="flex items-center justify-between p-4 bg-muted/30 rounded-lg">
              <div className="flex items-center gap-4">
                <div className={`p-2 rounded-full ${
                  trade.side === 'Buy' ? 'bg-green-500/20' : 'bg-red-500/20'
                }`}>
                  {trade.side === 'Buy' ? (
                    <TrendingUpIcon className="w-4 h-4 text-green-500" />
                  ) : (
                    <TrendingDownIcon className="w-4 h-4 text-red-500" />
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{trade.symbol}</span>
                    <Badge variant="outline" className="text-xs">{trade.side}</Badge>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    ${(trade.entry_price || 0).toFixed(2)} → ${trade.current_price ? trade.current_price.toFixed(2) : '-'}
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className={`font-semibold ${getPerformanceColor((trade as any).realized_pnl || 0, 'pnl')}`}>
                  ${((trade as any).realized_pnl || 0).toFixed(2)}
                </div>
                <div className="text-xs text-muted-foreground">
                  {new Date(trade.closed_at).toLocaleString()}
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