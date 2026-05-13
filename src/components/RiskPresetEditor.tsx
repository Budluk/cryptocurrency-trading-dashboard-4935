import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AlertTriangle, CheckCircle2, RotateCcw, Save } from "lucide-react";
import {
  RISK_PRESETS,
  RiskPreset,
  RiskPresetModifier,
  QUALITY_RISK_CONFIG,
  SignalQuality,
  applyPreset,
  getEffectiveModifier,
  getPresetOverrides,
  setPresetOverride,
  validatePresetModifier,
} from "@/config/qualityRiskConfig";

interface Props {
  preset: RiskPreset;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

const FIELDS: Array<{ key: keyof RiskPresetModifier; label: string; step: number; hint: string }> = [
  { key: 'confidenceDelta',  label: 'Δ Confiança (%)',     step: 1,    hint: 'Somado à confiança mínima' },
  { key: 'scoreDelta',       label: 'Δ Score',             step: 1,    hint: 'Somado ao score mínimo' },
  { key: 'leverageMult',     label: '× Leverage',          step: 0.05, hint: 'Multiplica leverage máxima' },
  { key: 'stopLossMult',     label: '× Stop Loss',         step: 0.05, hint: 'Multiplica SL máximo (largura)' },
  { key: 'riskRewardMult',   label: '× R:R',               step: 0.05, hint: 'Multiplica R:R mínimo' },
  { key: 'riskPerTradeMult', label: '× Risco/Trade',       step: 0.05, hint: 'Multiplica risco por trade' },
  { key: 'trailingMult',     label: '× Trailing',          step: 0.05, hint: 'Multiplica trailing %' },
  { key: 'breakevenMult',    label: '× Breakeven',         step: 0.05, hint: 'Multiplica gatilho breakeven' },
];

export const RiskPresetEditor = ({ preset, open, onOpenChange }: Props) => {
  const base = RISK_PRESETS[preset];
  const [mod, setMod] = useState<RiskPresetModifier>(base);
  const isCustomized = useMemo(() => {
    const ov = getPresetOverrides()[preset];
    return ov && Object.keys(ov).length > 0;
  }, [preset, open]);

  useEffect(() => {
    if (open) setMod(getEffectiveModifier(preset));
  }, [open, preset]);

  const validation = useMemo(() => validatePresetModifier(mod), [mod]);

  const update = (k: keyof RiskPresetModifier, v: string) => {
    const num = Number(v);
    if (Number.isFinite(num)) setMod(prev => ({ ...prev, [k]: num }));
  };

  const save = () => {
    if (!validation.valid) return;
    // Salva apenas campos que diferem do base
    const diff: Partial<RiskPresetModifier> = {};
    (Object.keys(mod) as (keyof RiskPresetModifier)[]).forEach(k => {
      if (typeof mod[k] === 'number' && mod[k] !== (base as any)[k]) (diff as any)[k] = mod[k];
    });
    setPresetOverride(preset, Object.keys(diff).length ? diff : null);
    onOpenChange(false);
  };

  const reset = () => {
    setMod(base);
    setPresetOverride(preset, null);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Editar preset:
            <Badge variant="outline">{base.label}</Badge>
            {isCustomized && (
              <Badge className="bg-indigo-500/20 text-indigo-300 border-indigo-500/30 border text-[10px]">
                personalizado
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="flex-1 pr-3 -mr-3">
          <div className="space-y-4">
            {/* Modificadores */}
            <div className="grid grid-cols-2 gap-3">
              {FIELDS.map(f => {
                const baseVal = (base as any)[f.key];
                const cur = (mod as any)[f.key];
                const changed = baseVal !== cur;
                return (
                  <div key={f.key} className="space-y-1">
                    <Label className="text-[11px] flex items-center justify-between">
                      <span>{f.label}</span>
                      {changed && (
                        <span className="text-[10px] font-mono text-muted-foreground line-through">{baseVal}</span>
                      )}
                    </Label>
                    <Input
                      type="number"
                      step={f.step}
                      value={cur}
                      onChange={e => update(f.key, e.target.value)}
                      className={`h-8 text-xs font-mono ${changed ? 'border-indigo-500/50' : ''}`}
                    />
                    <p className="text-[10px] text-muted-foreground">{f.hint}</p>
                  </div>
                );
              })}
            </div>

            {/* Preview por qualidade */}
            <div className="space-y-2">
              <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                Pré-visualização por qualidade (regras aplicadas)
              </div>
              <div className="space-y-1.5">
                {(Object.keys(QUALITY_RISK_CONFIG) as SignalQuality[]).map(q => {
                  // Aplica o mod local sem passar pelo storage
                  const baseRule = QUALITY_RISK_CONFIG[q];
                  const m = mod;
                  const conf = Math.max(50, Math.min(95, baseRule.minConfidence + m.confidenceDelta));
                  const lev = Math.max(1, Math.round(baseRule.maxLeverage * m.leverageMult));
                  const sl = Math.min(0.05, baseRule.maxStopLossPct * m.stopLossMult);
                  const rr = Math.max(1.2, baseRule.minRiskReward * m.riskRewardMult);
                  const tp = sl * rr;
                  const trail = Math.min(1, baseRule.trailingStopPct * m.trailingMult);
                  const be = baseRule.breakevenTriggerPct * m.breakevenMult;
                  return (
                    <div key={q} className="grid grid-cols-7 gap-2 p-2 rounded bg-background/40 border border-border/50 text-[11px] font-mono">
                      <Badge variant="outline" className="uppercase justify-center text-[10px]">{q}</Badge>
                      <span>conf {conf}%</span>
                      <span>lev {lev}x</span>
                      <span>SL {(sl*100).toFixed(2)}%</span>
                      <span>TP {(tp*100).toFixed(2)}%</span>
                      <span>trail {(trail*100).toFixed(0)}%</span>
                      <span>BE {be.toFixed(2)}%</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Validação */}
            {validation.errors.length > 0 && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <div className="font-semibold mb-1 text-xs">Erros de consistência:</div>
                  <ul className="list-disc list-inside space-y-0.5 text-[11px]">
                    {validation.errors.map((e, i) => <li key={i}>{e}</li>)}
                  </ul>
                </AlertDescription>
              </Alert>
            )}
            {validation.errors.length === 0 && validation.warnings.length > 0 && (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <div className="font-semibold mb-1 text-xs">Avisos:</div>
                  <ul className="list-disc list-inside space-y-0.5 text-[11px]">
                    {validation.warnings.map((w, i) => <li key={i}>{w}</li>)}
                  </ul>
                </AlertDescription>
              </Alert>
            )}
            {validation.valid && validation.warnings.length === 0 && (
              <Alert>
                <CheckCircle2 className="h-4 w-4 text-green-400" />
                <AlertDescription className="text-xs">
                  Configuração consistente: SL &lt; TP em todas as qualidades, trailing e breakeven coerentes.
                </AlertDescription>
              </Alert>
            )}
          </div>
        </ScrollArea>

        <DialogFooter className="gap-2">
          <Button variant="outline" size="sm" onClick={reset}>
            <RotateCcw className="h-3.5 w-3.5 mr-1" /> Restaurar padrão
          </Button>
          <Button size="sm" onClick={save} disabled={!validation.valid}>
            <Save className="h-3.5 w-3.5 mr-1" /> Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
