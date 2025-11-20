import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Shield, AlertTriangle, TrendingDown, Settings, Save } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface RiskSettings {
  max_positions: number;
  max_daily_loss: number;
  current_daily_loss: number;
  trading_paused: boolean;
  last_reset_date: string;
}

export const RiskManagementPanel = () => {
  const { toast } = useToast();
  const [settings, setSettings] = useState<RiskSettings | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [tempSettings, setTempSettings] = useState<Partial<RiskSettings>>({});

  useEffect(() => {
    fetchSettings();
    // Interval desabilitado temporariamente para melhorar performance
    // const interval = setInterval(fetchSettings, 30000); // Aumentado para 30s
    // return () => clearInterval(interval);
  }, []);

  const fetchSettings = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    let { data, error } = await supabase
      .from('risk_management_settings')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!data && !error) {
      // Criar configuração padrão
      const { data: newSettings } = await supabase
        .from('risk_management_settings')
        .insert({
          user_id: user.id,
          max_positions: 5,
          max_daily_loss: 100,
          current_daily_loss: 0,
          trading_paused: false
        })
        .select()
        .single();
      
      data = newSettings;
    }

    if (data) {
      setSettings(data);
      setTempSettings(data);
    }
  };

  const saveSettings = async () => {
    if (!settings) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase
      .from('risk_management_settings')
      .update({
        max_positions: tempSettings.max_positions,
        max_daily_loss: tempSettings.max_daily_loss
      })
      .eq('user_id', user.id);

    if (!error) {
      toast({
        title: "Configurações Salvas",
        description: "Limites de risco atualizados com sucesso",
      });
      setEditMode(false);
      fetchSettings();
    } else {
      toast({
        title: "Erro",
        description: "Não foi possível salvar as configurações",
        variant: "destructive"
      });
    }
  };

  const resetDailyLoss = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase
      .from('risk_management_settings')
      .update({
        current_daily_loss: 0,
        trading_paused: false
      })
      .eq('user_id', user.id);

    if (!error) {
      toast({
        title: "Reset Realizado",
        description: "Perdas diárias zeradas e trading reativado",
      });
      fetchSettings();
    }
  };

  const togglePause = async () => {
    if (!settings) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase
      .from('risk_management_settings')
      .update({
        trading_paused: !settings.trading_paused
      })
      .eq('user_id', user.id);

    if (!error) {
      toast({
        title: settings.trading_paused ? "Trading Reativado" : "Trading Pausado",
        description: settings.trading_paused 
          ? "O sistema pode abrir novas posições" 
          : "Novas posições foram bloqueadas",
      });
      fetchSettings();
    }
  };

  if (!settings) {
    return (
      <Card className="p-6 bg-card/50 backdrop-blur">
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5 animate-pulse text-primary" />
          <span>Carregando gestão de risco...</span>
        </div>
      </Card>
    );
  }

  const lossPercent = (settings.current_daily_loss / settings.max_daily_loss) * 100;
  const isNearLimit = lossPercent > 70;
  const isAtLimit = lossPercent >= 100;

  return (
    <Card className="p-6 bg-card/50 backdrop-blur">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold">Gestão de Risco</h3>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setEditMode(!editMode)}
        >
          <Settings className="h-4 w-4 mr-2" />
          {editMode ? 'Cancelar' : 'Configurar'}
        </Button>
      </div>

      {settings.trading_paused && (
        <div className="mb-4 p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
          <div className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            <span className="font-semibold">Trading Pausado</span>
          </div>
          <p className="text-sm text-muted-foreground mt-2">
            Limite diário atingido. Novas posições estão bloqueadas.
          </p>
        </div>
      )}

      <div className="space-y-6">
        {/* Perda Diária */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <Label className="text-sm font-medium">Perda Diária</Label>
            <Badge 
              variant={isAtLimit ? "destructive" : isNearLimit ? "outline" : "secondary"}
              className="text-xs"
            >
              {lossPercent.toFixed(1)}%
            </Badge>
          </div>
          
          <Progress 
            value={Math.min(lossPercent, 100)} 
            className={`h-2 ${isAtLimit ? 'bg-destructive/20' : isNearLimit ? 'bg-amber-500/20' : ''}`}
          />
          
          <div className="flex justify-between mt-2 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <TrendingDown className="h-3 w-3 text-destructive" />
              ${Math.abs(settings.current_daily_loss).toFixed(2)}
            </span>
            <span>Limite: ${settings.max_daily_loss.toFixed(2)}</span>
          </div>
        </div>

        {/* Máximo de Posições */}
        {editMode ? (
          <div className="space-y-4">
            <div>
              <Label htmlFor="max_positions">Máximo de Posições Simultâneas</Label>
              <Input
                id="max_positions"
                type="number"
                min="1"
                max="20"
                value={tempSettings.max_positions}
                onChange={(e) => setTempSettings({ ...tempSettings, max_positions: parseInt(e.target.value) })}
                className="mt-2"
              />
            </div>

            <div>
              <Label htmlFor="max_daily_loss">Perda Diária Máxima ($)</Label>
              <Input
                id="max_daily_loss"
                type="number"
                min="10"
                max="1000"
                step="10"
                value={tempSettings.max_daily_loss}
                onChange={(e) => setTempSettings({ ...tempSettings, max_daily_loss: parseFloat(e.target.value) })}
                className="mt-2"
              />
            </div>

            <Button onClick={saveSettings} className="w-full">
              <Save className="h-4 w-4 mr-2" />
              Salvar Configurações
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 bg-background/50 rounded-lg border">
              <div className="text-xs text-muted-foreground mb-1">Max Posições</div>
              <div className="text-2xl font-bold">{settings.max_positions}</div>
            </div>

            <div className="p-4 bg-background/50 rounded-lg border">
              <div className="text-xs text-muted-foreground mb-1">Limite Diário</div>
              <div className="text-2xl font-bold">${settings.max_daily_loss}</div>
            </div>
          </div>
        )}

        {/* Ações */}
        <div className="flex gap-2">
          <Button
            variant={settings.trading_paused ? "default" : "outline"}
            size="sm"
            onClick={togglePause}
            className="flex-1"
          >
            {settings.trading_paused ? 'Reativar Trading' : 'Pausar Trading'}
          </Button>
          
          {settings.current_daily_loss !== 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={resetDailyLoss}
              className="flex-1"
            >
              Reset Diário
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
};
