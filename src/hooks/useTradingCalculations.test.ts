import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTradingCalculations } from './useTradingCalculations';

// Mock Supabase
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    functions: {
      invoke: vi.fn(),
    },
  },
}));

describe('useTradingCalculations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calculates stop loss and take profit correctly for BUY', () => {
    const { result } = renderHook(() => useTradingCalculations());
    
    const calc = result.current.calculateStopTakeProfit({
      entryPrice: 50000,
      action: 'BUY',
      atr: 1000,
      riskRewardRatio: 2,
    });

    expect(calc.stopLoss).toBeLessThan(50000);
    expect(calc.takeProfit).toBeGreaterThan(50000);
    expect(calc.takeProfit - 50000).toBeCloseTo(2 * (50000 - calc.stopLoss), -2);
  });

  it('calculates stop loss and take profit correctly for SELL', () => {
    const { result } = renderHook(() => useTradingCalculations());
    
    const calc = result.current.calculateStopTakeProfit({
      entryPrice: 50000,
      action: 'SELL',
      atr: 1000,
      riskRewardRatio: 2,
    });

    expect(calc.stopLoss).toBeGreaterThan(50000);
    expect(calc.takeProfit).toBeLessThan(50000);
    expect(50000 - calc.takeProfit).toBeCloseTo(2 * (calc.stopLoss - 50000), -2);
  });

  it('calculates position size based on risk percentage', () => {
    const { result } = renderHook(() => useTradingCalculations());
    
    const size = result.current.calculatePositionSize({
      accountBalance: 10000,
      riskPercent: 2, // 2%
      entryPrice: 50000,
      stopLoss: 49000,
    });

    // Risk = 10000 * 0.02 = 200
    // Size = 200 / (50000 - 49000) = 0.02
    expect(size).toBeCloseTo(0.02, 4);
  });

  it('adjusts leverage based on account balance', () => {
    const { result } = renderHook(() => useTradingCalculations());
    
    expect(result.current.calculateDynamicLeverage(100)).toBe(20); // < 500
    expect(result.current.calculateDynamicLeverage(1000)).toBe(15); // 500-5000
    expect(result.current.calculateDynamicLeverage(10000)).toBe(10); // 5000-50000
    expect(result.current.calculateDynamicLeverage(100000)).toBe(5); // > 50000
  });

  it('validates minimum risk/reward ratio', () => {
    const { result } = renderHook(() => useTradingCalculations());
    
    const calc = result.current.calculateStopTakeProfit({
      entryPrice: 50000,
      action: 'BUY',
      atr: 1000,
      riskRewardRatio: 1.5, // Below minimum
    });

    // Should enforce minimum 2:1
    const actualRR = (calc.takeProfit - 50000) / (50000 - calc.stopLoss);
    expect(actualRR).toBeGreaterThanOrEqual(2);
  });
});