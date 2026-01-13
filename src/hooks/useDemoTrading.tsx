import { useState, useCallback, useRef, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { getUserId } from '@/lib/anonymousUser';
import { useToast } from '@/hooks/use-toast';

interface DemoPosition {
  id: string;
  symbol: string;
  side: 'Buy' | 'Sell';
  entry_price: number;
  current_price: number;
  quantity: number;
  stop_loss: number | null;
  take_profit: number | null;
  pnl: number;
  leverage: number;
  opened_at: string;
}

interface DemoAccount {
  id: string;
  current_balance: number;
  initial_balance: number;
  total_pnl: number;
}

export const useDemoTrading = (isDemoMode: boolean) => {
  const [demoBalance, setDemoBalance] = useState(20);
  const [demoPositions, setDemoPositions] = useState<DemoPosition[]>([]);
  const [demoAccount, setDemoAccount] = useState<DemoAccount | null>(null);
  const [demoPnL, setDemoPnL] = useState(0);
  const { toast } = useToast();
  const priceCache = useRef<Map<string, number>>(new Map());

  // Carregar conta demo
  const loadDemoAccount = useCallback(async () => {
    if (!isDemoMode) return null;
    
    const userId = await getUserId();
    console.log(`🎮 [DEMO] Carregando conta demo para user: ${userId}`);
    
    // Buscar conta demo existente ou criar nova
    let { data: account, error } = await supabase
      .from('demo_accounts')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();
    
    if (error) {
      console.log(`⚠️ [DEMO] Erro ao buscar conta: ${error.message}`);
    }
    
    if (!account) {
      // Criar conta demo com $20
      console.log(`🆕 [DEMO] Criando nova conta demo...`);
      const { data: newAccount, error: insertError } = await supabase
        .from('demo_accounts')
        .insert({
          user_id: userId,
          initial_balance: 20,
          current_balance: 20,
          total_pnl: 0
        })
        .select()
        .single();
      
      if (insertError) {
        console.log(`❌ [DEMO] Erro ao criar conta: ${insertError.message}`);
        // Fallback: usar conta local
        setDemoBalance(20);
        setDemoPnL(0);
        return null;
      }
      
      account = newAccount;
    }
    
    if (account) {
      setDemoAccount(account);
      setDemoBalance(account.current_balance);
      setDemoPnL(account.total_pnl);
      console.log(`✅ [DEMO] Conta carregada: $${account.current_balance.toFixed(2)} | PnL: $${account.total_pnl.toFixed(2)}`);
      
      // Carregar posições demo abertas
      const { data: positions } = await supabase
        .from('demo_positions')
        .select('*')
        .eq('user_id', userId)
        .eq('status', 'open');
      
      if (positions && positions.length > 0) {
        const mappedPositions: DemoPosition[] = positions.map(p => ({
          id: p.id,
          symbol: p.symbol,
          side: p.side as 'Buy' | 'Sell',
          entry_price: p.entry_price,
          current_price: p.current_price || p.entry_price,
          quantity: p.quantity,
          stop_loss: p.stop_loss,
          take_profit: p.take_profit,
          pnl: p.pnl || 0,
          leverage: 10, // Default
          opened_at: p.opened_at
        }));
        setDemoPositions(mappedPositions);
        console.log(`📊 [DEMO] ${mappedPositions.length} posições carregadas`);
      }
    }
    
    return account;
  }, [isDemoMode]);

  // Buscar preço atual via API pública da Bybit
  const fetchCurrentPrice = useCallback(async (symbol: string): Promise<number> => {
    const cached = priceCache.current.get(symbol);
    if (cached) return cached;
    
    try {
      const response = await fetch(`https://api.bybit.com/v5/market/tickers?category=linear&symbol=${symbol}`);
      const data = await response.json();
      const price = parseFloat(data?.result?.list?.[0]?.lastPrice || '0');
      
      if (price > 0) {
        priceCache.current.set(symbol, price);
        setTimeout(() => priceCache.current.delete(symbol), 5000); // Cache por 5s
      }
      
      return price;
    } catch {
      return 0;
    }
  }, []);

  // Abrir posição demo
  const openDemoPosition = useCallback(async (params: {
    symbol: string;
    side: 'Buy' | 'Sell';
    quantity: number;
    leverage: number;
    stopLoss?: number;
    takeProfit?: number;
    confidence?: number;
  }): Promise<{ success: boolean; data?: any; error?: string }> => {
    if (!isDemoMode || !demoAccount) {
      return { success: false, error: 'Modo demo não ativo' };
    }

    const currentPrice = await fetchCurrentPrice(params.symbol);
    if (currentPrice === 0) {
      return { success: false, error: 'Não foi possível obter preço atual' };
    }

    // Calcular margem necessária
    const positionValue = currentPrice * params.quantity;
    const marginRequired = positionValue / params.leverage;

    if (marginRequired > demoBalance * 0.95) { // 95% max
      return { success: false, error: 'Saldo demo insuficiente' };
    }

    // Criar posição local
    const newPosition: DemoPosition = {
      id: crypto.randomUUID(),
      symbol: params.symbol,
      side: params.side,
      entry_price: currentPrice,
      current_price: currentPrice,
      quantity: params.quantity,
      stop_loss: params.stopLoss || null,
      take_profit: params.takeProfit || null,
      pnl: 0,
      leverage: params.leverage,
      opened_at: new Date().toISOString()
    };

    setDemoPositions(prev => [...prev, newPosition]);
    
    // Deduzir margem do saldo
    setDemoBalance(prev => prev - marginRequired);

    // Salvar no banco para persistência
    const userId = await getUserId();
    await supabase.from('demo_positions').insert({
      user_id: userId,
      demo_account_id: demoAccount.id,
      symbol: params.symbol,
      side: params.side,
      entry_price: currentPrice,
      current_price: currentPrice,
      quantity: params.quantity,
      stop_loss: params.stopLoss,
      take_profit: params.takeProfit,
      status: 'open'
    });

    console.log(`📊 [DEMO] Posição aberta: ${params.side} ${params.symbol} @ $${currentPrice.toFixed(4)} | Margem: $${marginRequired.toFixed(2)}`);

    return { 
      success: true, 
      data: { 
        orderId: newPosition.id,
        price: currentPrice,
        qty: params.quantity
      } 
    };
  }, [isDemoMode, demoAccount, demoBalance, fetchCurrentPrice]);

  // Fechar posição demo
  const closeDemoPosition = useCallback(async (positionId: string, reason: string = 'manual'): Promise<{ success: boolean; pnl?: number }> => {
    const position = demoPositions.find(p => p.id === positionId);
    if (!position) {
      return { success: false };
    }

    const currentPrice = await fetchCurrentPrice(position.symbol);
    if (currentPrice === 0) {
      return { success: false };
    }

    // Calcular PnL
    let pnl = 0;
    if (position.side === 'Buy') {
      pnl = (currentPrice - position.entry_price) * position.quantity;
    } else {
      pnl = (position.entry_price - currentPrice) * position.quantity;
    }
    
    // Aplicar alavancagem ao PnL
    pnl = pnl * position.leverage;

    // Calcular margem que foi usada
    const positionValue = position.entry_price * position.quantity;
    const marginUsed = positionValue / position.leverage;

    // Devolver margem + PnL
    const returnAmount = marginUsed + pnl;
    setDemoBalance(prev => prev + returnAmount);
    setDemoPnL(prev => prev + pnl);

    // Remover da lista local
    setDemoPositions(prev => prev.filter(p => p.id !== positionId));

    // Atualizar banco
    const userId = await getUserId();
    if (demoAccount) {
      await supabase.from('demo_accounts').update({
        current_balance: demoBalance + returnAmount,
        total_pnl: demoPnL + pnl
      }).eq('id', demoAccount.id);
    }

    // Registrar trade fechado
    await supabase.from('demo_trades').insert({
      user_id: userId,
      demo_account_id: demoAccount?.id,
      symbol: position.symbol,
      side: position.side,
      entry_price: position.entry_price,
      exit_price: currentPrice,
      quantity: position.quantity,
      pnl
    });

    console.log(`📊 [DEMO] Posição fechada: ${position.symbol} | PnL: $${pnl.toFixed(2)} (${reason})`);

    return { success: true, pnl };
  }, [demoPositions, fetchCurrentPrice, demoBalance, demoPnL, demoAccount]);

  // Atualizar preços das posições demo
  const updateDemoPositions = useCallback(async () => {
    if (!isDemoMode || demoPositions.length === 0) return;

    const updatedPositions = await Promise.all(
      demoPositions.map(async (pos) => {
        const currentPrice = await fetchCurrentPrice(pos.symbol);
        if (currentPrice === 0) return pos;

        let pnl = 0;
        if (pos.side === 'Buy') {
          pnl = (currentPrice - pos.entry_price) * pos.quantity * pos.leverage;
        } else {
          pnl = (pos.entry_price - currentPrice) * pos.quantity * pos.leverage;
        }

        // Verificar SL/TP
        let shouldClose = false;
        let closeReason = '';

        if (pos.stop_loss) {
          if (pos.side === 'Buy' && currentPrice <= pos.stop_loss) {
            shouldClose = true;
            closeReason = 'stop_loss';
          } else if (pos.side === 'Sell' && currentPrice >= pos.stop_loss) {
            shouldClose = true;
            closeReason = 'stop_loss';
          }
        }

        if (pos.take_profit) {
          if (pos.side === 'Buy' && currentPrice >= pos.take_profit) {
            shouldClose = true;
            closeReason = 'take_profit';
          } else if (pos.side === 'Sell' && currentPrice <= pos.take_profit) {
            shouldClose = true;
            closeReason = 'take_profit';
          }
        }

        if (shouldClose) {
          await closeDemoPosition(pos.id, closeReason);
          return null;
        }

        return { ...pos, current_price: currentPrice, pnl };
      })
    );

    setDemoPositions(updatedPositions.filter((p): p is DemoPosition => p !== null));
  }, [isDemoMode, demoPositions, fetchCurrentPrice, closeDemoPosition]);

  // Calcular PnL não realizado
  const unrealizedPnL = demoPositions.reduce((sum, pos) => sum + pos.pnl, 0);

  // Carregar conta demo ao ativar modo
  useEffect(() => {
    if (isDemoMode) {
      loadDemoAccount();
    }
  }, [isDemoMode, loadDemoAccount]);

  // Auto-update de posições a cada 10s
  useEffect(() => {
    if (!isDemoMode || demoPositions.length === 0) return;
    
    const interval = setInterval(updateDemoPositions, 10000);
    return () => clearInterval(interval);
  }, [isDemoMode, demoPositions.length, updateDemoPositions]);

  return {
    // Estado
    demoBalance,
    demoPositions,
    demoAccount,
    demoPnL,
    unrealizedPnL,
    demoPositionsCount: demoPositions.length,
    
    // Ações
    loadDemoAccount,
    openDemoPosition,
    closeDemoPosition,
    updateDemoPositions,
    fetchCurrentPrice,
    
    // Reset
    resetDemoAccount: async () => {
      if (demoAccount) {
        await supabase.from('demo_accounts').update({
          current_balance: 20,
          total_pnl: 0
        }).eq('id', demoAccount.id);
        
        setDemoBalance(20);
        setDemoPnL(0);
        setDemoPositions([]);
        
        toast({ title: '🔄 Demo Reset', description: 'Conta demo restaurada para $20' });
      }
    }
  };
};
