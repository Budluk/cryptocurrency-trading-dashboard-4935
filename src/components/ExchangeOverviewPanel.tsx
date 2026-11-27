import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { EXCHANGES, getExchangeInfo } from '@/config/exchanges';
import { invokeExchange } from '@/lib/invokeExchange';
import { toast } from 'sonner';

type B3SignalRow = {
  symbol: string;
  side: string;
  price: number;
  confidence: number;
  created_at: string;
  source: string;
};

type SimulationResult = {
  simulated?: boolean;
  reason?: string;
  orderId?: string;
  exchange?: string;
  action?: string;
};

const inputClass = 'min-h-10 w-full rounded-md border border-border bg-background px-3 py-2 text-sm';

export const ExchangeOverviewPanel = () => {
  const [exchangeId, setExchangeId] = useState('BINANCE');
  const [symbol, setSymbol] = useState('BTCUSDT');
  const [side, setSide] = useState('Buy');
  const [qty, setQty] = useState('0.01');
  const [lastSimulation, setLastSimulation] = useState<SimulationResult | null>(null);

  const selected = getExchangeInfo(exchangeId) ?? EXCHANGES[1];

  const { data: signals, isLoading } = useQuery({
    queryKey: ['b3-signals'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('b3_signals')
        .select('symbol, side, price, confidence, created_at, source')
        .order('created_at', { ascending: false })
        .limit(8);
      if (error) throw error;
      return (data ?? []) as B3SignalRow[];
    },
    refetchInterval: 30000,
    staleTime: 15000,
  });

  const simulate = useMutation({
    mutationFn: () => invokeExchange<SimulationResult>('place_order', {
      exchange: exchangeId,
      symbol,
      side,
      qty,
      price: 0,
    }),
    onSuccess: (result) => {
      if (!result.ok) {
        toast.error('Falha na simulação', { description: result.error });
        return;
      }
      setLastSimulation(result.data ?? null);
      toast.success('Simulação registrada', { description: 'Nenhuma ordem real foi enviada.' });
    },
  });

  const changeExchange = (id: string) => {
    const info = getExchangeInfo(id);
    setExchangeId(id);
    setSymbol(info?.symbols[0] ?? 'BTCUSDT');
    setLastSimulation(null);
  };

  return (
    <Card aria-label="Visão geral de exchanges" className="workspace-card">
      <CardHeader className="gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle className="text-lg">B3 + corretoras</CardTitle>
          <p className="text-sm text-muted-foreground">Simulação unificada: B3, exchanges e testnets sem ordens reais neste painel.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline">Simulação unificada</Badge>
          <Badge variant="outline">Sinais B3</Badge>
          <Badge variant="secondary">Sem ordens reais neste painel</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {EXCHANGES.map((item) => (
            <div key={item.id} className="rounded-md border border-border p-3 text-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium">{item.name}</span>
                <Badge variant={item.id === 'BYBIT' ? 'default' : item.paper || item.id === 'B3' ? 'outline' : 'secondary'}>
                  {item.id === 'BYBIT' ? 'Real' : item.paper ? 'Testnet' : item.id === 'B3' ? 'Sinais' : 'Simulação'}
                </Badge>
              </div>
              <p className="mt-1 truncate text-xs text-muted-foreground">{item.symbols.join(' · ')}</p>
              {item.paper && (
                <p className="mt-1 text-xs text-muted-foreground">Paper trading: nunca envia ordem real.</p>
              )}
              {item.id === 'B3' && (
                <p className="mt-1 text-xs text-muted-foreground">Corretoras: {item.brokers.join(', ')}</p>
              )}
            </div>
          ))}
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-2">
            <h3 className="text-sm font-semibold">Últimos sinais B3</h3>
            {isLoading && <p className="text-sm text-muted-foreground">Carregando…</p>}
            {!isLoading && (!signals || signals.length === 0) && (
              <p className="text-sm text-muted-foreground">
                Nenhum sinal ainda. Envie um alerta assinado com <code>market: "B3"</code> e símbolo WINZ26 ou WDOZ26.
              </p>
            )}
            {signals?.map((row) => (
              <div key={`${row.created_at}-${row.symbol}`} className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm">
                <span className="font-medium">{row.symbol}</span>
                <Badge variant={row.side === 'BUY' ? 'default' : 'destructive'}>{row.side}</Badge>
                <span>{Number(row.price).toLocaleString('pt-BR')}</span>
                <span className="text-muted-foreground">{Number(row.confidence).toFixed(0)}%</span>
              </div>
            ))}
          </div>

          <div className="space-y-3">
            <h3 className="text-sm font-semibold">Teste de simulação (dry run)</h3>
            <div className="grid gap-2 sm:grid-cols-2">
              <label className="space-y-1 text-xs text-muted-foreground">
                Exchange
                <select className={inputClass} value={exchangeId} onChange={(event) => changeExchange(event.target.value)}>
                  {EXCHANGES.filter((item) => item.id !== 'B3').map((item) => (
                    <option key={item.id} value={item.id}>{item.name}</option>
                  ))}
                </select>
              </label>
              <label className="space-y-1 text-xs text-muted-foreground">
                Símbolo
                <select className={inputClass} value={symbol} onChange={(event) => setSymbol(event.target.value)}>
                  {selected.symbols.map((item) => <option key={item} value={item}>{item}</option>)}
                </select>
              </label>
              <label className="space-y-1 text-xs text-muted-foreground">
                Lado
                <select className={inputClass} value={side} onChange={(event) => setSide(event.target.value)}>
                  <option value="Buy">Compra</option>
                  <option value="Sell">Venda</option>
                </select>
              </label>
              <label className="space-y-1 text-xs text-muted-foreground">
                Quantidade
                <input className={inputClass} value={qty} inputMode="decimal" onChange={(event) => setQty(event.target.value)} />
              </label>
            </div>
            <Button size="sm" className="min-h-10" disabled={simulate.isPending} onClick={() => simulate.mutate()}>
              {simulate.isPending ? 'Simulando…' : 'Simular ordem'}
            </Button>
            <p className="text-xs text-muted-foreground">O botão força <code>dry_run:true</code>. Para operar de verdade é necessário token HMAC assinado pelo servidor e opt-in por exchange.</p>
            {lastSimulation && (
              <div className="rounded-md border border-border bg-muted/40 p-3 text-xs">
                <p><strong>Resultado:</strong> {lastSimulation.simulated ? 'simulado' : 'real'}</p>
                <p>Motivo: {lastSimulation.reason ?? '—'}</p>
                <p>ID: {lastSimulation.orderId ?? '—'}</p>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
