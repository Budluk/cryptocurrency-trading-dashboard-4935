import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

export const BybitModeToggle = () => {
  const [isTestnet, setIsTestnet] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const { toast } = useToast();

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
        toast({
          title: "✅ Conectado com sucesso!",
          description: `Modo: ${isTestnet ? 'TESTNET' : 'REAL'}`,
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
      <div className="flex items-center justify-between gap-4">
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
