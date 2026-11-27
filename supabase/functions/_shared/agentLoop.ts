// Loop server-side do agente autônomo. Roda como action dentro de
// ai-market-analysis (não cria Edge Function nova, conforme AGENTS.md).
//
// - agent_loop (a cada 5 min): busca klines/ticker públicos da Bybit,
//   calcula indicadores, aplica os gates de risco e pede uma decisão JSON à IA.
//   NUNCA executa ordem: grava ai_decisions + agent_routine_log para auditoria.
// - agent_daily (00:00 UTC): recalcula o desempenho das últimas 24h por usuário,
//   registra a rotina e prepara o kill switch se o drawdown atingir -2%.
import { aiFetch } from './aiRouter.ts';
import { AUTONOMOUS_SYSTEM_PROMPT } from './autonomousPrompt.ts';
import { guardFromState, dailyReview, isDailyWindow, type AgentStateRow, type AgentTradeRow } from './autonomousAgent.ts';
import { candlesFromBybitKlines, indicatorSummary, type Candle } from './indicators.ts';

export const SYSTEM_USER_ID = '00000000-0000-0000-0000-000000000001';
const DEFAULT_SYMBOLS = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT'];
const BYBIT = 'https://api.bybit.com/v5/market';

export interface LoopOptions {
  symbols?: string[];
  interval?: string;
  limit?: number;
  force?: boolean; // ignora janela 00:00-00:05 (uso em testes/manutenção)
}

// Tipagem deliberadamente solta: o schema gerado ainda não conhece as tabelas
// agent_* e as versões de supabase-js diferem entre functions. O runtime é o
// mesmo; a validação real acontece nos testes e no retorno `error` de cada call.
export type Db = { from(table: string): any };

const clampConf = (n: unknown): number => {
  const x = Number(n);
  if (!Number.isFinite(x)) return 0;
  return Math.max(0, Math.min(100, Math.round(x)));
};

/** Extrai o primeiro objeto JSON de uma resposta do modelo (tolerante a ```json). */
export function extractJson(text: string): Record<string, unknown> | null {
  if (!text) return null;
  const cleaned = text.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try {
    const parsed = JSON.parse(cleaned.slice(start, end + 1));
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null;
  } catch { return null; }
}

export function normalizeAction(action: unknown): 'BUY' | 'SELL' | 'WAIT' {
  const a = String(action ?? '').toUpperCase();
  if (a === 'BUY' || a === 'LONG' || a === 'COMPRAR') return 'BUY';
  if (a === 'SELL' || a === 'SHORT' || a === 'VENDER') return 'SELL';
  return 'WAIT';
}

async function fetchCandles(symbol: string, interval: string, limit: number): Promise<Candle[]> {
  const res = await fetch(`${BYBIT}/kline?category=linear&symbol=${symbol}&interval=${interval}&limit=${limit}`, {
    signal: AbortSignal.timeout(15000),
  });
  const data = await res.json();
  if (Number(data?.retCode) !== 0) throw new Error(data?.retMsg || 'kline indisponível');
  return candlesFromBybitKlines(data?.result);
}

async function fetchTicker(symbol: string): Promise<{ price?: number; spreadPct?: number }> {
  try {
    const res = await fetch(`${BYBIT}/tickers?category=linear&symbol=${symbol}`, { signal: AbortSignal.timeout(10000) });
    const data = await res.json();
    const t = data?.result?.list?.[0];
    const bid = Number(t?.bid1Price);
    const ask = Number(t?.ask1Price);
    const price = Number(t?.lastPrice);
    const spreadPct = bid > 0 && ask > 0 ? (Math.abs(ask - bid) / ((ask + bid) / 2)) * 100 : undefined;
    return { price: Number.isFinite(price) ? price : undefined, spreadPct };
  } catch { return {}; }
}

function marketFromIndicators(ind: ReturnType<typeof indicatorSummary>, ticker: { price?: number; spreadPct?: number }) {
  const num = (v: unknown): number | undefined => {
    const x = Number(v);
    return Number.isFinite(x) ? x : undefined;
  };
  const bb = ind.bollinger && typeof ind.bollinger === 'object'
    ? (ind.bollinger as { widthPct?: number })
    : null;
  return {
    price: num(ind.preco) ?? ticker.price,
    ema20: num(ind.ema20),
    ema50: num(ind.ema50),
    adx: num(ind.adx14),
    atrPct: num(ind.atrPct),
    bbWidthPct: bb?.widthPct,
    rsi: num(ind.rsi14),
    rvol: num(ind.rvol20),
    spreadPct: ticker.spreadPct,
  };
}

async function askAiDecision(symbol: string, market: Record<string, unknown>, gate: { tradable: boolean; reasons: string[]; regime: string }) {
  const system = `${AUTONOMOUS_SYSTEM_PROMPT}

Você está rodando no LOOP AUTÔNOMO (sem conversa). Responda APENAS com JSON válido:
{"action":"BUY|SELL|WAIT","confidence":0-100,"entry":0,"stop":0,"target":0,"reasoning":"max 200 caracteres"}
Se o gate estiver bloqueado, retorne obrigatoriamente {"action":"WAIT","confidence":0,...,"reasoning":"BLOQUEADO: <motivo>"}.`;
  try {
    const res = await aiFetch({
      method: 'POST',
      headers: { Authorization: `Bearer ${Deno.env.get('LOVABLE_API_KEY')}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'google/gemini-3.8-flash',
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: `symbol=${symbol}\nmarket=${JSON.stringify(market)}\ngate=${JSON.stringify(gate)}` },
        ],
        temperature: 0.2,
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const content = String(data?.choices?.[0]?.message?.content ?? '');
    return extractJson(content);
  } catch { return null; }
}

async function readState(db: Db, symbol: string): Promise<(AgentStateRow & { user_id?: string }) | null> {
  try {
    const { data, error } = await db.from('agent_state').select('*').eq('symbol', symbol)
      .order('updated_at', { ascending: false }).limit(1);
    if (error) return null;
    return data?.[0] ?? null;
  } catch { return null; }
}

async function readTrades(db: Db, userId: string): Promise<AgentTradeRow[]> {
  try {
    const { data, error } = await db.from('agent_trades').select('*').eq('user_id', userId)
      .order('opened_at', { ascending: false }).limit(300);
    return error ? [] : (data ?? []);
  } catch { return []; }
}

export async function runAgentLoop(db: Db, opts: LoopOptions = {}) {
  const symbols = (opts.symbols?.length ? opts.symbols : DEFAULT_SYMBOLS).map((s) => String(s).toUpperCase());
  const interval = opts.interval || '5';
  const limit = Math.min(Math.max(Number(opts.limit) || 200, 30), 1000);
  const now = new Date();
  const utcHour = now.getUTCHours();
  const results: any[] = [];

  for (const symbol of symbols) {
    try {
      const [candles, ticker] = await Promise.all([
        fetchCandles(symbol, interval, limit),
        fetchTicker(symbol),
      ]);
      if (candles.length < 15) {
        results.push({ symbol, status: 'insufficient_data', candles: candles.length });
        continue;
      }
      const ind = indicatorSummary(candles);
      const market = marketFromIndicators(ind, ticker);
      const state = await readState(db, symbol);
      const userId = state?.user_id ?? SYSTEM_USER_ID;
      const trades = await readTrades(db, userId);
      const review = dailyReview(trades, now);
      const gate = guardFromState(state, market, utcHour, now, review.trades ? review.winRate : undefined);

      let decision = gate.tradable ? await askAiDecision(symbol, market, gate) : null;
      if (!gate.tradable) {
        decision = { action: 'WAIT', confidence: 0, reasoning: `BLOQUEADO: ${gate.reasons.join('; ')}` };
      }
      const action = normalizeAction(decision?.action);
      const confidence = gate.tradable ? clampConf(decision?.confidence) : 0;
      const blocked = !gate.tradable || action === 'WAIT';

      const row = {
        user_id: userId,
        symbol,
        final_action: action,
        final_confidence: confidence,
        target_price: Number(decision?.target) || undefined,
        stop_loss: Number(decision?.stop) || undefined,
        leverage: Number(decision?.leverage) || undefined,
        sources: ['agent_loop'],
        gate_pass: !blocked,
        gate_blocked_by: gate.reasons.length ? gate.reasons : (blocked ? ['ai_wait'] : null),
        consensus: true,
        raw_sources: [{ source: 'agent_loop', action, confidence, regime: gate.regime, reasoning: decision?.reasoning ?? '', indicators: ind }],
        created_at: now.toISOString(),
      };
      const insert = await db.from('ai_decisions').insert(row);
      const logKind = gate.reasons.some((r) => r.includes('kill')) ? 'kill_switch'
        : gate.blacklisted ? 'blacklist' : 'loop';
      const log = await db.from('agent_routine_log').insert({
        user_id: userId,
        kind: logKind,
        summary: `${symbol} ${action} ${confidence}% (${gate.regime}${gate.reasons.length ? '; ' + gate.reasons.join('; ') : ''})`,
        payload: { gate, indicators: ind, decision, review: { winRate: review.winRate, dailyPnlPct: review.dailyPnlPct } },
      });

      results.push({
        symbol,
        status: 'ok',
        action,
        confidence,
        regime: gate.regime,
        tradable: gate.tradable,
        reasons: gate.reasons,
        logged: !insert.error && !log.error,
      });
    } catch (e) {
      results.push({ symbol, status: 'error', error: (e as Error).message });
    }
  }

  return { action: 'agent_loop', at: now.toISOString(), results };
}

export async function runAgentDaily(db: Db, opts: LoopOptions = {}) {
  const now = new Date();
  if (!opts.force && !isDailyWindow(now)) {
    return { action: 'agent_daily', skipped: true, reason: 'fora da janela 00:00-00:05 UTC', at: now.toISOString() };
  }

  try {
    const { data, error } = await db.from('agent_trades').select('*')
      .order('opened_at', { ascending: false }).limit(1000);
    if (error) throw error;
    const trades = (data ?? []) as (AgentTradeRow & { user_id: string })[];
    const byUser = new Map<string, AgentTradeRow[]>();
    for (const t of trades) {
      const uid = t.user_id || SYSTEM_USER_ID;
      byUser.set(uid, [...(byUser.get(uid) ?? []), t]);
    }
    if (byUser.size === 0) byUser.set(SYSTEM_USER_ID, []);

    const reviews: any[] = [];
    for (const [userId, userTrades] of byUser) {
      const review = dailyReview(userTrades, now);
      // Novo dia: zera o P&L diário; kill ativo por drawdown vira pausa de 3h.
      const existing = await db.from('agent_state').select('*').eq('user_id', userId);
      const states = existing.data ?? [];
      const nextKillUntil = review.killActive
        ? new Date(now.getTime() + 3 * 3600_000).toISOString()
        : null;
      for (const st of states) {
        const keepKill = st.kill_until && new Date(st.kill_until) > now ? st.kill_until : nextKillUntil;
        await db.from('agent_state').upsert({
          user_id: userId,
          symbol: st.symbol,
          consecutive_losses: st.consecutive_losses,
          consecutive_stops: st.consecutive_stops,
          daily_pnl_pct: 0,
          kill_until: keepKill,
          blacklisted: st.blacklisted,
          last_signal_at: st.last_signal_at,
          updated_at: now.toISOString(),
        }, { onConflict: 'user_id,symbol' });
      }
      await db.from('agent_routine_log').insert({
        user_id: userId,
        kind: review.killActive ? 'kill_switch' : 'daily',
        summary: `${review.trades} trades 24h, win rate ${review.winRate.toFixed(1)}%, P&L ${review.dailyPnlPct.toFixed(2)}%, PF ${review.profitFactor}`,
        payload: review,
      });
      reviews.push({ userId, ...review });
    }

    return { action: 'agent_daily', at: now.toISOString(), reviews };
  } catch (e) {
    return { action: 'agent_daily', error: (e as Error).message, at: now.toISOString() };
  }
}
