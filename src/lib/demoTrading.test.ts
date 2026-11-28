import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import {
  DEMO_INITIAL_BALANCE,
  DEMO_MODE_STORAGE_KEY,
  calculateDemoMargin,
  calculateDemoPnl,
  demoAvailableMargin,
  demoExitReason,
  forgetDemoLeverage,
  planDemoTrade,
  readDemoMode,
  recallDemoLeverage,
  rememberDemoLeverage,
  writeDemoMode,
} from './demoTrading';

describe('demoTrading', () => {
  test('calcula margem com alavancagem como multiplicador', () => {
    expect(calculateDemoMargin(100, 2, 5)).toBe(40);
    expect(calculateDemoMargin(100, 2, 1)).toBe(200);
    expect(calculateDemoMargin(0, 2, 5)).toBe(0);
  });

  test('calcula PnL nos dois lados e rejeita entradas inválidas', () => {
    expect(calculateDemoPnl('Buy', 100, 110, 2, 5)).toBe(100);
    expect(calculateDemoPnl('Sell', 100, 90, 2, 5)).toBe(100);
    expect(calculateDemoPnl('Buy', 100, 90, 2, 5)).toBe(-100);
    expect(calculateDemoPnl('Buy', Number.NaN, 90, 2, 5)).toBe(0);
  });

  test('limita a margem disponível a 95% do saldo', () => {
    expect(demoAvailableMargin(DEMO_INITIAL_BALANCE)).toBeCloseTo(19);
    expect(demoAvailableMargin(-1)).toBe(0);
  });

  test('plana um ciclo demo sem depender de IA, horário ou conta real', () => {
    const buy = planDemoTrade({ symbol: 'BTCUSDT', price: 50000, changePct: 1.5, balance: 20 });
    expect(buy).not.toBeNull();
    expect(buy!.side).toBe('Buy');
    expect(buy!.leverage).toBe(5);
    expect(buy!.quantity).toBeGreaterThan(0);
    expect(buy!.margin).toBeLessThanOrEqual(demoAvailableMargin(20));
    expect(buy!.stopLoss).toBeCloseTo(49800, 2);
    expect(buy!.takeProfit).toBeCloseTo(50500, 2);

    const sell = planDemoTrade({ symbol: 'ETHUSDT', price: 3000, changePct: -1, balance: 20 });
    expect(sell!.side).toBe('Sell');
    expect(sell!.stopLoss).toBeGreaterThan(3000);
    expect(sell!.takeProfit).toBeLessThan(3000);

    expect(planDemoTrade({ symbol: 'BTCUSDT', price: 50000, balance: 20, openSymbols: ['BTCUSDT'] })).toBeNull();
    expect(planDemoTrade({ symbol: 'BTCUSDT', price: 0, balance: 20 })).toBeNull();
  });

  test('stop tem precedência sobre take profit no mesmo tick', () => {
    expect(demoExitReason('Buy', 95, 96, 90)).toBe('stop_loss');
    expect(demoExitReason('Buy', 110, 90, 105)).toBe('take_profit');
    expect(demoExitReason('Sell', 105, 104, 100)).toBe('stop_loss');
    expect(demoExitReason('Sell', 90, 100, 95)).toBe('take_profit');
    expect(demoExitReason('Buy', 100, null, null)).toBeNull();
  });
});

describe('demoTrading storage', () => {
  beforeEach(() => {
    const store = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => { store.set(key, value); },
      removeItem: (key: string) => { store.delete(key); },
      clear: () => store.clear(),
      key: (index: number) => [...store.keys()][index] ?? null,
      get length() { return store.size; },
    } satisfies Storage);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test('persiste e remove o modo demo', () => {
    expect(readDemoMode()).toBe(false);
    writeDemoMode(true);
    expect(readDemoMode()).toBe(true);
    expect(localStorage.getItem(DEMO_MODE_STORAGE_KEY)).toBe('true');
    writeDemoMode(false);
    expect(readDemoMode()).toBe(false);
  });

  test('mantém a alavancagem da posição após reload', () => {
    rememberDemoLeverage('pos-1', 5);
    expect(recallDemoLeverage('pos-1', 10)).toBe(5);
    forgetDemoLeverage('pos-1');
    expect(recallDemoLeverage('pos-1', 10)).toBe(10);
  });
});
