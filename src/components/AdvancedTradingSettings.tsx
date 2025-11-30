import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TrendingUp, Clock, Layers, TrendingDown, Copy, Shield, Newspaper, Zap, AlertTriangle, Target, Settings2, Sparkles } from "lucide-react";

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
  const activeCount = [
    trailingStopEnabled,
    timeFilterEnabled,
    scaleInOutEnabled,
    martingaleEnabled,
    copyTradingEnabled,
    hedgeEnabled,
    sentimentEnabled,
    dynamicLeverageEnabled
  ].filter(Boolean).length;

  return (
    <Card className="glass-card p-8 space-y-6 border-2 bg-gradient-to-br from-card/80 via-card/60 to-card/80 backdrop-blur-sm">
      {/* Header Modernizado */}
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 animate-glow">
              <Settings2 className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h3 className="text-2xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
                Configurações Avançadas
              </h3>
              <p className="text-sm text-muted-foreground">
                Otimize sua estratégia com recursos profissionais
              </p>
            </div>
          </div>
        </div>
        
        {/* Contador de Features Ativas */}
        <div className="flex flex-col items-end gap-2">
          <Badge className="bg-gradient-to-r from-primary to-primary/80 text-primary-foreground px-4 py-2 text-sm font-semibold shadow-glow">
            <Sparkles className="w-4 h-4 mr-1.5" />
            {activeCount} Ativa{activeCount !== 1 ? 's' : ''}
          </Badge>
          <p className="text-xs text-muted-foreground">de 8 disponíveis</p>
        </div>
      </div>

      {/* Tabs para Organização */}
      <Tabs defaultValue="protection" className="w-full">
        <TabsList className="grid w-full grid-cols-3 gap-2 bg-muted/50 p-1.5 rounded-xl">
          <TabsTrigger 
            value="protection" 
            className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-green-500/20 data-[state=active]:to-green-500/5 data-[state=active]:text-green-600 dark:data-[state=active]:text-green-400 rounded-lg transition-all"
          >
            <Shield className="w-4 h-4 mr-2" />
            Proteção
          </TabsTrigger>
          <TabsTrigger 
            value="strategy" 
            className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-500/20 data-[state=active]:to-blue-500/5 data-[state=active]:text-blue-600 dark:data-[state=active]:text-blue-400 rounded-lg transition-all"
          >
            <Target className="w-4 h-4 mr-2" />
            Estratégia
          </TabsTrigger>
          <TabsTrigger 
            value="risk" 
            className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-orange-500/20 data-[state=active]:to-orange-500/5 data-[state=active]:text-orange-600 dark:data-[state=active]:text-orange-400 rounded-lg transition-all"
          >
            <AlertTriangle className="w-4 h-4 mr-2" />
            Risco
          </TabsTrigger>
        </TabsList>

        {/* ABA: PROTEÇÃO */}
        <TabsContent value="protection" className="space-y-4 mt-6">
          {/* TRAILING STOP LOSS */}
          <div className="space-y-4 p-5 bg-gradient-to-br from-green-500/10 via-green-500/5 to-transparent rounded-xl border-2 border-green-500/20 hover:border-green-500/30 transition-all duration-300 shadow-card">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-gradient-to-br from-green-500/30 to-green-500/10 shadow-glow">
                  <TrendingUp className="w-6 h-6 text-green-500" />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="trailing-stop" className="text-lg font-bold text-foreground">
                      Trailing Stop Loss
                    </Label>
                    <Badge variant="outline" className="text-xs bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/30">
                      Proteção Premium
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    🎯 Move o stop automaticamente seguindo o preço favorável
                  </p>
                  <p className="text-xs text-muted-foreground">
                    💡 <strong>Benefício:</strong> Protege lucros enquanto deixa ganhos correrem
                  </p>
                </div>
              </div>
              <Switch
                id="trailing-stop"
                checked={trailingStopEnabled}
                onCheckedChange={setTrailingStopEnabled}
                className="data-[state=checked]:bg-green-500"
              />
            </div>
            
            {trailingStopEnabled && (
              <div className="space-y-3 p-4 bg-card/50 rounded-lg border border-border/50 animate-in fade-in slide-in-from-top-2 duration-300">
                <div className="flex items-center gap-3">
                  <Label htmlFor="trailing-percent" className="text-sm font-semibold whitespace-nowrap">
                    Distância:
                  </Label>
                  <Input
                    id="trailing-percent"
                    type="number"
                    min="0.5"
                    max="5"
                    step="0.1"
                    value={trailingStopPercent}
                    onChange={(e) => setTrailingStopPercent(parseFloat(e.target.value))}
                    className="w-28 font-semibold"
                  />
                  <span className="text-sm font-semibold text-muted-foreground">%</span>
                  <Badge variant="secondary" className="ml-auto">
                    Recomendado: 1.0-2.0%
                  </Badge>
                </div>
                <div className="flex items-start gap-2 text-xs text-muted-foreground bg-muted/30 p-3 rounded-lg">
                  <Target className="w-4 h-4 mt-0.5 text-green-500 flex-shrink-0" />
                  <p>
                    <strong>Como funciona:</strong> Quando o preço sobe {trailingStopPercent}%, o stop sobe junto. 
                    Se o preço cair {trailingStopPercent}% do topo, fecha a posição com lucro.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* FILTRO DE HORÁRIOS */}
          <div className="space-y-4 p-5 bg-gradient-to-br from-blue-500/10 via-blue-500/5 to-transparent rounded-xl border-2 border-blue-500/20 hover:border-blue-500/30 transition-all duration-300 shadow-card">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-gradient-to-br from-blue-500/30 to-blue-500/10 shadow-glow">
                  <Clock className="w-6 h-6 text-blue-500" />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="time-filter" className="text-lg font-bold text-foreground">
                      Filtro de Horários
                    </Label>
                    <Badge variant="outline" className="text-xs bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30">
                      Controle Temporal
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    ⏰ Opera apenas nos horários de maior liquidez e volatilidade
                  </p>
                  <p className="text-xs text-muted-foreground">
                    💡 <strong>Benefício:</strong> Evita períodos de baixo volume e spreads altos
                  </p>
                </div>
              </div>
              <Switch
                id="time-filter"
                checked={timeFilterEnabled}
                onCheckedChange={setTimeFilterEnabled}
                className="data-[state=checked]:bg-blue-500"
              />
            </div>
            
            {timeFilterEnabled && (
              <div className="space-y-3 p-4 bg-card/50 rounded-lg border border-border/50 animate-in fade-in slide-in-from-top-2 duration-300">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2 flex-1">
                    <Label htmlFor="start-hour" className="text-sm font-semibold whitespace-nowrap">
                      Início:
                    </Label>
                    <Input
                      id="start-hour"
                      type="number"
                      min="0"
                      max="23"
                      value={startHour}
                      onChange={(e) => setStartHour(parseInt(e.target.value))}
                      className="w-24 font-semibold text-center"
                    />
                    <span className="text-sm font-semibold text-muted-foreground">h UTC</span>
                  </div>
                  <div className="flex items-center gap-2 flex-1">
                    <Label htmlFor="end-hour" className="text-sm font-semibold whitespace-nowrap">
                      Fim:
                    </Label>
                    <Input
                      id="end-hour"
                      type="number"
                      min="0"
                      max="23"
                      value={endHour}
                      onChange={(e) => setEndHour(parseInt(e.target.value))}
                      className="w-24 font-semibold text-center"
                    />
                    <span className="text-sm font-semibold text-muted-foreground">h UTC</span>
                  </div>
                </div>
                <div className="flex items-start gap-2 text-xs text-muted-foreground bg-muted/30 p-3 rounded-lg">
                  <Clock className="w-4 h-4 mt-0.5 text-blue-500 flex-shrink-0" />
                  <p>
                    <strong>Dica:</strong> Horário de Nova York (14h-20h UTC) oferece maior liquidez. 
                    Europa: 8h-16h UTC. Ásia: 0h-8h UTC.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* HEDGE DINÂMICO */}
          <div className="space-y-4 p-5 bg-gradient-to-br from-pink-500/10 via-pink-500/5 to-transparent rounded-xl border-2 border-pink-500/20 hover:border-pink-500/30 transition-all duration-300 shadow-card">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-gradient-to-br from-pink-500/30 to-pink-500/10 shadow-glow">
                  <Shield className="w-6 h-6 text-pink-500" />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="hedge" className="text-lg font-bold text-foreground">
                      Hedge Dinâmico
                    </Label>
                    <Badge variant="outline" className="text-xs bg-pink-500/10 text-pink-600 dark:text-pink-400 border-pink-500/30">
                      Proteção Avançada
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    🛡️ Abre posição contrária em ativo correlacionado durante reversões
                  </p>
                  <p className="text-xs text-muted-foreground">
                    💡 <strong>Benefício:</strong> Protege o portfólio contra movimentos adversos
                  </p>
                </div>
              </div>
              <Switch
                id="hedge"
                checked={hedgeEnabled}
                onCheckedChange={setHedgeEnabled}
                className="data-[state=checked]:bg-pink-500"
              />
            </div>
          </div>
        </TabsContent>

        {/* ABA: ESTRATÉGIA */}
        <TabsContent value="strategy" className="space-y-4 mt-6">
          {/* SCALE IN/OUT */}
          <div className="space-y-4 p-5 bg-gradient-to-br from-purple-500/10 via-purple-500/5 to-transparent rounded-xl border-2 border-purple-500/20 hover:border-purple-500/30 transition-all duration-300 shadow-card">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-gradient-to-br from-purple-500/30 to-purple-500/10 shadow-glow">
                  <Layers className="w-6 h-6 text-purple-500" />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="scale-inout" className="text-lg font-bold text-foreground">
                      Scale In/Out (Pyramiding)
                    </Label>
                    <Badge variant="outline" className="text-xs bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/30">
                      Entrada/Saída Gradual
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    📊 Entra com 50% inicial, adiciona em confirmação e sai parcialmente
                  </p>
                  <p className="text-xs text-muted-foreground">
                    💡 <strong>Benefício:</strong> Maximiza lucros em tendências fortes
                  </p>
                </div>
              </div>
              <Switch
                id="scale-inout"
                checked={scaleInOutEnabled}
                onCheckedChange={setScaleInOutEnabled}
                className="data-[state=checked]:bg-purple-500"
              />
            </div>
            
            {scaleInOutEnabled && (
              <div className="space-y-3 p-4 bg-card/50 rounded-lg border border-border/50 animate-in fade-in slide-in-from-top-2 duration-300">
                <div className="space-y-2.5">
                  <div className="flex items-start gap-3 p-2 rounded-lg bg-muted/30">
                    <Badge variant="outline" className="text-xs shrink-0 mt-0.5">1</Badge>
                    <div className="space-y-0.5">
                      <p className="text-sm font-semibold">Entrada inicial: <strong className="text-purple-600 dark:text-purple-400">50%</strong> da posição</p>
                      <p className="text-xs text-muted-foreground">Entra com metade para testar o setup</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 p-2 rounded-lg bg-muted/30">
                    <Badge variant="outline" className="text-xs shrink-0 mt-0.5">2</Badge>
                    <div className="space-y-0.5">
                      <p className="text-sm font-semibold">Se preço confirma (+0.5%): adiciona <strong className="text-purple-600 dark:text-purple-400">+50%</strong></p>
                      <p className="text-xs text-muted-foreground">Dobra a posição quando tendência se confirma</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 p-2 rounded-lg bg-muted/30">
                    <Badge variant="outline" className="text-xs shrink-0 mt-0.5">3</Badge>
                    <div className="space-y-0.5">
                      <p className="text-sm font-semibold">Primeiro TP (2%): fecha <strong className="text-purple-600 dark:text-purple-400">50%</strong> da posição</p>
                      <p className="text-xs text-muted-foreground">Garante lucro e reduz risco</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 p-2 rounded-lg bg-muted/30">
                    <Badge variant="outline" className="text-xs shrink-0 mt-0.5">4</Badge>
                    <div className="space-y-0.5">
                      <p className="text-sm font-semibold">Segundo TP (4%): fecha <strong className="text-purple-600 dark:text-purple-400">50%</strong> restante</p>
                      <p className="text-xs text-muted-foreground">Maximiza ganhos na tendência</p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* COPY TRADING INTERNO */}
          <div className="space-y-4 p-5 bg-gradient-to-br from-cyan-500/10 via-cyan-500/5 to-transparent rounded-xl border-2 border-cyan-500/20 hover:border-cyan-500/30 transition-all duration-300 shadow-card">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-gradient-to-br from-cyan-500/30 to-cyan-500/10 shadow-glow">
                  <Copy className="w-6 h-6 text-cyan-500" />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="copy-trading" className="text-lg font-bold text-foreground">
                      Copy Trading Interno
                    </Label>
                    <Badge variant="outline" className="text-xs bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/30">
                      Aprendizado AI
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    🧠 Aprende e replica padrões de trades vencedores
                  </p>
                  <p className="text-xs text-muted-foreground">
                    💡 <strong>Benefício:</strong> Melhora consistência e win rate
                  </p>
                </div>
              </div>
              <Switch
                id="copy-trading"
                checked={copyTradingEnabled}
                onCheckedChange={setCopyTradingEnabled}
                className="data-[state=checked]:bg-cyan-500"
              />
            </div>
          </div>

          {/* ALAVANCAGEM DINÂMICA */}
          <div className="space-y-4 p-5 bg-gradient-to-br from-yellow-500/10 via-yellow-500/5 to-transparent rounded-xl border-2 border-yellow-500/20 hover:border-yellow-500/30 transition-all duration-300 shadow-card">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-gradient-to-br from-yellow-500/30 to-yellow-500/10 shadow-glow">
                  <Zap className="w-6 h-6 text-yellow-500" />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="dynamic-leverage" className="text-lg font-bold text-foreground">
                      Alavancagem Dinâmica
                    </Label>
                    <Badge variant="outline" className="text-xs bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/30">
                      Ajuste Automático
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    ⚡ Ajusta alavancagem automaticamente baseado no desempenho
                  </p>
                  <p className="text-xs text-muted-foreground">
                    💡 <strong>Benefício:</strong> Otimiza retorno conforme win rate
                  </p>
                </div>
              </div>
              <Switch
                id="dynamic-leverage"
                checked={dynamicLeverageEnabled}
                onCheckedChange={setDynamicLeverageEnabled}
                className="data-[state=checked]:bg-yellow-500"
              />
            </div>
          </div>

          {/* ANÁLISE DE SENTIMENTO */}
          <div className="space-y-4 p-5 bg-gradient-to-br from-indigo-500/10 via-indigo-500/5 to-transparent rounded-xl border-2 border-indigo-500/20 hover:border-indigo-500/30 transition-all duration-300 shadow-card">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-gradient-to-br from-indigo-500/30 to-indigo-500/10 shadow-glow">
                  <Newspaper className="w-6 h-6 text-indigo-500" />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="sentiment" className="text-lg font-bold text-foreground">
                      Análise de Sentimento
                    </Label>
                    <Badge variant="outline" className="text-xs bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/30">
                      Filtro de Mercado
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    📰 Filtra trades baseado em notícias e sentimento do mercado
                  </p>
                  <p className="text-xs text-muted-foreground">
                    💡 <strong>Benefício:</strong> Evita entradas em contextos adversos
                  </p>
                </div>
              </div>
              <Switch
                id="sentiment"
                checked={sentimentEnabled}
                onCheckedChange={setSentimentEnabled}
                className="data-[state=checked]:bg-indigo-500"
              />
            </div>
          </div>
        </TabsContent>

        {/* ABA: RISCO */}
        <TabsContent value="risk" className="space-y-4 mt-6">
          {/* MARTINGALE CONTROLADO */}
          <div className="space-y-4 p-5 bg-gradient-to-br from-orange-500/10 via-orange-500/5 to-transparent rounded-xl border-2 border-orange-500/20 hover:border-orange-500/30 transition-all duration-300 shadow-card">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-gradient-to-br from-orange-500/30 to-orange-500/10 shadow-glow">
                  <TrendingDown className="w-6 h-6 text-orange-500" />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="martingale" className="text-lg font-bold text-foreground">
                      Martingale Controlado
                    </Label>
                    <Badge variant="outline" className="text-xs bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/30">
                      Alto Risco
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    🎲 Dobra posição após 2 perdas consecutivas (limite 3x)
                  </p>
                  <p className="text-xs text-muted-foreground">
                    💡 <strong>Benefício:</strong> Recupera perdas com uma única vitória
                  </p>
                </div>
              </div>
              <Switch
                id="martingale"
                checked={martingaleEnabled}
                onCheckedChange={setMartingaleEnabled}
                className="data-[state=checked]:bg-orange-500"
              />
            </div>
            
            {martingaleEnabled && (
              <div className="space-y-3 p-4 bg-amber-500/10 rounded-lg border border-amber-500/30 animate-in fade-in slide-in-from-top-2 duration-300">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-amber-600 dark:text-amber-400">
                      ⚠️ Atenção: Alto Risco
                    </p>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Martingale aumenta significativamente a exposição ao risco. Use apenas com bom gerenciamento 
                      de capital e em mercados com alta probabilidade de reversão.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* AVISO DE RISCO GERAL */}
          <div className="p-5 bg-gradient-to-br from-red-500/10 via-red-500/5 to-transparent rounded-xl border-2 border-red-500/20">
            <div className="flex items-start gap-4">
              <div className="p-2.5 rounded-xl bg-gradient-to-br from-red-500/30 to-red-500/10">
                <AlertTriangle className="w-5 h-5 text-red-500" />
              </div>
              <div className="space-y-2">
                <h4 className="text-base font-bold text-foreground">Aviso Importante sobre Risco</h4>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Trading com alavancagem envolve risco significativo de perda de capital. 
                  As configurações avançadas podem aumentar tanto lucros quanto perdas.
                </p>
                <ul className="text-xs text-muted-foreground space-y-1.5 list-disc list-inside">
                  <li>Comece com valores pequenos para testar estratégias</li>
                  <li>Nunca arrisque mais do que pode perder</li>
                  <li>Monitore suas posições regularmente</li>
                  <li>Use stop loss em todas as operações</li>
                </ul>
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* RESUMO DE FEATURES ATIVAS */}
      <div className="flex flex-wrap items-center gap-3 pt-6 border-t-2 border-border/50">
        <span className="text-sm font-semibold text-foreground">Features Ativas:</span>
        <div className="flex flex-wrap gap-2">
          {trailingStopEnabled && (
            <Badge className="gap-1.5 bg-green-500/20 text-green-600 dark:text-green-400 border-green-500/30 hover:bg-green-500/30">
              <TrendingUp className="w-3.5 h-3.5" />
              Trailing Stop
            </Badge>
          )}
          {timeFilterEnabled && (
            <Badge className="gap-1.5 bg-blue-500/20 text-blue-600 dark:text-blue-400 border-blue-500/30 hover:bg-blue-500/30">
              <Clock className="w-3.5 h-3.5" />
              Filtro Horário
            </Badge>
          )}
          {scaleInOutEnabled && (
            <Badge className="gap-1.5 bg-purple-500/20 text-purple-600 dark:text-purple-400 border-purple-500/30 hover:bg-purple-500/30">
              <Layers className="w-3.5 h-3.5" />
              Scale In/Out
            </Badge>
          )}
          {martingaleEnabled && (
            <Badge className="gap-1.5 bg-orange-500/20 text-orange-600 dark:text-orange-400 border-orange-500/30 hover:bg-orange-500/30">
              <TrendingDown className="w-3.5 h-3.5" />
              Martingale
            </Badge>
          )}
          {copyTradingEnabled && (
            <Badge className="gap-1.5 bg-cyan-500/20 text-cyan-600 dark:text-cyan-400 border-cyan-500/30 hover:bg-cyan-500/30">
              <Copy className="w-3.5 h-3.5" />
              Copy Trading
            </Badge>
          )}
          {hedgeEnabled && (
            <Badge className="gap-1.5 bg-pink-500/20 text-pink-600 dark:text-pink-400 border-pink-500/30 hover:bg-pink-500/30">
              <Shield className="w-3.5 h-3.5" />
              Hedge
            </Badge>
          )}
          {sentimentEnabled && (
            <Badge className="gap-1.5 bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 border-indigo-500/30 hover:bg-indigo-500/30">
              <Newspaper className="w-3.5 h-3.5" />
              Sentimento
            </Badge>
          )}
          {dynamicLeverageEnabled && (
            <Badge className="gap-1.5 bg-yellow-500/20 text-yellow-600 dark:text-yellow-400 border-yellow-500/30 hover:bg-yellow-500/30">
              <Zap className="w-3.5 h-3.5" />
              Alavancagem
            </Badge>
          )}
          {!activeCount && (
            <Badge variant="outline" className="text-muted-foreground">Nenhuma feature ativa</Badge>
          )}
        </div>
      </div>
    </Card>
  );
};