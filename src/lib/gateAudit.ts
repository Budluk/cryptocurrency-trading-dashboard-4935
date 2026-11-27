// 📋 Auditoria de gates por trade — singleton em memória
// Captura cada decisão (APROVADO/BLOQUEADO) com regras aplicadas no momento.
import type { RiskPreset, QualityRiskRule } from "@/config/qualityRiskConfig";

export type GateOutcome = 'APPROVED' | 'BLOCKED';

export interface GateAuditEntry {
  id: string;
  timestamp: number;
  symbol: string;
  quality?: string;
  preset: RiskPreset;
  outcome: GateOutcome;
  gate: string;            // categoria/razão (ex: "Confiança", "Aprovado")
  reason?: string;         // detalhe legível
  // Snapshot das regras de risco aplicadas (do preset+qualidade)
  rules: {
    minConfidence: number;
    minScore: number;
    maxLeverage: number;
    maxStopLossPct: number;
    minRiskReward: number;
    trailingStopPct: number;
    breakevenTriggerPct: number;
    riskPerTradePct: number;
  };
  // Valores realmente aplicados ao trade (quando APPROVED)
  applied?: {
    leverage?: number;
    stopLossPct?: number;
    takeProfitPct?: number;
    trailingPct?: number;
  };
}

const MAX_ENTRIES = 200;
const STORAGE_KEY = 'lovable.gateAudit';
const EVENT_NAME = 'gate-audit-update';

let entries: GateAuditEntry[] = [];

// Carregar do localStorage
try {
  if (typeof window !== 'undefined') {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) entries = JSON.parse(raw).slice(0, MAX_ENTRIES);
  }
} catch {
  entries = [];
}

const persist = () => {
  try {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries.slice(0, MAX_ENTRIES)));
      window.dispatchEvent(new CustomEvent(EVENT_NAME));
    }
  } catch {
    // localStorage indisponível (modo privado/quota): auditoria permanece só em memória.
  }
};

export const recordGateAudit = (
  e: Omit<GateAuditEntry, 'id' | 'timestamp' | 'rules'> & { rule: QualityRiskRule }
) => {
  const { rule, ...rest } = e;
  const entry: GateAuditEntry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    timestamp: Date.now(),
    ...rest,
    rules: {
      minConfidence: rule.minConfidence,
      minScore: rule.minScore,
      maxLeverage: rule.maxLeverage,
      maxStopLossPct: rule.maxStopLossPct,
      minRiskReward: rule.minRiskReward,
      trailingStopPct: rule.trailingStopPct,
      breakevenTriggerPct: rule.breakevenTriggerPct,
      riskPerTradePct: rule.riskPerTradePct,
    },
  };
  entries = [entry, ...entries].slice(0, MAX_ENTRIES);
  persist();
};

export const getGateAuditEntries = (): GateAuditEntry[] => entries;

export const clearGateAudit = () => {
  entries = [];
  persist();
};

export const subscribeGateAudit = (cb: () => void): (() => void) => {
  if (typeof window === 'undefined') return () => {};
  const handler = () => cb();
  window.addEventListener(EVENT_NAME, handler);
  return () => window.removeEventListener(EVENT_NAME, handler);
};
