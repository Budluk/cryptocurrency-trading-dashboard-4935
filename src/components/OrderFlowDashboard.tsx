import { useEffect, useState, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowUpCircle, ArrowDownCircle, Activity, AlertTriangle, Bell, BellOff } from "lucide-react";
import { useWebNotifications } from "@/hooks/useWebNotifications";
import { useNotificationSettings } from "@/hooks/useNotificationSettings";
import { NotificationSettingsDialog } from "./NotificationSettingsDialog";
import { LargeOrdersHistory } from "./LargeOrdersHistory";
import { toast } from "sonner";

interface OrderFlowData {
  symbol: string;
  buy_volume: number;
  sell_volume: number;
  net_volume: number;
  volume_delta_pct: number;
  large_orders_count: number;
  institutional_flow: string;
  price: number;
  large_orders: Array<{
    side: string;
    size: number;
    price: number;
    value_usd: number;
    is_institutional: boolean;
    impact_score: number;
  }>;
}

export function OrderFlowDashboard() {
  const [flowData, setFlowData] = useState<OrderFlowData[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const { permission, isSupported, requestPermission, sendNotification } = useWebNotifications();
  const { settings, updateSettings, resetSettings, shouldNotify } = useNotificationSettings();
  const previousOrdersRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const projectRef = 'uohdpxkfgxmtlosnmspf';
    const ws = new WebSocket(`wss://${projectRef}.supabase.co/functions/v1/order-flow-analysis`);

    ws.onopen = () => {
      console.log('Order Flow WebSocket connected');
      setIsConnected(true);
      ws.send(JSON.stringify({
        type: 'subscribe',
        symbols: ['BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT']
      }));
    };

    ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      
      if (message.type === 'order_flow_update') {
        setFlowData(message.data);
        
        // Check for new large orders and send notifications based on filters
        if (notificationsEnabled && permission === 'granted') {
          message.data.forEach((data: OrderFlowData) => {
            data.large_orders.forEach((order) => {
              // Check if should notify based on filters
              if (!shouldNotify(order.value_usd, data.symbol, order.is_institutional)) {
                return;
              }

              const orderId = `${data.symbol}-${order.value_usd}-${order.side}-${Date.now()}`;
              
              // Only notify for new orders
              if (!previousOrdersRef.current.has(orderId)) {
                previousOrdersRef.current.add(orderId);
                
                const emoji = order.side === 'BUY' ? '🟢' : '🔴';
                const action = order.side === 'BUY' ? 'COMPRA' : 'VENDA';
                const institutionalLabel = order.is_institutional ? ' INSTITUCIONAL' : '';
                
                sendNotification(
                  `${emoji} Grande Ordem${institutionalLabel} Detectada`,
                  {
                    body: `${action} de ${formatVolume(order.value_usd)} em ${data.symbol}\nImpacto: ${order.impact_score.toFixed(1)}%`,
                    tag: orderId,
                    requireInteraction: true,
                  }
                );
                
                toast.success(
                  `Grande ordem detectada: ${action} de ${formatVolume(order.value_usd)} em ${data.symbol}`,
                  { duration: 5000 }
                );
              }
            });
          });
          
          // Clean up old order IDs (keep only last 100)
          if (previousOrdersRef.current.size > 100) {
            const entries = Array.from(previousOrdersRef.current);
            previousOrdersRef.current = new Set(entries.slice(-100));
          }
        }
      } else if (message.type === 'error') {
        console.error('Order Flow Error:', message.message);
      }
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      setIsConnected(false);
    };

    ws.onclose = () => {
      console.log('WebSocket closed');
      setIsConnected(false);
    };

    return () => {
      ws.close();
    };
  }, []);

  const getFlowBadge = (flow: string) => {
    if (flow === 'accumulation') {
      return <Badge className="bg-success">Acumulação</Badge>;
    }
    if (flow === 'distribution') {
      return <Badge variant="destructive">Distribuição</Badge>;
    }
    return <Badge variant="secondary">Neutro</Badge>;
  };

  const formatVolume = (volume: number) => {
    if (volume >= 1000000) {
      return `$${(volume / 1000000).toFixed(2)}M`;
    }
    return `$${(volume / 1000).toFixed(0)}K`;
  };

  const handleToggleNotifications = async () => {
    if (!notificationsEnabled) {
      // Enable notifications
      if (permission === 'default') {
        const granted = await requestPermission();
        if (granted) {
          setNotificationsEnabled(true);
          toast.success('Notificações de grandes ordens ativadas!');
        }
      } else if (permission === 'granted') {
        setNotificationsEnabled(true);
        toast.success('Notificações de grandes ordens ativadas!');
      } else {
        toast.error('Permissão para notificações foi negada. Verifique as configurações do navegador.');
      }
    } else {
      // Disable notifications
      setNotificationsEnabled(false);
      previousOrdersRef.current.clear();
      toast.info('Notificações de grandes ordens desativadas');
    }
  };

  return (
    <Card className="border-primary/20">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-primary" />
              Order Flow Analysis
            </CardTitle>
            <CardDescription>
              Detecção de movimentações institucionais em tempo real
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {isSupported && notificationsEnabled && (
              <NotificationSettingsDialog
                settings={settings}
                onUpdateSettings={updateSettings}
                onResetSettings={resetSettings}
              />
            )}
            {isSupported && (
              <Button
                variant={notificationsEnabled ? "default" : "outline"}
                size="sm"
                onClick={handleToggleNotifications}
                className="gap-2"
              >
                {notificationsEnabled ? (
                  <>
                    <Bell className="h-4 w-4" />
                    Notificações On
                  </>
                ) : (
                  <>
                    <BellOff className="h-4 w-4" />
                    Notificações Off
                  </>
                )}
              </Button>
            )}
            <Badge variant={isConnected ? "default" : "secondary"}>
              {isConnected ? '🟢 Live' : '🔴 Offline'}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="live" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="live">Fluxo ao Vivo</TabsTrigger>
            <TabsTrigger value="history">Histórico</TabsTrigger>
          </TabsList>
          
          <TabsContent value="live" className="mt-4">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {flowData.map((data) => (
            <Card key={data.symbol} className="bg-muted/30">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg">{data.symbol}</CardTitle>
                    <p className="text-sm text-muted-foreground">
                      ${data.price.toFixed(2)}
                    </p>
                  </div>
                  {getFlowBadge(data.institutional_flow)}
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* Volume Delta */}
                <div className="flex items-center justify-between p-3 rounded-lg bg-background/50">
                  <div className="flex items-center gap-2">
                    {data.net_volume > 0 ? (
                      <ArrowUpCircle className="h-5 w-5 text-success" />
                    ) : (
                      <ArrowDownCircle className="h-5 w-5 text-destructive" />
                    )}
                    <span className="text-sm font-medium">Delta de Volume</span>
                  </div>
                  <div className="text-right">
                    <div className={`text-lg font-bold ${data.net_volume > 0 ? 'text-success' : 'text-destructive'}`}>
                      {data.volume_delta_pct > 0 ? '+' : ''}{data.volume_delta_pct.toFixed(1)}%
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {formatVolume(Math.abs(data.net_volume))}
                    </div>
                  </div>
                </div>

                {/* Buy vs Sell Volume */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-success">Volume Compra</span>
                    <span className="font-semibold">{formatVolume(data.buy_volume)}</span>
                  </div>
                  <div className="w-full bg-background rounded-full h-2">
                    <div 
                      className="bg-success h-2 rounded-full transition-all"
                      style={{ width: `${(data.buy_volume / (data.buy_volume + data.sell_volume)) * 100}%` }}
                    />
                  </div>
                  
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-destructive">Volume Venda</span>
                    <span className="font-semibold">{formatVolume(data.sell_volume)}</span>
                  </div>
                  <div className="w-full bg-background rounded-full h-2">
                    <div 
                      className="bg-destructive h-2 rounded-full transition-all"
                      style={{ width: `${(data.sell_volume / (data.buy_volume + data.sell_volume)) * 100}%` }}
                    />
                  </div>
                </div>

                {/* Large Orders */}
                {data.large_orders_count > 0 && (
                  <div className="p-3 rounded-lg bg-warning/10 border border-warning/30">
                    <div className="flex items-center gap-2 mb-2">
                      <AlertTriangle className="h-4 w-4 text-warning" />
                      <span className="text-sm font-semibold text-warning">
                        {data.large_orders_count} Ordem{data.large_orders_count > 1 ? 's' : ''} Grande{data.large_orders_count > 1 ? 's' : ''}
                      </span>
                    </div>
                    <div className="space-y-1">
                      {data.large_orders.map((order, idx) => (
                        <div key={idx} className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2">
                            <Badge variant={order.side === 'BUY' ? 'default' : 'destructive'} className="text-xs">
                              {order.side}
                            </Badge>
                            {order.is_institutional && (
                              <Badge variant="outline" className="text-xs">
                                Institucional
                              </Badge>
                            )}
                          </div>
                          <span className="font-semibold">
                            {formatVolume(order.value_usd)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

            {flowData.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <Activity className="h-12 w-12 mx-auto mb-3 opacity-50 animate-pulse" />
                <p>Conectando ao stream de order flow...</p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="history" className="mt-4">
            <LargeOrdersHistory />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}