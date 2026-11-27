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

  // Criar array de cards e filtrar os zerados
  const cards = [
    {
      key: 'daily-total',
      value: pnlData.dailyTotal,
      icon: Calendar,
      label: 'P&L Hoje',
      sublabel: 'Realizado + Não Realizado',
      badge: pnlData.dailyTotal !== 0 ? (
        <div className={`flex items-center gap-1 text-xs font-medium ${getColorClass(pnlData.dailyTotal)}`}>
          {pnlData.dailyTotal > 0 ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
          <span>{pnlData.dailyTotal > 0 ? 'Lucro' : 'Perda'}</span>
        </div>
      ) : null
    },
    {
      key: 'realized',
      value: pnlData.dailyRealized,
      icon: DollarSign,
      label: 'Realizado',
      sublabel: 'Operações fechadas',
      badge: (
        <Badge variant="secondary" className="text-[10px] px-2 py-0.5 bg-secondary/50">
          {pnlData.closedTodayCount} ops
        </Badge>
      )
    },
    {
      key: 'unrealized',
      value: pnlData.currentUnrealized,
      icon: Activity,
      label: 'Aberto',
      sublabel: 'Posições ativas',
      badge: (
        <Badge variant="outline" className="text-[10px] px-2 py-0.5 border-primary/30 text-primary">
          {pnlData.openCount} abertas
        </Badge>
      )
    },
    {
      key: 'total-30d',
      value: pnlData.totalRealized,
      icon: BarChart3,
      label: 'Total',
      sublabel: 'Últimos 30 dias',
      badge: (
        <Badge className="text-[10px] px-2 py-0.5 bg-primary/20 text-primary border-0">
          30 dias
        </Badge>
      )
    }
  ].filter(card => card.value !== 0);

  if (cards.length === 0) return null;

  // Mobile: sempre 2 colunas para melhor visualização
  const gridCols = cards.length === 1 ? 'grid-cols-1' : 'grid-cols-2 lg:grid-cols-4';

  return (
    <section aria-label="Resumo de P&L" className={`grid ${gridCols} gap-2 sm:gap-4`}>
      {cards.map(card => {
        const IconComponent = card.icon;
        return (
          <Card key={card.key} className="stat-card group p-3 sm:p-4">
            <div className="flex items-start justify-between mb-2 sm:mb-4">
              <div className={`p-1.5 sm:p-2.5 rounded-lg sm:rounded-xl ${getIconBgClass(card.value)} transition-colors`}>
                <IconComponent className="h-4 w-4 sm:h-5 sm:w-5" aria-hidden="true" />
              </div>
              <div className="hidden sm:block">{card.badge}</div>
            </div>
            <div className="space-y-0.5 sm:space-y-1">
              <p className="text-[10px] sm:text-xs font-medium text-muted-foreground uppercase tracking-wider">{card.label}</p>
              <p className={`text-xl sm:text-3xl font-bold font-mono tracking-tight ${getColorClass(card.value)}`}>
                {formatValue(card.value)}
              </p>
              <p className="text-[10px] sm:text-xs text-muted-foreground hidden sm:block">{card.sublabel}</p>
            </div>
          </Card>
        );
      })}
    </section>
  );
});