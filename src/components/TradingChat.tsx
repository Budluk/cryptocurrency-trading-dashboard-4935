import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { BookOpen, Bot, FileText, Loader2, MessageSquare, Paperclip, Send, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { filesToAttachments, isResearchMessage, MAX_CHAT_FILES, type ChatAttachment } from "@/lib/chatAttachments";

type Ficha = Record<string, unknown> & { titulo?: string };
type Msg = {
  id: string;
  role: "user" | "assistant";
  content: string;
  proposal?: { summary: string } | null;
  proposal_status?: string | null;
  research?: boolean;
  ficha?: Ficha | null;
};

const STATUS: Record<string, string> = { pending: "Aguardando", executed: "Executada", cancelled: "Cancelada", failed: "Falhou" };

async function invokeFunction(name: string, body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke(name, { body });
  if (error) {
    let msg = error.message;
    const ctx = error as { context?: { json?: () => Promise<{ error?: string }> } };
    try { msg = (await ctx.context?.json?.())?.error || msg; } catch { /* mantém mensagem original */ }
    throw new Error(msg);
  }
  return data;
}

const callTrading = (body: Record<string, unknown>) => invokeFunction("bybit-trading", body);
const callResearch = (body: Record<string, unknown>) => invokeFunction("ai-market-analysis", body);

const SUGGESTIONS = [
  { label: "Analisar repositório do projeto", value: "Leia https://github.com/Budluk/cryptocurrency-trading-dashboard-4935 e sugira melhorias no robô", research: false },
  { label: "Ler arquivo do repositório", value: "Explique este código: https://github.com/Budluk/cryptocurrency-trading-dashboard-4935/blob/main/src/components/MultiAssetTrader.tsx", research: false },
  { label: "Resumir vídeo", value: "Leia este vídeo e extraia a estratégia: ", research: false },
  { label: "Pesquisar com fontes", value: "Pesquise estratégias de scalping para BTC com fontes recentes", research: true },
];

export function TradingChat() {
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [files, setFiles] = useState<ChatAttachment[]>([]);
  const [forceResearch, setForceResearch] = useState(false);
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    try { const d = await callTrading({ action: "chat_history" }); setMsgs((d?.messages as Msg[]) || []); }
    catch (e) { toast.error((e as Error).message); }
  };

  useEffect(() => { if (open) { load(); setTimeout(() => inputRef.current?.focus(), 100); } }, [open]);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs, busy]);

  const pickFiles = async (event: ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (!picked.length) return;
    try {
      const parsed = await filesToAttachments(picked);
      setFiles((prev) => [...prev.filter((f) => !parsed.some((p) => p.name === f.name)), ...parsed].slice(0, MAX_CHAT_FILES));
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const send = async () => {
    const t = text.trim();
    if ((!t && !files.length) || busy) return;
    const attachments = [...files];
    const researching = forceResearch || isResearchMessage(t, attachments);
    const userContent = `${t || "Analise os arquivos anexados."}${attachments.length ? `\n📎 ${attachments.map((a) => a.name).join(", ")}` : ""}`;
    const userMsgId = `tmp-${Date.now()}`;
    setText("");
    setFiles([]);
    setForceResearch(false);
    setMsgs((m) => [...m, { id: userMsgId, role: "user", content: userContent, research: researching }]);
    setBusy(true);
    try {
      if (researching) {
        const data = await callResearch({
          action: "research",
          message: t || "Analise os arquivos anexados.",
          attachments,
          history: msgs.slice(-10).map(({ role, content }) => ({ role, content })),
          persist_chat: true,
        }) as { reply?: string; ficha?: Ficha | null };
        setMsgs((m) => [...m, {
          id: `r-${Date.now()}`,
          role: "assistant",
          content: String(data?.reply ?? "Sem resposta."),
          research: true,
          ficha: data?.ficha ?? null,
        }]);
      } else {
        await callTrading({ action: "chat_send", message: t });
      }
    } catch (e) {
      setMsgs((m) => m.filter((msg) => msg.id !== userMsgId));
      setText(t);
      setFiles(attachments);
      toast.error((e as Error).message);
    } finally {
      await load();
      setBusy(false);
      inputRef.current?.focus();
    }
  };

  const [api, setApi] = useState<{ ok: boolean; problem?: string; warning?: string | null; daysLeft?: number | null } | null>(null);
  useEffect(() => {
    callTrading({ action: "chat_api_status" }).then(setApi).catch(() => {});
    const timer = setInterval(() => callTrading({ action: "chat_api_status" }).then(setApi).catch(() => {}), 30 * 60 * 1000);
    return () => clearInterval(timer);
  }, []);
  const apiAlert = api && (!api.ok ? `Chave da Bybit com problema: ${api.problem}` : api.warning);

  const clear = async () => {
    if (!confirm("Apagar todo o histórico do chat?")) return;
    try { await callTrading({ action: "chat_clear" }); setMsgs([]); } catch (e) { toast.error((e as Error).message); }
  };

  return (
    <>
      <Button onClick={() => setOpen(true)} size="lg" aria-label="Abrir chat de trading"
        className="fixed bottom-5 right-5 z-50 h-14 w-14 rounded-full shadow-lg p-0">
        <MessageSquare className="h-6 w-6" />
        {apiAlert && <span className="absolute top-1 right-1 h-3 w-3 rounded-full bg-destructive" />}
      </Button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="w-full sm:max-w-md flex flex-col p-0 gap-0">
          <SheetHeader className="px-4 py-3 border-b border-border/50 flex-row items-center justify-between space-y-0">
            <SheetTitle className="flex items-center gap-2"><Bot className="h-5 w-5 text-primary" /> Assistente de Trading</SheetTitle>
            <Button variant="ghost" size="icon" onClick={clear} aria-label="Limpar histórico" className="mr-6"><Trash2 className="h-4 w-4" /></Button>
          </SheetHeader>
          {apiAlert && <div className="mx-4 mt-3 rounded-lg border border-destructive/50 bg-destructive/10 px-3 py-2 text-xs text-destructive">{apiAlert}</div>}
          <ScrollArea className="flex-1 px-4">
            <div className="py-4 space-y-3">
              {msgs.length === 0 && !busy && (
                <p className="text-sm text-muted-foreground text-center py-8">
                  Pergunte sobre posições ou estratégia. Cole um link do GitHub, um vídeo do YouTube, um artigo ou anexe arquivos de texto/código: eu leio antes de responder e cito as fontes. Nesse modo de pesquisa nenhuma ordem é executada. No chat normal, ordens são executadas com stop obrigatório (máx. 0,5%) e alavancagem até 8x.
                </p>
              )}
              {msgs.map((m) => (
                <div key={m.id} className={m.role === "user" ? "flex justify-end" : ""}>
                  {m.role === "user" ? (
                    <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-primary text-primary-foreground px-3 py-2 text-sm whitespace-pre-wrap">{m.content}</div>
                  ) : m.proposal ? (
                    <div className="rounded-xl border border-primary/40 bg-card/60 p-3 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-sm">{m.proposal.summary}</span>
                        <Badge variant={m.proposal_status === "executed" ? "default" : "secondary"}>{STATUS[m.proposal_status || "pending"]}</Badge>
                      </div>
                      {m.content && <p className="text-xs text-muted-foreground">{m.content}</p>}
                    </div>
                  ) : (
                    <div className="max-w-[95%] space-y-2">
                      {m.research && <Badge variant="secondary" className="gap-1"><BookOpen className="h-3 w-3" /> Pesquisa</Badge>}
                      <div className="text-sm whitespace-pre-wrap text-foreground">{m.content}</div>
                      {m.ficha && (
                        <details className="rounded-lg border border-border/60 bg-card/40 p-2 text-xs">
                          <summary className="cursor-pointer text-muted-foreground">
                            Ver ficha estruturada: {String(m.ficha.titulo ?? "Estratégia sem título")}
                          </summary>
                          <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap text-[11px]">{JSON.stringify(m.ficha, null, 2)}</pre>
                        </details>
                      )}
                    </div>
                  )}
                </div>
              ))}
              {busy && <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Lendo fontes e analisando...</div>}
              <div ref={endRef} />
            </div>
          </ScrollArea>
          <div className="flex gap-2 overflow-x-auto px-3 py-2 border-t border-border/50">
            {SUGGESTIONS.map((s) => (
              <button key={s.label} type="button" disabled={busy}
                onClick={() => { setText(s.value); setForceResearch(s.research); inputRef.current?.focus(); }}
                className="shrink-0 rounded-full border border-border bg-card/60 px-3 py-1 text-xs text-muted-foreground hover:text-foreground hover:border-primary/50">
                {s.label}
              </button>
            ))}
          </div>
          {files.length > 0 && (
            <div className="flex flex-wrap gap-2 px-3 py-2 border-t border-border/50">
              {files.map((f, i) => (
                <span key={`${f.name}-${i}`} className="inline-flex items-center gap-1 rounded-full border border-primary/40 bg-primary/10 px-2 py-1 text-xs">
                  <FileText className="h-3 w-3" /> {f.name}
                  <button type="button" onClick={() => setFiles((prev) => prev.filter((_, j) => j !== i))} aria-label={`Remover ${f.name}`}>
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
          <div className="border-t border-border/50 p-3 flex gap-2 items-end">
            <input ref={fileRef} type="file" multiple hidden
              accept=".txt,.md,.markdown,.ts,.tsx,.js,.jsx,.json,.py,.sql,.csv,.log,.yml,.yaml,.toml,.pine,.html,.css,.env"
              onChange={pickFiles} />
            <Button variant={forceResearch ? "default" : "ghost"} size="icon" onClick={() => setForceResearch((v) => !v)}
              disabled={busy} aria-label="Alternar modo pesquisa" title="Modo pesquisa: lê fontes sem executar ordens">
              <BookOpen className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => fileRef.current?.click()} disabled={busy}
              aria-label="Anexar arquivos de texto/código" title="Anexar até 5 arquivos de texto/código">
              <Paperclip className="h-4 w-4" />
            </Button>
            <Textarea ref={inputRef} value={text} onChange={(e) => setText(e.target.value)} rows={2}
              placeholder="Pergunte, cole um link do GitHub/YouTube ou anexe arquivos..."
              className="resize-none min-h-[44px]"
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }} />
            <Button size="icon" onClick={send} disabled={busy || (!text.trim() && !files.length)} aria-label="Enviar" className="h-11 w-11 shrink-0">
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
