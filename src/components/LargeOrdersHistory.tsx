import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { ArrowUpCircle, ArrowDownCircle, TrendingUp } from "lucide-react";
import { format } from "date-fns";

interface LargeOrder {
  id: string;
  symbol: string;
  side: string;
  size: number;
  price: number;
  value_usd: number;
  is_institutional: boolean;
  impact_score: number;
  detected_at: string;
}

export function LargeOrdersHistory() {
  const [orders, setOrders] = useState<LargeOrder[]>([]);
  const [chartData, setChartData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchOrders();
    const interval = setInterval(fetchOrders, 10000); // Refresh every 10s
    return () => clearInterval(interval);
  }, []);

  const fetchOrders = async () => {
    try {
      const { data, error } = await supabase
        .from('large_orders')
        .select('*')
        .order('detected_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      if (data) {
        setOrders(data);
        processChartData(data);
      }
    } catch (error) {
      console.error('Error fetching large orders:', error);
    } finally {
      setLoading(false);
    }
  };

  const processChartData = (ordersData: LargeOrder[]) => {
    // Group orders by time intervals (5 minute buckets)
    const timeGroups = new Map<string, { buy: number; sell: number; institutional: number }>();

    ordersData.forEach((order) => {
      const time = new Date(order.detected_at);
      const timeKey = format(time, 'HH:mm');

      if (!timeGroups.has(timeKey)) {
        timeGroups.set(timeKey, { buy: 0, sell: 0, institutional: 0 });
      }

      const group = timeGroups.get(timeKey)!;
      if (order.side === 'BUY') {
        group.buy += order.value_usd;
      } else {
        group.sell += order.value_usd;
      }
      if (order.is_institutional) {
        group.institutional += order.value_usd;
      }
    });

    const chartDataArray = Array.from(timeGroups.entries())
      .map(([time, values]) => ({
        time,
        buy: values.buy / 1000000, // Convert to millions
        sell: values.sell / 1000000,
        institutional: values.institutional / 1000000,
      }))
      .reverse()
      .slice(-20); // Last 20 time periods

    setChartData(chartDataArray);
  };

  const formatVolume = (volume: number) => {
    if (volume >= 1000000) {
      return `$${(volume / 1000000).toFixed(2)}M`;
    }
    return `$${(volume / 1000).toFixed(0)}K`;
  };

  const stats = {
    totalOrders: orders.length,
    institutionalOrders: orders.filter(o => o.is_institutional).length,
    totalVolume: orders.reduce((sum, o) => sum + o.value_usd, 0),
    avgImpact: orders.length > 0 
      ? orders.reduce((sum, o) => sum + (o.impact_score || 0), 0) / orders.length 
      : 0,
  };

  return (
    <div className="space-y-4">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{stats.totalOrders}</div>
            <p className="text-xs text-muted-foreground">Grandes Ordens</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-warning">
              {stats.institutionalOrders}
            </div>
            <p className="text-xs text-muted-foreground">Institucionais</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{formatVolume(stats.totalVolume)}</div>
            <p className="text-xs text-muted-foreground">Volume Total</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{stats.avgImpact.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground">Impacto Médio</p>
          </CardContent>
        </Card>
      </div>

      {/* Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            Evolução Temporal das Grandes Ordens
          </CardTitle>
          <CardDescription>
            Volume de ordens de compra vs venda nos últimos minutos
          </CardDescription>
        </CardHeader>
        <CardContent>
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis 
                  dataKey="time" 
                  className="text-xs"
                  stroke="hsl(var(--muted-foreground))"
                />
                <YAxis 
                  className="text-xs"
                  stroke="hsl(var(--muted-foreground))"
                  label={{ value: 'Volume ($M)', angle: -90, position: 'insideLeft' }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                  }}
                  formatter={(value: number) => `$${value.toFixed(2)}M`}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="buy"
                  stroke="hsl(var(--success))"
                  strokeWidth={2}
                  name="Compra"
                  dot={{ fill: 'hsl(var(--success))' }}
                />
                <Line
                  type="monotone"
                  dataKey="sell"
                  stroke="hsl(var(--destructive))"
                  strokeWidth={2}
                  name="Venda"
                  dot={{ fill: 'hsl(var(--destructive))' }}
                />
                <Line
                  type="monotone"
                  dataKey="institutional"
                  stroke="hsl(var(--warning))"
                  strokeWidth={2}
                  name="Institucional"
                  dot={{ fill: 'hsl(var(--warning))' }}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[300px] flex items-center justify-center text-muted-foreground">
              {loading ? 'Carregando dados...' : 'Nenhuma ordem grande detectada ainda'}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Orders List */}
      <Card>
        <CardHeader>
          <CardTitle>Ordens Recentes</CardTitle>
          <CardDescription>
            Últimas {Math.min(orders.length, 10)} grandes ordens detectadas
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {orders.slice(0, 10).map((order) => (
              <div
                key={order.id}
                className="flex items-center justify-between p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  {order.side === 'BUY' ? (
                    <ArrowUpCircle className="h-5 w-5 text-success" />
                  ) : (
                    <ArrowDownCircle className="h-5 w-5 text-destructive" />
                  )}
                  <div>
                    <div className="font-semibold">{order.symbol}</div>
                    <div className="text-xs text-muted-foreground">
                      {format(new Date(order.detected_at), 'HH:mm:ss')}
                    </div>
                  </div>
                </div>
                <div className="text-right space-y-1">
                  <div className="font-bold">{formatVolume(order.value_usd)}</div>
                  <div className="flex items-center gap-2">
                    {order.is_institutional && (
                      <Badge variant="outline" className="text-xs">
                        Institucional
                      </Badge>
                    )}
                    <Badge variant={order.side === 'BUY' ? 'default' : 'destructive'} className="text-xs">
                      {order.side}
                    </Badge>
                  </div>
                </div>
              </div>
            ))}
            {orders.length === 0 && !loading && (
              <div className="text-center py-8 text-muted-foreground">
                Nenhuma ordem grande detectada ainda
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
