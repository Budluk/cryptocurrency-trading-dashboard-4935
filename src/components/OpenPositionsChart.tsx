import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Activity } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  buildOpenPositionsChartData,
  sumOpenPnl,
  type ChartPositionInput,
} from "@/lib/openPositionsChart";

interface OpenPositionsChartProps {
  demoPositions: readonly ChartPositionInput[];
  realPositions: readonly ChartPositionInput[];
}

const money = (value: number) =>
  `${value >= 0 ? "+" : "-"}$${Math.abs(value).toFixed(2)}`;

/** Gráfico comparativo das posições abertas, sem fazer novas chamadas à exchange. */
export const OpenPositionsChart = ({
  demoPositions,
  realPositions,
}: OpenPositionsChartProps) => {
  const data = useMemo(
    () => buildOpenPositionsChartData(demoPositions, realPositions),
    [demoPositions, realPositions],
  );
  const demoPnl = useMemo(() => sumOpenPnl(demoPositions), [demoPositions]);
  const realPnl = useMemo(() => sumOpenPnl(realPositions), [realPositions]);
  const totalPositions = demoPositions.length + realPositions.length;

  return (
    <Card className="border-border/60 bg-secondary/30">
      <CardHeader className="flex flex-wrap items-center justify-between gap-2 pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-medium">
          <Activity className="h-4 w-4 text-primary" aria-hidden="true" />
          Gráfico de operações em andamento
        </CardTitle>
        <div className="flex flex-wrap gap-2 text-xs">
          <Badge variant="outline" className="border-primary/50 text-primary">
            Demo: {money(demoPnl)} ({demoPositions.length})
          </Badge>
          <Badge variant="outline" className="border-accent/50 text-accent">
            Real: {money(realPnl)} ({realPositions.length})
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {totalPositions === 0 ? (
          <p className="py-8 text-center text-xs text-muted-foreground">
            Nenhuma operação em andamento. Rode 1 ciclo no demo ou abra uma posição real.
          </p>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="currentColor" opacity={0.15} />
              <XAxis dataKey="symbol" fontSize={11} />
              <YAxis
                fontSize={11}
                width={58}
                tickFormatter={(value: number) => `$${value}`}
              />
              <Tooltip
                formatter={(value: number, name: string) => [money(Number(value)), name]}
                labelFormatter={(label: string) => `Ativo: ${label}`}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar
                dataKey="demo"
                name="Demo (paper)"
                fill="hsl(var(--primary))"
                radius={[4, 4, 0, 0]}
              />
              <Bar
                dataKey="real"
                name="Real"
                fill="hsl(var(--accent))"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
};
