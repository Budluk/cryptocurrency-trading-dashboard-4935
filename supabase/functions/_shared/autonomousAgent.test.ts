import { test, expect, describe } from 'bun:test';
import {
  applyTradeResult,
  dailyReview,
  guardFromState,
  isDailyWindow,
  type AgentTradeRow,
} from './autonomousAgent.ts';

describe('autonomousAgent', () => {
  test('guard bloqueia kill switch ativo até o horário futuro', () => {
    const now = new Date('2026-11-27T12:00:00Z');
    const g = guardFromState(
      { symbol: 'BTCUSDT', kill_until: '2026-11-27T14:00:00Z' },
      { price: 100, ema20: 98, ema50: 95, adx: 30, rvol: 2 },
      12,
      now,
    );
    expect(g.tradable).toBe(false);
    expect(g.kill.active).toBe(true);
    expect(g.regime).toBe('trend');
    expect(g.liquidityOk).toBe(true);
  });

  test('guard considera blacklist salva e horário bloqueado', () => {
    const g = guardFromState(
      { symbol: 'SOLUSDT', blacklisted: true },
      { adx: 18, bbWidthPct: 1 },
      0,
    );
    expect(g.tradable).toBe(false);
    expect(g.reasons.join(' ')).toContain('blacklist');
    expect(g.reasons.join(' ')).toContain('janela UTC');
  });

  test('applyTradeResult acumula perdas, aplica kill switch e blacklist por stops', () => {
    let state = { symbol: 'BTCUSDT', consecutive_losses: 2, consecutive_stops: 2, daily_pnl_pct: '-1' };
    state = applyTradeResult(state, 'stop', -0.5);
    expect(state.consecutive_losses).toBe(3);
    expect(state.consecutive_stops).toBe(3);
    expect(Number(state.daily_pnl_pct)).toBeCloseTo(-1.5, 6);
    expect(state.blacklisted).toBe(true);
    expect(state.kill_until).toBeTruthy();

    state = applyTradeResult(state, 'win', 1);
    expect(state.consecutive_losses).toBe(0);
    expect(state.consecutive_stops).toBe(0);
  });

  test('dailyReview calcula win rate, profit factor, drawdown e melhores ativos', () => {
    const now = new Date('2026-11-27T00:00:00Z');
    const trades: AgentTradeRow[] = [
      { symbol: 'BTCUSDT', result: 'win', pnl_pct: 1, closed_at: '2026-11-26T23:00:00Z' },
      { symbol: 'BTCUSDT', result: 'loss', pnl_pct: -0.5, closed_at: '2026-11-26T22:00:00Z' },
      { symbol: 'ETHUSDT', result: 'stop', pnl_pct: -0.5, closed_at: '2026-11-26T21:00:00Z' },
      { symbol: 'ETHUSDT', result: 'win', pnl_pct: 2, closed_at: '2026-11-26T20:00:00Z' },
      { symbol: 'XRPUSDT', result: 'win', pnl_pct: 0.4, closed_at: '2026-10-01T20:00:00Z' },
    ];
    const r = dailyReview(trades, now);
    expect(r.trades).toBe(4);
    expect(r.winRate).toBe(50);
    expect(r.profitFactor).toBeCloseTo(3, 6);
    expect(r.dailyPnlPct).toBeCloseTo(2, 6);
    expect(r.maxDrawdownPct).toBeGreaterThan(0);
    expect(r.bestSymbols[0].symbol).toBe('ETHUSDT');
  });

  test('dailyReview sinaliza kill switch por -2% diário', () => {
    const r = dailyReview([{ result: 'loss', pnl_pct: -2.1, closed_at: new Date().toISOString() }]);
    expect(r.killActive).toBe(true);
  });

  test('isDailyWindow aceita apenas os primeiros 5 minutos de 00:00 UTC', () => {
    expect(isDailyWindow(new Date('2026-11-27T00:04:00Z'))).toBe(true);
    expect(isDailyWindow(new Date('2026-11-27T00:06:00Z'))).toBe(false);
    expect(isDailyWindow(new Date('2026-11-27T01:00:00Z'))).toBe(false);
  });
});
