import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { Settings, TrendingUp } from "lucide-react";

interface Position {
  id: string;
  symbol: string;
  side: string;
  trailing_stop_percentage: number | null;
  unrealized_pnl: number;
}

export const TrailingStopConfig = () => {
  const { toast } = useToast();
  const [selectedPosition, setSelectedPosition] = useState<string | null>(null);
  const [trailingStopPct, setTrailingStopPct] = useState(1.5);

  const { data: positions, refetch } = useQuery({
    queryKey: ['trailing-stop-positions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('auto_trader_positions')
        .select('id, symbol, side, trailing_stop_percentage, unrealized_pnl')
        .eq('status', 'OPEN')
        .order('opened_at', { ascending: false });

      if (error) throw error;
      return data as Position[];
    },
    refetchInterval: false, // DESABILITADO
  });

  const updateTrailingStop = async (positionId: string, percentage: number) => {
    try {
      const { error } = await supabase
        .from('auto_trader_positions')
        .update({ trailing_stop_percentage: percentage })
        .eq('id', positionId);

      if (error) throw error;

      toast({
        title: "✅ Trailing Stop Atualizado",
        description: `Novo valor: ${percentage.toFixed(1)}%`,
      });

      refetch();
    } catch (error: any) {
      toast({
        title: "❌ Erro ao atualizar",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  return (
    <Card className="p-6">
      <div className="flex items-center gap-2 mb-4">
        <Settings className="h-5 w-5 text-primary" />
        <h3 className="text-lg font-bold">Configuração de Trailing Stop</h3>
      </div>

      <p className="text-sm text-muted-foreground mb-6">
        Ajuste o percentual de trailing stop para cada posição aberta. O stop loss se ajusta automaticamente conforme o preço se move a seu favor.
      </p>

      {(!positions || positions.length === 0) && (
        <div className="text-center py-8 text-muted-foreground">
          Nenhuma posição aberta no momento
        </div>
      )}

      <div className="space-y-4">
        {positions?.map((position) => (
          <div key={position.id} className="p-4 bg-muted/30 rounded-lg border">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary" />
                <span className="font-semibold">{position.symbol}</span>
                <Badge variant={position.side === 'BUY' ? 'default' : 'destructive'} className="text-xs">
                  {position.side}
                </Badge>
              </div>
              <span className={`text-sm font-bold ${position.unrealized_pnl >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                {position.unrealized_pnl >= 0 ? '+' : ''}${position.unrealized_pnl.toFixed(2)}
              </span>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm">Trailing Stop Percentage</Label>
                <span className="text-sm font-semibold text-primary">
                  {selectedPosition === position.id ? trailingStopPct.toFixed(1) : (position.trailing_stop_percentage || 1.5).toFixed(1)}%
                </span>
              </div>

              <Slider
                value={[selectedPosition === position.id ? trailingStopPct : (position.trailing_stop_percentage || 1.5)]}
                onValueChange={(value) => {
                  setSelectedPosition(position.id);
                  setTrailingStopPct(value[0]);
                }}
                min={0.5}
                max={5}
                step={0.1}
                className="w-full"
              />

              <div className="flex justify-between text-xs text-muted-foreground">
                <span>0.5% (Agressivo)</span>
                <span>5.0% (Conservador)</span>
              </div>

              {selectedPosition === position.id && (
                <Button
                  size="sm"
                  className="w-full"
                  onClick={() => {
                    updateTrailingStop(position.id, trailingStopPct);
                    setSelectedPosition(null);
                  }}
                >
                  Aplicar Trailing Stop de {trailingStopPct.toFixed(1)}%
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
};
