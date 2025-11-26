import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { getUserId } from "@/lib/anonymousUser";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Settings, Save } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Config {
  id?: string;
  min_confidence: number;
  max_position_size: number;
  max_simultaneous_positions: number;
  risk_per_trade_percentage: number;
  use_stop_loss: boolean;
  use_take_profit: boolean;
  trailing_stop_percentage: number;
  allowed_symbols: string[];
  excluded_symbols: string[];
  timeframes: string[];
  operating_hours_start: number;
  operating_hours_end: number;
  notifications_enabled: boolean;
  email_notifications: boolean;
  is_active: boolean;
}

export const AutoTraderSettings = () => {
  const { toast } = useToast();
  const [config, setConfig] = useState<Config>({
    min_confidence: 85,
    max_position_size: 1000,
    max_simultaneous_positions: 5,
    risk_per_trade_percentage: 2,
    use_stop_loss: true,
    use_take_profit: true,
    trailing_stop_percentage: 5, // Aumentar para 5% por padrão
    allowed_symbols: ['BTC/USD', 'ETH/USD'],
    excluded_symbols: [],
    timeframes: ['1h', '4h'],
    operating_hours_start: 0,
    operating_hours_end: 24,
    notifications_enabled: true,
    email_notifications: false,
    is_active: false,
  });

  const { data: savedConfig, refetch } = useQuery({
    queryKey: ['auto-trader-config'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('auto_trader_config')
        .select('*')
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      return data;
    },
  });

  useEffect(() => {
    if (savedConfig) {
      setConfig(savedConfig as unknown as Config);
    }
  }, [savedConfig]);

  const saveConfig = async () => {
    try {
      const userId = await getUserId();

      if (savedConfig?.id) {
        const { error } = await supabase
          .from('auto_trader_config')
          .update(config)
          .eq('id', savedConfig.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('auto_trader_config')
          .insert([{ ...config, user_id: userId }]);

        if (error) throw error;
      }

      toast({
        title: "✅ Configurações salvas",
        description: "As configurações do Auto Trader foram atualizadas",
      });

      refetch();
    } catch (error: any) {
      toast({
        title: "❌ Erro ao salvar",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  return (
    <Card className="p-6">
      <div className="flex items-center gap-2 mb-6">
        <Settings className="h-6 w-6" />
        <h3 className="text-2xl font-bold">Configurações do Auto Trader</h3>
      </div>

      <div className="space-y-6">
        {/* Gerenciamento de Risco */}
        <div>
          <h4 className="font-semibold mb-4 flex items-center gap-2">
            Gerenciamento de Risco
            <Badge variant="outline">Essencial</Badge>
          </h4>
          
          <div className="space-y-4">
            <div>
              <Label>Confiança Mínima (%)</Label>
              <div className="flex items-center gap-4">
                <Slider
                  value={[config.min_confidence]}
                  onValueChange={([value]) => setConfig({ ...config, min_confidence: value })}
                  min={50}
                  max={100}
                  step={5}
                  className="flex-1"
                />
                <Input
                  type="number"
                  value={config.min_confidence}
                  onChange={(e) => setConfig({ ...config, min_confidence: parseInt(e.target.value) })}
                  className="w-20"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Tamanho Máximo da Posição ($)</Label>
                <Input
                  type="number"
                  value={config.max_position_size}
                  onChange={(e) => setConfig({ ...config, max_position_size: parseFloat(e.target.value) })}
                />
              </div>
              <div>
                <Label>Máximo de Posições Simultâneas</Label>
                <Input
                  type="number"
                  value={config.max_simultaneous_positions}
                  onChange={(e) => setConfig({ ...config, max_simultaneous_positions: parseInt(e.target.value) })}
                />
              </div>
            </div>

            <div>
              <Label>Risco por Trade (%)</Label>
              <div className="flex items-center gap-4">
                <Slider
                  value={[config.risk_per_trade_percentage]}
                  onValueChange={([value]) => setConfig({ ...config, risk_per_trade_percentage: value })}
                  min={0.5}
                  max={10}
                  step={0.5}
                  className="flex-1"
                />
                <Input
                  type="number"
                  value={config.risk_per_trade_percentage}
                  onChange={(e) => setConfig({ ...config, risk_per_trade_percentage: parseFloat(e.target.value) })}
                  className="w-20"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Stop Loss e Take Profit */}
        <div>
          <h4 className="font-semibold mb-4">Proteção de Posições</h4>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label>Usar Stop Loss</Label>
                <p className="text-xs text-muted-foreground">Fecha automaticamente em perda</p>
              </div>
              <Switch
                checked={config.use_stop_loss}
                onCheckedChange={(checked) => setConfig({ ...config, use_stop_loss: checked })}
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label>Usar Take Profit</Label>
                <p className="text-xs text-muted-foreground">Fecha automaticamente em lucro</p>
              </div>
              <Switch
                checked={config.use_take_profit}
                onCheckedChange={(checked) => setConfig({ ...config, use_take_profit: checked })}
              />
            </div>

            <div>
              <Label>Trailing Stop (%)</Label>
              <Input
                type="number"
                value={config.trailing_stop_percentage}
                onChange={(e) => setConfig({ ...config, trailing_stop_percentage: parseFloat(e.target.value) })}
              />
            </div>
          </div>
        </div>

        {/* Horário de Operação */}
        <div>
          <h4 className="font-semibold mb-4">Horário de Operação</h4>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Início (hora)</Label>
              <Input
                type="number"
                min={0}
                max={23}
                value={config.operating_hours_start}
                onChange={(e) => setConfig({ ...config, operating_hours_start: parseInt(e.target.value) })}
              />
            </div>
            <div>
              <Label>Fim (hora)</Label>
              <Input
                type="number"
                min={0}
                max={24}
                value={config.operating_hours_end}
                onChange={(e) => setConfig({ ...config, operating_hours_end: parseInt(e.target.value) })}
              />
            </div>
          </div>
        </div>

        {/* Notificações */}
        <div>
          <h4 className="font-semibold mb-4">Notificações</h4>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label>Notificações Ativadas</Label>
              <Switch
                checked={config.notifications_enabled}
                onCheckedChange={(checked) => setConfig({ ...config, notifications_enabled: checked })}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label>Notificações por Email</Label>
              <Switch
                checked={config.email_notifications}
                onCheckedChange={(checked) => setConfig({ ...config, email_notifications: checked })}
              />
            </div>
          </div>
        </div>

        {/* Status */}
        <div className="pt-4 border-t">
          <div className="flex items-center justify-between mb-4">
            <div>
              <Label>Status do Auto Trader</Label>
              <p className="text-xs text-muted-foreground">
                {config.is_active ? 'Sistema ativo e operando' : 'Sistema pausado'}
              </p>
            </div>
            <Switch
              checked={config.is_active}
              onCheckedChange={(checked) => setConfig({ ...config, is_active: checked })}
            />
          </div>
        </div>

        <Button onClick={saveConfig} className="w-full" size="lg">
          <Save className="w-4 h-4 mr-2" />
          Salvar Configurações
        </Button>
      </div>
    </Card>
  );
};