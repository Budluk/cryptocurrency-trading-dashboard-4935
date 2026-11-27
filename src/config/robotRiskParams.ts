// Parâmetros fixos de risco do robô (definidos pelo usuário).
// Os números vêm de riskLimits.ts, espelho do RISK do backend.
import { RISK_LIMITS, clampLeverage } from './riskLimits';

export const ROBOT_RISK = {
  riskPerTrade: RISK_LIMITS.maxRiskPct / 100, // 0.5% do saldo arriscado por trade
  leverageMax: RISK_LIMITS.maxLeverage,       // teto de alavancagem (6x)
  minLeverage: RISK_LIMITS.minLeverage,       // piso de alavancagem (3x)
  hardLeverageCap: RISK_LIMITS.hardLeverageCap,
  maxStopPct: RISK_LIMITS.maxStopPct,
  stopLossPct: 0.33,          // stop (%) — dentro do teto de 0.5%
  takeProfitPct: 0.60,        // alvo (%) — R:R ~1:1.8
  maxConsecutiveLosses: RISK_LIMITS.killLosses,
  killDailyPnlPct: RISK_LIMITS.killDailyPnlPct,
  killPauseHours: RISK_LIMITS.killPauseHours,
  minRvol: RISK_LIMITS.minRvol,
  blacklistSymbols: ['LINKUSDT', 'NEARUSDT', 'ZECUSDT', 'ETHUSDT', 'TRUMPUSDT'],
  blacklistStops: RISK_LIMITS.blacklistStops,
  blacklistWinRate: RISK_LIMITS.blacklistWinRate,
  blockedHoursUtc: RISK_LIMITS.blockedUtcHours,
} as const;

export const isBlockedHourUtc = (date: Date = new Date()) =>
  (ROBOT_RISK.blockedHoursUtc as readonly number[]).includes(date.getUTCHours());

export const isRobotBlacklisted = (symbol: string) =>
  (ROBOT_RISK.blacklistSymbols as readonly string[]).includes(symbol);

/** Valor nocional máximo para que um stop custe no máximo riskPerTrade do saldo. */
export const maxNotionalForRisk = (balance: number) =>
  (balance * ROBOT_RISK.riskPerTrade) / (ROBOT_RISK.stopLossPct / 100);

/** Alavancagem sempre entre 3x e 6x, com teto absoluto de 8x. */
export const capLeverage = (lev: number) => Math.min(ROBOT_RISK.hardLeverageCap, clampLeverage(lev));
