import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertTriangleIcon, BellIcon, PlusIcon, Settings2Icon, VolumeXIcon, Volume2Icon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface AlertConfig {
  id: string;
  name: string;
  symbol: string;
  alert_type: string;
  conditions: any;
  is_active: boolean;
  notifications: any;
  created_at: string;
}

interface TriggeredAlert {
  id: string;
  message: string;
  triggered_at: string;
  is_read: boolean;
  trigger_data: any;
}

const SmartAlerts = () => {
  const [isCreating, setIsCreating] = useState(false);
  const [newAlert, setNewAlert] = useState({
    name: '',
    symbol: 'BTC/USD',
    alert_type: 'SIGNAL_CONFIDENCE',
    conditions: { threshold: 85 },
    notifications: { email: false, push: true, sound: true }
  });

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch alert configs
  const { data: alertConfigs, isLoading: configsLoading } = useQuery({
    queryKey: ['alert-configs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('trading_alerts_config')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data.map(item => ({
        ...item,
        notifications: item.notifications as any
      })) as AlertConfig[];
    },
    refetchInterval: false, // DESABILITADO
  });

  // Fetch triggered alerts
  const { data: triggeredAlerts } = useQuery({
    queryKey: ['triggered-alerts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('triggered_alerts')
        .select('*')
        .order('triggered_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      return data as TriggeredAlert[];
    },
    refetchInterval: false, // DESABILITADO
  });

  // Create alert mutation
  const createAlert = useMutation({
    mutationFn: async (alertData: any) => {
      const { data, error } = await supabase
        .from('trading_alerts_config')
        .insert([alertData])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alert-configs'] });
      setIsCreating(false);
      setNewAlert({
        name: '',
        symbol: 'BTC/USD',
        alert_type: 'SIGNAL_CONFIDENCE',
        conditions: { threshold: 85 },
        notifications: { email: false, push: true, sound: true }
      });
      toast({
        title: "Alerta criado!",
        description: "Seu alerta inteligente está ativo e monitorando o mercado.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao criar alerta",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // Toggle alert mutation
  const toggleAlert = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { data, error } = await supabase
        .from('trading_alerts_config')
        .update({ is_active, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alert-configs'] });
    }
  });

  // Mark alert as read
  const markAsRead = useMutation({
    mutationFn: async (alertId: string) => {
      const { data, error } = await supabase
        .from('triggered_alerts')
        .update({ is_read: true })
        .eq('id', alertId);

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['triggered-alerts'] });
    }
  });

  const handleCreateAlert = () => {
    createAlert.mutate(newAlert);
  };

  const getAlertTypeLabel = (type: string) => {
    switch (type) {
      case 'PRICE_LEVEL': return 'Nível de Preço';
      case 'SIGNAL_CONFIDENCE': return 'Confiança do Sinal';
      case 'VOLUME_SPIKE': return 'Pico de Volume';
      case 'NEWS_SENTIMENT': return 'Sentimento das Notícias';
      default: return type;
    }
  };

  const unreadCount = triggeredAlerts?.filter(alert => !alert.is_read).length || 0;

  return (
    <Card className="glass-card border-2 border-primary/20 shadow-elevated">
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-gradient-to-br from-primary/20 to-accent/20">
              <BellIcon className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h2 className="text-2xl font-bold glow-text">Alertas Inteligentes</h2>
              <p className="text-sm text-muted-foreground">Configure notificações automáticas</p>
            </div>
            {unreadCount > 0 && (
              <Badge className="bg-gradient-to-r from-destructive to-destructive/80 border-0 shadow-lg shadow-destructive/30 animate-glow">
                {unreadCount} novos
              </Badge>
            )}
          </div>
          <Dialog open={isCreating} onOpenChange={setIsCreating}>
            <DialogTrigger asChild>
              <Button className="bg-gradient-to-r from-primary to-accent hover:opacity-90 shadow-lg shadow-primary/30 transition-all hover:scale-105">
                <PlusIcon className="w-4 h-4 mr-2" />
                Criar Alerta
              </Button>
            </DialogTrigger>
            <DialogContent className="glass-card border-2 border-primary/20">
              <DialogHeader>
                <DialogTitle className="text-xl glow-text">Novo Alerta Inteligente</DialogTitle>
              </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="alert-name">Nome do Alerta</Label>
                <Input
                  id="alert-name"
                  value={newAlert.name}
                  onChange={(e) => setNewAlert({ ...newAlert, name: e.target.value })}
                  placeholder="Ex: BTC Alta Confiança"
                />
              </div>

              <div>
                <Label htmlFor="alert-type">Tipo de Alerta</Label>
                <Select 
                  value={newAlert.alert_type} 
                  onValueChange={(value) => setNewAlert({ ...newAlert, alert_type: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="SIGNAL_CONFIDENCE">Confiança do Sinal</SelectItem>
                    <SelectItem value="PRICE_LEVEL">Nível de Preço</SelectItem>
                    <SelectItem value="VOLUME_SPIKE">Pico de Volume</SelectItem>
                    <SelectItem value="NEWS_SENTIMENT">Sentimento das Notícias</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {newAlert.alert_type === 'SIGNAL_CONFIDENCE' && (
                <div>
                  <Label htmlFor="threshold">Confiança Mínima (%)</Label>
                  <Input
                    id="threshold"
                    type="number"
                    min="50"
                    max="100"
                    value={newAlert.conditions.threshold}
                    onChange={(e) => setNewAlert({ 
                      ...newAlert, 
                      conditions: { threshold: parseInt(e.target.value) }
                    })}
                  />
                </div>
              )}

              <div className="space-y-3">
                <Label>Notificações</Label>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Som</span>
                  <Switch
                    checked={newAlert.notifications.sound}
                    onCheckedChange={(checked) => setNewAlert({
                      ...newAlert,
                      notifications: { ...newAlert.notifications, sound: checked }
                    })}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Push</span>
                  <Switch
                    checked={newAlert.notifications.push}
                    onCheckedChange={(checked) => setNewAlert({
                      ...newAlert,
                      notifications: { ...newAlert.notifications, push: checked }
                    })}
                  />
                </div>
              </div>

              <Button 
                onClick={handleCreateAlert} 
                className="w-full bg-gradient-to-r from-primary to-accent hover:opacity-90"
                disabled={!newAlert.name || createAlert.isPending}
              >
                {createAlert.isPending ? 'Criando...' : 'Criar Alerta'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Alertas Configurados */}
        <Card className="border-2 border-border/50 bg-card/50 backdrop-blur-sm shadow-card">
          <div className="p-6">
            <h3 className="font-semibold mb-4 flex items-center gap-2 text-lg">
              <div className="p-1.5 rounded-lg bg-primary/20">
                <Settings2Icon className="w-4 h-4 text-primary" />
              </div>
              Alertas Configurados
            </h3>
          
          {configsLoading ? (
            <div className="space-y-3">
              {[1,2,3].map(i => (
                <div key={i} className="h-16 bg-muted rounded animate-pulse"></div>
              ))}
            </div>
          ) : alertConfigs?.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <BellIcon className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>Nenhum alerta configurado</p>
              <p className="text-sm">Crie seu primeiro alerta inteligente</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-80 overflow-y-auto pr-2">
              {alertConfigs?.map((alert) => (
                <div key={alert.id} className={`flex items-center justify-between p-4 rounded-lg border-2 transition-all hover:scale-[1.02] ${
                  alert.is_active 
                    ? 'border-primary/30 bg-gradient-to-br from-primary/5 to-transparent shadow-sm' 
                    : 'border-border/30 bg-muted/20 opacity-60'
                }`}>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium">{alert.name}</span>
                      <Badge variant="outline" className={`text-xs ${
                        alert.is_active ? 'border-primary/50 text-primary' : ''
                      }`}>
                        {getAlertTypeLabel(alert.alert_type)}
                      </Badge>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {alert.symbol} • Threshold: {alert.conditions?.threshold || 'N/A'}
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      {alert.notifications.sound && <Volume2Icon className="w-3 h-3 text-primary" />}
                      {!alert.notifications.sound && <VolumeXIcon className="w-3 h-3 text-muted-foreground" />}
                      {alert.notifications.push && <BellIcon className="w-3 h-3 text-primary" />}
                    </div>
                  </div>
                  <Switch
                    checked={alert.is_active}
                    onCheckedChange={(checked) => toggleAlert.mutate({ id: alert.id, is_active: checked })}
                  />
                </div>
              ))}
            </div>
          )}
          </div>
        </Card>

        {/* Alertas Disparados */}
        <Card className="border-2 border-border/50 bg-card/50 backdrop-blur-sm shadow-card">
          <div className="p-6">
            <h3 className="font-semibold mb-4 flex items-center gap-2 text-lg">
              <div className="p-1.5 rounded-lg bg-accent/20">
                <AlertTriangleIcon className="w-4 h-4 text-accent" />
              </div>
              Alertas Recentes
            </h3>
          
          {triggeredAlerts?.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <AlertTriangleIcon className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>Nenhum alerta disparado</p>
              <p className="text-sm">Os alertas aparecerão aqui quando ativados</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-80 overflow-y-auto pr-2">
              {triggeredAlerts?.map((alert) => (
                <div 
                  key={alert.id} 
                  className={`p-4 rounded-lg border-2 cursor-pointer transition-all hover:scale-[1.02] ${
                    alert.is_read 
                      ? 'bg-muted/10 border-border/30 opacity-70' 
                      : 'bg-gradient-to-br from-accent/10 to-transparent border-accent/40 shadow-lg shadow-accent/10 animate-glow'
                  }`}
                  onClick={() => !alert.is_read && markAsRead.mutate(alert.id)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="font-medium text-sm flex items-center gap-2">
                        {!alert.is_read && <span className="w-2 h-2 bg-accent rounded-full animate-pulse" />}
                        {alert.message}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {new Date(alert.triggered_at).toLocaleString()}
                      </div>
                      {alert.trigger_data && (
                        <div className="text-xs mt-2 p-2 bg-muted/30 rounded font-mono">
                          {JSON.stringify(alert.trigger_data, null, 2)}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
          </div>
        </Card>
      </div>
      </div>
    </Card>
  );
};

export default SmartAlerts;