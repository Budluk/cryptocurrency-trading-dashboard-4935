// Parâmetros fixos de risco do robô (definidos pelo usuário).
export const ROBOT_RISK = {
  riskPerTrade: 0.005,        // 0.5% do saldo arriscado por trade
  leverageMax: 6,             // teto de alavancagem
  stopLossPct: 0.33,          // stop (%)
  takeProfitPct: 0.60,        // alvo (%) — R:R ~1:1.8
  maxConsecutiveLosses: 3,    // kill switch
  blacklistSymbols: ['LINKUSDT', 'NEARUSDT', 'ZECUSDT', 'ETHUSDT', 'TRUMPUSDT'],
  blockedHoursUtc: [0, 13, 21],
} as const;

export const isBlockedHourUtc = (date: Date = new Date()) =>
  (ROBOT_RISK.blockedHoursUtc as readonly number[]).includes(date.getUTCHours());

export const isRobotBlacklisted = (symbol: string) =>
  (ROBOT_RISK.blacklistSymbols as readonly string[]).includes(symbol);

/** Valor nocional máximo para que um stop custe no máximo riskPerTrade do saldo. */
export const maxNotionalForRisk = (balance: number) =>
  (balance * ROBOT_RISK.riskPerTrade) / (ROBOT_RISK.stopLossPct / 100);

export const capLeverage = (lev: number) => Math.max(1, Math.min(ROBOT_RISK.leverageMax, lev));
