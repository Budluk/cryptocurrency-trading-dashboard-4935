import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { AlertCircle, CheckCircle2, Wallet, TrendingUp } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

export const BybitModeToggle = () => {
  const [isTestnet, setIsTestnet] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [balance, setBalance] = useState<number | null>(null);
  const [totalTrades, setTotalTrades] = useState<number>(0);
  const { toast } = useToast();

  useEffect(() => {
    loadTradeHistory();
  }, []);

  const loadTradeHistory = async () => {
    try {
      const { data, error } = await supabase
        .from('signal_history')
        .select('*')
        .eq('status', 'CLOSED');
      
      if (!error && data) {
        setTotalTrades(data.length);
      }
    } catch (error) {
      console.error('Failed to load trade history:', error);
    }
  };

  const testConnection = async () => {
    setIsChecking(true);
    try {
      const { data, error } = await supabase.functions.invoke('bybit-trading', {
        body: {
          action: 'get_balance',
          isTestnet,
          params: { accountType: 'UNIFIED' }
        }
      });

      if (error) throw error;

      if (data.success) {
        setIsConnected(true);
        
        // Extract balance from response
        const walletBalance = data.data?.list?.[0]?.totalEquity || 0;
        setBalance(parseFloat(walletBalance));
        
        toast({
          title: "✅ Conectado com sucesso!",
          description: `Modo: ${isTestnet ? 'TESTNET' : 'REAL'} | Saldo: $${parseFloat(walletBalance).toFixed(2)}`,
        });
      } else {
        throw new Error(data.error);
      }
    } catch (error) {
      console.error('Connection test failed:', error);
      setIsConnected(false);
      toast({
        title: "❌ Falha na conexão",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsChecking(false);
    }
  };

  const handleModeChange = (checked: boolean) => {
    setIsTestnet(!checked);
    setIsConnected(false);
    toast({
      title: "Modo alterado",
      description: `Agora em modo ${checked ? 'REAL' : 'TESTNET'}`,
    });
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
          <Badge variant={isTestnet ? "outline" : "destructive"}>
            {isTestnet ? 'TESTNET' : 'REAL'}
          </Badge>

          <div className="flex items-center gap-2">
            <Label htmlFor="bybit-mode" className="text-xs">
              Testnet
            </Label>
            <Switch
              id="bybit-mode"
              checked={!isTestnet}
              onCheckedChange={handleModeChange}
            />
            <Label htmlFor="bybit-mode" className="text-xs">
              Real
            </Label>
          </div>

          <Button
            size="sm"
            onClick={testConnection}
            disabled={isChecking}
          >
            {isChecking ? 'Testando...' : 'Testar Conexão'}
          </Button>
        </div>
      </div>
    </Card>
  );
};
