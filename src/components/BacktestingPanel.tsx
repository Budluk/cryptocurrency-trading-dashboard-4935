import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Calendar, TrendingUp, TrendingDown, Target, Activity, PlayCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { getUserId } from "@/lib/anonymousUser";

interface BacktestResult {
  id: string;
  start_date: string;
  end_date: string;
  total_trades: number;
  winning_trades: number;
  losing_trades: number;
  total_pnl: number;
  win_rate: number;
  profit_factor: number;
  max_drawdown: number;
  sharpe_ratio: number | null;
  created_at: string;
}

export const BacktestingPanel = () => {
  const { toast } = useToast();
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState(0);

  const { data: results, refetch } = useQuery({
    queryKey: ['backtesting-results'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('backtesting_results')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5);

      if (error) throw error;
      return data as BacktestResult[];
    },
  });

  const runBacktest = async () => {
    if (!startDate || !endDate) {
      toast({
        title: "⚠️ Datas obrigatórias",
        description: "Selecione as datas de início e fim",
        variant: "destructive",
      });
      return;
    }

    setIsRunning(true);
    setProgress(0);

    try {
      // Simular progresso do backtesting
      const interval = setInterval(() => {
        setProgress(prev => Math.min(prev + 10, 90));
      }, 500);

      // Aqui você implementaria a lógica real de backtesting
      // Por enquanto, vamos simular resultados
      await new Promise(resolve => setTimeout(resolve, 5000));

      clearInterval(interval);
      setProgress(100);

      const userId = await getUserId();

      const simulatedResult = {
        user_id: userId,
        start_date: startDate,
        end_date: endDate,
        total_trades: Math.floor(Math.random() * 100) + 50,
        winning_trades: Math.floor(Math.random() * 50) + 30,
        losing_trades: Math.floor(Math.random() * 30) + 10,
        total_pnl: (Math.random() * 10000) - 2000,
        win_rate: Math.random() * 40 + 50,
        profit_factor: Math.random() * 2 + 1,
        max_drawdown: Math.random() * 20 + 5,
        sharpe_ratio: Math.random() * 2,
        config_snapshot: {},
        trades_data: [],
      };

      const { error } = await supabase
        .from('backtesting_results')
        .insert([simulatedResult]);

      if (error) throw error;

      toast({
        title: "✅ Backtesting concluído",
        description: `Analisados ${simulatedResult.total_trades} trades`,
      });

      refetch();
    } catch (error: any) {
      toast({
        title: "❌ Erro no backtesting",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsRunning(false);
      setProgress(0);
    }
  };

  const getPnLColor = (pnl: number) => {
    return pnl > 0 ? 'text-green-500' : pnl < 0 ? 'text-red-500' : 'text-muted-foreground';
  };

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-6">
          <Calendar className="h-6 w-6" />
          <h3 className="text-2xl font-bold">Backtesting</h3>
        </div>

        <div className="space-y-4 mb-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Data Início</Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                disabled={isRunning}
              />
            </div>
            <div>
              <Label>Data Fim</Label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                disabled={isRunning}
              />
            </div>
          </div>

          {isRunning && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>Executando backtesting...</span>
                <span>{progress}%</span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>
          )}

          <Button 
            onClick={runBacktest} 
            disabled={isRunning}
            className="w-full"
            size="lg"
          >
            <PlayCircle className="w-4 h-4 mr-2" />
            {isRunning ? 'Executando...' : 'Executar Backtesting'}
          </Button>
        </div>
      </Card>

      {/* Resultados Anteriores */}
      <div className="space-y-4">
        <h4 className="text-lg font-semibold">Resultados Anteriores</h4>
        
        {results?.map((result) => (
          <Card key={result.id} className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <Badge variant="outline">
                  {new Date(result.start_date).toLocaleDateString()} - {new Date(result.end_date).toLocaleDateString()}
                </Badge>
                <p className="text-xs text-muted-foreground mt-1">
                  Executado em {new Date(result.created_at).toLocaleString()}
                </p>
              </div>
              <Badge variant={result.total_pnl > 0 ? 'default' : 'destructive'} className="text-lg px-4 py-2">
                ${result.total_pnl.toFixed(2)}
              </Badge>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-3 bg-muted/30 rounded-lg">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <Activity className="w-4 h-4 text-primary" />
                  <p className="text-xs text-muted-foreground">Total Trades</p>
                </div>
                <p className="text-2xl font-bold">{result.total_trades}</p>
              </div>

              <div className="text-center p-3 bg-muted/30 rounded-lg">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <Target className="w-4 h-4 text-green-500" />
                  <p className="text-xs text-muted-foreground">Win Rate</p>
                </div>
                <p className="text-2xl font-bold text-green-500">
                  {result.win_rate.toFixed(1)}%
                </p>
              </div>

              <div className="text-center p-3 bg-muted/30 rounded-lg">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <TrendingUp className="w-4 h-4 text-blue-500" />
                  <p className="text-xs text-muted-foreground">Profit Factor</p>
                </div>
                <p className="text-2xl font-bold">{result.profit_factor.toFixed(2)}</p>
              </div>

              <div className="text-center p-3 bg-muted/30 rounded-lg">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <TrendingDown className="w-4 h-4 text-red-500" />
                  <p className="text-xs text-muted-foreground">Max Drawdown</p>
                </div>
                <p className="text-2xl font-bold text-red-500">
                  {result.max_drawdown.toFixed(1)}%
                </p>
              </div>
            </div>

            <div className="mt-4 pt-4 border-t border-border grid grid-cols-3 gap-4 text-center text-sm">
              <div>
                <p className="text-muted-foreground">Vitórias</p>
                <p className="font-semibold text-green-500">{result.winning_trades}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Derrotas</p>
                <p className="font-semibold text-red-500">{result.losing_trades}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Sharpe Ratio</p>
                <p className="font-semibold">{result.sharpe_ratio?.toFixed(2) || 'N/A'}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
};