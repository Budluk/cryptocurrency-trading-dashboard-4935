import { useCallback, useEffect, useState } from "react";
import { FunctionsHttpError } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronDown, Loader2, Save, Search, ShieldAlert, FlaskConical } from "lucide-react";
import { toast } from "sonner";

type Ficha = Record<string, unknown> & { titulo?: string };
type Msg = { role: "user" | "assistant"; content: string; ficha?: Ficha | null; aviso?: string | null };
type Lead = { id: string; titulo: string; status: string; created_at: string; notas: string | null };

const STATUS_LABEL: Record<string, string> = {
  nova: "Nova",
  em_analise: "Em análise",
  descartada: "Descartada",
  aprovada_para_backtest: "Aprovada p/ backtest",
};

const SECTIONS: Array<[string, string]> = [
  ["fontes", "Fontes"],
  ["regras_entrada", "Regras de entrada"],
  ["regras_saida", "Regras de saída"],
  ["gestao_risco", "Gestão de risco"],
  ["indicadores", "Indicadores"],
  ["parametros", "Parâmetros"],
  ["alegacoes_do_autor", "Alegações do autor (não verificadas)"],
  ["riscos_e_limites", "Riscos e limites"],
  ["lacunas", "Lacunas"],
  ["proximos_passos_validacao", "Próximos passos de validação"],
];

async function readError(error: unknown): Promise<string> {
  if (error instanceof FunctionsHttpError) {
    try {
      const j = await error.context.json();
      return j?.error ?? "Erro desconhecido.";
    } catch {
      return "Erro desconhecido.";
    }
  }
  return (error as Error)?.message ?? "Erro desconhecido.";
}

function renderValue(v: unknown) {
  if (Array.isArray(v)) {
    if (v.length === 0) return <p className="text-muted-foreground text-sm">NÃO VERIFICADO</p>;
    return (
      <ul className="list-disc pl-5 space-y-1 text-sm">
        {v.map((item, i) => (
          <li key={i}>
            {typeof item === "object" && item !== null
              ? Object.entries(item as Record<string, unknown>).map(([k, val]) => (
                  <span key={k} className="block">
                    <span className="text-muted-foreground">{k}:</span> {String(val)}
                  </span>
                ))
              : String(item)}
          </li>
        ))}
      </ul>
    );
  }
  if (v && typeof v === "object") {
    const entries = Object.entries(v as Record<string, unknown>);
    if (entries.length === 0) return <p className="text-muted-foreground text-sm">NÃO VERIFICADO</p>;
    return (
      <ul className="space-y-1 text-sm">
        {entries.map(([k, val]) => (
          <li key={k}><span className="text-muted-foreground">{k}:</span> {String(val)}</li>
        ))}
      </ul>
    );
  }
  return <p className="text-sm">{String(v ?? "NÃO VERIFICADO")}</p>;
}

function FichaView({ ficha, onSave, saving }: { ficha: Ficha; onSave: () => void; saving: boolean }) {
  return (
    <div className="mt-3 rounded-lg border border-border/50 bg-background/40 p-3 space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="font-semibold">{String(ficha.titulo ?? "Ficha de estratégia")}</h4>
        <Button size="sm" variant="outline" onClick={onSave} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Salvar como lead
        </Button>
      </div>
      <div className="flex flex-wrap gap-2 text-xs">
        <Badge variant="secondary">Mercado: {String(ficha.mercado ?? "—")}</Badge>
        <Badge variant="secondary">Timeframe: {String(ficha.timeframe ?? "—")}</Badge>
        <Badge variant="secondary">Licença: {String(ficha.licenca_codigo ?? "—")}</Badge>
        {Array.isArray(ficha.ativos) && <Badge variant="secondary">Ativos: {(ficha.ativos as string[]).join(", ") || "—"}</Badge>}
      </div>
      <Alert variant="destructive" className="py-2">
        <ShieldAlert className="h-4 w-4" />
        <AlertDescription className="text-xs">
          Alegações do autor não foram verificadas. Isto é pesquisa, não recomendação de investimento.
        </AlertDescription>
      </Alert>
      {SECTIONS.map(([key, label]) => (
        <Collapsible key={key}>
          <CollapsibleTrigger className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-sm font-medium hover:bg-muted/50">
            {label}
            <ChevronDown className="h-4 w-4" />
          </CollapsibleTrigger>
          <CollapsibleContent className="px-2 pb-2">{renderValue(ficha[key])}</CollapsibleContent>
        </Collapsible>
      ))}
    </div>
  );
}

export default function ResearchTab() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [urls, setUrls] = useState(["", "", ""]);
  const [loading, setLoading] = useState(false);
  const [savingIdx, setSavingIdx] = useState<number | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [accessError, setAccessError] = useState<string | null>(null);

  const loadLeads = useCallback(async () => {
    const { data, error } = await supabase
      .from("strategy_leads")
      .select("id, titulo, status, created_at, notas")
      .order("created_at", { ascending: false })
      .limit(50);
    if (!error && data) setLeads(data as Lead[]);
  }, []);

  useEffect(() => { loadLeads(); }, [loadLeads]);

  const send = async () => {
    const message = input.trim();
    if (!message || loading) return;
    if (message.length > 5000) { toast.error("Mensagem excede 5.000 caracteres."); return; }
    const cleanUrls = urls.map((u) => u.trim()).filter(Boolean);
    const history = messages.slice(-10).map((m) => ({ role: m.role, content: m.content }));
    setMessages((prev) => [...prev, { role: "user", content: message + (cleanUrls.length ? `\n\n🔗 ${cleanUrls.join("\n🔗 ")}` : "") }]);
    setInput("");
    setLoading(true);
    setAccessError(null);
    const { data, error } = await supabase.functions.invoke("ai-market-analysis", {
      body: { action: "research", message, urls: cleanUrls, history },
    });
    setLoading(false);
    if (error) {
      const msg = await readError(error);
      if (error instanceof FunctionsHttpError && [401, 403].includes(error.context.status)) setAccessError(msg);
      setMessages((prev) => [...prev, { role: "assistant", content: `⚠️ ${msg}` }]);
      return;
    }
    setUrls(["", "", ""]);
    setMessages((prev) => [...prev, { role: "assistant", content: data.reply, ficha: data.ficha, aviso: data.aviso }]);
  };

  const saveLead = async (idx: number, ficha: Ficha) => {
    setSavingIdx(idx);
    const { error } = await supabase.functions.invoke("ai-market-analysis", {
      body: { action: "research_save_lead", titulo: String(ficha.titulo ?? "Estratégia sem título"), ficha },
    });
    setSavingIdx(null);
    if (error) { toast.error(await readError(error)); return; }
    toast.success("Lead salvo.");
    loadLeads();
  };

  const updateStatus = async (id: string, status: string) => {
    const { error } = await supabase.from("strategy_leads").update({ status }).eq("id", id);
    if (error) { toast.error(`Falha ao atualizar: ${error.message}`); return; }
    setLeads((prev) => prev.map((l) => (l.id === id ? { ...l, status } : l)));
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
      <Card className="xl:col-span-2 bg-card/50 backdrop-blur-sm border-border/40">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5 text-primary" /> Pesquisa de estratégias
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Pesquisa web, matérias, repositórios do GitHub e transcrições do YouTube. Somente leitura: não executa ordens.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {accessError && (
            <Alert variant="destructive"><AlertDescription>{accessError}</AlertDescription></Alert>
          )}
          <div className="max-h-[60vh] overflow-y-auto space-y-3 pr-1">
            {messages.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Ex.: "Pesquise estratégias de scalping com VWAP em BTC no M1 e compare com este repositório."
              </p>
            )}
            {messages.map((m, i) => (
              <div key={i} className={m.role === "user" ? "ml-8 rounded-lg bg-primary/10 p-3" : "mr-4 rounded-lg bg-muted/40 p-3"}>
                <p className="whitespace-pre-wrap text-sm">{m.content}</p>
                {m.aviso && <p className="mt-2 text-xs text-destructive">{m.aviso}</p>}
                {m.ficha && <FichaView ficha={m.ficha} saving={savingIdx === i} onSave={() => saveLead(i, m.ficha!)} />}
              </div>
            ))}
            {loading && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Pesquisando…
              </div>
            )}
          </div>
          <div className="space-y-2">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {urls.map((u, i) => (
                <Input
                  key={i}
                  value={u}
                  placeholder={`URL opcional ${i + 1} (matéria, repo, vídeo)`}
                  onChange={(e) => setUrls((prev) => prev.map((x, j) => (j === i ? e.target.value : x)))}
                />
              ))}
            </div>
            <Textarea
              value={input}
              maxLength={5000}
              rows={3}
              placeholder="O que você quer pesquisar?"
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
            />
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">{input.length}/5000 · máx. 20 pesquisas/hora</span>
              <Button onClick={send} disabled={loading || !input.trim()}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />} Pesquisar
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-card/50 backdrop-blur-sm border-border/40">
        <CardHeader><CardTitle className="text-base">Leads de estratégia</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {leads.length === 0 && <p className="text-sm text-muted-foreground">Nenhum lead salvo ainda.</p>}
          {leads.map((l) => (
            <div key={l.id} className="rounded-lg border border-border/40 p-3 space-y-2">
              <p className="text-sm font-medium">{l.titulo}</p>
              <p className="text-xs text-muted-foreground">{new Date(l.created_at).toLocaleString("pt-BR")}</p>
              <Select value={l.status} onValueChange={(v) => updateStatus(l.id, v)}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(STATUS_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
              {l.status === "aprovada_para_backtest" && (
                <Button size="sm" variant="outline" disabled className="w-full">
                  <FlaskConical className="h-4 w-4" /> Enviar para backtest (em breve)
                </Button>
              )}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
