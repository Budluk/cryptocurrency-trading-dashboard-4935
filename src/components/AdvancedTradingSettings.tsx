import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, Clock, Layers, TrendingDown, Copy, Shield, Newspaper, Zap } from "lucide-react";

interface AdvancedTradingSettingsProps {
  trailingStopEnabled: boolean;
  setTrailingStopEnabled: (value: boolean) => void;
  trailingStopPercent: number;
  setTrailingStopPercent: (value: number) => void;
  timeFilterEnabled: boolean;
  setTimeFilterEnabled: (value: boolean) => void;
  startHour: number;
  setStartHour: (value: number) => void;
  endHour: number;
  setEndHour: (value: number) => void;
  scaleInOutEnabled: boolean;
  setScaleInOutEnabled: (value: boolean) => void;
  martingaleEnabled: boolean;
  setMartingaleEnabled: (value: boolean) => void;
  copyTradingEnabled: boolean;
  setCopyTradingEnabled: (value: boolean) => void;
  hedgeEnabled: boolean;
  setHedgeEnabled: (value: boolean) => void;
  sentimentEnabled: boolean;
  setSentimentEnabled: (value: boolean) => void;
  dynamicLeverageEnabled: boolean;
  setDynamicLeverageEnabled: (value: boolean) => void;
}

export const AdvancedTradingSettings = ({
  trailingStopEnabled,
  setTrailingStopEnabled,
  trailingStopPercent,
  setTrailingStopPercent,
  timeFilterEnabled,
  setTimeFilterEnabled,
  startHour,
  setStartHour,
  endHour,
  setEndHour,
  scaleInOutEnabled,
  setScaleInOutEnabled,
  martingaleEnabled,
  setMartingaleEnabled,
  copyTradingEnabled,
  setCopyTradingEnabled,
  hedgeEnabled,
  setHedgeEnabled,
  sentimentEnabled,
  setSentimentEnabled,
  dynamicLeverageEnabled,
  setDynamicLeverageEnabled,
}: AdvancedTradingSettingsProps) => {
  return (
    <Card className="p-6 space-y-6">
      <div>
        <h3 className="text-xl font-bold mb-2">⚡ Configurações Avançadas</h3>
        <p className="text-sm text-muted-foreground">
          Recursos para maximizar lucros e reduzir riscos
        </p>
      </div>

      {/* TRAILING STOP LOSS */}
      <div className="space-y-3 p-4 bg-muted/30 rounded-lg border border-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-full bg-green-500/20">
              <TrendingUp className="w-5 h-5 text-green-500" />
            </div>
            <div>
              <Label htmlFor="trailing-stop" className="text-base font-semibold">
                Trailing Stop Loss
              </Label>
              <p className="text-xs text-muted-foreground">
                Move o stop automaticamente quando o preço vai a favor
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              id="trailing-stop"
              checked={trailingStopEnabled}
              onCheckedChange={setTrailingStopEnabled}
            />
            {trailingStopEnabled && (
              <Badge variant="default" className="ml-2">Ativo</Badge>
            )}
          </div>
        </div>
        
        {trailingStopEnabled && (
          <div className="flex items-center gap-3 mt-3">
            <Label htmlFor="trailing-percent" className="text-sm whitespace-nowrap">
              Distância do Trailing:
            </Label>
            <Input
              id="trailing-percent"
              type="number"
              min="0.5"
              max="5"
              step="0.1"
              value={trailingStopPercent}
              onChange={(e) => setTrailingStopPercent(parseFloat(e.target.value))}
              className="w-24"
            />
            <span className="text-sm text-muted-foreground">%</span>
            <p className="text-xs text-muted-foreground">
              (Recomendado: 1-2% para cripto)
            </p>
          </div>
        )}
      </div>

      {/* FILTRO DE HORÁRIOS */}
      <div className="space-y-3 p-4 bg-muted/30 rounded-lg border border-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-full bg-blue-500/20">
              <Clock className="w-5 h-5 text-blue-500" />
            </div>
            <div>
              <Label htmlFor="time-filter" className="text-base font-semibold">
                Filtro de Horários
              </Label>
              <p className="text-xs text-muted-foreground">
                Opera apenas nos horários de maior liquidez
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              id="time-filter"
              checked={timeFilterEnabled}
              onCheckedChange={setTimeFilterEnabled}
            />
            {timeFilterEnabled && (
              <Badge variant="default" className="ml-2">Ativo</Badge>
            )}
          </div>
        </div>
        
        {timeFilterEnabled && (
          <div className="flex items-center gap-4 mt-3">
            <div className="flex items-center gap-2">
              <Label htmlFor="start-hour" className="text-sm whitespace-nowrap">
                Início:
              </Label>
              <Input
                id="start-hour"
                type="number"
                min="0"
                max="23"
                value={startHour}
                onChange={(e) => setStartHour(parseInt(e.target.value))}
                className="w-20"
              />
              <span className="text-sm text-muted-foreground">h UTC</span>
            </div>
            <div className="flex items-center gap-2">
              <Label htmlFor="end-hour" className="text-sm whitespace-nowrap">
                Fim:
              </Label>
              <Input
                id="end-hour"
                type="number"
                min="0"
                max="23"
                value={endHour}
                onChange={(e) => setEndHour(parseInt(e.target.value))}
                className="w-20"
              />
              <span className="text-sm text-muted-foreground">h UTC</span>
            </div>
            <p className="text-xs text-muted-foreground">
              (Recomendado: 14h-20h UTC = horário de NY)
            </p>
          </div>
        )}
      </div>

      {/* SCALE IN/OUT */}
      <div className="space-y-3 p-4 bg-muted/30 rounded-lg border border-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-full bg-purple-500/20">
              <Layers className="w-5 h-5 text-purple-500" />
            </div>
            <div>
              <Label htmlFor="scale-inout" className="text-base font-semibold">
                Scale In/Out
              </Label>
              <p className="text-xs text-muted-foreground">
                Entra com 50% inicial, adiciona em confirmação e sai parcialmente
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              id="scale-inout"
              checked={scaleInOutEnabled}
              onCheckedChange={setScaleInOutEnabled}
            />
            {scaleInOutEnabled && (
              <Badge variant="default" className="ml-2">Ativo</Badge>
            )}
          </div>
        </div>
        
        {scaleInOutEnabled && (
          <div className="bg-muted/50 p-3 rounded-lg border border-border/50 mt-3">
            <div className="space-y-2 text-xs">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs">1</Badge>
                <span>Entrada inicial: <strong>50%</strong> da posição</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs">2</Badge>
                <span>Se preço confirma (+0.5%): adiciona <strong>+50%</strong></span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs">3</Badge>
                <span>Primeiro TP (2%): fecha <strong>50%</strong> da posição</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs">4</Badge>
                <span>Segundo TP (4%): fecha <strong>50%</strong> restante</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* MARTINGALE CONTROLADO */}
      <div className="space-y-3 p-4 bg-muted/30 rounded-lg border border-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-full bg-orange-500/20">
              <TrendingDown className="w-5 h-5 text-orange-500" />
            </div>
            <div>
              <Label htmlFor="martingale" className="text-base font-semibold">
                Martingale Controlado
              </Label>
              <p className="text-xs text-muted-foreground">
                Dobra posição após 2 perdas consecutivas (limite 3x)
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              id="martingale"
              checked={martingaleEnabled}
              onCheckedChange={setMartingaleEnabled}
            />
            {martingaleEnabled && (
              <Badge variant="default" className="ml-2">Ativo</Badge>
            )}
          </div>
        </div>
        {martingaleEnabled && (
          <div className="bg-amber-500/10 p-3 rounded-lg border border-amber-500/30 mt-3">
            <p className="text-xs text-amber-600 dark:text-amber-400">
              ⚠️ <strong>Atenção:</strong> Martingale aumenta exposição ao risco. Use apenas com bom gerenciamento.
            </p>
          </div>
        )}
      </div>

      {/* COPY TRADING INTERNO */}
      <div className="space-y-3 p-4 bg-muted/30 rounded-lg border border-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-full bg-cyan-500/20">
              <Copy className="w-5 h-5 text-cyan-500" />
            </div>
            <div>
              <Label htmlFor="copy-trading" className="text-base font-semibold">
                Copy Trading Interno
              </Label>
              <p className="text-xs text-muted-foreground">
                Aprende e replica padrões de trades vencedores
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              id="copy-trading"
              checked={copyTradingEnabled}
              onCheckedChange={setCopyTradingEnabled}
            />
            {copyTradingEnabled && (
              <Badge variant="default" className="ml-2">Ativo</Badge>
            )}
          </div>
        </div>
      </div>

      {/* HEDGE DINÂMICO */}
      <div className="space-y-3 p-4 bg-muted/30 rounded-lg border border-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-full bg-pink-500/20">
              <Shield className="w-5 h-5 text-pink-500" />
            </div>
            <div>
              <Label htmlFor="hedge" className="text-base font-semibold">
                Hedge Dinâmico
              </Label>
              <p className="text-xs text-muted-foreground">
                Abre posição contrária em ativo correlacionado durante reversões
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              id="hedge"
              checked={hedgeEnabled}
              onCheckedChange={setHedgeEnabled}
            />
            {hedgeEnabled && (
              <Badge variant="default" className="ml-2">Ativo</Badge>
            )}
          </div>
        </div>
      </div>

      {/* ANÁLISE DE SENTIMENTO */}
      <div className="space-y-3 p-4 bg-muted/30 rounded-lg border border-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-full bg-indigo-500/20">
              <Newspaper className="w-5 h-5 text-indigo-500" />
            </div>
            <div>
              <Label htmlFor="sentiment" className="text-base font-semibold">
                Análise de Sentimento
              </Label>
              <p className="text-xs text-muted-foreground">
                Filtra trades baseado em notícias e sentimento do mercado
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              id="sentiment"
              checked={sentimentEnabled}
              onCheckedChange={setSentimentEnabled}
            />
            {sentimentEnabled && (
              <Badge variant="default" className="ml-2">Ativo</Badge>
            )}
          </div>
        </div>
      </div>

      {/* ALAVANCAGEM DINÂMICA */}
      <div className="space-y-3 p-4 bg-muted/30 rounded-lg border border-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-full bg-yellow-500/20">
              <Zap className="w-5 h-5 text-yellow-500" />
            </div>
            <div>
              <Label htmlFor="dynamic-leverage" className="text-base font-semibold">
                Alavancagem Dinâmica
              </Label>
              <p className="text-xs text-muted-foreground">
                Ajusta alavancagem automaticamente baseado no desempenho
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              id="dynamic-leverage"
              checked={dynamicLeverageEnabled}
              onCheckedChange={setDynamicLeverageEnabled}
            />
            {dynamicLeverageEnabled && (
              <Badge variant="default" className="ml-2">Ativo</Badge>
            )}
          </div>
        </div>
      </div>

      {/* RESUMO DE FEATURES ATIVAS */}
      <div className="flex flex-wrap items-center gap-2 pt-4 border-t border-border">
        <span className="text-sm font-semibold">Features Ativas:</span>
        <div className="flex flex-wrap gap-2">
          {trailingStopEnabled && (
            <Badge variant="default" className="gap-1">
              <TrendingUp className="w-3 h-3" />
              Trailing Stop
            </Badge>
          )}
          {timeFilterEnabled && (
            <Badge variant="default" className="gap-1">
              <Clock className="w-3 h-3" />
              Filtro Horário
            </Badge>
          )}
          {scaleInOutEnabled && (
            <Badge variant="default" className="gap-1">
              <Layers className="w-3 h-3" />
              Scale In/Out
            </Badge>
          )}
          {martingaleEnabled && (
            <Badge variant="default" className="gap-1">
              <TrendingDown className="w-3 h-3" />
              Martingale
            </Badge>
          )}
          {copyTradingEnabled && (
            <Badge variant="default" className="gap-1">
              <Copy className="w-3 h-3" />
              Copy Trading
            </Badge>
          )}
          {hedgeEnabled && (
            <Badge variant="default" className="gap-1">
              <Shield className="w-3 h-3" />
              Hedge
            </Badge>
          )}
          {sentimentEnabled && (
            <Badge variant="default" className="gap-1">
              <Newspaper className="w-3 h-3" />
              Sentimento
            </Badge>
          )}
          {dynamicLeverageEnabled && (
            <Badge variant="default" className="gap-1">
              <Zap className="w-3 h-3" />
              Alavancagem
            </Badge>
          )}
          {!trailingStopEnabled && !timeFilterEnabled && !scaleInOutEnabled && 
           !martingaleEnabled && !copyTradingEnabled && !hedgeEnabled && 
           !sentimentEnabled && !dynamicLeverageEnabled && (
            <Badge variant="outline">Nenhuma</Badge>
          )}
        </div>
      </div>
    </Card>
  );
};