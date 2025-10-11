import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Send, Loader2 } from "lucide-react";

export const WebhookTester = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const [testData, setTestData] = useState({
    action: "buy",
    symbol: "BTCUSDT",
    price: 111500,
    confidence: 85,
    qty: 0.01,
    rsi: 48,
    atr: 1200,
    ema_fast: 111600,
    ema_slow: 111400,
    stop_loss: 109700,
    take_profit: 114500
  });

  const testWebhook = async () => {
    setLoading(true);
    setResult(null);

    try {
      const response = await fetch(
        "https://uohdpxkfgxmtlosnmspf.supabase.co/functions/v1/tradingview-webhook",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(testData),
        }
      );

      const data = await response.json();
      setResult({ status: response.status, data });

      if (response.ok) {
        toast({
          title: "✅ Webhook testado com sucesso",
          description: `Status: ${data.status}`,
        });
      } else {
        toast({
          title: "⚠️ Webhook retornou erro",
          description: data.message || "Erro desconhecido",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      console.error("Erro testando webhook:", error);
      setResult({ error: error.message });
      toast({
        title: "❌ Erro ao testar webhook",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="p-6">
      <h3 className="text-lg font-bold mb-4">🧪 Testar Webhook</h3>

      <div className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <div>
            <Label htmlFor="action">Ação</Label>
            <Input
              id="action"
              value={testData.action}
              onChange={(e) => setTestData({ ...testData, action: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="symbol">Símbolo</Label>
            <Input
              id="symbol"
              value={testData.symbol}
              onChange={(e) => setTestData({ ...testData, symbol: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="confidence">Confiança (%)</Label>
            <Input
              id="confidence"
              type="number"
              value={testData.confidence}
              onChange={(e) => setTestData({ ...testData, confidence: Number(e.target.value) })}
            />
          </div>
          <div>
            <Label htmlFor="price">Preço</Label>
            <Input
              id="price"
              type="number"
              value={testData.price}
              onChange={(e) => setTestData({ ...testData, price: Number(e.target.value) })}
            />
          </div>
          <div>
            <Label htmlFor="rsi">RSI</Label>
            <Input
              id="rsi"
              type="number"
              value={testData.rsi}
              onChange={(e) => setTestData({ ...testData, rsi: Number(e.target.value) })}
            />
          </div>
          <div>
            <Label htmlFor="qty">Quantidade</Label>
            <Input
              id="qty"
              type="number"
              step="0.001"
              value={testData.qty}
              onChange={(e) => setTestData({ ...testData, qty: Number(e.target.value) })}
            />
          </div>
        </div>

        <Button onClick={testWebhook} disabled={loading} className="w-full">
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Testando...
            </>
          ) : (
            <>
              <Send className="w-4 h-4 mr-2" />
              Testar Webhook
            </>
          )}
        </Button>

        {result && (
          <div className="mt-4 p-4 bg-muted/30 rounded-lg">
            <p className="text-xs text-muted-foreground mb-2">Resposta:</p>
            <pre className="text-xs overflow-auto max-h-60">
              {JSON.stringify(result, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </Card>
  );
};
