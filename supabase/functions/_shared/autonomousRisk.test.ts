import { test, expect, describe } from 'bun:test';
import { TRADING_CHAT_SYSTEM } from './autonomousPrompt.ts';
import {
  RISK,
  classifyRegime,
  checkKillSwitch,
  shouldBlacklist,
  isBlockedHour,
  hasEnoughLiquidity,
  clampLeverage,
  maxRiskQuantity,
  stopDistancePct,
  decisionGuard,
} from './autonomousRisk.ts';

describe('autonomousRisk', () => {
  test('classifica tendência com ADX alto e médias alinhadas', () => {
    expect(classifyRegime({ price: 100, ema20: 98, ema50: 95, adx: 28 })).toBe('trend');
    expect(classifyRegime({ price: 90, ema20: 92, ema50: 95, adx: 31 })).toBe('trend');
  });

  test('classifica range com ADX baixo e Bollinger estreito', () => {
    expect(classifyRegime({ adx: 18, bbWidthPct: 1.1 })).toBe('range');
  });

  test('volatilidade/notícia bloqueia antes de qualquer outra classificação', () => {
    expect(classifyRegime({ newsSpike: true, adx: 30, price: 100, ema20: 98, ema50: 95 })).toBe('volatile');
    expect(classifyRegime({ atrPct: 4, spreadPct: 0.02, adx: 30 })).toBe('volatile');
    expect(classifyRegime({ spreadPct: 0.3, adx: 30 })).toBe('volatile');
  });

  test('kill switch após 3 perdas consecutivas', () => {
    const k = checkKillSwitch({ consecutiveLosses: 3, dailyPnlPct: -0.5 });
    expect(k.active).toBe(true);
    expect(k.pauseHours).toBe(3);
    expect(k.reason).toContain('3 perdas');
  });

  test('kill switch após -2% diário', () => {
    const k = checkKillSwitch({ dailyPnlPct: -2 });
    expect(k.active).toBe(true);
    expect(k.reason).toContain('2%');
    expect(checkKillSwitch({ dailyPnlPct: -1.9 }).active).toBe(false);
  });

  test('blacklist por 3 stops ou win rate abaixo de 35%', () => {
    expect(shouldBlacklist({ consecutiveStops: 3, winRate: 50 })).toBe(true);
    expect(shouldBlacklist({ consecutiveStops: 0, winRate: 34 })).toBe(true);
    expect(shouldBlacklist({ consecutiveStops: 2, winRate: 40 })).toBe(false);
  });

  test('bloqueia horários de transição 00h, 13h e 21h UTC', () => {
    expect([0, 13, 21].every(isBlockedHour)).toBe(true);
    expect(isBlockedHour(12)).toBe(false);
  });

  test('RVOL mínimo de 1.5', () => {
    expect(hasEnoughLiquidity(1.5)).toBe(true);
    expect(hasEnoughLiquidity(1.4)).toBe(false);
  });

  test('alavancagem nunca passa de 6x (teto duro 8x)', () => {
    expect(clampLeverage(8)).toBe(6);
    expect(clampLeverage(1)).toBe(3);
    expect(clampLeverage(4)).toBe(4);
    expect(RISK.hardLeverageCap).toBe(8);
  });

  test('position sizing respeita risco de 0,5% da banca', () => {
    // $10.000 * 0,5% = $50 de risco; stop a $0,50 => 100 unidades.
    expect(maxRiskQuantity(10000, 100, 99.5)).toBeCloseTo(100, 6);
    expect(maxRiskQuantity(10000, 100, 100)).toBe(0);
  });

  test('stop nunca é considerado além do teto de 0,5%', () => {
    expect(stopDistancePct(100, 99.5)).toBeCloseTo(0.5, 6);
    expect(stopDistancePct(100, 97)).toBe(0.5);
  });

  test('decisionGuard bloqueia entradas e explica o motivo', () => {
    const g = decisionGuard(
      { price: 100, ema20: 98, ema50: 95, adx: 28, newsSpike: false },
      { consecutiveLosses: 3, winRate: 60 },
      12,
    );
    expect(g.regime).toBe('trend');
    expect(g.tradable).toBe(false);
    expect(g.reason).toContain('perdas');
  });

  test('system prompt usa os mesmos limites do código', () => {
    expect(TRADING_CHAT_SYSTEM).toContain('PRESERVAÇÃO DE CAPITAL');
    expect(TRADING_CHAT_SYSTEM).toContain(`${RISK.maxRiskPct}%`);
    expect(TRADING_CHAT_SYSTEM).toContain(`${RISK.maxLeverage}x`);
    expect(TRADING_CHAT_SYSTEM).toContain(`${RISK.blacklistWinRate}%`);
    expect(TRADING_CHAT_SYSTEM).toContain('00:00 UTC');
    expect(TRADING_CHAT_SYSTEM).toContain('get_indicators');
  });
});
