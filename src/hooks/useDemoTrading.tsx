import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { getUserId } from '@/lib/anonymousUser';
import { useToast } from '@/hooks/use-toast';
import {
  DEMO_INITIAL_BALANCE,
  calculateDemoMargin,
  calculateDemoPnl,
  demoAvailableMargin,
  demoExitReason,
  forgetDemoLeverage,
  recallDemoLeverage,
  rememberDemoLeverage,
  type DemoSide,
} from '@/lib/demoTrading';

interface DemoPosition {
  id: string;
  symbol: string;
  side: DemoSide;
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

/**
 * Paper trading persistente. Toda decisão, margem, PnL e saída é calculada
 * localmente; nenhuma função deste hook chama `place_order` ou usa chaves.
 */
export const useDemoTrading = (isDemoMode: boolean) => {
  const [demoBalance, setDemoBalance] = useState(DEMO_INITIAL_BALANCE);
  const [demoPositions, setDemoPositions] = useState<DemoPosition[]>([]);
  const [demoAccount, setDemoAccount] = useState<DemoAccount | null>(null);
  const [demoPnL, setDemoPnL] = useState(0);
  const { toast } = useToast();

  const priceCache = useRef<Map<string, number>>(new Map());
  const accountRef = useRef({ balance: DEMO_INITIAL_BALANCE, pnl: 0 });
  const demoAccountRef = useRef<DemoAccount | null>(null);
  const loadTokenRef = useRef(0); // evita que um load antigo sobrescreva posições recém-abertas
  const positionsRef = useRef<DemoPosition[]>([]);
  const syncingRef = useRef(false);

  const setPositions = useCallback((next: DemoPosition[]) => {
    positionsRef.current = next;
    setDemoPositions(next);
  }, []);

  const persistAccount = useCallback(async (balance: number, pnl: number): Promise<boolean> => {
    const account = demoAccountRef.current;
    if (!account) return true; // Conta apenas local: não há ledger no banco.
    const { error } = await supabase
      .from('demo_accounts')
      .update({ current_balance: balance, total_pnl: pnl })
      .eq('id', account.id);

    if (error) {
      console.warn(`⚠️ [DEMO] Falha ao persistir conta: ${error.message}`);
      return false;
    }
    return true;
  }, []);

  // Serializa aberturas/fechamentos: sem isso, duas operações simultâneas
  // calculam o saldo a partir do mesmo snapshot e corrompem o ledger.
  const ledgerQueueRef = useRef<Promise<unknown>>(Promise.resolve());
  const withLedgerLock = useCallback(<T,>(operation: () => Promise<T>): Promise<T> => {
    const result = ledgerQueueRef.current.then(operation, operation);
    ledgerQueueRef.current = result.then(() => undefined, () => undefined);
    return result;
  }, []);

  const loadDemoAccount = useCallback(async () => {
    if (!isDemoMode) return null;

    const token = ++loadTokenRef.current;
    const userId = await getUserId();
    console.log(`🎮 [DEMO] Carregando conta demo para user: ${userId}`);

    const { data: foundAccount, error } = await supabase
      .from('demo_accounts')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) console.warn(`⚠️ [DEMO] Erro ao buscar conta: ${error.message}`);

    let account = foundAccount;

    if (!account) {
      const { data: newAccount, error: insertError } = await supabase
        .from('demo_accounts')
        .insert({
          user_id: userId,
          initial_balance: DEMO_INITIAL_BALANCE,
          current_balance: DEMO_INITIAL_BALANCE,
          total_pnl: 0,
        })
        .select()
        .single();

      if (insertError) {
        console.warn(`⚠️ [DEMO] Erro ao criar conta: ${insertError.message}; usando conta local.`);
        demoAccountRef.current = null;
        accountRef.current = { balance: DEMO_INITIAL_BALANCE, pnl: 0 };
        setDemoBalance(DEMO_INITIAL_BALANCE);
        setDemoPnL(0);
        setPositions([]);
        return null;
      }
      account = newAccount;
    }

    if (token !== loadTokenRef.current) return account;
    demoAccountRef.current = account;
    setDemoAccount(account);
    accountRef.current = {
      balance: Number(account.current_balance) || DEMO_INITIAL_BALANCE,
      pnl: Number(account.total_pnl) || 0,
    };
    setDemoBalance(accountRef.current.balance);
    setDemoPnL(accountRef.current.pnl);

    const { data: positions, error: positionsError } = await supabase
      .from('demo_positions')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'open');

    if (positionsError) console.warn(`⚠️ [DEMO] Erro ao carregar posições: ${positionsError.message}`);
    if (token !== loadTokenRef.current) return account;

    const mapped: DemoPosition[] = (positions || []).map((p) => {
      const entry = Number(p.entry_price) || 0;
      return {
        id: p.id,
        symbol: p.symbol,
        side: p.side === 'Sell' ? 'Sell' : 'Buy',
        entry_price: entry,
        current_price: Number(p.current_price) || entry,
        quantity: Number(p.quantity) || 0,
        stop_loss: p.stop_loss == null ? null : Number(p.stop_loss),
        take_profit: p.take_profit == null ? null : Number(p.take_profit),
        pnl: Number(p.pnl) || 0,
        leverage: recallDemoLeverage(p.id, 10),
        opened_at: p.opened_at,
      };
    });

    setPositions(mapped);
    console.log(`✅ [DEMO] Conta $${accountRef.current.balance.toFixed(2)} | ${mapped.length} posições`);
    return account;
  }, [isDemoMode, setPositions]);

  /** Preço público, apenas para marcar a posição — nunca autentica na exchange. */
  const fetchCurrentPrice = useCallback(async (symbol: string): Promise<number> => {
    const cached = priceCache.current.get(symbol);
    if (cached) return cached;

    try {
      const response = await fetch(`https://api.bybit.com/v5/market/tickers?category=linear&symbol=${symbol}`);
      const data = await response.json();
      const price = parseFloat(data?.result?.list?.[0]?.lastPrice || '0');

      if (price > 0) {
        priceCache.current.set(symbol, price);
        setTimeout(() => priceCache.current.delete(symbol), 5000);
      }

      return price;
    } catch {
      return 0;
    }
  }, []);

  /** Fecha uma posição demo: devolve margem, realiza PnL e grava o ledger. */
  const settlePosition = useCallback(async (
    position: DemoPosition,
    exitPrice: number,
    reason: string,
  ): Promise<{ success: boolean; pnl: number }> => withLedgerLock(async () => {
    loadTokenRef.current += 1;
    const pnl = calculateDemoPnl(
      position.side, position.entry_price, exitPrice, position.quantity, position.leverage,
    );
    const margin = calculateDemoMargin(position.entry_price, position.quantity, position.leverage);
    const previous = { ...accountRef.current };
    // O banco já credita `pnl` em demo_accounts quando o trade é inserido.
    // Gravar o PnL aqui também dobraria o crédito no saldo.
    const marginBalance = Math.max(previous.balance + margin, 0);
    const balance = Math.max(marginBalance + pnl, 0);
    const totalPnl = previous.pnl + pnl;
    const userId = await getUserId();
    const closedAt = new Date().toISOString();
    const account = demoAccountRef.current;

    // Persistimos primeiro: a UI só mostra a posição fechada depois que o
    // ledger estiver consistente. Assim um reload imediato não reabre a posição.
    if (account) {
      if (!await persistAccount(marginBalance, previous.pnl)) return { success: false, pnl };

      // `select` é essencial: um update com zero linhas não retorna erro e
      // deixaria a posição aberta no banco enquanto a UI a remove.
      const { data: closed, error: closeError } = await supabase
        .from('demo_positions')
        .update({
          status: 'closed',
          close_reason: reason,
          closed_at: closedAt,
          current_price: exitPrice,
          pnl,
        })
        .eq('id', position.id)
        .eq('user_id', userId)
        .select('id');

      if (closeError || !closed?.length) {
        console.warn(`⚠️ [DEMO] Falha ao fechar posição: ${closeError?.message ?? 'nenhuma linha atualizada'}`);
        await persistAccount(previous.balance, previous.pnl);
        return { success: false, pnl };
      }

      const { error: tradeError } = await supabase.from('demo_trades').insert({
        user_id: userId,
        demo_account_id: account.id,
        symbol: position.symbol,
        side: position.side,
        entry_price: position.entry_price,
        exit_price: exitPrice,
        quantity: position.quantity,
        pnl,
      });

      if (tradeError) {
        console.warn(`⚠️ [DEMO] Falha ao registrar trade: ${tradeError.message}`);
        await persistAccount(previous.balance, previous.pnl);
        return { success: false, pnl };
      }
    }

    accountRef.current = { balance, pnl: totalPnl };
    setDemoBalance(balance);
    setDemoPnL(totalPnl);
    setPositions(positionsRef.current.filter((p) => p.id !== position.id));
    forgetDemoLeverage(position.id);

    console.log(`📊 [DEMO] ${position.symbol} fechada (${reason}) | PnL: $${pnl.toFixed(2)}`);
    return { success: true, pnl };
  }), [persistAccount, setPositions, withLedgerLock]);

  const openDemoPosition = useCallback(async (params: {
    symbol: string;
    side: DemoSide;
    quantity: number;
    leverage: number;
    stopLoss?: number;
    takeProfit?: number;
    confidence?: number;
    /** Preço público já obtido no ciclo; evita uma segunda chamada de rede. */
    price?: number;
  }): Promise<{ success: boolean; data?: { orderId: string; price: number; qty: number }; error?: string }> => withLedgerLock(async () => {
    loadTokenRef.current += 1;
    const account = demoAccountRef.current;
    if (!isDemoMode || !account) return { success: false, error: 'Modo demo não ativo' };

    const currentPrice = params.price && params.price > 0
      ? params.price
      : await fetchCurrentPrice(params.symbol);
    if (currentPrice <= 0) return { success: false, error: 'Não foi possível obter preço atual' };

    const marginRequired = calculateDemoMargin(currentPrice, params.quantity, params.leverage);
    if (marginRequired <= 0 || marginRequired > demoAvailableMargin(accountRef.current.balance)) {
      return { success: false, error: 'Saldo demo insuficiente' };
    }

    const newPosition: DemoPosition = {
      id: crypto.randomUUID(),
      symbol: params.symbol,
      side: params.side,
      entry_price: currentPrice,
      current_price: currentPrice,
      quantity: params.quantity,
      stop_loss: params.stopLoss && params.stopLoss > 0 ? params.stopLoss : null,
      take_profit: params.takeProfit && params.takeProfit > 0 ? params.takeProfit : null,
      pnl: 0,
      leverage: params.leverage,
      opened_at: new Date().toISOString(),
    };

    const previous = { ...accountRef.current };
    const balance = Math.max(previous.balance - marginRequired, 0);
    const userId = await getUserId();

    // A ordem paper só aparece na UI depois que conta e posição estão gravadas.
    if (!await persistAccount(balance, previous.pnl)) {
      return { success: false, error: 'Falha ao persistir a conta demo' };
    }
    // O id gerado no cliente também é a chave da linha: sem ele, o fechamento
    // usaria um id que não existe no banco e a posição ficaria aberta.
    const { error } = await supabase.from('demo_positions').insert({
      id: newPosition.id,
      user_id: userId,
      demo_account_id: account.id,
      symbol: newPosition.symbol,
      side: newPosition.side,
      entry_price: newPosition.entry_price,
      current_price: newPosition.current_price,
      quantity: newPosition.quantity,
      stop_loss: newPosition.stop_loss,
      take_profit: newPosition.take_profit,
      status: 'open',
      pnl: 0,
    });

    if (error) {
      console.warn(`⚠️ [DEMO] Falha ao salvar posição: ${error.message}`);
      await persistAccount(previous.balance, previous.pnl);
      return { success: false, error: 'Falha ao salvar a posição demo' };
    }

    rememberDemoLeverage(newPosition.id, newPosition.leverage);
    accountRef.current = { balance, pnl: accountRef.current.pnl };
    setDemoBalance(balance);
    setDemoPnL(accountRef.current.pnl);
    setPositions([...positionsRef.current, newPosition]);

    console.log(`📊 [DEMO] Abertura ${newPosition.side} ${newPosition.symbol} @ $${currentPrice.toFixed(4)} | Margem $${marginRequired.toFixed(2)}`);

    return {
      success: true,
      data: { orderId: newPosition.id, price: currentPrice, qty: newPosition.quantity },
    };
  }), [fetchCurrentPrice, isDemoMode, persistAccount, setPositions, withLedgerLock]);

  const closeDemoPosition = useCallback(async (
    positionId: string,
    reason: string = 'manual',
  ): Promise<{ success: boolean; pnl?: number }> => {
    const position = positionsRef.current.find((p) => p.id === positionId);
    if (!position) return { success: false };

    const currentPrice = await fetchCurrentPrice(position.symbol);
    if (currentPrice <= 0) return { success: false };

    return settlePosition(position, currentPrice, reason);
  }, [fetchCurrentPrice, settlePosition]);

  /** Marca preço/PnL e executa stop/take profit simulados. */
  const updateDemoPositions = useCallback(async () => {
    if (!isDemoMode || syncingRef.current || positionsRef.current.length === 0) return;
    syncingRef.current = true;

    try {
      const results = await Promise.all(positionsRef.current.map(async (pos) => {
        const currentPrice = await fetchCurrentPrice(pos.symbol);
        if (currentPrice <= 0) return { position: pos, keep: true };

        const reason = demoExitReason(pos.side, currentPrice, pos.stop_loss, pos.take_profit);
        if (reason) {
          await settlePosition(pos, currentPrice, reason);
          return { position: pos, keep: false };
        }

        const pnl = calculateDemoPnl(
          pos.side, pos.entry_price, currentPrice, pos.quantity, pos.leverage,
        );
        return { position: { ...pos, current_price: currentPrice, pnl }, keep: true };
      }));

      setPositions(results.filter((r) => r.keep).map((r) => r.position));
    } finally {
      syncingRef.current = false;
    }
  }, [fetchCurrentPrice, isDemoMode, setPositions, settlePosition]);

  const unrealizedPnL = useMemo(
    () => demoPositions.reduce((sum, pos) => sum + pos.pnl, 0),
    [demoPositions],
  );

  useEffect(() => {
    if (isDemoMode) void loadDemoAccount();
  }, [isDemoMode, loadDemoAccount]);

  // Saídas simuladas: o robô permanece forceMount entre abas; este timer é o
  // responsável por cruzar SL/TP mesmo quando nenhum ciclo novo é disparado.
  useEffect(() => {
    if (!isDemoMode || demoPositions.length === 0) return;
    const interval = setInterval(() => void updateDemoPositions(), 10000);
    return () => clearInterval(interval);
  }, [isDemoMode, demoPositions.length, updateDemoPositions]);

  const resetDemoAccount = useCallback(async () => {
    loadTokenRef.current += 1;
    const userId = await getUserId();
    const closedAt = new Date().toISOString();
    const openPositions = positionsRef.current;

    if (openPositions.length > 0) {
      for (let i = 0; i < openPositions.length; i += 100) {
        const batch = openPositions.slice(i, i + 100);
        const { error } = await supabase
          .from('demo_positions')
          .update({ status: 'closed', close_reason: 'reset', closed_at: closedAt, pnl: 0 })
          .eq('user_id', userId)
          .in('id', batch.map((p) => p.id));
        if (error) console.warn(`⚠️ [DEMO] Falha ao limpar posições: ${error.message}`);
      }
      openPositions.forEach((p) => forgetDemoLeverage(p.id));
    }

    const account = demoAccountRef.current;
    if (account) {
      const { error } = await supabase
        .from('demo_accounts')
        .update({ current_balance: DEMO_INITIAL_BALANCE, total_pnl: 0 })
        .eq('id', account.id);
      if (error) console.warn(`⚠️ [DEMO] Falha ao resetar conta: ${error.message}`);
    }

    accountRef.current = { balance: DEMO_INITIAL_BALANCE, pnl: 0 };
    setDemoBalance(DEMO_INITIAL_BALANCE);
    setDemoPnL(0);
    setPositions([]);
    toast({ title: '🔄 Demo resetada', description: `Saldo restaurado para $${DEMO_INITIAL_BALANCE.toFixed(2)}` });
  }, [setPositions, toast]);

  return {
    demoBalance,
    demoPositions,
    demoAccount,
    demoPnL,
    unrealizedPnL,
    demoPositionsCount: demoPositions.length,

    loadDemoAccount,
    openDemoPosition,
    closeDemoPosition,
    updateDemoPositions,
    fetchCurrentPrice,
    resetDemoAccount,
  };
};
