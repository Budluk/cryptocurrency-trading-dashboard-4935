import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useTradingCalculations } from './useTradingCalculations';

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { functions: { invoke: vi.fn() } },
}));

function useCalc() {
  return renderHook(() => useTradingCalculations()).result.current;
}

describe('useTradingCalculations', () => {
  it('calculates stop loss and take profit for a BUY with minimum 2.5:1 R:R', () => {
    const { calculateStopTakeProfit } = useCalc();
    const calc = calculateStopTakeProfit(50000, 'BUY', 0.5, false, null);

    expect(Number(calc.stopLoss)).toBeLessThan(50000);
    expect(Number(calc.takeProfit)).toBeGreaterThan(50000);
    expect(calc.takeProfitPct / calc.stopLossPct).toBeGreaterThanOrEqual(2.5);
  });

  it('inverts sides for SELL', () => {
    const { calculateStopTakeProfit } = useCalc();
    const calc = calculateStopTakeProfit(50000, 'SELL', 0.5, false, null);

    expect(Number(calc.stopLoss)).toBeGreaterThan(50000);
    expect(Number(calc.takeProfit)).toBeLessThan(50000);
  });

  it('keeps stop loss inside the v25 bounds (0.6% - 2.0%)', () => {
    const { calculateStopTakeProfit } = useCalc();
    const tight = calculateStopTakeProfit(50000, 'BUY', 0.01, false, null);
    const wide = calculateStopTakeProfit(50000, 'BUY', 10, false, null);

    expect(tight.stopLossPct).toBeGreaterThanOrEqual(0.006);
    expect(wide.stopLossPct).toBeLessThanOrEqual(0.02);
  });

  it('uses M5 support/resistance for BUY stops and targets', () => {
    const { calculateStopTakeProfit } = useCalc();
    const calc = calculateStopTakeProfit(50000, 'BUY', 0.5, false, null, 51000, 49000, undefined, 'high', 49500, 51200);
    expect(Number(calc.stopLoss)).toBeLessThan(50000);
    expect(Number(calc.takeProfit)).toBeGreaterThan(50000);
    expect(calc.takeProfitPct / calc.stopLossPct).toBeGreaterThanOrEqual(2.5);
  });

  it('uses M5 support/resistance for SELL stops and targets', () => {
    const { calculateStopTakeProfit } = useCalc();
    const calc = calculateStopTakeProfit(50000, 'SELL', 0.5, false, null, 51000, 49000, undefined, 'premium', 48800, 50500);
    expect(Number(calc.stopLoss)).toBeGreaterThan(50000);
    expect(Number(calc.takeProfit)).toBeLessThan(50000);
  });

  it('returns a valid position size', () => {
    const { calculatePositionSize } = useCalc();
    const size = calculatePositionSize(1000, 5, 1, 60, 0, 3);
    expect(size.usdSize).toBeGreaterThan(0);
    expect(size.quantity).toBeGreaterThan(0);
  });

  it('validates quantity against balance and price', () => {
    const { calculateValidQuantity } = useCalc();
    const result = calculateValidQuantity(1000, 50000, 5, 0.001, 0.001, 100);
    expect(result.qty).toBeGreaterThan(0);
  });

  it('computes leverage from volatility and balance', () => {
    const { getLeverageForScalping, getLeverageForBalance } = useCalc();
    expect(getLeverageForScalping(0.2)).toBeGreaterThan(0);
    expect(getLeverageForBalance(1000, 60)).toBeGreaterThan(0);
  });
});
