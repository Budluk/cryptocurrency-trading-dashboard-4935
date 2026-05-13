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
    </Card>
  );
};
