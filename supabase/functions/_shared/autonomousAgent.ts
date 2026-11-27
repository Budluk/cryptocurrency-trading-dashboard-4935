// Estado persistido do agente autônomo. Funções puras: o banco guarda a memória,
// o chat e os loops apenas leem/escrevem através destas regras.
import {
  RISK,
  checkKillSwitch,
  classifyRegime,
  hasEnoughLiquidity,
  isBlockedHour,
  shouldBlacklist,
  type MarketSnapshot,
} from './autonomousRisk.ts';

export interface AgentStateRow {
  symbol: string;
  consecutive_losses?: number | null;
  consecutive_stops?: number | null;
  daily_pnl_pct?: number | string | null;
  kill_until?: string | null;
  blacklisted?: boolean | null;
  last_signal_at?: string | null;
}

export interface AgentTradeRow {
  id?: string | null;
  user_id?: string | null;
  symbol?: string | null;
  side?: string | null;
  entry?: number | string | null;
  stop_loss?: number | string | null;
  take_profit?: number | string | null;
  result?: string | null;
  pnl_pct?: number | string | null;
  closed_at?: string | null;
  opened_at?: string | null;
}

const n = (v: unknown): number | undefined => {
  const x = Number(v);
  return Number.isFinite(x) ? x : undefined;
};

/** Gate completo para uma entrada: regime + kill switch + blacklist + horário + liquidez. */
export function guardFromState(
  state: AgentStateRow | null | undefined,
  market: MarketSnapshot,
  utcHour: number,
  now = new Date(),
  winRate?: number,
) {
  const regime = classifyRegime(market);
  const kill = checkKillSwitch({
    consecutiveLosses: n(state?.consecutive_losses),
    dailyPnlPct: n(state?.daily_pnl_pct),
  });

  const killUntil = state?.kill_until ? new Date(state.kill_until) : null;
  const killActive = kill.active || (killUntil !== null && !Number.isNaN(killUntil.getTime()) && killUntil > now);
  const blacklisted = Boolean(state?.blacklisted) || shouldBlacklist({
    consecutiveStops: n(state?.consecutive_stops),
    winRate,
  });
  const blockedHour = isBlockedHour(utcHour);
  const liquidityKnown = typeof market.rvol === 'number' && Number.isFinite(market.rvol);
  const liquidityOk = hasEnoughLiquidity(market.rvol);

  const reasons: string[] = [];
  if (killActive) reasons.push(kill.reason ?? `kill switch ativo até ${killUntil?.toISOString()}`);
  if (blockedHour) reasons.push(`janela UTC bloqueada (${utcHour}h)`);
  if (blacklisted) reasons.push('ativo na blacklist');
  if (regime === 'volatile') reasons.push('volatilidade/notícia');
  if (liquidityKnown && !liquidityOk) reasons.push(`RVOL abaixo de ${RISK.minRvol}`);

  return {
    symbol: state?.symbol,
    regime,
    kill: { active: killActive, reason: reasons.find((r) => r.includes('kill')) ?? kill.reason, pauseHours: kill.pauseHours },
    blockedHour,
    blacklisted,
    liquidityOk,
    tradable: reasons.length === 0,
    reasons,
    maxRiskPct: RISK.maxRiskPct,
  };
}

/** Atualiza a memória do ativo após um fechamento. Usado pelo loop e pelo chat. */
export function applyTradeResult(state: AgentStateRow, result: string, pnlPct: number) {
  const loss = result === 'loss' || result === 'stop' || pnlPct < 0;
  const stop = result === 'stop';
  const next: AgentStateRow = {
    ...state,
    consecutive_losses: loss ? (n(state.consecutive_losses) ?? 0) + 1 : 0,
    consecutive_stops: stop ? (n(state.consecutive_stops) ?? 0) + 1 : 0,
    daily_pnl_pct: (n(state.daily_pnl_pct) ?? 0) + pnlPct,
  };
  const kill = checkKillSwitch({ consecutiveLosses: n(next.consecutive_losses), dailyPnlPct: n(next.daily_pnl_pct) });
  if (kill.active) next.kill_until = new Date(Date.now() + kill.pauseHours * 3600_000).toISOString();
  next.blacklisted = shouldBlacklist({ consecutiveStops: n(next.consecutive_stops) });
  return next;
}

export interface ReconciledExit extends AgentTradeRow {
  entryPrice: number;
  exitPrice: number;
  result: 'stop' | 'win' | 'loss';
  pnlPct: number;
  reason: 'stop_loss' | 'take_profit';
}

/**
 * Reconhece saídas por SL/TP de posições abertas usando o preço atual.
 * Função pura: o chamador (loop, webhook ou chat) decide como persistir.
 * Em caso de SL e TP na mesma vela, prevalece o stop — critério conservador.
 * No máximo uma posição aberta por símbolo/lado para não fechar duplicatas.
 */
export function reconcileExits(
  trades: AgentTradeRow[],
  priceBySymbol: Record<string, number | undefined>,
): ReconciledExit[] {
  const prices = new Map<string, number>();
  for (const [symbol, raw] of Object.entries(priceBySymbol)) {
    const price = n(raw);
    if (price !== undefined && price > 0) prices.set(symbol.toUpperCase(), price);
  }

  const sorted = [...trades].sort((a, b) =>
    new Date(b.opened_at ?? 0).getTime() - new Date(a.opened_at ?? 0).getTime());
  const seen = new Set<string>();
  const exits: ReconciledExit[] = [];

  for (const trade of sorted) {
    if (trade.result && trade.result !== 'open') continue;
    const symbol = String(trade.symbol ?? '').toUpperCase();
    const price = prices.get(symbol);
    const entry = n(trade.entry);
    if (!symbol || price === undefined || entry === undefined || entry <= 0) continue;

    const side = String(trade.side ?? 'Buy').toLowerCase() === 'sell' ? 'Sell' : 'Buy';
    const key = `${symbol}:${side}`;
    if (seen.has(key)) continue;

    const stop = n(trade.stop_loss);
    const target = n(trade.take_profit);
    const stopHit = stop !== undefined && stop > 0 && (side === 'Buy' ? price <= stop : price >= stop);
    const targetHit = target !== undefined && target > 0 && (side === 'Buy' ? price >= target : price <= target);
    if (!stopHit && !targetHit) continue;

    seen.add(key);
    const pnlPct = side === 'Buy'
      ? ((price - entry) / entry) * 100
      : ((entry - price) / entry) * 100;
    const reason = stopHit ? 'stop_loss' : 'take_profit';
    exits.push({
      ...trade,
      symbol,
      side,
      entryPrice: entry,
      exitPrice: price,
      pnlPct,
      result: stopHit ? 'stop' : pnlPct >= 0 ? 'win' : 'loss',
      reason,
    });
  }

  return exits;
}

export interface DailyReview {
  trades: number;
  wins: number;
  losses: number;
  winRate: number;
  profitFactor: number;
  dailyPnlPct: number;
  maxDrawdownPct: number;
  killActive: boolean;
  bestSymbols: { symbol: string; pnlPct: number; trades: number }[];
}

/** Rotina das 00:00 UTC: recalcula desempenho a partir do histórico persistido. */
export function dailyReview(trades: AgentTradeRow[], now = new Date()): DailyReview {
  const since = now.getTime() - 24 * 3600_000;
  const closed = trades.filter((t) => {
    const time = new Date(t.closed_at ?? t.opened_at ?? 0).getTime();
    return t.result && t.result !== 'open' && time >= since && time <= now.getTime();
  });

  const pnls = closed.map((t) => n(t.pnl_pct) ?? 0);
  const grossProfit = pnls.filter((v) => v > 0).reduce((a, b) => a + b, 0);
  const grossLoss = Math.abs(pnls.filter((v) => v < 0).reduce((a, b) => a + b, 0));
  const wins = pnls.filter((v) => v > 0).length;
  const losses = pnls.filter((v) => v < 0).length;

  let peak = 0;
  let equity = 0;
  let maxDrawdownPct = 0;
  for (const p of pnls) {
    equity += p;
    peak = Math.max(peak, equity);
    if (peak > 0) maxDrawdownPct = Math.max(maxDrawdownPct, ((peak - equity) / peak) * 100);
  }

  const bySymbol = new Map<string, { pnlPct: number; trades: number }>();
  for (const t of closed) {
    if (!t.symbol) continue;
    const cur = bySymbol.get(t.symbol) ?? { pnlPct: 0, trades: 0 };
    bySymbol.set(t.symbol, { pnlPct: cur.pnlPct + (n(t.pnl_pct) ?? 0), trades: cur.trades + 1 });
  }
  const bestSymbols = [...bySymbol.entries()]
    .map(([symbol, v]) => ({ symbol, ...v }))
    .sort((a, b) => b.pnlPct - a.pnlPct)
    .slice(0, 5);
  const dailyPnlPct = pnls.reduce((a, b) => a + b, 0);

  return {
    trades: closed.length,
    wins,
    losses,
    winRate: closed.length ? (wins / closed.length) * 100 : 0,
    // Valor finito para sobreviver a JSON.stringify (Infinity viraria null).
    profitFactor: grossLoss === 0 ? (grossProfit > 0 ? 999 : 0) : grossProfit / grossLoss,
    dailyPnlPct,
    maxDrawdownPct,
    killActive: dailyPnlPct <= RISK.killDailyPnlPct,
    bestSymbols,
  };
}

/** Só executa a rotina diária uma vez na janela das 00:00-00:05 UTC. */
export function isDailyWindow(now = new Date()): boolean {
  return now.getUTCHours() === 0 && now.getUTCMinutes() < 5;
}
