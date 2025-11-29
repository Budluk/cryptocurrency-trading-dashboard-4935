import { useMemo, memo } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, DollarSign, Calendar } from "lucide-react";
import { usePositions } from "@/contexts/PositionsContext";

export const DailyPnLSummary = memo(() => {
  const { openPositions, closedPositions } = usePositions();

  const pnlData = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Posições fechadas hoje
    const closedToday = closedPositions.filter(p => 
      p.closed_at && new Date(p.closed_at) >= today
    );

    const dailyRealized = closedToday.reduce((sum, p) => sum + (p.realized_pnl || 0), 0);
    const currentUnrealized = openPositions.reduce((sum, p) => sum + (p.unrealized_pnl || 0), 0);
    const partialRealized = openPositions.reduce((sum, p) => sum + (p.realized_pnl || 0), 0);

    // P&L Total de Hoje
    const dailyTotal = dailyRealized + partialRealized + currentUnrealized;

    // P&L Total (últimos 30 dias)
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
    };
  }, [openPositions, closedPositions]);

  const getDailyColor = (value: number) => {
    return value > 0 ? 'text-green-500' : value < 0 ? 'text-red-500' : 'text-muted-foreground';
  };

  const getDailyBg = (value: number) => {
    return value > 0 
      ? 'bg-gradient-to-br from-success/20 to-success/5 border-success/40 shadow-lg shadow-success/20' 
      : value < 0 
      ? 'bg-gradient-to-br from-destructive/20 to-destructive/5 border-destructive/40 shadow-lg shadow-destructive/20' 
      : 'bg-gradient-to-br from-card to-card/80 border-border/50';
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* P&L Diário Total */}
      <Card className={`p-6 border-2 ${getDailyBg(pnlData?.dailyTotal || 0)} backdrop-blur-sm transition-all duration-300 hover:scale-[1.02] card-elevated`}>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium text-muted-foreground">P&L Hoje</span>
          </div>
          {(pnlData?.dailyTotal || 0) > 0 ? (
            <TrendingUp className="h-4 w-4 text-green-500" />
          ) : (
            <TrendingDown className="h-4 w-4 text-red-500" />
          )}
        </div>
        <p className={`text-2xl font-bold ${getDailyColor(pnlData?.dailyTotal || 0)}`}>
          {(pnlData?.dailyTotal || 0) >= 0 ? '+' : ''}${(pnlData?.dailyTotal || 0).toFixed(2)}
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          Realizado + Não Realizado
        </p>
      </Card>

      {/* P&L Realizado Hoje */}
      <Card className="p-6 border-2 bg-gradient-to-br from-card to-card/80 border-border/50 backdrop-blur-sm transition-all duration-300 hover:scale-[1.02] card-elevated">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-blue-500" />
            <span className="text-sm font-medium text-muted-foreground">Realizado Hoje</span>
          </div>
          <Badge variant="secondary" className="text-xs">
            Fechado
          </Badge>
        </div>
        <p className={`text-2xl font-bold ${getDailyColor(pnlData?.dailyRealized || 0)}`}>
          {(pnlData?.dailyRealized || 0) >= 0 ? '+' : ''}${(pnlData?.dailyRealized || 0).toFixed(2)}
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          Operações fechadas
        </p>
      </Card>

      {/* P&L Não Realizado */}
      <Card className="p-6 border-2 bg-gradient-to-br from-card to-card/80 border-border/50 backdrop-blur-sm transition-all duration-300 hover:scale-[1.02] card-elevated">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-yellow-500" />
            <span className="text-sm font-medium text-muted-foreground">Não Realizado</span>
          </div>
          <Badge variant="outline" className="text-xs">
            Aberto
          </Badge>
        </div>
        <p className={`text-2xl font-bold ${getDailyColor(pnlData?.currentUnrealized || 0)}`}>
          {(pnlData?.currentUnrealized || 0) >= 0 ? '+' : ''}${(pnlData?.currentUnrealized || 0).toFixed(2)}
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          Posições abertas
        </p>
      </Card>

      {/* P&L Total (30 dias) */}
      <Card className={`p-6 border-2 ${getDailyBg(pnlData?.totalRealized || 0)} backdrop-blur-sm transition-all duration-300 hover:scale-[1.02] card-elevated`}>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium text-muted-foreground">Total 30d</span>
          </div>
          <Badge variant="default" className="text-xs">
            Acumulado
          </Badge>
        </div>
        <p className={`text-2xl font-bold ${getDailyColor(pnlData?.totalRealized || 0)}`}>
          {(pnlData?.totalRealized || 0) >= 0 ? '+' : ''}${(pnlData?.totalRealized || 0).toFixed(2)}
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          Últimos 30 dias
        </p>
      </Card>
    </div>
  );
});
