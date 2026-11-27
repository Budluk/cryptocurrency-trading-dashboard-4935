import { useState, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TrendingUp, TrendingDown, Clock, Target, AlertTriangle } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts';
import { usePositions } from "@/contexts/PositionsContext";

const COLORS = ['#10b981', '#ef4444', '#f59e0b', '#3b82f6', '#8b5cf6', '#ec4899'];
const WEEKDAY_NAMES = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

interface TradeRecord {
  symbol: string;
  closed_at: string | null;
  opened_at: string;
  realized_pnl?: number;
  leverage?: number;
}

interface SymbolPerformance {
  symbol: string;
  trades: number;
  wins: number;
  totalPnl: number;
  winRate: number;
}

interface HourlyPerformance {
  hour: number;
  trades: number;
  wins: number;
  winRate: number;
}

interface LeverageDistribution {
  leverage: string;
  count: number;
  totalPnl: number;
}

interface WeekdayPerformance {
  day: string;
  trades: number;
  totalPnl: number;
}

export const AdvancedAnalytics = () => {
  const [period, setPeriod] = useState('30d');
  const { closedPositions: allTrades } = usePositions();

  const trades = useMemo(() => {
    const endDate = new Date();
    const startDate = new Date();
    
    switch (period) {
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

    return allTrades.filter(trade => {
      if (!trade.closed_at) return false;
      const closedDate = new Date(trade.closed_at);
      return closedDate >= startDate && closedDate <= endDate;
    });
  }, [allTrades, period]);

  // 1. Performance por Símbolo - memoizado
  const symbolPerformance = useMemo(() => {
    return trades?.reduce((acc: Record<string, SymbolPerformance>, trade: TradeRecord) => {
      const symbol = trade.symbol;
      if (!acc[symbol]) {
        acc[symbol] = { symbol, trades: 0, wins: 0, totalPnl: 0, winRate: 0 };
      }
      acc[symbol].trades += 1;
      const realizedPnl = trade.realized_pnl || 0;
      acc[symbol].wins += realizedPnl > 0 ? 1 : 0;
      acc[symbol].totalPnl += realizedPnl;
      acc[symbol].winRate = (acc[symbol].wins / acc[symbol].trades) * 100;
      return acc;
    }, {});
  }, [trades]);

  const symbolData = useMemo(() => {
    return Object.values(symbolPerformance || {}).sort((a: SymbolPerformance, b: SymbolPerformance) => b.totalPnl - a.totalPnl);
  }, [symbolPerformance]);

  // 2. Win Rate por Horário - memoizado
  const hourlyPerformance = useMemo(() => {
    return trades?.reduce((acc: Record<number, HourlyPerformance>, trade: TradeRecord) => {
      const hour = new Date(trade.opened_at).getHours();
      if (!acc[hour]) {
        acc[hour] = { hour, trades: 0, wins: 0, winRate: 0 };
      }
      acc[hour].trades += 1;
      const realizedPnl = trade.realized_pnl || 0;
      acc[hour].wins += realizedPnl > 0 ? 1 : 0;
      acc[hour].winRate = (acc[hour].wins / acc[hour].trades) * 100;
      return acc;
    }, {});
  }, [trades]);

  const hourlyData = useMemo(() => {
    return Object.values(hourlyPerformance || {}).sort((a: HourlyPerformance, b: HourlyPerformance) => a.hour - b.hour);
  }, [hourlyPerformance]);

  // 3. Distribuição de Leverage - memoizado
  const leverageDistribution = useMemo(() => {
    return trades?.reduce((acc: LeverageDistribution[], trade: TradeRecord) => {
      const lev = trade.leverage || 1;
      const existing = acc.find(item => item.leverage === `${lev}x`);
      const realizedPnl = trade.realized_pnl || 0;
      if (existing) {
        existing.count += 1;
        existing.totalPnl += realizedPnl;
      } else {
        acc.push({ leverage: `${lev}x`, count: 1, totalPnl: realizedPnl });
      }
      return acc;
    }, []) || [];
  }, [trades]);

  // 4. Análise de Perdas Consecutivas - memoizado
  const { maxConsecutiveLosses, consecutiveLosses } = useMemo(() => {
    let maxConsecutiveLosses = 0;
    let currentStreak = 0;

    trades?.forEach((trade: TradeRecord) => {
      const realizedPnl = trade.realized_pnl || 0;
      if (realizedPnl < 0) {
        currentStreak += 1;
        maxConsecutiveLosses = Math.max(maxConsecutiveLosses, currentStreak);
      } else {
        currentStreak = 0;
      }
    });

    return { maxConsecutiveLosses, consecutiveLosses: currentStreak };
  }, [trades]);

  // 5. Performance por Dia da Semana - memoizado
  const weekdayPerformance = useMemo(() => {
    return trades?.reduce((acc: Record<number, WeekdayPerformance>, trade: TradeRecord) => {
      const day = new Date(trade.opened_at).getDay();
      if (!acc[day]) {
        acc[day] = { day: WEEKDAY_NAMES[day], trades: 0, totalPnl: 0 };
      }
      acc[day].trades += 1;
      const realizedPnl = trade.realized_pnl || 0;
      acc[day].totalPnl += realizedPnl;
      return acc;
    }, {});
  }, [trades]);

  const weekdayData = useMemo(() => {
    return Object.values(weekdayPerformance || {});
  }, [weekdayPerformance]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold mb-2">📊 Analytics Avançado</h2>
          <p className="text-muted-foreground">Insights profundos sobre sua performance</p>
        </div>
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7d">7 Dias</SelectItem>
            <SelectItem value="30d">30 Dias</SelectItem>
            <SelectItem value="90d">90 Dias</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Métricas de Risco */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-6">
          <div className="flex items-center gap-3 mb-3">
            <AlertTriangle className="w-6 h-6 text-red-500" />
            <h3 className="font-semibold">Perdas Consecutivas</h3>
          </div>
          <div className="text-3xl font-bold text-red-500">{consecutiveLosses}</div>
          <p className="text-sm text-muted-foreground mt-2">
            Máximo: {maxConsecutiveLosses} trades
          </p>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-3 mb-3">
            <Target className="w-6 h-6 text-blue-500" />
            <h3 className="font-semibold">Melhor Símbolo</h3>
          </div>
          <div className="text-2xl font-bold">{symbolData[0]?.symbol || 'N/A'}</div>
          <p className="text-sm text-green-500 mt-2">
            +${symbolData[0]?.totalPnl ? symbolData[0].totalPnl.toFixed(2) : '0.00'}
          </p>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-3 mb-3">
            <Clock className="w-6 h-6 text-purple-500" />
            <h3 className="font-semibold">Melhor Horário</h3>
          </div>
          <div className="text-2xl font-bold">
            {hourlyData.slice().sort((a: HourlyPerformance, b: HourlyPerformance) => b.winRate - a.winRate)[0]?.hour || 0}h
          </div>
          <p className="text-sm text-muted-foreground mt-2">
            {hourlyData.slice().sort((a: HourlyPerformance, b: HourlyPerformance) => b.winRate - a.winRate)[0]?.winRate ? hourlyData.slice().sort((a: HourlyPerformance, b: HourlyPerformance) => b.winRate - a.winRate)[0].winRate.toFixed(0) : '0'}% win rate
          </p>
        </Card>
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Performance por Símbolo */}
        <Card className="p-6">
          <h3 className="font-semibold mb-4">🎯 Performance por Símbolo</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={symbolData.slice(0, 8)}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="symbol" />
              <YAxis />
              <Tooltip 
                formatter={(value: number, name: string) => [
                  name === 'totalPnl' ? `$${(value || 0).toFixed(2)}` : `${(value || 0).toFixed(1)}%`,
                  name === 'totalPnl' ? 'P&L Total' : 'Win Rate'
                ]}
              />
              <Bar dataKey="totalPnl" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        {/* Win Rate por Horário */}
        <Card className="p-6">
          <h3 className="font-semibold mb-4">⏰ Win Rate por Horário</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={hourlyData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="hour" label={{ value: 'Hora', position: 'insideBottom', offset: -5 }} />
              <YAxis label={{ value: 'Win Rate %', angle: -90, position: 'insideLeft' }} />
              <Tooltip formatter={(value: number) => `${(value || 0).toFixed(1)}%`} />
              <Line type="monotone" dataKey="winRate" stroke="hsl(var(--primary))" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </Card>

        {/* Distribuição de Leverage */}
        <Card className="p-6">
          <h3 className="font-semibold mb-4">⚡ Distribuição de Leverage</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={leverageDistribution}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={(entry) => `${entry.leverage}: ${entry.count}`}
                outerRadius={100}
                fill="#8884d8"
                dataKey="count"
              >
                {leverageDistribution.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </Card>

        {/* Performance por Dia da Semana */}
        <Card className="p-6">
          <h3 className="font-semibold mb-4">📅 Performance por Dia da Semana</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={weekdayData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="day" />
              <YAxis />
              <Tooltip formatter={(value: number) => `$${(value || 0).toFixed(2)}`} />
              <Bar dataKey="totalPnl" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]}>
                {weekdayData.map((entry: WeekdayPerformance, index) => (
                  <Cell key={`cell-${index}`} fill={entry.totalPnl > 0 ? '#10b981' : '#ef4444'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Tabela Detalhada por Símbolo */}
      <Card className="p-6">
        <h3 className="font-semibold mb-4">📋 Análise Detalhada por Símbolo</h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b">
                <th className="text-left py-3 px-4">Símbolo</th>
                <th className="text-right py-3 px-4">Trades</th>
                <th className="text-right py-3 px-4">Win Rate</th>
                <th className="text-right py-3 px-4">P&L Total</th>
                <th className="text-right py-3 px-4">P&L Médio</th>
              </tr>
            </thead>
            <tbody>
              {symbolData.slice(0, 10).map((item: SymbolPerformance) => (
                <tr key={item.symbol} className="border-b hover:bg-muted/30 transition-colors">
                  <td className="py-3 px-4 font-semibold">{item.symbol}</td>
                  <td className="py-3 px-4 text-right">{item.trades}</td>
                  <td className="py-3 px-4 text-right">
                    <Badge variant={item.winRate > 50 ? 'default' : 'destructive'}>
                      {(item.winRate || 0).toFixed(1)}%
                    </Badge>
                  </td>
                  <td className={`py-3 px-4 text-right font-semibold ${item.totalPnl > 0 ? 'text-green-500' : 'text-red-500'}`}>
                    ${(item.totalPnl || 0).toFixed(2)}
                  </td>
                  <td className="py-3 px-4 text-right">
                    ${item.trades > 0 ? (item.totalPnl / item.trades).toFixed(2) : '0.00'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};
