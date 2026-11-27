// Trading chat assistant (served through bybit-trading, actions chat_*). Orders execute automatically within hard risk limits.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { aiFetch, webSearchFetch } from './aiRouter.ts';
import { TRADING_CHAT_SYSTEM } from './autonomousPrompt.ts';
import { RISK, clampLeverage, maxRiskQuantity } from './autonomousRisk.ts';
import { applyTradeResult, dailyReview, guardFromState } from './autonomousAgent.ts';
import { candlesFromBybitKlines, indicatorSummary } from './indicators.ts';

type Exec = (action: string, params?: Record<string, unknown>) => Promise<any>;
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };
const ANON_ID = '00000000-0000-0000-0000-000000000001';
export const LIMITS = {
  maxLeverage: RISK.maxLeverage,
  hardMaxLeverage: RISK.hardLeverageCap,
  maxStopPct: RISK.maxStopPct,
  maxRiskPct: RISK.maxRiskPct,
};
const SYSTEM = TRADING_CHAT_SYSTEM;
const json = (d: unknown, status = 200) => new Response(JSON.stringify(d), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

const fn = (name: string, description: string, properties: Record<string, unknown>, required: string[]) =>
  ({ type: 'function', function: { name, description, parameters: { type: 'object', properties, required } } });
const str = { type: 'string' }; const num = { type: 'number' }; const side = { type: 'string', enum: ['Buy', 'Sell'] };
const TOOLS = [
  fn('get_positions', 'Posições abertas na Bybit', {}, []),
  fn('get_balance', 'Saldo da conta Bybit', {}, []),
  fn('get_ticker', 'Preço atual de um símbolo', { symbol: str }, ['symbol']),
  fn('get_closed_pnl', 'Últimos trades fechados com P&L', { limit: num }, []),
  fn('get_strategy_config', 'Configuração atual do robô e aprendizado do ML', {}, []),
  fn('scan_market', 'Lista os ativos perpétuos USDT da Bybit mais negociados, com variação 24h', { top: num }, []),
  fn('get_indicators', 'Calcula indicadores determinísticos (ATR, RSI, ADX, VWAP, EMA, Bollinger, RVOL) e o gate de risco de um ativo', { symbol: str, interval: str, limit: num }, ['symbol']),
  fn('agent_status', 'Lê a memória persistente do agente (kill switch, blacklist, trades e desempenho recente)', { symbol: str }, []),
  fn('agent_record_result', 'Registra o resultado de um trade fechado na memória do agente e atualiza kill switch/blacklist', { symbol: str, result: { type: 'string', enum: ['win', 'loss', 'stop'] }, pnlPct: num }, ['symbol', 'result', 'pnlPct']),
  fn('daily_review', 'Executa a rotina diária das 00:00 UTC: P&L, win rate, profit factor, drawdown e melhores ativos', {}, []),
  fn('check_api', 'Verifica a chave da API Bybit: validade, permissões, vencimento', {}, []),
  fn('execute_order', 'ABRE ordem real imediatamente', { symbol: str, side, qty: num, orderType: { type: 'string', enum: ['Market', 'Limit'] }, price: num, stopLoss: num, takeProfit: num, leverage: num, reason: str }, ['symbol', 'side', 'qty', 'stopLoss', 'reason']),
  fn('execute_close', 'FECHA posição real imediatamente', { symbol: str, side: { ...side, description: 'lado da posição aberta' }, qty: num, reason: str }, ['symbol', 'side', 'qty', 'reason']),
  fn('execute_set_stop', 'AJUSTA SL/TP de posição real imediatamente', { symbol: str, stopLoss: num, takeProfit: num, reason: str }, ['symbol', 'reason']),
  // New research tools
  fn('web_search', 'Pesquisa na web (notícias, artigos) baseada em uma query.', { query: str }, ['query']),
  fn('fetch_page', 'Recupera o texto puro de uma página web.', { url: str }, ['url']),
  fn('github_repo', 'Lê informações de um repositório público do GitHub, opcionalmente um arquivo.', { owner: str, repo: str, path: str }, ['owner', 'repo']),
  fn('youtube_transcript', 'Obtém a transcrição de um vídeo do YouTube.', { url: str }, ['url']),
];
const cut = (v: unknown) => JSON.stringify(v).slice(0, 6000);
const safe = async (p: Promise<any>) => { try { return { ok: true, data: await p }; } catch (e) { return { ok: false, error: (e as Error).message }; } };

// ---- Research capabilities (read-only) -------------------------------------
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';
const decodeEntities = (s: string) => s
  .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&#x27;/g, "'")
  .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));

// Read-only URL fetching must never reach private/metadata networks.
function isPublicHttpUrl(raw: string): boolean {
  try {
    const u = new URL(raw);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return false;
    const h = u.hostname.toLowerCase().replace(/^\[|\]$/g, '');
    if (h === 'localhost' || h.endsWith('.localhost') || h.endsWith('.local') || h.endsWith('.internal')) return false;
    if (h.includes(':')) return false; // IPv6 literal (loopback/link-local ambiguity)
    if (/^(\d{1,3}\.){3}\d{1,3}$/.test(h)) {
      const [a, b] = h.split('.').map(Number);
      if (a === 0 || a === 10 || a === 127 || a >= 224
        || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31)
        || (a === 192 && b === 168)) return false;
    }
    return true;
  } catch { return false; }
}

async function fetchPage(url: string): Promise<string> {
  if (!isPublicHttpUrl(url)) return 'URL inválida ou não pública.';
  try {
    const res = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(15000), redirect: 'follow' });
    if (!res.ok) return `Não consegui abrir a fonte (HTTP ${res.status}).`;
    const html = await res.text();
    return decodeEntities(html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ').trim()).slice(0, 12000) || 'Página sem conteúdo textual legível.';
  } catch (e) { return `Não consegui abrir a fonte: ${(e as Error).message}`; }
}

async function githubRepo(owner: string, repo: string, path?: string): Promise<string> {
  if (!/^[\w.-]+$/.test(owner) || !/^[\w.-]+$/.test(repo)) return 'owner/repo inválidos.';
  const token = Deno.env.get('GITHUB_TOKEN');
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'trading-chat-research',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
  const gh = async (p: string) => {
    const res = await fetch(`https://api.github.com${p}`, { headers, signal: AbortSignal.timeout(15000) });
    if (!res.ok) throw new Error(`GitHub API HTTP ${res.status}`);
    return res.json();
  };
  try {
    const base = `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;
    const meta = await gh(base);
    const out: Record<string, unknown> = {
      nome: meta.full_name, descricao: meta.description, stars: meta.stargazers_count,
      licenca: meta.license?.spdx_id ?? 'desconhecida', ultimo_commit: meta.pushed_at,
      linguagem: meta.language,
      aviso_licenca: ['GPL-2.0', 'GPL-3.0', 'AGPL-3.0'].includes(meta.license?.spdx_id)
        ? 'ATENÇÃO: licença copyleft — uso comercial pode exigir abrir o código derivado.' : undefined,
    };
    try { out.arquivos = ((await gh(`${base}/git/trees/HEAD?recursive=1`)).tree ?? [])
      .filter((t: { type: string }) => t.type === 'blob').map((t: { path: string }) => t.path).slice(0, 300); }
    catch { out.arquivos = 'indisponível'; }
    if (path) {
      const file = await gh(`${base}/contents/${path.replace(/^\/+/, '')}`);
      if ((file.size ?? 0) > 200 * 1024) out.arquivo_lido = `Arquivo excede 200 KB (${file.size} bytes).`;
      else if (file.content) out.arquivo_lido = { path, conteudo: atob(file.content.replace(/\n/g, '')).slice(0, 20000) };
      else out.arquivo_lido = 'Sem conteúdo de texto (binário?).';
    }
    return JSON.stringify(out).slice(0, 16000);
  } catch (e) { return `Não consegui ler o repositório: ${(e as Error).message}`; }
}

async function youtubeTranscript(url: string): Promise<string> {
  const m = url.match(/(?:v=|youtu\.be\/|shorts\/|embed\/)([\w-]{11})/);
  if (!m) return 'URL de vídeo do YouTube inválida.';
  try {
    const html = await (await fetch(`https://www.youtube.com/watch?v=${m[1]}`, {
      headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(15000),
    })).text();
    const cap = html.match(/"captionTracks":(\[.*?\])/);
    if (!cap) return 'Vídeo sem transcrição disponível.';
    const tracks = JSON.parse(cap[1]);
    const track = tracks.find((t: { languageCode?: string }) => t.languageCode?.startsWith('pt')) ?? tracks[0];
    if (!isPublicHttpUrl(track.baseUrl)) return 'Transcrição indisponível (URL insegura).';
    const xml = await (await fetch(track.baseUrl, { signal: AbortSignal.timeout(15000) })).text();
    const text = [...xml.matchAll(/<text[^>]*>([\s\S]*?)<\/text>/g)].map((x) => decodeEntities(x[1])).join(' ').replace(/\s+/g, ' ').trim();
    return text ? text.slice(0, 12000) : 'Vídeo sem transcrição disponível.';
  } catch (e) { return `Não consegui obter a transcrição: ${(e as Error).message}`; }
}

export async function apiStatus(exec: Exec) {
  const r = await safe(exec('get_api_info'));
  if (!r.ok) return { ok: false, problem: r.error };
  const d = r.data || {};
  const exp = d.expiredAt ? new Date(d.expiredAt) : null;
  const days = exp ? Math.floor((exp.getTime() - Date.now()) / 86400000) : null;
  return { ok: true, readOnly: d.readOnly === 1, permissions: d.permissions, ips: d.ips, expiresAt: exp?.toISOString() ?? null, daysLeft: days, warning: days !== null && days <= 7 ? `Chave vence em ${days} dia(s)` : null };
}

const toNum = (v: unknown): number | undefined => {
  const x = Number(v);
  return Number.isFinite(x) ? x : undefined;
};

async function readAgentState(db: any, userId: string, symbol?: string): Promise<any | null> {
  try {
    let q = db.from('agent_state').select('*').eq('user_id', userId);
    if (symbol) q = q.eq('symbol', symbol);
    const { data, error } = await q.order('updated_at', { ascending: false }).limit(symbol ? 1 : 50);
    if (error) return null;
    return symbol ? (data?.[0] ?? null) : data;
  } catch { return null; }
}

async function readAgentTrades(db: any, userId: string): Promise<any[]> {
  try {
    const { data, error } = await db.from('agent_trades').select('*').eq('user_id', userId)
      .order('opened_at', { ascending: false }).limit(200);
    return error ? [] : (data ?? []);
  } catch { return []; }
}

async function runTool(db: any, exec: Exec, name: string, a: any, userId: string): Promise<{ out: string; action?: { summary: string; ok: boolean } }> {
  if (a.symbol) a.symbol = String(a.symbol).toUpperCase();
  switch (name) {
    case 'web_search': return { out: await webSearchFetch(String(a.query ?? '')) };
    case 'fetch_page': return { out: await fetchPage(String(a.url ?? '')) };
    case 'github_repo': return { out: await githubRepo(String(a.owner ?? ''), String(a.repo ?? ''), a.path ? String(a.path) : undefined) };
    case 'youtube_transcript': return { out: await youtubeTranscript(String(a.url ?? '')) };
    case 'get_positions': return { out: cut(await safe(exec('get_positions'))) };
    case 'get_balance': return { out: cut(await safe(exec('get_balance'))) };
    case 'get_ticker': return { out: cut(await safe(exec('get_ticker', { symbol: a.symbol }))) };
    case 'get_closed_pnl': return { out: cut(await safe(exec('get_closed_pnl', { limit: Math.min(Number(a.limit) || 50, 100) }))) };
    case 'check_api': return { out: cut(await apiStatus(exec)) };
    case 'get_strategy_config': {
      const [x, y, z] = await Promise.all([
        db.from('auto_trader_config').select('*').limit(1),
        db.from('aggressive_trading_config').select('*').limit(1),
        db.from('ml_adaptive_config').select('*').order('updated_at', { ascending: false }).limit(1),
      ]);
      return { out: cut({ auto_trader_config: x.data, aggressive_trading_config: y.data, ml: z.data }) };
    }
    case 'scan_market': {
      const r = await safe(exec('get_tickers'));
      if (!r.ok) return { out: cut(r) };
      const list = (r.data || []).filter((t: any) => String(t.symbol).endsWith('USDT'))
        .sort((p: any, q: any) => Number(q.turnover24h) - Number(p.turnover24h)).slice(0, Math.min(Number(a.top) || 30, 60))
        .map((t: any) => ({ s: t.symbol, p: t.lastPrice, chg: (Number(t.price24hPcnt) * 100).toFixed(2) + '%', vol: Math.round(Number(t.turnover24h) / 1e6) + 'M', fund: t.fundingRate }));
      return { out: cut(list) };
    }
    case 'get_indicators': {
      if (!a.symbol) return { out: 'Informe o símbolo (ex.: BTCUSDT).' };
      const allowed = ['1', '3', '5', '15', '30', '60', '120', '240', '360', 'D', 'W', 'M'];
      const interval = allowed.includes(String(a.interval ?? '5')) ? String(a.interval ?? '5') : '5';
      const limit = Math.min(Math.max(Number(a.limit) || 200, 30), 1000);
      const r = await safe(exec('get_klines', { symbol: a.symbol, interval, limit }));
      if (!r.ok) return { out: cut(r) };
      const candles = candlesFromBybitKlines(r.data);
      if (candles.length < 15) return { out: `Bybit devolveu apenas ${candles.length} velas; preciso de pelo menos 15.` };

      const ind = indicatorSummary(candles);
      const bb = ind.bollinger && typeof ind.bollinger === 'object' ? ind.bollinger as { widthPct: number } : null;
      const ticker = await safe(exec('get_ticker', { symbol: a.symbol }));
      const t = Array.isArray(ticker.data) ? ticker.data[0] : ticker.data;
      const bid = toNum(t?.bid1Price);
      const ask = toNum(t?.ask1Price);
      const spreadPct = bid && ask && bid + ask > 0 ? (Math.abs(ask - bid) / ((ask + bid) / 2)) * 100 : undefined;
      const market = {
        price: toNum(ind.preco),
        ema20: toNum(ind.ema20),
        ema50: toNum(ind.ema50),
        adx: toNum(ind.adx14),
        atrPct: toNum(ind.atrPct),
        bbWidthPct: bb?.widthPct,
        rsi: toNum(ind.rsi14),
        rvol: toNum(ind.rvol20),
        spreadPct,
      };
      const state = await readAgentState(db, userId, a.symbol);
      const recent = await readAgentTrades(db, userId);
      const review = dailyReview(recent);
      const gate = guardFromState(state, market, new Date().getUTCHours(), new Date(), review.trades ? review.winRate : undefined);
      return { out: cut({ simbolo: a.symbol, interval, velas: candles.length, indicadores: ind, gate }) };
    }
    case 'agent_status': {
      const states = await readAgentState(db, userId, a.symbol);
      const trades = await readAgentTrades(db, userId);
      const review = dailyReview(trades);
      const rows = Array.isArray(states) ? states : states ? [states] : [];
      const state = a.symbol ? rows[0] ?? { symbol: a.symbol } : rows[0];
      const gate = state?.symbol
        ? guardFromState(state, {}, new Date().getUTCHours(), new Date(), review.trades ? review.winRate : undefined)
        : null;
      return { out: cut({ estados: rows.slice(0, 20), gate, rotina: review, ultimos_trades: trades.slice(0, 10) }) };
    }
    case 'agent_record_result': {
      if (!a.symbol || !['win', 'loss', 'stop'].includes(String(a.result))) {
        return { out: 'Use symbol e result (win, loss ou stop).' };
      }
      const pnl = toNum(a.pnlPct);
      if (pnl === undefined) return { out: 'Informe pnlPct numérico.' };
      const current = await readAgentState(db, userId, a.symbol) ?? { symbol: a.symbol };
      const next = applyTradeResult(current, String(a.result), pnl);
      const saved = await safe(db.from('agent_state').upsert({ ...next, user_id: userId, updated_at: new Date().toISOString() }, { onConflict: 'user_id,symbol' }));
      const kind = next.blacklisted ? 'blacklist' : next.kill_until ? 'kill_switch' : 'loop';
      await safe(db.from('agent_routine_log').insert({ user_id: userId, kind, summary: `${a.symbol} ${a.result} ${pnl.toFixed(2)}%`, payload: next }));
      return { out: cut({ salvo: saved.ok, estado: next, erro: saved.ok ? undefined : saved.error }) };
    }
    case 'daily_review': {
      const trades = await readAgentTrades(db, userId);
      const review = dailyReview(trades);
      const balance = await safe(exec('get_balance'));
      const payload = {
        revisao: review,
        saldo: balance.ok ? balance.data : balance.error,
        locale: 'UTC',
        gerado_em: new Date().toISOString(),
      };
      const kind = review.killActive ? 'kill_switch' : 'daily';
      const saved = await safe(db.from('agent_routine_log').insert({
        user_id: userId,
        kind,
        summary: `${review.trades} trades, win rate ${review.winRate.toFixed(1)}%, P&L ${review.dailyPnlPct.toFixed(2)}%`,
        payload,
      }));
      return { out: cut({ ...payload, log_salvo: saved.ok }) };
    }
    case 'execute_order': {
      const requestedLev = Number(a.leverage) || RISK.minLeverage;
      if (requestedLev > LIMITS.hardMaxLeverage) return { out: `RECUSADO: alavancagem ${requestedLev}x acima do teto duro ${LIMITS.hardMaxLeverage}x` };
      const lev = clampLeverage(requestedLev);
      const t = await safe(exec('get_ticker', { symbol: a.symbol }));
      const price = Number(a.price) || Number(t.data?.[0]?.lastPrice);
      if (!price) return { out: 'RECUSADO: não consegui o preço atual' };

      // Gate de memória: kill switch, blacklist e horários precisam valer
      // aqui, independentemente do que o modelo decidiu.
      const state = await readAgentState(db, userId, a.symbol);
      const recent = await readAgentTrades(db, userId);
      const review = dailyReview(recent);
      const gate = guardFromState(state, { price }, new Date().getUTCHours(), new Date(), review.trades ? review.winRate : undefined);
      if (!gate.tradable) return { out: `BLOQUEADO: ${gate.reasons.join('; ')}` };

      const sl = Number(a.stopLoss);
      const dist = Math.abs(price - sl) / price * 100;
      if (!sl || (a.side === 'Buy' ? sl >= price : sl <= price)) return { out: 'RECUSADO: stop loss ausente ou do lado errado' };
      if (dist > LIMITS.maxStopPct) return { out: `RECUSADO: stop a ${dist.toFixed(2)}% (máx ${LIMITS.maxStopPct}%)` };

      // Position sizing: quantidade nunca pode arriscar mais que 0,5% da banca.
      const bal = await safe(exec('get_balance'));
      const balObj = Array.isArray(bal.data) ? bal.data[0] : bal.data;
      const equity = Number(balObj?.totalEquity ?? balObj?.usdtBalance ?? 0);
      const maxQty = maxRiskQuantity(equity, price, sl);
      const qty = Number(a.qty);
      if (maxQty > 0 && qty > maxQty) {
        return { out: `RECUSADO: ${qty} ${a.symbol} excede o risco de ${LIMITS.maxRiskPct}% da banca (máx ${maxQty.toFixed(6)})` };
      }

      const summary = `${a.side === 'Buy' ? 'COMPRA' : 'VENDA'} ${qty} ${a.symbol} ${a.orderType || 'Market'} ${lev}x SL ${sl}${a.takeProfit ? ' TP ' + a.takeProfit : ''}`;
      await safe(exec('set_leverage', { symbol: a.symbol, leverage: lev }));
      const r = await safe(exec('place_order', { symbol: a.symbol, side: a.side, qty, orderType: a.orderType || 'Market', price: a.price, stopLoss: sl, takeProfit: a.takeProfit }));
      if (r.ok) {
        // Memória persistida para que dailyReview e os gates futuros tenham dados.
        await safe(db.from('agent_trades').insert({
          user_id: userId,
          symbol: a.symbol,
          side: a.side === 'Buy' ? 'Buy' : 'Sell',
          entry: price,
          stop_loss: sl,
          qty,
          result: 'open',
          opened_at: new Date().toISOString(),
        }));
        await safe(db.from('agent_state').upsert({
          user_id: userId,
          symbol: a.symbol,
          last_signal_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id,symbol' }));
      }
      return { out: cut(r), action: { summary, ok: r.ok } };
    }
    case 'execute_close': {
      const summary = `FECHAR ${a.qty} ${a.symbol} (${a.side === 'Buy' ? 'comprada' : 'vendida'})`;
      const t = await safe(exec('get_ticker', { symbol: a.symbol }));
      const closePrice = Number(Array.isArray(t.data) ? t.data[0]?.lastPrice : t.data?.lastPrice);
      const r = await safe(exec('close_position', { symbol: a.symbol, side: a.side, qty: a.qty }));

      let memorySaved = false;
      if (r.ok && closePrice > 0) {
        try {
          const open = await db.from('agent_trades').select('id, entry, side')
            .eq('user_id', userId).eq('symbol', a.symbol).eq('side', a.side).eq('result', 'open')
            .order('opened_at', { ascending: false }).limit(1);
          const row = open.data?.[0];
          if (row?.entry) {
            const entry = Number(row.entry);
            const pnlPct = a.side === 'Buy'
              ? ((closePrice - entry) / entry) * 100
              : ((entry - closePrice) / entry) * 100;
            const result = pnlPct >= 0 ? 'win' : 'loss';
            const updated = await db.from('agent_trades').update({
              result,
              pnl_pct: pnlPct,
              closed_at: new Date().toISOString(),
            }).eq('id', row.id);
            if (!updated.error) {
              memorySaved = true;
              const state = await readAgentState(db, userId, a.symbol);
              const next = applyTradeResult(state ?? { symbol: a.symbol }, result, pnlPct);
              await safe(db.from('agent_state').upsert({ ...next, user_id: userId, updated_at: new Date().toISOString() }, { onConflict: 'user_id,symbol' }));
              await safe(db.from('agent_routine_log').insert({
                user_id: userId,
                kind: 'loop',
                summary: `${a.symbol} fechado ${result} ${pnlPct.toFixed(2)}%`,
                payload: { entry, close: closePrice, pnlPct, result },
              }));
            }
          }
        } catch { /* memória não pode impedir o fechamento já executado */ }
      }
      return { out: cut({ ...r, memoria_atualizada: memorySaved }), action: { summary, ok: r.ok } };
    }
    case 'execute_set_stop': {
      const summary = `AJUSTAR ${a.symbol}${a.stopLoss ? ' SL ' + a.stopLoss : ''}${a.takeProfit ? ' TP ' + a.takeProfit : ''}`;
      const r = await safe(exec('set_trading_stop', { symbol: a.symbol, stopLoss: a.stopLoss, takeProfit: a.takeProfit }));
      return { out: cut(r), action: { summary, ok: r.ok } };
    }
  }
  return { out: 'ferramenta desconhecida' };
}

export async function handleTradingChat(req: Request, exec: Exec): Promise<Response> {
  try {
    const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    let userId = ANON_ID;
    const auth = req.headers.get('Authorization');
    if (auth?.startsWith('Bearer ')) {
      const { data } = await db.auth.getUser(auth.slice(7));
      if (data?.user) userId = data.user.id;
    }
    const body = await req.json().catch(() => ({}));
    const action = body?.action;

    if (action === 'chat_history') {
      const { data, error } = await db.from('trading_chat_messages').select('*').eq('user_id', userId).order('created_at').limit(300);
      if (error) throw error;
      return json({ messages: data });
    }
    if (action === 'chat_api_status') return json(await apiStatus(exec));
    if (action === 'chat_clear') {
      const { error } = await db.from('trading_chat_messages').delete().eq('user_id', userId);
      if (error) throw error;
      return json({ ok: true });
    }
    if (action !== 'chat_send') return json({ error: 'Ação inválida' }, 400);

    const text = String(body.message || '').trim().slice(0, 12000);
    if (!text) return json({ error: 'Mensagem vazia' }, 400);
    const { error: insErr } = await db.from('trading_chat_messages').insert({ user_id: userId, role: 'user', content: text });
    if (insErr) throw insErr;
    const { data: hist } = await db.from('trading_chat_messages').select('role, content, proposal, proposal_status').eq('user_id', userId).order('created_at', { ascending: false }).limit(30);
    const messages: any[] = [{ role: 'system', content: SYSTEM }, ...(hist || []).reverse().map((m: any) => ({
      role: m.role, content: m.content + (m.proposal ? `\n[ação ${m.proposal.summary}: ${m.proposal_status}]` : ''),
    }))];

    const actions: { summary: string; ok: boolean }[] = [];
    let reply = '';
    for (let i = 0; i < 6; i++) {
      const res = await aiFetch({
        method: 'POST',
        headers: { Authorization: `Bearer ${Deno.env.get('LOVABLE_API_KEY')}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'google/gemini-3.8-flash', messages, tools: TOOLS }),
      });
      if (!res.ok) {
        const t = await res.text();
        return json({ error: res.status === 402 ? 'Créditos de IA esgotados' : res.status === 429 ? 'Muitas mensagens, aguarde um pouco' : `IA indisponível (${res.status})`, detail: t.slice(0, 300) }, res.status);
      }
      const m = (await res.json()).choices?.[0]?.message;
      if (!m) break;
      const calls = m.tool_calls || [];
      if (!calls.length) { reply = m.content || ''; break; }
      messages.push({ role: 'assistant', content: m.content || '', tool_calls: calls });
      for (const c of calls) {
        let args: any = {}; try { args = JSON.parse(c.function.arguments || '{}'); } catch { /* */ }
        const r = await runTool(db, exec, c.function.name, args, userId);
        if (r.action) actions.push(r.action);
        messages.push({ role: 'tool', tool_call_id: c.id, content: r.out });
      }
    }
    const rows: any[] = actions.map((a) => ({ user_id: userId, role: 'assistant', content: '', proposal: { summary: a.summary }, proposal_status: a.ok ? 'executed' : 'failed' }));
    rows.push({ user_id: userId, role: 'assistant', content: reply || 'Sem resposta.' });
    const { error } = await db.from('trading_chat_messages').insert(rows);
    if (error) throw error;
    return json({ ok: true });
  } catch (e) {
    console.error('[trading-chat]', e);
    return json({ error: (e as Error).message }, 500);
  }
}
