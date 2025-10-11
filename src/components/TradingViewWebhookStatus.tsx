import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Activity, TrendingUp, TrendingDown, Clock, BarChart3 } from "lucide-react";

interface LastSignal {
  id: string;
  log_type: string;
  symbol: string;
  message: string;
  metadata: any;
  created_at: string;
}

export const TradingViewWebhookStatus = () => {
  const { data: lastSignal, refetch } = useQuery({
    queryKey: ['last-tradingview-signal'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('auto_trader_logs')
        .select('*')
        .eq('log_type', 'TRADINGVIEW_SIGNAL')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      return data as LastSignal | null;
    },
    refetchInterval: 5000, // Atualizar a cada 5 segundos
  });

  const webhookUrl = "https://uohdpxkfgxmtlosnmspf.supabase.co/functions/v1/tradingview-webhook";

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Activity className="w-5 h-5 text-primary" />
          <h3 className="text-xl font-bold">TradingView Webhook</h3>
        </div>
        <Badge variant={lastSignal ? "default" : "secondary"}>
          {lastSignal ? "Conectado" : "Aguardando sinais"}
        </Badge>
      </div>

      <div className="space-y-4">
        {/* URL do Webhook */}
        <div className="p-3 bg-muted/30 rounded-lg">
          <p className="text-xs text-muted-foreground mb-1">URL do Webhook:</p>
          <code className="text-xs break-all">{webhookUrl}</code>
        </div>

        {/* Último Sinal */}
        {lastSignal && (
          <div className="space-y-3 pt-3 border-t border-border">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {lastSignal.metadata?.indicators?.ema_fast > lastSignal.metadata?.indicators?.ema_slow ? (
                  <TrendingUp className="w-4 h-4 text-green-500" />
                ) : (
                  <TrendingDown className="w-4 h-4 text-red-500" />
                )}
                <span className="font-semibold">{lastSignal.symbol}</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Clock className="w-3 h-3" />
                {new Date(lastSignal.created_at).toLocaleString()}
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="p-2 bg-muted/20 rounded">
                <p className="text-xs text-muted-foreground">Confiança Original</p>
                <p className="font-semibold text-lg">
                  {lastSignal.metadata?.original_confidence}%
                </p>
              </div>
              <div className="p-2 bg-muted/20 rounded">
                <p className="text-xs text-muted-foreground">Confiança Ajustada</p>
                <p className="font-semibold text-lg text-green-500">
                  {lastSignal.metadata?.adjusted_confidence}%
                </p>
              </div>
              <div className="p-2 bg-muted/20 rounded">
                <p className="text-xs text-muted-foreground">RSI</p>
                <p className="font-semibold text-lg">
                  {lastSignal.metadata?.indicators?.rsi?.toFixed(1)}
                </p>
              </div>
              <div className="p-2 bg-muted/20 rounded">
                <p className="text-xs text-muted-foreground">ATR</p>
                <p className="font-semibold text-lg">
                  {lastSignal.metadata?.indicators?.atr?.toFixed(2)}
                </p>
              </div>
            </div>

            {lastSignal.metadata?.validation_reason && (
              <div className="p-3 bg-primary/10 rounded-lg">
                <p className="text-xs text-muted-foreground mb-1">Validação:</p>
                <p className="text-sm">{lastSignal.metadata.validation_reason}</p>
              </div>
            )}
          </div>
        )}

        {/* Instruções */}
        <div className="pt-3 border-t border-border">
          <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
            <BarChart3 className="w-3 h-3" />
            Como configurar no TradingView:
          </p>
          <ol className="text-xs space-y-1 text-muted-foreground list-decimal list-inside">
            <li>Abra o indicador "SmartFlow Pro" no gráfico</li>
            <li>Clique em "Criar alerta" (ícone de sino)</li>
            <li>Em "Condição", selecione o indicador</li>
            <li>Em "Notificações", marque "Webhook URL"</li>
            <li>Cole a URL acima no campo</li>
            <li>Clique em "Criar"</li>
          </ol>
        </div>
      </div>
    </Card>
  );
};
