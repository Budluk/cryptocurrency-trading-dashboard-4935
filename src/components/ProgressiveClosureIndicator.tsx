import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Check, Clock, TrendingUp } from "lucide-react";

interface ProgressiveClosureIndicatorProps {
  entryPrice: number;
  currentPrice: number;
  side: string;
  qty: number;
  originalQty?: number;
}

export const ProgressiveClosureIndicator = ({
  entryPrice,
  currentPrice,
  side,
  qty,
  originalQty
}: ProgressiveClosureIndicatorProps) => {
  // Calcular P&L %
  const pnlPercent = side === 'BUY' 
    ? ((currentPrice - entryPrice) / entryPrice) * 100
    : ((entryPrice - currentPrice) / entryPrice) * 100;

  // Determinar quantos fechamentos parciais já aconteceram
  const startingQty = originalQty || qty;
  const qtyReduction = startingQty - qty;
  const reductionPct = (qtyReduction / startingQty) * 100;

  let closedLevels = 0;
  if (reductionPct >= 45) closedLevels = 2; // 50% fechado (25% + 25%)
  else if (reductionPct >= 20) closedLevels = 1; // 25% fechado

  // Status de cada nível
  const level1Status = pnlPercent >= 1.0 ? (closedLevels >= 1 ? 'closed' : 'ready') : 'pending';
  const level2Status = pnlPercent >= 2.0 ? (closedLevels >= 2 ? 'closed' : 'ready') : 'pending';
  const level3Status = pnlPercent >= 2.0 && closedLevels >= 2 ? 'active' : 'pending';

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-xs">
        <span className="font-semibold text-primary">Fechamento Progressivo</span>
        <span className={pnlPercent >= 0 ? 'text-green-500' : 'text-red-500'}>
          {pnlPercent >= 0 ? '+' : ''}{pnlPercent.toFixed(2)}%
        </span>
      </div>

      {/* Nível 1: 25% em +1% */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            {level1Status === 'closed' ? (
              <Check className="h-3 w-3 text-green-500" />
            ) : level1Status === 'ready' ? (
              <TrendingUp className="h-3 w-3 text-yellow-500 animate-pulse" />
            ) : (
              <Clock className="h-3 w-3 text-muted-foreground" />
            )}
            <span className={level1Status === 'closed' ? 'text-green-500' : 'text-muted-foreground'}>
              Nível 1: 25% em +1%
            </span>
          </div>
          <Badge 
            variant={level1Status === 'closed' ? 'default' : 'outline'} 
            className="text-xs h-5"
          >
            {level1Status === 'closed' ? '✓ Fechado' : level1Status === 'ready' ? 'Pronto!' : 'Pendente'}
          </Badge>
        </div>
        <Progress 
          value={Math.min(pnlPercent * 100, 100)} 
          className="h-1.5"
        />
      </div>

      {/* Nível 2: 25% em +2% + Breakeven */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            {level2Status === 'closed' ? (
              <Check className="h-3 w-3 text-green-500" />
            ) : level2Status === 'ready' ? (
              <TrendingUp className="h-3 w-3 text-yellow-500 animate-pulse" />
            ) : (
              <Clock className="h-3 w-3 text-muted-foreground" />
            )}
            <span className={level2Status === 'closed' ? 'text-green-500' : 'text-muted-foreground'}>
              Nível 2: 25% em +2% (Stop → BE)
            </span>
          </div>
          <Badge 
            variant={level2Status === 'closed' ? 'default' : 'outline'} 
            className="text-xs h-5"
          >
            {level2Status === 'closed' ? '✓ Fechado' : level2Status === 'ready' ? 'Pronto!' : 'Pendente'}
          </Badge>
        </div>
        <Progress 
          value={Math.min((pnlPercent / 2) * 100, 100)} 
          className="h-1.5"
        />
      </div>

      {/* Nível 3: 50% com trailing stop */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            {level3Status === 'active' ? (
              <TrendingUp className="h-3 w-3 text-blue-500 animate-pulse" />
            ) : (
              <Clock className="h-3 w-3 text-muted-foreground" />
            )}
            <span className={level3Status === 'active' ? 'text-blue-500' : 'text-muted-foreground'}>
              Nível 3: 50% livre (Trailing Stop)
            </span>
          </div>
          <Badge 
            variant={level3Status === 'active' ? 'default' : 'outline'} 
            className="text-xs h-5"
          >
            {level3Status === 'active' ? '🚀 Ativo' : 'Aguardando'}
          </Badge>
        </div>
        {level3Status === 'active' && (
          <div className="text-xs text-blue-500 font-semibold animate-pulse">
            🎯 Deixando correr com trailing stop
          </div>
        )}
      </div>

      {/* Resumo */}
      <div className="pt-2 border-t border-border/50">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Posição Atual</span>
          <span className="font-semibold">
            {((qty / startingQty) * 100).toFixed(0)}% restante
          </span>
        </div>
      </div>
    </div>
  );
};
