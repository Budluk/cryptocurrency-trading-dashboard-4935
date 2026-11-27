import { describe, it, expect } from 'vitest';
import { ROBOT_RISK, isBlockedHourUtc, isRobotBlacklisted, maxNotionalForRisk, capLeverage } from './robotRiskParams';

describe('robot risk params', () => {
  it('risk 0.5% with 0.33% stop: $100 balance allows ~$151.5 notional', () => {
    expect(maxNotionalForRisk(100)).toBeCloseTo(151.515, 2);
  });
  it('caps leverage at 6x', () => { expect(capLeverage(25)).toBe(6); expect(capLeverage(4)).toBe(4); });
  it('kill switch after 3 losses', () => { expect(ROBOT_RISK.maxConsecutiveLosses).toBe(3); });
  it('SL 0.33 / TP 0.60', () => { expect(ROBOT_RISK.stopLossPct).toBe(0.33); expect(ROBOT_RISK.takeProfitPct).toBe(0.6); });
  it('blocks hours 0, 13, 21 UTC only', () => {
    expect(isBlockedHourUtc(new Date('2026-01-01T13:30:00Z'))).toBe(true);
    expect(isBlockedHourUtc(new Date('2026-01-01T00:05:00Z'))).toBe(true);
    expect(isBlockedHourUtc(new Date('2026-01-01T21:59:00Z'))).toBe(true);
    expect(isBlockedHourUtc(new Date('2026-01-01T14:00:00Z'))).toBe(false);
  });
  it('blacklists ETHUSDT but not BTCUSDT', () => {
    expect(isRobotBlacklisted('ETHUSDT')).toBe(true);
    expect(isRobotBlacklisted('BTCUSDT')).toBe(false);
  });
});
