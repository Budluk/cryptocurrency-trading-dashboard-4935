import { useMemo, memo } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, DollarSign, Calendar, Activity, BarChart3 } from "lucide-react";
import { usePositions } from "@/contexts/PositionsContext";

export const DailyPnLSummary = memo(() => {
  const { openPositions, closedPositions } = usePositions();

  const pnlData = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const closedToday = closedPositions.filter(p => 
      p.closed_at && new Date(p.closed_at) >= today
    );

    const dailyRealized = closedToday.reduce((sum, p) => sum + (p.realized_pnl || 0), 0);
    const currentUnrealized = openPositions.reduce((sum, p) => sum + (p.unrealized_pnl || 0), 0);
    const partialRealized = openPositions.reduce((sum, p) => sum + (p.realized_pnl || 0), 0);
    const dailyTotal = dailyRealized + partialRealized + currentUnrealized;

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const last30Days = closedPositions.filter(p => 
      p.closed_at && new Date(p.closed_at) >= thirtyDaysAgo
    );

    const totalRealized = last30Days.reduce((sum, p) => sum + (p.realized_pnl || 0), 0);

    return {
      dailyRealized,
      dailyTotal,
      currentUnrealized,
      totalRealized: totalRealized + currentUnrealized,
      openCount: openPositions.length,
      closedTodayCount: closedToday.length,
    };
  }, [openPositions, closedPositions]);

  const formatValue = (value: number) => {
    const prefix = value >= 0 ? '+' : '';
    return `${prefix}$${Math.abs(value).toFixed(2)}`;
  };

  const getColorClass = (value: number) => {
    if (value > 0) return 'text-success';
    if (value < 0) return 'text-destructive';
    return 'text-muted-foreground';
  };

  const getIconBgClass = (value: number) => {
    if (value > 0) return 'bg-success/15 text-success';
    if (value < 0) return 'bg-destructive/15 text-destructive';
    return 'bg-muted/30 text-muted-foreground';
  };

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {/* P&L Diário Total */}
      <Card className="stat-card group">
        <div className="flex items-start justify-between mb-4">
          <div className={`p-2.5 rounded-xl ${getIconBgClass(pnlData.dailyTotal)} transition-colors`}>
            <Calendar className="h-5 w-5" />
          </div>
          {pnlData.dailyTotal !== 0 && (
            <div className={`flex items-center gap-1 text-xs font-medium ${getColorClass(pnlData.dailyTotal)}`}>
              {pnlData.dailyTotal > 0 ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
              <span>{pnlData.dailyTotal > 0 ? 'Lucro' : 'Perda'}</span>
            </div>
          )}
        </div>
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">P&L Hoje</p>
          <p className={`text-2xl sm:text-3xl font-bold font-mono tracking-tight ${getColorClass(pnlData.dailyTotal)}`}>
            {formatValue(pnlData.dailyTotal)}
          </p>
          <p className="text-xs text-muted-foreground/70">Realizado + Não Realizado</p>
        </div>
      </Card>

      {/* P&L Realizado */}
      <Card className="stat-card group">
        <div className="flex items-start justify-between mb-4">
          <div className={`p-2.5 rounded-xl ${getIconBgClass(pnlData.dailyRealized)} transition-colors`}>
            <DollarSign className="h-5 w-5" />
          </div>
          <Badge variant="secondary" className="text-[10px] px-2 py-0.5 bg-secondary/50">
            {pnlData.closedTodayCount} ops
          </Badge>
        </div>
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Realizado</p>
          <p className={`text-2xl sm:text-3xl font-bold font-mono tracking-tight ${getColorClass(pnlData.dailyRealized)}`}>
            {formatValue(pnlData.dailyRealized)}
          </p>
          <p className="text-xs text-muted-foreground/70">Operações fechadas</p>
        </div>
      </Card>

      {/* Não Realizado */}
      <Card className="stat-card group">
        <div className="flex items-start justify-between mb-4">
          <div className={`p-2.5 rounded-xl ${getIconBgClass(pnlData.currentUnrealized)} transition-colors`}>
            <Activity className="h-5 w-5" />
          </div>
          <Badge variant="outline" className="text-[10px] px-2 py-0.5 border-primary/30 text-primary">
            {pnlData.openCount} abertas
          </Badge>
        </div>
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Aberto</p>
          <p className={`text-2xl sm:text-3xl font-bold font-mono tracking-tight ${getColorClass(pnlData.currentUnrealized)}`}>
            {formatValue(pnlData.currentUnrealized)}
          </p>
          <p className="text-xs text-muted-foreground/70">Posições ativas</p>
        </div>
      </Card>

      {/* Total 30 dias */}
      <Card className="stat-card group">
        <div className="flex items-start justify-between mb-4">
          <div className={`p-2.5 rounded-xl ${getIconBgClass(pnlData.totalRealized)} transition-colors`}>
            <BarChart3 className="h-5 w-5" />
          </div>
          <Badge className="text-[10px] px-2 py-0.5 bg-primary/20 text-primary border-0">
            30 dias
          </Badge>
        </div>
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Total</p>
          <p className={`text-2xl sm:text-3xl font-bold font-mono tracking-tight ${getColorClass(pnlData.totalRealized)}`}>
            {formatValue(pnlData.totalRealized)}
          </p>
          <p className="text-xs text-muted-foreground/70">Últimos 30 dias</p>
        </div>
      </Card>
    </div>
  );
});