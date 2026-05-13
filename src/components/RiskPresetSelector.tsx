import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sliders, Pencil } from "lucide-react";
import {
  RISK_PRESETS,
  RiskPreset,
  getCurrentPreset,
  setCurrentPreset,
  applyPreset,
  QUALITY_RISK_CONFIG,
  getPresetOverrides,
  subscribePresetOverrides,
} from "@/config/qualityRiskConfig";
import { RiskPresetEditor } from "./RiskPresetEditor";

export const RiskPresetSelector = () => {
  const [preset, setPreset] = useState<RiskPreset>('equilibrado');
  const [editing, setEditing] = useState<RiskPreset | null>(null);
  const [overrides, setOverrides] = useState(() => getPresetOverrides());

  useEffect(() => {
    setPreset(getCurrentPreset());
    const handler = () => { setPreset(getCurrentPreset()); setOverrides(getPresetOverrides()); };
    window.addEventListener('risk-preset-change', handler);
    const unsub = subscribePresetOverrides(() => setOverrides(getPresetOverrides()));
    return () => { window.removeEventListener('risk-preset-change', handler); unsub(); };
  }, []);

  const select = (p: RiskPreset) => {
    setCurrentPreset(p);
    setPreset(p);
  };

  // Preview do impacto na qualidade "high" (referência)
  const previewBase = QUALITY_RISK_CONFIG.high;
  const previewApplied = applyPreset(previewBase, preset);

  return (
    <Card className="p-5 bg-gradient-to-br from-indigo-500/10 to-purple-500/10 border-indigo-500/20 mb-4">
      <div className="flex items-center gap-2 mb-4">
        <div className="p-2 rounded-lg bg-indigo-500/20">
          <Sliders className="h-5 w-5 text-indigo-300" />
        </div>
        <div>
          <h3 className="text-base font-bold">Preset de Gestão de Risco</h3>
          <p className="text-xs text-muted-foreground">
            Ajusta SL/TP/trailing/leverage por qualidade do sinal
          </p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 mb-4">
        {(Object.keys(RISK_PRESETS) as RiskPreset[]).map((p) => {
          const meta = RISK_PRESETS[p];
          const active = p === preset;
          return (
            <Button
              key={p}
              variant={active ? "default" : "outline"}
              size="sm"
              onClick={() => select(p)}
              className={`h-auto py-2 flex flex-col items-start gap-0.5 ${active ? '' : 'bg-background/40'}`}
            >
              <span className="font-bold text-xs">{meta.label}</span>
              <span className="text-[10px] opacity-80 font-normal text-left whitespace-normal leading-tight">
                {meta.description}
              </span>
            </Button>
          );
        })}
      </div>

      {/* Preview do efeito (referência: qualidade HIGH) */}
      <div className="p-3 rounded-lg bg-background/40 border border-border/50">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] text-muted-foreground uppercase tracking-wide">
            Efeito sobre qualidade <span className="font-bold text-foreground">HIGH</span>
          </span>
          <Badge className="text-[10px]" variant="outline">{RISK_PRESETS[preset].label}</Badge>
        </div>
        <div className="grid grid-cols-4 gap-2 text-[11px]">
          <PreviewStat label="Conf min" base={`${previewBase.minConfidence}%`} now={`${previewApplied.minConfidence}%`} />
          <PreviewStat label="Lev max" base={`${previewBase.maxLeverage}x`} now={`${previewApplied.maxLeverage}x`} />
          <PreviewStat label="SL max" base={`${(previewBase.maxStopLossPct*100).toFixed(2)}%`} now={`${(previewApplied.maxStopLossPct*100).toFixed(2)}%`} />
          <PreviewStat label="R:R min" base={`${previewBase.minRiskReward}:1`} now={`${previewApplied.minRiskReward}:1`} />
          <PreviewStat label="Risk/trade" base={`${previewBase.riskPerTradePct}%`} now={`${previewApplied.riskPerTradePct}%`} />
          <PreviewStat label="Trailing" base={`${(previewBase.trailingStopPct*100).toFixed(0)}%`} now={`${(previewApplied.trailingStopPct*100).toFixed(0)}%`} />
          <PreviewStat label="Breakeven" base={`${previewBase.breakevenTriggerPct}%`} now={`${previewApplied.breakevenTriggerPct}%`} />
          <PreviewStat label="Score min" base={`${previewBase.minScore}`} now={`${previewApplied.minScore}`} />
        </div>
      </div>
    </Card>
  );
};

const PreviewStat = ({ label, base, now }: { label: string; base: string; now: string }) => {
  const changed = base !== now;
  return (
    <div className="p-1.5 rounded bg-background/60">
      <div className="text-[10px] text-muted-foreground">{label}</div>
      <div className={`font-mono text-xs ${changed ? 'text-indigo-300 font-bold' : 'text-foreground'}`}>{now}</div>
      {changed && <div className="text-[9px] text-muted-foreground/70 line-through font-mono">{base}</div>}
    </div>
  );
};
