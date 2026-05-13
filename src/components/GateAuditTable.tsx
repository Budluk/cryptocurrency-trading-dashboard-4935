import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ClipboardList, Trash2, CheckCircle2, XCircle, ArrowRight } from "lucide-react";
import {
  getGateAuditEntries,
  subscribeGateAudit,
  clearGateAudit,
  GateAuditEntry,
} from "@/lib/gateAudit";

const QUALITY_COLORS: Record<string, string> = {
  premium: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
  high: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  medium: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
};

export const GateAuditTable = () => {
  const [entries, setEntries] = useState<GateAuditEntry[]>([]);
  const [filter, setFilter] = useState<'all' | 'APPROVED' | 'BLOCKED'>('all');
  const [selected, setSelected] = useState<GateAuditEntry | null>(null);

  useEffect(() => {
    setEntries(getGateAuditEntries());
    return subscribeGateAudit(() => setEntries(getGateAuditEntries()));
  }, []);

  const filtered = entries.filter(e => filter === 'all' || e.outcome === filter);
  const counts = {
    total: entries.length,
    approved: entries.filter(e => e.outcome === 'APPROVED').length,
    blocked: entries.filter(e => e.outcome === 'BLOCKED').length,
  };

  return (
    <Card className="p-5 bg-gradient-to-br from-slate-500/10 to-slate-700/10 border-slate-500/20 mb-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-slate-500/20">
            <ClipboardList className="h-5 w-5 text-slate-300" />
          </div>
          <div>
            <h3 className="text-base font-bold">Auditoria de Trades — Gates por Trade</h3>
            <p className="text-xs text-muted-foreground">
              Histórico do que liberou ou travou cada operação (últimas 200)
            </p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => { clearGateAudit(); setEntries([]); }}
          className="text-muted-foreground hover:text-destructive"
        >
          <Trash2 className="h-3.5 w-3.5 mr-1" /> Limpar
        </Button>
      </div>

      {/* Filtros + métricas */}
      <div className="flex items-center gap-2 mb-3">
        <Button size="sm" variant={filter === 'all' ? 'default' : 'outline'} onClick={() => setFilter('all')}>
          Todos <Badge variant="secondary" className="ml-2">{counts.total}</Badge>
        </Button>
        <Button size="sm" variant={filter === 'APPROVED' ? 'default' : 'outline'} onClick={() => setFilter('APPROVED')}>
          <CheckCircle2 className="h-3.5 w-3.5 mr-1 text-green-400" />
          Aprovados <Badge variant="secondary" className="ml-2">{counts.approved}</Badge>
        </Button>
        <Button size="sm" variant={filter === 'BLOCKED' ? 'default' : 'outline'} onClick={() => setFilter('BLOCKED')}>
          <XCircle className="h-3.5 w-3.5 mr-1 text-red-400" />
          Bloqueados <Badge variant="secondary" className="ml-2">{counts.blocked}</Badge>
        </Button>
      </div>

      {filtered.length === 0 ? (
        <div className="text-sm text-muted-foreground text-center py-6">
          Nenhum evento de auditoria registrado ainda.
        </div>
      ) : (
        <ScrollArea className="h-[420px] rounded-lg border border-border/50">
          <Table>
            <TableHeader className="sticky top-0 bg-background/95 backdrop-blur z-10">
              <TableRow>
                <TableHead className="text-[11px]">Hora</TableHead>
                <TableHead className="text-[11px]">Status</TableHead>
                <TableHead className="text-[11px]">Símbolo</TableHead>
                <TableHead className="text-[11px]">Qualidade</TableHead>
                <TableHead className="text-[11px]">Preset</TableHead>
                <TableHead className="text-[11px]">Gate / Razão</TableHead>
                <TableHead className="text-[11px] text-right">SL max</TableHead>
                <TableHead className="text-[11px] text-right">R:R</TableHead>
                <TableHead className="text-[11px] text-right">Trailing</TableHead>
                <TableHead className="text-[11px] text-right">Lev max</TableHead>
                <TableHead className="text-[11px] text-right">Aplicado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(e => (
                <TableRow key={e.id} className="text-xs cursor-pointer hover:bg-background/40" onClick={() => setSelected(e)}>
                  <TableCell className="font-mono text-[10px] text-muted-foreground">
                    {new Date(e.timestamp).toLocaleTimeString()}
                  </TableCell>
                  <TableCell>
                    {e.outcome === 'APPROVED' ? (
                      <Badge className="bg-green-500/20 text-green-300 border-green-500/30 border text-[10px]">
                        APROVADO
                      </Badge>
                    ) : (
                      <Badge className="bg-red-500/20 text-red-300 border-red-500/30 border text-[10px]">
                        BLOQUEADO
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="font-mono font-semibold">{e.symbol}</TableCell>
                  <TableCell>
                    {e.quality && (
                      <Badge className={`${QUALITY_COLORS[e.quality] || ''} border text-[10px] uppercase`}>
                        {e.quality}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="capitalize text-[11px]">{e.preset}</TableCell>
                  <TableCell className="max-w-[260px] truncate" title={e.reason || e.gate}>
                    <span className="font-medium">{e.gate}</span>
                    {e.reason && e.reason !== e.gate && (
                      <span className="text-muted-foreground"> — {e.reason}</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right font-mono text-[10px]">
                    {(e.rules.maxStopLossPct * 100).toFixed(2)}%
                  </TableCell>
                  <TableCell className="text-right font-mono text-[10px]">
                    {e.rules.minRiskReward}:1
                  </TableCell>
                  <TableCell className="text-right font-mono text-[10px]">
                    {(e.rules.trailingStopPct * 100).toFixed(0)}%
                  </TableCell>
                  <TableCell className="text-right font-mono text-[10px]">
                    {e.rules.maxLeverage}x
                  </TableCell>
                  <TableCell className="text-right font-mono text-[10px]">
                    {e.applied ? (
                      <span className="text-green-300">
                        {e.applied.leverage}x · SL {e.applied.stopLossPct?.toFixed(2)}% · TP {e.applied.takeProfitPct?.toFixed(2)}%
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ScrollArea>
      )}

      <AuditDetailDialog entry={selected} onClose={() => setSelected(null)} />
    </Card>
  );
};

// ───────────────────────── Detail dialog ─────────────────────────
const fmtPct = (n?: number, digits = 2) => (typeof n === 'number' ? `${n.toFixed(digits)}%` : '—');
const DiffRow = ({ label, intended, applied, unit = '' }: { label: string; intended: string; applied: string; unit?: string }) => {
  const changed = intended !== applied;
  return (
    <div className={`grid grid-cols-3 gap-2 px-3 py-2 rounded text-xs ${changed ? 'bg-indigo-500/10 border border-indigo-500/30' : 'bg-background/40 border border-border/40'}`}>
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono">{intended}{unit}</span>
      <span className={`font-mono text-right ${changed ? 'text-indigo-300 font-semibold' : ''}`}>
        {applied}{unit} {changed && <ArrowRight className="inline h-3 w-3 ml-1 -mt-0.5" />}
      </span>
    </div>
  );
};

function AuditDetailDialog({ entry, onClose }: { entry: GateAuditEntry | null; onClose: () => void }) {
  if (!entry) return null;
  const r = entry.rules;
  const a = entry.applied || {};
  // Intended TP derivado de SL máx * R:R mínimo
  const intendedTpPct = r.maxStopLossPct * r.minRiskReward * 100;
  const intendedSlPct = r.maxStopLossPct * 100;
  const intendedTrailPct = r.trailingStopPct * 100;
  const intendedRR = r.minRiskReward;
  const appliedSlPct = a.stopLossPct;
  const appliedTpPct = a.takeProfitPct;
  const appliedTrailPct = (a.trailingPct ?? 0) * 100;
  const appliedRR = appliedSlPct && appliedTpPct ? appliedTpPct / appliedSlPct : undefined;

  return (
    <Dialog open={!!entry} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-sm">
            {entry.outcome === 'APPROVED' ? (
              <CheckCircle2 className="h-4 w-4 text-green-400" />
            ) : (
              <XCircle className="h-4 w-4 text-red-400" />
            )}
            <span className="font-mono">{entry.symbol}</span>
            {entry.quality && (
              <Badge className={`${QUALITY_COLORS[entry.quality] || ''} border text-[10px] uppercase`}>
                {entry.quality}
              </Badge>
            )}
            <Badge variant="outline" className="text-[10px] capitalize">{entry.preset}</Badge>
            <span className="ml-auto text-[10px] font-mono text-muted-foreground">
              {new Date(entry.timestamp).toLocaleString()}
            </span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="p-3 rounded bg-background/40 border border-border/50">
            <div className="text-[11px] text-muted-foreground uppercase mb-1">Gate / Razão</div>
            <div className="text-sm font-medium">{entry.gate}</div>
            {entry.reason && entry.reason !== entry.gate && (
              <div className="text-xs text-muted-foreground mt-0.5">{entry.reason}</div>
            )}
          </div>

          <div>
            <div className="grid grid-cols-3 gap-2 px-3 py-1 text-[10px] uppercase tracking-wide text-muted-foreground">
              <span>Parâmetro</span>
              <span>Pretendido (regra)</span>
              <span className="text-right">Aplicado no trade</span>
            </div>
            <div className="space-y-1.5">
              <DiffRow label="Stop Loss" intended={fmtPct(intendedSlPct)} applied={fmtPct(appliedSlPct)} />
              <DiffRow label="Take Profit" intended={fmtPct(intendedTpPct)} applied={fmtPct(appliedTpPct)} />
              <DiffRow label="Risk:Reward" intended={`${intendedRR.toFixed(2)}:1`} applied={appliedRR ? `${appliedRR.toFixed(2)}:1` : '—'} />
              <DiffRow label="Trailing Stop" intended={fmtPct(intendedTrailPct, 0)} applied={fmtPct(appliedTrailPct, 0)} />
              <DiffRow label="Leverage" intended={`${r.maxLeverage}x`} applied={a.leverage ? `${a.leverage}x` : '—'} />
              <DiffRow label="Confiança mín" intended={`${r.minConfidence}%`} applied={`${r.minConfidence}%`} />
              <DiffRow label="Score mín" intended={`${r.minScore}`} applied={`${r.minScore}`} />
              <DiffRow label="Risco/trade" intended={`${r.riskPerTradePct}%`} applied={`${r.riskPerTradePct}%`} />
              <DiffRow label="Breakeven trigger" intended={`${r.breakevenTriggerPct}%`} applied={`${r.breakevenTriggerPct}%`} />
            </div>
            {entry.outcome === 'BLOCKED' && (
              <div className="mt-3 text-[11px] text-muted-foreground italic px-1">
                Trade bloqueado — nenhum SL/TP foi aplicado. Coluna “Aplicado” mostra a regra prevista.
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
