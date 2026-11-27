// Regras puras do agente autônomo. Sem dependência de Bybit, Supabase ou rede:
// pode ser usado pelo chat, pelo loop autônomo e pelos testes Bun.

export type MarketRegime = 'trend' | 'range' | 'volatile' | 'unknown';

export interface MarketSnapshot {
  price?: number;
  ema20?: number;
  ema50?: number;
  vwap?: number;
  adx?: number;
  atrPct?: number;       // ATR como % do preço
  spreadPct?: number;    // spread como % do preço
  bbWidthPct?: number;   // (banda superior - inferior) / meio * 100
  newsSpike?: boolean;
  rsi?: number;
  rvol?: number;
}

export interface PerformanceSnapshot {
  consecutiveLosses?: number;
  consecutiveStops?: number;
  dailyPnlPct?: number;   // ex.: -2 = -2%
  winRate?: number;       // 0..100
  trades?: number;
}

export const RISK = {
  maxRiskPct: 0.5,        // % do saldo líquido por operação
  minLeverage: 3,
  maxLeverage: 6,
  hardLeverageCap: 8,     // nunca exceder, mesmo se config errada
  maxStopPct: 0.5,        // distância máxima da entrada, em %
  killLosses: 3,
  killDailyPnlPct: -2,
  killPauseHours: 3,
  blacklistStops: 3,
  blacklistWinRate: 35,
  minRvol: 1.5,
  blockedUtcHours: [0, 13, 21] as const,
  highVolAtrPct: 3,
  wideSpreadPct: 0.15,
  trendAdx: 25,
  rangeAdx: 20,
  tightBollingerPct: 1.5,
} as const;

/** Classifica o regime antes de qualquer decisão de entrada. */
export function classifyRegime(m: MarketSnapshot): MarketRegime {
  if (m.newsSpike || (m.spreadPct ?? 0) > RISK.wideSpreadPct || (m.atrPct ?? 0) > RISK.highVolAtrPct) {
    return 'volatile';
  }

  const adx = m.adx ?? 0;
  const price = m.price ?? 0;
  const ema20 = m.ema20 ?? 0;
  const ema50 = m.ema50 ?? 0;

  // Médias alinhadas: alta (preço > EMA20 > EMA50) ou baixa (preço < EMA20 < EMA50).
  const aligned = price > 0 && ema20 > 0 && ema50 > 0 &&
    ((price > ema20 && ema20 > ema50) || (price < ema20 && ema20 < ema50));

  if (adx > RISK.trendAdx && aligned) return 'trend';
  if (adx < RISK.rangeAdx && (m.bbWidthPct ?? 100) < RISK.tightBollingerPct) return 'range';
  return 'unknown';
}

/** Kill switch: pausa novas entradas por 3h após 3 perdas seguidas ou -2% no dia. */
export function checkKillSwitch(p: PerformanceSnapshot): { active: boolean; reason?: string; pauseHours: number } {
  if ((p.consecutiveLosses ?? 0) >= RISK.killLosses) {
    return { active: true, reason: `${RISK.killLosses} perdas consecutivas`, pauseHours: RISK.killPauseHours };
  }
  if ((p.dailyPnlPct ?? 0) <= RISK.killDailyPnlPct) {
    return { active: true, reason: `drawdown diário de ${Math.abs(RISK.killDailyPnlPct)}%`, pauseHours: RISK.killPauseHours };
  }
  return { active: false, pauseHours: 0 };
}

/** Blacklist dinâmica de ativos. */
export function shouldBlacklist(p: PerformanceSnapshot): boolean {
  if ((p.consecutiveStops ?? 0) >= RISK.blacklistStops) return true;
  return (p.winRate ?? 100) < RISK.blacklistWinRate;
}

/** Janelas de baixa liquidez/transição (UTC). */
export function isBlockedHour(utcHour: number): boolean {
  return (RISK.blockedUtcHours as readonly number[]).includes(utcHour);
}

/** RVOL mínimo para priorizar o ativo. */
export function hasEnoughLiquidity(rvol?: number): boolean {
  return (rvol ?? 0) >= RISK.minRvol;
}

/** Alavancagem sempre dentro da faixa 3x-6x, com teto duro de 8x. */
export function clampLeverage(requested: number): number {
  if (!Number.isFinite(requested)) return RISK.minLeverage;
  return Math.min(RISK.hardLeverageCap, Math.max(RISK.minLeverage, Math.min(requested, RISK.maxLeverage)));
}

/** Quantidade máxima em unidades do ativo para respeitar risco de 0,5% e stop. */
export function maxRiskQuantity(balance: number, entry: number, stopLoss: number): number {
  const riskUsd = balance * (RISK.maxRiskPct / 100);
  const distance = Math.abs(entry - stopLoss);
  if (riskUsd <= 0 || distance <= 0 || !Number.isFinite(distance)) return 0;
  return riskUsd / distance;
}

/** Distância de stop em %, limitada ao teto de 0,5%. */
export function stopDistancePct(entry: number, stopLoss: number): number {
  if (!entry) return 0;
  return Math.min((Math.abs(entry - stopLoss) / entry) * 100, RISK.maxStopPct);
}

/** Resumo único para injetar no prompt do agente. */
export function decisionGuard(m: MarketSnapshot, p: PerformanceSnapshot, utcHour: number) {
  const regime = classifyRegime(m);
  const kill = checkKillSwitch(p);
  const blocked = isBlockedHour(utcHour);
  const blacklisted = shouldBlacklist(p);
  const tradable = !kill.active && !blocked && !blacklisted && regime !== 'volatile';
  return {
    regime,
    kill,
    blockedHour: blocked,
    blacklisted,
    tradable,
    reason: kill.reason ?? (blocked ? 'janela UTC bloqueada' : blacklisted ? 'ativo na blacklist' : regime === 'volatile' ? 'volatilidade/notícia' : undefined),
  };
}
