import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import type { Database as SupabaseDatabase } from "@/integrations/supabase/types";
import {
  Activity, AlertTriangle, CheckCircle2, Database, RefreshCw, Server, ShieldCheck,
  Clock3, CircleSlash, Bot,
} from "lucide-react";
import { toast } from "sonner";

type AgentState = SupabaseDatabase["public"]["Tables"]["agent_state"]["Row"];
type AgentRoutine = SupabaseDatabase["public"]["Tables"]["agent_routine_log"]["Row"];
type AgentTrade = SupabaseDatabase["public"]["Tables"]["agent_trades"]["Row"];
type ProviderHealth = {
  name: string; model: string; configured: boolean;
  circuitOpen: boolean; failures: number; rateLimited: boolean;
};

const dayAgo = () => new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
const time = (v: string | null | undefined) =>
  v ? new Date(v).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "—";

/** Tabela ausente significa migration não aplicada — não é falha de conexão. */
const missingTable = (error: { code?: string; message?: string } | null) =>
  !!error && (
    error.code === "PGRST205" ||
    error.code === "42P01" ||
    /Could not find the table|schema cache|relation .+ does not exist/i.test(error.message ?? "")
  );

function Metric({ label, value, hint, tone = "default" }: { label: string; value: string | number; hint?: string; tone?: "default" | "good" | "bad" }) {
  const color = tone === "good" ? "text-success" : tone === "bad" ? "text-destructive" : "text-foreground";
  return (
    <Card className="bg-card/60">
      <CardHeader className="pb-2"><CardDescription className="text-xs">{label}</CardDescription></CardHeader>
      <CardContent>
        <div className={`text-2xl font-bold ${color}`}>{value}</div>
        {hint && <p className="text-[11px] text-muted-foreground mt-1">{hint}</p>}
      </CardContent>
    </Card>
  );
}

export function ObservabilityPanel() {
  const queryClient = useQueryClient();
  const [apiCheck, setApiCheck] = useState<{ ok: boolean; detail: string; ms: number } | null>(null);
  const [checking, setChecking] = useState(false);

  const errors = useQuery({
    queryKey: ["obs-errors"],
    queryFn: async () => {
      const { data, error } = await supabase.from("bot_errors")
        .select("id, error_type, error_message, resolved, retry_count, created_at, timestamp")
        .order("created_at", { ascending: false }).limit(100);
      if (error) throw error;
      return data ?? [];
    },
    refetchInterval: 30000,
  });

  const logs = useQuery({
    queryKey: ["obs-logs"],
    queryFn: async () => {
      const { data, error } = await supabase.from("auto_trader_logs")
        .select("id, created_at, log_type, message, symbol")
        .order("created_at", { ascending: false }).limit(100);
      if (error) throw error;
      return data ?? [];
    },
    refetchInterval: 30000,
  });

  const decisions = useQuery({
    queryKey: ["obs-decisions"],
    queryFn: async () => {
      const { data, error } = await supabase.from("ai_decisions")
        .select("id, symbol, final_action, final_confidence, gate_pass, gate_blocked_by, sources, created_at")
        .order("created_at", { ascending: false }).limit(100);
      if (error) {
        if (missingTable(error)) return { rows: [] as { id: string; symbol: string; final_action: string; final_confidence: number; gate_pass: boolean; gate_blocked_by: string[] | null; sources: string[]; created_at: string }[], unavailable: true };
        throw error;
      }
      return { rows: data ?? [], unavailable: false };
    },
    refetchInterval: 30000,
  });

  const agentState = useQuery({
    queryKey: ["obs-agent-state"],
    queryFn: async () => {
      const { data, error } = await supabase.from("agent_state")
        .select("symbol, consecutive_losses, consecutive_stops, daily_pnl_pct, kill_until, blacklisted, last_signal_at, updated_at")
        .order("updated_at", { ascending: false }).limit(100);
      if (error) {
        if (missingTable(error)) return { rows: [] as AgentState[], unavailable: true };
        throw error;
      }
      return { rows: (data ?? []) as AgentState[], unavailable: false };
    },
    refetchInterval: 30000,
  });

  const agentRoutine = useQuery({
    queryKey: ["obs-agent-routine"],
    queryFn: async () => {
      const { data, error } = await supabase.from("agent_routine_log")
        .select("id, kind, summary, payload, created_at, user_id")
        .order("created_at", { ascending: false }).limit(100);
      if (error) {
        if (missingTable(error)) return { rows: [] as AgentRoutine[], unavailable: true };
        throw error;
      }
      return { rows: (data ?? []) as AgentRoutine[], unavailable: false };
    },
    refetchInterval: 30000,
  });

  const agentTrades = useQuery({
    queryKey: ["obs-agent-trades"],
    queryFn: async () => {
      const { data, error } = await supabase.from("agent_trades")
        .select("id, symbol, side, entry, result, pnl_pct, opened_at, closed_at")
        .eq("result", "open").order("opened_at", { ascending: false }).limit(100);
      if (error) {
        if (missingTable(error)) return { rows: [] as AgentTrade[], unavailable: true };
        throw error;
      }
      return { rows: (data ?? []) as AgentTrade[], unavailable: false };
    },
    refetchInterval: 30000,
  });

  const aiStatus = useQuery({
    queryKey: ["obs-ai-status"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("ai-market-analysis", { body: { action: "ai_status" } });
      if (error) throw error;
      const payload = data as { providers?: ProviderHealth[]; fallbackConfigured?: boolean } | null;
      return { providers: payload?.providers ?? [], fallbackConfigured: !!payload?.fallbackConfigured };
    },
    refetchInterval: 60000,
    retry: 1,
  });

  const audit = useQuery({
    queryKey: ["obs-audit"],
    queryFn: async () => {
      const { data, error } = await supabase.from("audit_log")
        .select("id, at, action, detail").order("at", { ascending: false }).limit(100);
      return { rows: data ?? [], restricted: !!error };
    },
    refetchInterval: 60000,
  });

  const resolveError = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("bot_errors").update({ resolved: true }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Erro marcado como resolvido"); queryClient.invalidateQueries({ queryKey: ["obs-errors"] }); },
    onError: (e) => toast.error((e as Error).message),
  });

  const refreshAll = () => {
    ["obs-errors", "obs-logs", "obs-decisions", "obs-audit", "obs-agent-state", "obs-agent-routine", "obs-agent-trades", "obs-ai-status"]
      .forEach((key) => queryClient.invalidateQueries({ queryKey: [key] }));
  };

  const checkApi = async () => {
    setChecking(true);
    const started = Date.now();
    try {
      const { data, error } = await supabase.functions.invoke("bybit-trading", { body: { action: "chat_api_status" } });
      const ms = Date.now() - started;
      if (error) setApiCheck({ ok: false, detail: error.message, ms });
      else setApiCheck({ ok: !!(data as { ok?: boolean })?.ok, detail: !data?.ok ? String((data as { problem?: string })?.problem ?? "sem detalhes") : "chave válida", ms });
    } catch (e) {
      setApiCheck({ ok: false, detail: (e as Error).message, ms: Date.now() - started });
    } finally {
      setChecking(false);
    }
  };

  const metrics = useMemo(() => {
    const since = dayAgo();
    const recentErrors = (errors.data ?? []).filter((e) => (e.created_at ?? e.timestamp ?? "") >= since);
    const openErrors = recentErrors.filter((e) => !e.resolved);
    const recentDecisions = (decisions.data?.rows ?? []).filter((d) => d.created_at >= since);
    const approved = recentDecisions.filter((d) => d.gate_pass).length;
    const states = agentState.data?.rows ?? [];
    return {
      openErrors: openErrors.length,
      decisions24h: recentDecisions.length,
      approvalRate: recentDecisions.length ? `${Math.round((approved / recentDecisions.length) * 100)}%` : "—",
      lastEvent: logs.data?.[0]?.created_at ?? null,
      agentOpen: agentTrades.data?.rows.length ?? 0,
      agentBlocked: states.filter((s) => s.blacklisted || (s.kill_until && new Date(s.kill_until) > new Date())).length,
    };
  }, [errors.data, decisions.data, logs.data, agentState.data, agentTrades.data]);

  const activeProvider = useMemo(() => {
    const list = aiStatus.data?.providers ?? [];
    return list.find((p) => p.configured && !p.circuitOpen && !p.rateLimited)
      ?? list.find((p) => p.configured && !p.circuitOpen)
      ?? null;
  }, [aiStatus.data]);

  const failing = errors.isError || logs.isError || decisions.isError
    || agentState.isError || agentRoutine.isError || agentTrades.isError;

  return (
    <Card className="bg-card/60 border-border/50">
      <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
        <div>
          <CardTitle className="flex items-center gap-2 text-lg"><Activity className="h-5 w-5 text-primary" /> Observabilidade</CardTitle>
          <CardDescription className="text-xs">Saúde dos serviços, erros, decisões da IA e auditoria — atualização automática a cada 30s.</CardDescription>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={checkApi} disabled={checking}>
            {checking ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Server className="h-4 w-4" />} Verificar API
          </Button>
          <Button variant="ghost" size="icon" onClick={refreshAll} aria-label="Atualizar"><RefreshCw className="h-4 w-4" /></Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          <Metric label="Erros abertos (24h)" value={metrics.openErrors} tone={metrics.openErrors > 0 ? "bad" : "good"} hint="bot_errors não resolvidos" />
          <Metric label="Decisões IA (24h)" value={metrics.decisions24h} hint="registradas pelo gateway" />
          <Metric label="Taxa de aprovação" value={metrics.approvalRate} tone="good" hint="gate_pass / decisões" />
          <Metric label="Posições agente" value={metrics.agentOpen} hint="agent_trades abertas" />
          <Metric label="Último evento" value={metrics.lastEvent ? time(metrics.lastEvent) : "—"} hint="auto_trader_logs" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="flex items-center gap-2 rounded-lg border border-border/50 bg-background/40 px-3 py-2 text-xs">
            {failing ? <CircleSlash className="h-4 w-4 text-destructive" /> : <Database className="h-4 w-4 text-success" />}
            <span>Supabase: {failing ? "erro ao consultar" : "conectado"}</span>
          </div>
          <div className="flex items-center gap-2 rounded-lg border border-border/50 bg-background/40 px-3 py-2 text-xs">
            <CheckCircle2 className={`h-4 w-4 ${decisions.data?.rows.length ? "text-success" : "text-muted-foreground"}`} />
            <span>Gateway IA: {decisions.data?.unavailable ? "migration pendente" : decisions.data?.rows.length ? `${decisions.data.rows.length} decisões no log` : "sem registros"}</span>
          </div>
          <div className="flex items-center gap-2 rounded-lg border border-border/50 bg-background/40 px-3 py-2 text-xs">
            {apiCheck ? (apiCheck.ok ? <ShieldCheck className="h-4 w-4 text-success" /> : <AlertTriangle className="h-4 w-4 text-destructive" />) : <Server className="h-4 w-4 text-muted-foreground" />}
            <span>{apiCheck ? `Bybit: ${apiCheck.ok ? "OK" : apiCheck.detail} (${apiCheck.ms}ms)` : "Bybit: não verificado"}</span>
          </div>
          <div className="flex items-center gap-2 rounded-lg border border-border/50 bg-background/40 px-3 py-2 text-xs" aria-label="Provedor de IA ativo">
            {activeProvider ? <Bot className="h-4 w-4 text-success" /> : <AlertTriangle className="h-4 w-4 text-warning" />}
            <span>IA: {activeProvider ? `${activeProvider.name} (${activeProvider.model})` : aiStatus.isError ? "indisponível" : "sem provedor livre"}</span>
          </div>
        </div>

        <Tabs defaultValue="events">
          <TabsList className="grid grid-cols-5">
            <TabsTrigger value="events">Eventos</TabsTrigger>
            <TabsTrigger value="errors">Erros</TabsTrigger>
            <TabsTrigger value="decisions">Decisões IA</TabsTrigger>
            <TabsTrigger value="agent">Agente</TabsTrigger>
            <TabsTrigger value="audit">Auditoria</TabsTrigger>
          </TabsList>

          <TabsContent value="events">
            <ScrollArea className="h-64 rounded-md border border-border/50 p-2">
              {(logs.data ?? []).length === 0 && <p className="text-xs text-muted-foreground p-2">Nenhum evento registrado.</p>}
              {logs.data?.map((l) => (
                <div key={l.id} className="flex gap-2 text-xs border-b border-border/30 py-1.5 last:border-0">
                  <span className="text-muted-foreground whitespace-nowrap">{time(l.created_at)}</span>
                  <Badge variant="outline" className="h-fit text-[10px]">{l.log_type}</Badge>
                  <span className="flex-1">{l.message}</span>
                  {l.symbol && <span className="text-primary text-[10px]">{l.symbol}</span>}
                </div>
              ))}
            </ScrollArea>
          </TabsContent>

          <TabsContent value="errors">
            <ScrollArea className="h-64 rounded-md border border-border/50 p-2">
              {(errors.data ?? []).length === 0 && <p className="text-xs text-muted-foreground p-2">Nenhum erro registrado. 🎉</p>}
              {errors.data?.map((e) => (
                <div key={e.id} className="flex gap-2 items-start text-xs border-b border-border/30 py-1.5 last:border-0">
                  <AlertTriangle className={`h-3.5 w-3.5 mt-0.5 shrink-0 ${e.resolved ? "text-muted-foreground" : "text-destructive"}`} />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{e.error_type}: {e.error_message}</div>
                    <div className="text-muted-foreground">{time(e.created_at ?? e.timestamp)} · tentativas: {e.retry_count ?? 0}</div>
                  </div>
                  {e.resolved ? <Badge variant="secondary" className="text-[10px]">resolvido</Badge>
                    : <Button variant="ghost" size="sm" className="h-6 px-2 text-[10px]" onClick={() => resolveError.mutate(e.id)}>Resolver</Button>}
                </div>
              ))}
            </ScrollArea>
          </TabsContent>

          <TabsContent value="decisions">
            <ScrollArea className="h-64 rounded-md border border-border/50 p-2">
              {decisions.data?.unavailable && <p className="text-xs text-warning p-2">Tabela `ai_decisions` ausente: aplique `20261127000000_fix_rls_policies.sql`.</p>}
              {!decisions.data?.unavailable && (decisions.data?.rows.length ?? 0) === 0 && <p className="text-xs text-muted-foreground p-2">O gateway ainda não gravou decisões. Envie um sinal para popular o log.</p>}
              {decisions.data?.rows.map((d) => (
                <div key={d.id} className="flex gap-2 items-center text-xs border-b border-border/30 py-1.5 last:border-0">
                  <span className="w-20 text-muted-foreground">{time(d.created_at)}</span>
                  <span className="font-semibold w-16">{d.symbol}</span>
                  <Badge variant={d.final_action === "WAIT" ? "secondary" : d.final_action === "BUY" ? "default" : "destructive"} className="text-[10px]">{d.final_action}</Badge>
                  <span className="w-14">{d.final_confidence}%</span>
                  <Badge variant={d.gate_pass ? "default" : "outline"} className="text-[10px]">{d.gate_pass ? "aprovado" : "bloqueado"}</Badge>
                  <span className="text-muted-foreground truncate flex-1">{d.gate_blocked_by?.join(", ") || d.sources.join(", ")}</span>
                </div>
              ))}
            </ScrollArea>
          </TabsContent>

          <TabsContent value="agent">
            <ScrollArea className="h-64 rounded-md border border-border/50 p-2 space-y-2">
              {(agentState.data?.unavailable || agentRoutine.data?.unavailable || agentTrades.data?.unavailable) &&
                <p className="text-xs text-warning p-2">Memória do agente ausente: aplique as migrations `agent_autonomous_memory` e `agent_trades_take_profit`.</p>}

              <div className="flex items-center gap-2 text-xs font-medium"><Bot className="h-3.5 w-3.5 text-primary" /> Estado por ativo</div>
              {agentState.data?.rows.length === 0 && <p className="text-xs text-muted-foreground p-2">Sem estado persistido. O loop registra a cada 5 min.</p>}
              {agentState.data?.rows.map((s) => (
                <div key={`${s.user_id}-${s.symbol}`} className="flex flex-wrap items-center gap-2 text-xs border-b border-border/30 py-1.5 last:border-0">
                  <span className="font-semibold w-20">{s.symbol}</span>
                  <Badge variant="outline" className="text-[10px]">perdas {s.consecutive_losses}</Badge>
                  <Badge variant="outline" className="text-[10px]">stops {s.consecutive_stops}</Badge>
                  <span className={Number(s.daily_pnl_pct) < 0 ? "text-destructive" : "text-success"}>{Number(s.daily_pnl_pct).toFixed(2)}%</span>
                  {s.blacklisted && <Badge variant="destructive" className="text-[10px]">blacklist</Badge>}
                  {s.kill_until && new Date(s.kill_until) > new Date() && <Badge variant="destructive" className="text-[10px]">kill até {time(s.kill_until)}</Badge>}
                  <span className="text-muted-foreground ml-auto">atualizado {time(s.updated_at)}</span>
                </div>
              ))}

              <div className="text-xs font-medium pt-2">Rotina (loop, diária, kill switch)</div>
              {agentRoutine.data?.rows.length === 0 && <p className="text-xs text-muted-foreground p-2">Nenhuma rotina registrada.</p>}
              {agentRoutine.data?.rows.map((r) => (
                <div key={r.id} className="flex gap-2 text-xs border-b border-border/30 py-1.5 last:border-0">
                  <span className="text-muted-foreground whitespace-nowrap">{time(r.created_at)}</span>
                  <Badge variant="outline" className="h-fit text-[10px]">{r.kind}</Badge>
                  <span className="flex-1">{r.summary}</span>
                </div>
              ))}

              <div className="text-xs font-medium pt-2">Posições abertas (saídas reconciliadas pelo loop)</div>
              {agentTrades.data?.rows.length === 0 && <p className="text-xs text-muted-foreground p-2">Nenhuma posição aberta.</p>}
              {agentTrades.data?.rows.map((t) => (
                <div key={t.id} className="flex gap-2 text-xs border-b border-border/30 py-1.5 last:border-0">
                  <span className="font-semibold w-20">{t.symbol}</span>
                  <Badge variant="outline" className="h-fit text-[10px]">{t.side}</Badge>
                  <span>entrada {t.entry}</span>
                  <span className="text-muted-foreground ml-auto">aberta {time(t.opened_at)}</span>
                </div>
              ))}
            </ScrollArea>
          </TabsContent>

          <TabsContent value="audit">
            <ScrollArea className="h-64 rounded-md border border-border/50 p-2">
              {audit.data?.restricted && <p className="text-xs text-warning p-2">A auditoria é restrita a administradores (RLS).</p>}
              {!audit.data?.restricted && (audit.data?.rows ?? []).length === 0 && <p className="text-xs text-muted-foreground p-2">Nenhuma ação auditada.</p>}
              {audit.data?.rows.map((a) => (
                <div key={a.id} className="flex gap-2 text-xs border-b border-border/30 py-1.5 last:border-0">
                  <Clock3 className="h-3.5 w-3.5 mt-0.5 text-muted-foreground shrink-0" />
                  <span className="text-muted-foreground whitespace-nowrap">{time(a.at)}</span>
                  <span className="font-medium">{a.action}</span>
                  <span className="text-muted-foreground truncate flex-1">{JSON.stringify(a.detail)}</span>
                </div>
              ))}
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
