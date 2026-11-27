// Espelho frontend dos limites de `supabase/functions/_shared/autonomousRisk.ts`.
// O frontend não importa Edge Functions; aqui fica a única fonte de verdade da UI.
// Se alterar um número, altere também no backend e nos testes.
export const RISK_LIMITS = {
  maxRiskPct: 0.5,        // % da banca por operação
  minLeverage: 3,
  maxLeverage: 6,
  hardLeverageCap: 8,     // nunca exceder
  maxStopPct: 0.5,        // distância máxima do stop, em %
  minStopPct: 0.25,       // piso operacional do stop, em %
  killLosses: 3,
  killDailyPnlPct: -2,
  killPauseHours: 3,
  blacklistStops: 3,
  blacklistWinRate: 35,
  minRvol: 1.5,
  blockedUtcHours: [0, 13, 21] as const,
} as const;

/** Stop em fração de preço (0.005 = 0.5%) dentro do teto central. */
export const clampStopFraction = (fraction: number): number => {
  if (!Number.isFinite(fraction) || fraction <= 0) return RISK_LIMITS.maxStopPct / 100;
  return Math.max(RISK_LIMITS.minStopPct / 100, Math.min(RISK_LIMITS.maxStopPct / 100, fraction));
};

/** Alavancagem sempre entre 3x e 6x; valores inválidos caem no mínimo. */
export const clampLeverage = (leverage: number): number => {
  if (!Number.isFinite(leverage)) return RISK_LIMITS.minLeverage;
  return Math.max(RISK_LIMITS.minLeverage, Math.min(RISK_LIMITS.maxLeverage, Math.round(leverage)));
};
