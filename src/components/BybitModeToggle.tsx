import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { AlertCircle, CheckCircle2, Wallet, TrendingUp } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

// 🔒 PERSISTÊNCIA DO MODO REAL
const STORAGE_KEY = 'bybit_real_mode_active';

export const BybitModeToggle = () => {
  const [isTestnet, setIsTestnet] = useState(false); // ⚡ SEMPRE REAL
  const [isConnected, setIsConnected] = useState(() => {
    // Restaurar estado de conexão do localStorage
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === 'true';
  });
  const [isChecking, setIsChecking] = useState(false);
  const [balance, setBalance] = useState<number | null>(() => {
    // Restaurar saldo do localStorage
    const stored = localStorage.getItem('bybit_balance');
    return stored ? parseFloat(stored) : null;
  });
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
    console.log('🔄 Testando conexão Bybit REAL...');
    
    try {
      console.log('📡 Invocando edge function bybit-trading...');
      
      const { data, error } = await supabase.functions.invoke('bybit-trading', {
        body: {
          action: 'get_balance',
          isTestnet: false, // ⚡ SEMPRE CONTA REAL
          params: { accountType: 'UNIFIED' }
        }
      });

      console.log('📥 Resposta recebida:', { data, error });

      if (error) {
        console.error('❌ Erro do Supabase:', error);
        throw new Error(`Erro ao chamar função: ${error.message}`);
      }

      if (!data) {
        throw new Error('Nenhum dado retornado da API');
      }

      if (data.success) {
        console.log('✅ Conexão bem-sucedida!', data.data);
        setIsConnected(true);
        
        // Salvar estado no localStorage
        localStorage.setItem(STORAGE_KEY, 'true');
        
        // Extract balance from response
        const walletBalance = data.data?.list?.[0]?.totalEquity || 0;
        const balanceNum = parseFloat(walletBalance);
        setBalance(balanceNum);
        
        // Salvar saldo no localStorage
        localStorage.setItem('bybit_balance', balanceNum.toString());
        
        toast({
          title: "✅ Conectado com sucesso!",
          description: `Modo: REAL | Saldo: $${balanceNum.toFixed(2)}`,
        });
      } else {
        console.error('❌ Erro da API Bybit:', data.error);
        throw new Error(data.error || 'Erro desconhecido da API Bybit');
      }
    } catch (error: any) {
      console.error('❌ Falha completa na conexão:', error);
      setIsConnected(false);
      
      const errorMessage = error?.message || 'Erro desconhecido ao conectar';
      
      toast({
        title: "❌ Falha na conexão",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsChecking(false);
    }
  };

  const handleModeChange = (checked: boolean) => {
    toast({
      title: "⚠️ Modo Fixado em REAL",
      description: "Sistema configurado apenas para conta real",
      variant: "destructive",
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
