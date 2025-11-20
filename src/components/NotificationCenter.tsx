import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Bell, BellOff, TrendingUp, TrendingDown, AlertTriangle, Info, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface Notification {
  id: string;
  log_type: string;
  symbol: string;
  message: string;
  metadata: any;
  created_at: string;
}

export const NotificationCenter = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const { data: notifications, refetch } = useQuery({
    queryKey: ['notifications'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('auto_trader_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      return data as Notification[];
    },
    refetchInterval: false, // DESABILITADO
  });

  useEffect(() => {
    if (notifications) {
      // Contar notificações dos últimos 5 minutos como "não lidas"
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
      const recentNotifications = notifications.filter(
        n => new Date(n.created_at) > fiveMinutesAgo
      );
      setUnreadCount(recentNotifications.length);
    }
  }, [notifications]);

  const getIcon = (type: string) => {
    switch (type) {
      case 'TRADE':
        return <TrendingUp className="w-4 h-4 text-green-500" />;
      case 'AUTO_CLOSE':
        return <CheckCircle2 className="w-4 h-4 text-blue-500" />;
      case 'STOP_LOSS':
        return <AlertTriangle className="w-4 h-4 text-red-500" />;
      case 'ERROR':
        return <AlertTriangle className="w-4 h-4 text-destructive" />;
      default:
        return <Info className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const getNotificationColor = (type: string) => {
    switch (type) {
      case 'TRADE':
        return 'border-l-green-500';
      case 'AUTO_CLOSE':
        return 'border-l-blue-500';
      case 'STOP_LOSS':
        return 'border-l-red-500';
      case 'ERROR':
        return 'border-l-destructive';
      default:
        return 'border-l-muted';
    }
  };

  const formatTimeAgo = (date: string) => {
    const now = new Date();
    const notificationDate = new Date(date);
    const diffInSeconds = Math.floor((now.getTime() - notificationDate.getTime()) / 1000);

    if (diffInSeconds < 60) return 'Agora mesmo';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m atrás`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h atrás`;
    return `${Math.floor(diffInSeconds / 86400)}d atrás`;
  };

  return (
    <div className="relative">
      <Button
        variant="ghost"
        size="icon"
        className="relative"
        onClick={() => setIsOpen(!isOpen)}
      >
        {isOpen ? <BellOff className="w-5 h-5" /> : <Bell className="w-5 h-5" />}
        {unreadCount > 0 && (
          <Badge 
            variant="destructive" 
            className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </Badge>
        )}
      </Button>

      {isOpen && (
        <Card className="absolute right-0 top-12 w-96 max-w-[calc(100vw-2rem)] z-50 shadow-lg">
          <div className="p-4 border-b border-border">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Notificações</h3>
              {unreadCount > 0 && (
                <Badge variant="secondary">{unreadCount} novas</Badge>
              )}
            </div>
          </div>

          <ScrollArea className="h-96">
            <div className="p-2">
              {notifications && notifications.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  Nenhuma notificação ainda
                </div>
              ) : (
                <div className="space-y-2">
                  {notifications?.map((notification) => {
                    const isRecent = new Date(notification.created_at) > new Date(Date.now() - 5 * 60 * 1000);
                    
                    return (
                      <div
                        key={notification.id}
                        className={`p-3 rounded-lg border-l-4 ${getNotificationColor(notification.log_type)} ${
                          isRecent ? 'bg-primary/5' : 'bg-muted/30'
                        } hover:bg-muted/50 transition-colors`}
                      >
                        <div className="flex items-start gap-3">
                          <div className="mt-0.5">
                            {getIcon(notification.log_type)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-medium text-sm truncate">
                                {notification.symbol}
                              </span>
                              <Badge variant="outline" className="text-xs">
                                {notification.log_type}
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground line-clamp-2">
                              {notification.message}
                            </p>
                            {notification.metadata?.pnl && (
                              <div className={`text-sm font-semibold mt-1 ${
                                notification.metadata.pnl > 0 ? 'text-green-500' : 'text-red-500'
                              }`}>
                                P&L: ${notification.metadata.pnl.toFixed(2)}
                              </div>
                            )}
                            <p className="text-xs text-muted-foreground mt-1">
                              {formatTimeAgo(notification.created_at)}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </ScrollArea>

          <div className="p-3 border-t border-border">
            <Button 
              variant="ghost" 
              size="sm" 
              className="w-full"
              onClick={() => setUnreadCount(0)}
            >
              Marcar todas como lidas
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
};
