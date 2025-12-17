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
    conditions: {
      threshold: 85
    },
    notifications: {
      email: false,
      push: true,
      sound: true
    }
  });
  const {
    toast
  } = useToast();
  const queryClient = useQueryClient();

  // Fetch alert configs
  const {
    data: alertConfigs,
    isLoading: configsLoading
  } = useQuery({
    queryKey: ['alert-configs'],
    queryFn: async () => {
      const {
        data,
        error
      } = await supabase.from('trading_alerts_config').select('*').order('created_at', {
        ascending: false
      });
      if (error) throw error;
      return data.map(item => ({
        ...item,
        notifications: item.notifications as any
      })) as AlertConfig[];
    },
    refetchInterval: false // DESABILITADO
  });

  // Fetch triggered alerts
  const {
    data: triggeredAlerts
  } = useQuery({
    queryKey: ['triggered-alerts'],
    queryFn: async () => {
      const {
        data,
        error
      } = await supabase.from('triggered_alerts').select('*').order('triggered_at', {
        ascending: false
      }).limit(20);
      if (error) throw error;
      return data as TriggeredAlert[];
    },
    refetchInterval: false // DESABILITADO
  });

  // Create alert mutation
  const createAlert = useMutation({
    mutationFn: async (alertData: any) => {
      const {
        data,
        error
      } = await supabase.from('trading_alerts_config').insert([alertData]).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['alert-configs']
      });
      setIsCreating(false);
      setNewAlert({
        name: '',
        symbol: 'BTC/USD',
        alert_type: 'SIGNAL_CONFIDENCE',
        conditions: {
          threshold: 85
        },
        notifications: {
          email: false,
          push: true,
          sound: true
        }
      });
      toast({
        title: "Alerta criado!",
        description: "Seu alerta inteligente está ativo e monitorando o mercado."
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao criar alerta",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  // Toggle alert mutation
  const toggleAlert = useMutation({
    mutationFn: async ({
      id,
      is_active
    }: {
      id: string;
      is_active: boolean;
    }) => {
      const {
        data,
        error
      } = await supabase.from('trading_alerts_config').update({
        is_active,
        updated_at: new Date().toISOString()
      }).eq('id', id).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['alert-configs']
      });
    }
  });

  // Mark alert as read
  const markAsRead = useMutation({
    mutationFn: async (alertId: string) => {
      const {
        data,
        error
      } = await supabase.from('triggered_alerts').update({
        is_read: true
      }).eq('id', alertId);
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['triggered-alerts']
      });
    }
  });
  const handleCreateAlert = () => {
    createAlert.mutate(newAlert);
  };
  const getAlertTypeLabel = (type: string) => {
    switch (type) {
      case 'PRICE_LEVEL':
        return 'Nível de Preço';
      case 'SIGNAL_CONFIDENCE':
        return 'Confiança do Sinal';
      case 'VOLUME_SPIKE':
        return 'Pico de Volume';
      case 'NEWS_SENTIMENT':
        return 'Sentimento das Notícias';
      default:
        return type;
    }
  };
  const unreadCount = triggeredAlerts?.filter(alert => !alert.is_read).length || 0;
  return <Card className="glass-card border-2 border-primary/20 shadow-elevated">
      
    </Card>;
};
export default SmartAlerts;