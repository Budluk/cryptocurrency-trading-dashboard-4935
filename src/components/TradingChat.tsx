import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Bot, Loader2, MessageSquare, Send, Trash2 } from "lucide-react";
import { toast } from "sonner";

type Msg = { id: string; role: "user" | "assistant"; content: string; proposal?: { summary: string } | null; proposal_status?: string | null };

const STATUS: Record<string, string> = { pending: "Aguardando", executed: "Executada", cancelled: "Cancelada", failed: "Falhou" };

async function call(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke("bybit-trading", { body });
  if (error) {
    let msg = error.message;
    try { msg = (await (error as any).context?.json())?.error || msg; } catch { /* */ }
    throw new Error(msg);
  }
  return data;
}

export function TradingChat() {
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
    const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const load = async () => {
    try { const d = await call({ action: "chat_history" }); setMsgs(d.messages || []); }
    catch (e) { toast.error((e as Error).message); }
  };

  useEffect(() => { if (open) { load(); setTimeout(() => inputRef.current?.focus(), 100); } }, [open]);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs, busy]);

  const send = async () => {
    const t = text.trim();
    if (!t || busy) return;
    setText("");
    setMsgs((m) => [...m, { id: `tmp-${Date.now()}`, role: "user", content: t }]);
    setBusy(true);
    try { await call({ action: "chat_send", message: t }); }
    catch (e) { toast.error((e as Error).message); }
    await load();
    setBusy(false);
    inputRef.current?.focus();
  };

  const [api, setApi] = useState<{ ok: boolean; problem?: string; warning?: string | null; daysLeft?: number | null } | null>(null);
  useEffect(() => {
    call({ action: "chat_api_status" }).then(setApi).catch(() => {});
    const t = setInterval(() => call({ action: "chat_api_status" }).then(setApi).catch(() => {}), 30 * 60 * 1000);
    return () => clearInterval(t);
  }, []);
  const apiAlert = api && (!api.ok ? `Chave da Bybit com problema: ${api.problem}` : api.warning);

  const clear = async () => {
    if (!confirm("Apagar todo o histórico do chat?")) return;
    try { await call({ action: "chat_clear" }); setMsgs([]); } catch (e) { toast.error((e as Error).message); }
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
                  Pergunte sobre suas posições, a estratégia, ou peça para abrir, fechar ou ajustar uma ordem. Ordens pedidas aqui são executadas na hora, com stop obrigatório (máx 0,5%) e alavancagem até 8x.
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
                    <div className="text-sm whitespace-pre-wrap text-foreground">{m.content}</div>
                  )}
                </div>
              ))}
              {busy && <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Analisando...</div>}
              <div ref={endRef} />
            </div>
          </ScrollArea>
          <div className="border-t border-border/50 p-3 flex gap-2 items-end">
            <Textarea ref={inputRef} value={text} onChange={(e) => setText(e.target.value)} rows={2}
              placeholder="Ex: como estão minhas posições?" className="resize-none min-h-[44px]"
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }} />
            <Button size="icon" onClick={send} disabled={busy || !text.trim()} aria-label="Enviar" className="h-11 w-11 shrink-0">
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
