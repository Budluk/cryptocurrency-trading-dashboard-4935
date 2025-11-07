import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, TrendingUp, TrendingDown } from "lucide-react";
import { format } from "date-fns";

interface LargeOrder {
  symbol: string;
  side: string;
  value_usd: number;
  price: number;
  is_institutional: boolean;
  timestamp: number;
}

interface SuspiciousPattern {
  id: string;
  type: 'CLUSTER_ORDERS' | 'PRE_MOVEMENT' | 'REVERSAL_SIGNAL';
  symbol: string;
  description: string;
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
  orders: LargeOrder[];
  detected_at: number;
  reversal_direction?: 'BULLISH' | 'BEARISH';
}

interface PatternAlertsPanelProps {
  patterns: SuspiciousPattern[];
}

export function PatternAlertsPanel({ patterns }: PatternAlertsPanelProps) {
  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'HIGH':
        return 'destructive';
      case 'MEDIUM':
        return 'default';
      default:
        return 'secondary';
    }
  };

  const getPatternIcon = (type: string) => {
    switch (type) {
      case 'CLUSTER_ORDERS':
        return <AlertTriangle className="h-5 w-5 text-destructive" />;
      case 'PRE_MOVEMENT':
        return <TrendingUp className="h-5 w-5 text-warning" />;
      default:
        return <AlertTriangle className="h-5 w-5" />;
    }
  };

  const getPatternTitle = (type: string) => {
    switch (type) {
      case 'CLUSTER_ORDERS':
        return 'Cluster de Ordens';
      case 'PRE_MOVEMENT':
        return 'Ordem Pré-Movimento';
      case 'REVERSAL_SIGNAL':
        return 'Sinal de Reversão';
      default:
        return 'Padrão Suspeito';
    }
  };

  return (
    <Card className="border-destructive/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-destructive" />
          Padrões Suspeitos Detectados
        </CardTitle>
        <CardDescription>
          Alertas de manipulação e atividade institucional coordenada
        </CardDescription>
      </CardHeader>
      <CardContent>
        {patterns.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <AlertTriangle className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p>Nenhum padrão suspeito detectado nos últimos 10 minutos</p>
          </div>
        ) : (
          <div className="space-y-3">
            {patterns.map((pattern) => (
              <div
                key={pattern.id}
                className={`p-4 rounded-lg border ${
                  pattern.severity === 'HIGH' 
                    ? 'bg-destructive/10 border-destructive/30' 
                    : 'bg-warning/10 border-warning/30'
                }`}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {getPatternIcon(pattern.type)}
                    <div>
                      <div className="font-semibold">{getPatternTitle(pattern.type)}</div>
                      <div className="text-xs text-muted-foreground">
                        {format(new Date(pattern.detected_at), 'HH:mm:ss')}
                      </div>
                    </div>
                  </div>
                  <Badge variant={getSeverityColor(pattern.severity)}>
                    {pattern.severity}
                  </Badge>
                </div>
                
                <div className="mb-3">
                  <div className="font-medium text-sm mb-1">{pattern.symbol}</div>
                  <p className="text-sm">{pattern.description}</p>
                </div>

                {pattern.orders.length > 0 && (
                  <div className="space-y-1">
                    <div className="text-xs font-semibold text-muted-foreground">
                      Ordens Relacionadas:
                    </div>
                    {pattern.orders.slice(0, 3).map((order, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between text-xs bg-background/50 p-2 rounded"
                      >
                        <div className="flex items-center gap-2">
                          {order.side === 'BUY' ? (
                            <TrendingUp className="h-3 w-3 text-success" />
                          ) : (
                            <TrendingDown className="h-3 w-3 text-destructive" />
                          )}
                          <span className="font-medium">{order.side}</span>
                          {order.is_institutional && (
                            <Badge variant="outline" className="text-[10px] h-4 px-1">
                              INST
                            </Badge>
                          )}
                        </div>
                        <span className="font-semibold">
                          ${(order.value_usd / 1000).toFixed(0)}K
                        </span>
                      </div>
                    ))}
                    {pattern.orders.length > 3 && (
                      <div className="text-[10px] text-center text-muted-foreground">
                        +{pattern.orders.length - 3} mais ordens
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
