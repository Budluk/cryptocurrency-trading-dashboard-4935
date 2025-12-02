import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { AlertCircle, CheckCircle2, Wallet, TrendingUp, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useBybitBalance } from "@/hooks/useBybitBalance";
import { supabase } from "@/integrations/supabase/client";

export const BybitModeToggle = () => {
  const [totalTrades, setTotalTrades] = useState<number>(0);
  const { toast } = useToast();
  
  const { 
    balance, 
    isLoading, 
    isConnected, 
    lastUpdated,
    fetchBalance, 
    testConnection 
  } = useBybitBalance();

  useEffect(() => {
    loadTradeHistory();
  }, []);

  const loadTradeHistory = async () => {
    try {
      const { data, error } = await supabase
        .from('signal_history')
        .select('id', { count: 'exact' })
        .eq('status', 'CLOSED');
      
      if (!error && data) {
        setTotalTrades(data.length);
      }
    } catch (error) {
      console.error('Failed to load trade history:', error);
    }
  };

  const handleTestConnection = async () => {
    const success = await testConnection();
    
    if (success) {
      toast({
        title: "✅ Conectado com sucesso!",
        description: `Modo: REAL | Saldo: $${balance?.toFixed(2) || '0.00'}`,
      });
    } else {
      toast({
        title: "❌ Falha na conexão",
        description: "Verifique as credenciais da API Bybit",
        variant: "destructive",
      });
    }
  };

  const handleRefresh = async () => {
    await fetchBalance();
    toast({
      title: "🔄 Saldo atualizado",
      description: `Saldo atual: $${balance?.toFixed(2) || '0.00'}`,
    });
  };

  const handleModeChange = () => {
    toast({
      title: "⚠️ Modo Fixado em REAL",
      description: "Sistema configurado apenas para conta real",
      variant: "destructive",
    });
  };

  const formatLastUpdated = () => {
    if (!lastUpdated) return '';
    const now = new Date();
    const diff = Math.floor((now.getTime() - lastUpdated.getTime()) / 1000);
    if (diff < 60) return `há ${diff}s`;
    if (diff < 3600) return `há ${Math.floor(diff / 60)}min`;
    return lastUpdated.toLocaleTimeString();
  };

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          {isConnected ? (
            <CheckCircle2 className="h-5 w-5 text-green-500" />
          ) : (
            <AlertCircle className="h-5 w-5 text-yellow-500" />
          )}
          
          <div className="flex flex-col">
            <Label htmlFor="bybit-mode" className="text-sm font-medium">
              Modo Bybit
            </Label>
            <p className="text-xs text-muted-foreground">
              {isConnected ? 'Conectado' : 'Desconectado'}
              {lastUpdated && isConnected && (
                <span className="ml-1 opacity-70">• {formatLastUpdated()}</span>
              )}
            </p>
          </div>
        </div>

        {isConnected && balance !== null && (
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-muted rounded-md">
              <Wallet className="h-4 w-4 text-primary" />
              <div className="flex flex-col">
                <span className="text-xs text-muted-foreground">Saldo</span>
                <span className="text-sm font-semibold">${balance.toFixed(2)}</span>
              </div>
            </div>
            
            <Button
              size="sm"
              variant="ghost"
              onClick={handleRefresh}
              disabled={isLoading}
              className="h-8 w-8 p-0"
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>
            
            <div className="flex items-center gap-2 px-3 py-1.5 bg-muted rounded-md">
              <TrendingUp className="h-4 w-4 text-primary" />
              <div className="flex flex-col">
                <span className="text-xs text-muted-foreground">Histórico</span>
                <span className="text-sm font-semibold">{totalTrades} trades</span>
              </div>
            </div>
          </div>
        )}

        <div className="flex items-center gap-4">
          <Badge variant="destructive" className="text-lg px-4 py-2">
            ⚡ REAL
          </Badge>

          <div className="flex items-center gap-2 opacity-50" title="Modo fixado em REAL">
            <Label htmlFor="bybit-mode" className="text-xs">
              Testnet
            </Label>
            <Switch
              id="bybit-mode"
              checked={true}
              onCheckedChange={handleModeChange}
              disabled
            />
            <Label htmlFor="bybit-mode" className="text-xs">
              Real
            </Label>
          </div>

          <Button
            size="sm"
            onClick={handleTestConnection}
            disabled={isLoading}
          >
            {isLoading ? 'Testando...' : 'Testar Conexão'}
          </Button>
        </div>
      </div>
    </Card>
  );
};
