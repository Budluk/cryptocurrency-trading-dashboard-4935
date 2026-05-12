// 🎯 Configuração centralizada de risco por qualidade do sinal
// Todas as regras de SL/TP/Trailing/Leverage cap em UM lugar para consistência.
// Editar AQUI propaga para o trader inteiro.

export type SignalQuality = 'premium' | 'high' | 'medium';

export interface QualityRiskRule {
  // Confiança mínima para entrar (%)
  minConfidence: number;
  // Score técnico mínimo (0-100+)
  minScore: number;
  // Leverage máxima permitida
  maxLeverage: number;
  // Stop-loss em % do preço (cap superior)
  maxStopLossPct: number;
  // Stop-loss mínimo (evita stops absurdamente apertados)
  minStopLossPct: number;
  // Risk:Reward mínimo (TP / SL)
  minRiskReward: number;
  // Multiplicador para TP via ATR (TP = ATR * mult)
  tpAtrMultiplier: number;
  // % do saldo arriscado por trade (1.0 = 1%)
  riskPerTradePct: number;
  // Tamanho máximo da posição como % do saldo
  maxPositionSizePct: number;
  // Trailing stop: % de retração que aciona
  trailingStopPct: number;
  // Breakeven: % de lucro para mover SL para entry
  breakevenTriggerPct: number;
}

export const QUALITY_RISK_CONFIG: Record<SignalQuality, QualityRiskRule> = {
  premium: {
    minConfidence: 65,
    minScore: 55,
    maxLeverage: 6,
    maxStopLossPct: 0.020,   // 2.0%
    minStopLossPct: 0.006,   // 0.6%
    minRiskReward: 3.0,
    tpAtrMultiplier: 3.5,
    riskPerTradePct: 2.0,
    maxPositionSizePct: 30,
    trailingStopPct: 0.35,
    breakevenTriggerPct: 0.20,
  },
  high: {
    minConfidence: 70,
    minScore: 62,
    maxLeverage: 5,
    maxStopLossPct: 0.018,
    minStopLossPct: 0.006,
    minRiskReward: 2.5,
    tpAtrMultiplier: 3.0,
    riskPerTradePct: 1.5,
    maxPositionSizePct: 25,
    trailingStopPct: 0.40,
    breakevenTriggerPct: 0.25,
  },
  medium: {
    minConfidence: 75,
    minScore: 70,
    maxLeverage: 4,
    maxStopLossPct: 0.015,
    minStopLossPct: 0.007,
    minRiskReward: 2.5,
    tpAtrMultiplier: 2.5,
    riskPerTradePct: 1.0,
    maxPositionSizePct: 20,
    trailingStopPct: 0.45,
    breakevenTriggerPct: 0.30,
  },
};

// 🎚️ Presets de gestão de risco (afetam todos os tiers de qualidade)
export type RiskPreset = 'conservador' | 'equilibrado' | 'agressivo';

export interface RiskPresetModifier {
  label: string;
  description: string;
  // Multiplicadores aplicados a cada regra de qualidade
  confidenceDelta: number;     // somado a minConfidence (%)
  scoreDelta: number;          // somado a minScore
  leverageMult: number;        // multiplica maxLeverage
  stopLossMult: number;        // multiplica maxStopLossPct (mais alto = SL mais largo)
  riskRewardMult: number;      // multiplica minRiskReward
  riskPerTradeMult: number;    // multiplica riskPerTradePct
  trailingMult: number;        // multiplica trailingStopPct
  breakevenMult: number;       // multiplica breakevenTriggerPct
}

export const RISK_PRESETS: Record<RiskPreset, RiskPresetModifier> = {
  conservador: {
    label: 'Conservador',
    description: 'Stops apertados, R:R alto, leverage reduzida — prioriza preservar capital',
    confidenceDelta: +5,
    scoreDelta: +5,
    leverageMult: 0.7,
    stopLossMult: 0.7,
    riskRewardMult: 1.2,
    riskPerTradeMult: 0.6,
    trailingMult: 0.7,
    breakevenMult: 0.7,
  },
  equilibrado: {
    label: 'Equilibrado',
    description: 'Configuração padrão — balanço entre frequência e qualidade (recomendado)',
    confidenceDelta: 0,
    scoreDelta: 0,
    leverageMult: 1.0,
    stopLossMult: 1.0,
    riskRewardMult: 1.0,
    riskPerTradeMult: 1.0,
    trailingMult: 1.0,
    breakevenMult: 1.0,
  },
  agressivo: {
    label: 'Agressivo',
    description: 'Stops mais largos, leverage maior, mais entradas — drawdown maior aceitável',
    confidenceDelta: -5,
    scoreDelta: -5,
    leverageMult: 1.3,
    stopLossMult: 1.4,
    riskRewardMult: 0.85,
    riskPerTradeMult: 1.4,
    trailingMult: 1.3,
    breakevenMult: 1.3,
  },
};

const PRESET_STORAGE_KEY = 'lovable.riskPreset';

export const getCurrentPreset = (): RiskPreset => {
  if (typeof window === 'undefined') return 'equilibrado';
  const v = window.localStorage.getItem(PRESET_STORAGE_KEY) as RiskPreset | null;
  return v && RISK_PRESETS[v] ? v : 'equilibrado';
};

export const setCurrentPreset = (p: RiskPreset) => {
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(PRESET_STORAGE_KEY, p);
    window.dispatchEvent(new CustomEvent('risk-preset-change', { detail: p }));
  }
};

export const applyPreset = (rule: QualityRiskRule, preset: RiskPreset): QualityRiskRule => {
  const m = RISK_PRESETS[preset];
  const round = (n: number, d = 4) => Number(n.toFixed(d));
  return {
    ...rule,
    minConfidence: Math.max(50, Math.min(95, rule.minConfidence + m.confidenceDelta)),
    minScore: Math.max(40, rule.minScore + m.scoreDelta),
    maxLeverage: Math.max(1, Math.round(rule.maxLeverage * m.leverageMult)),
    maxStopLossPct: round(Math.min(0.05, rule.maxStopLossPct * m.stopLossMult)),
    minRiskReward: round(Math.max(1.2, rule.minRiskReward * m.riskRewardMult), 2),
    riskPerTradePct: round(Math.max(0.3, Math.min(5, rule.riskPerTradePct * m.riskPerTradeMult)), 2),
    trailingStopPct: round(Math.min(1, rule.trailingStopPct * m.trailingMult)),
    breakevenTriggerPct: round(rule.breakevenTriggerPct * m.breakevenMult, 2),
  };
};

export const getRiskRule = (quality?: string, preset?: RiskPreset): QualityRiskRule => {
  const q = (quality as SignalQuality) || 'medium';
  const base = QUALITY_RISK_CONFIG[q] || QUALITY_RISK_CONFIG.medium;
  const p = preset || getCurrentPreset();
  return applyPreset(base, p);
};

// 🏷️ Categorias de gates para o painel de diagnóstico
export const GATE_CATEGORIES: Record<string, { label: string; color: string }> = {
  quality:    { label: 'Qualidade',          color: 'bg-purple-500/20 text-purple-300 border-purple-500/30' },
  confidence: { label: 'Confiança',          color: 'bg-blue-500/20 text-blue-300 border-blue-500/30' },
  alignment:  { label: 'Alinhamento M1/M5',  color: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30' },
  score:      { label: 'Score',              color: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30' },
  sentiment:  { label: 'Fear & Greed',       color: 'bg-orange-500/20 text-orange-300 border-orange-500/30' },
  historical: { label: 'Histórico/Hora',     color: 'bg-pink-500/20 text-pink-300 border-pink-500/30' },
  pattern:    { label: 'Padrão Perdedor',    color: 'bg-red-500/20 text-red-300 border-red-500/30' },
  ml:         { label: 'Machine Learning',   color: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30' },
  ai:         { label: 'IA Avançada',        color: 'bg-violet-500/20 text-violet-300 border-violet-500/30' },
  correlation:{ label: 'Correlação',         color: 'bg-amber-500/20 text-amber-300 border-amber-500/30' },
  volatility: { label: 'Volatilidade',       color: 'bg-rose-500/20 text-rose-300 border-rose-500/30' },
  margin:     { label: 'Margem/Saldo',       color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' },
  cycle:      { label: 'Limite Ciclo',       color: 'bg-slate-500/20 text-slate-300 border-slate-500/30' },
  other:      { label: 'Outros',             color: 'bg-gray-500/20 text-gray-300 border-gray-500/30' },
};

export const categorizeGate = (reason: string): keyof typeof GATE_CATEGORIES => {
  const r = reason.toLowerCase();
  if (r.includes('qualidade')) return 'quality';
  if (r.includes('confiança') || r.includes('confianca')) return 'confidence';
  if (r.includes('m1/m5') || r.includes('alinha')) return 'alignment';
  if (r.includes('score')) return 'score';
  if (r.includes('f&g') || r.includes('fear') || r.includes('greed')) return 'sentiment';
  if (r.includes('histórico') || r.includes('historico') || r.includes('hora')) return 'historical';
  if (r.includes('padrão') || r.includes('padrao') || r.includes('bloqueado')) return 'pattern';
  if (r.includes('ml')) return 'ml';
  if (r.includes('ia') || r.includes('ai ')) return 'ai';
  if (r.includes('correla')) return 'correlation';
  if (r.includes('volatil') || r.includes('vol ')) return 'volatility';
  if (r.includes('margem') || r.includes('saldo')) return 'margin';
  if (r.includes('ciclo') || r.includes('limite')) return 'cycle';
  return 'other';
};
