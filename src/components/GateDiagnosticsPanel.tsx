import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ShieldAlert, TrendingDown, Activity } from "lucide-react";
import { GATE_CATEGORIES, categorizeGate, QUALITY_RISK_CONFIG } from "@/config/qualityRiskConfig";

interface GateDiagnosticsPanelProps {
  /** Map serializado: razão -> count, do último ciclo */
  skipCounts: Record<string, number>;
  /** Total de candidatos analisados no último ciclo */
  totalAnalyzed: number;
  /** Trades abertos no último ciclo */
  openedThisCycle: number;
  /** Hora do último ciclo */
  lastCycleAt?: Date | null;
}

export const GateDiagnosticsPanel = ({
  skipCounts,
  totalAnalyzed,
  openedThisCycle,
  lastCycleAt,
}: GateDiagnosticsPanelProps) => {
  const entries = Object.entries(skipCounts).sort((a, b) => b[1] - a[1]);
  const totalBlocked = entries.reduce((s, [, c]) => s + c, 0);

  // Agregar por categoria
  const byCategory = new Map<string, { count: number; reasons: { reason: string; count: number }[] }>();
  for (const [reason, count] of entries) {
    const cat = categorizeGate(reason);
    if (!byCategory.has(cat)) byCategory.set(cat, { count: 0, reasons: [] });
    const bucket = byCategory.get(cat)!;
    bucket.count += count;
    bucket.reasons.push({ reason, count });
  }
  const sortedCategories = Array.from(byCategory.entries()).sort((a, b) => b[1].count - a[1].count);

  if (totalAnalyzed === 0 && totalBlocked === 0) {
    return (
      <Card className="p-5 bg-gradient-to-br from-slate-500/10 to-slate-700/10 border-slate-500/20">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Activity className="h-5 w-5" />
          <span className="text-sm">Aguardando primeiro ciclo de análise...</span>
        </div>
      </Card>
    );
  }

  const passRate = totalAnalyzed > 0 ? (openedThisCycle / totalAnalyzed) * 100 : 0;

  return (
    <Card className="p-5 bg-gradient-to-br from-orange-500/10 to-red-500/10 border-orange-500/20">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-orange-500/20">
            <ShieldAlert className="h-5 w-5 text-orange-400" />
          </div>
          <div>
            <h3 className="text-base font-bold">Diagnóstico de Gates</h3>
            <p className="text-xs text-muted-foreground">
              Por que os trades foram bloqueados no último ciclo
            </p>
          </div>
        </div>
        {lastCycleAt && (
          <Badge variant="outline" className="text-[10px] font-mono">
            {lastCycleAt.toLocaleTimeString()}
          </Badge>
        )}
      </div>

      {/* Métricas resumo */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        <div className="p-3 rounded-lg bg-background/50 border border-border">
          <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Analisados</div>
          <div className="text-2xl font-bold font-mono text-foreground">{totalAnalyzed}</div>
        </div>
        <div className="p-3 rounded-lg bg-background/50 border border-border">
          <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Bloqueados</div>
          <div className="text-2xl font-bold font-mono text-orange-400">{totalBlocked}</div>
        </div>
        <div className="p-3 rounded-lg bg-background/50 border border-border">
          <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Aprovados</div>
          <div className="text-2xl font-bold font-mono text-green-400">{openedThisCycle}</div>
        </div>
      </div>

      {/* Pass rate */}
      <div className="mb-4">
        <div className="flex items-center justify-between text-xs mb-1">
          <span className="text-muted-foreground">Taxa de aprovação</span>
          <span className={`font-bold ${passRate < 5 ? 'text-red-400' : passRate < 20 ? 'text-yellow-400' : 'text-green-400'}`}>
            {passRate.toFixed(1)}%
          </span>
        </div>
        <Progress value={Math.min(passRate, 100)} className="h-1.5" />
      </div>

      {/* Top gargalos por categoria */}
      {sortedCategories.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-2">
            <TrendingDown className="h-3.5 w-3.5" />
            Gargalos por categoria
          </div>
          {sortedCategories.map(([cat, data]) => {
            const meta = GATE_CATEGORIES[cat] || GATE_CATEGORIES.other;
            const pct = totalBlocked > 0 ? (data.count / totalBlocked) * 100 : 0;
            return (
              <div key={cat} className="p-2.5 rounded-lg bg-background/40 border border-border/50">
                <div className="flex items-center justify-between mb-1.5">
                  <Badge className={`${meta.color} text-[10px] font-semibold border`}>
                    {meta.label}
                  </Badge>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="font-mono text-foreground">{data.count}</span>
                    <span className="text-muted-foreground">({pct.toFixed(0)}%)</span>
                  </div>
                </div>
                <Progress value={pct} className="h-1 mb-1.5" />
                {/* Detalhe das razões */}
                <div className="space-y-0.5 mt-1.5">
                  {data.reasons.slice(0, 3).map(r => (
                    <div key={r.reason} className="flex items-center justify-between text-[11px] text-muted-foreground">
                      <span className="truncate pr-2">• {r.reason}</span>
                      <span className="font-mono shrink-0">{r.count}×</span>
                    </div>
                  ))}
                  {data.reasons.length > 3 && (
                    <div className="text-[10px] text-muted-foreground/70 italic">
                      +{data.reasons.length - 3} outras razões
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Config de risco ativa */}
      <details className="mt-4 group">
        <summary className="text-xs font-semibold text-muted-foreground cursor-pointer hover:text-foreground transition-colors">
          ⚙️ Regras de risco por qualidade (clique para ver)
        </summary>
        <div className="mt-3 grid grid-cols-3 gap-2">
          {(['premium', 'high', 'medium'] as const).map(q => {
            const r = QUALITY_RISK_CONFIG[q];
            return (
              <div key={q} className="p-2.5 rounded-lg bg-background/40 border border-border/50 text-[11px] space-y-1">
                <div className="font-bold uppercase text-foreground mb-1.5">{q}</div>
                <div className="flex justify-between"><span className="text-muted-foreground">Conf min</span><span className="font-mono">{r.minConfidence}%</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Score min</span><span className="font-mono">{r.minScore}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Lev max</span><span className="font-mono">{r.maxLeverage}x</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">SL max</span><span className="font-mono">{(r.maxStopLossPct*100).toFixed(1)}%</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">R:R min</span><span className="font-mono">{r.minRiskReward}:1</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Risk/trade</span><span className="font-mono">{r.riskPerTradePct}%</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Trailing</span><span className="font-mono">{(r.trailingStopPct*100).toFixed(0)}%</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Breakeven</span><span className="font-mono">{r.breakevenTriggerPct}%</span></div>
              </div>
            );
          })}
        </div>
      </details>
    </Card>
  );
};
