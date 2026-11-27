import { afterEach, describe, expect, it } from 'bun:test';
import { handleExchangeAction, type ExchangeContext } from './exchangeGateway.ts';

const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; });

const ctx: ExchangeContext = { userId: 'user-1', confirmationKey: 'test-confirm-key' };

const readEnv = (name: string) => {
  const values: Record<string, string> = {
    BINANCE_API_KEY: 'key', BINANCE_API_SECRET: 'secret', BINANCE_ENABLE_LIVE: 'true',
  };
  return values[name];
};

const liveCtx: ExchangeContext = {
  ...ctx,
  readEnv,
  riskState: { dailyPnlPct: 0, openPositions: 0, dailyTrades: 0 },
};

describe('exchange gateway', () => {
  it('lista venues sem tocar credenciais', async () => {
    const result = await handleExchangeAction('exchange_list', {}, ctx);
    const list = result.exchanges as Array<{ id: string }>;
    expect(list.map((item) => item.id)).toContain('BINANCE');
    expect(list.map((item) => item.id)).toContain('B3');
    expect(JSON.stringify(result)).not.toContain('secret');
  });

  it('simula por padrão e nunca envia ordem em dry_run', async () => {
    let calls = 0;
    globalThis.fetch = (async () => { calls += 1; return new Response('{}'); }) as typeof fetch;
    const result = await handleExchangeAction('place_order', {
      exchange: 'BINANCE', symbol: 'BTCUSDT', side: 'Buy', qty: '0.01',
      price: '100000', stopLoss: '101000',
    }, { ...ctx, readEnv });
    expect(result.simulated).toBe(true);
    expect(result.reason).toBe('dry_run');
    expect(result.leverage).toBeGreaterThanOrEqual(3);
    expect(calls).toBe(0);
  });

  it('Bybit continua apenas no caminho nativo', async () => {
    await expect(handleExchangeAction('exchange_balance', { exchange: 'BYBIT' }, ctx)).rejects.toThrow('nativas');
  });

  it('B3 rejeita qualquer ordem, mesmo com dry_run=false', async () => {
    await expect(handleExchangeAction('place_order', {
      exchange: 'B3', symbol: 'WINZ26', side: 'Buy', qty: '1', dry_run: false,
    }, ctx)).rejects.toThrow('B3');
  });

  it('sem opt-in, mantém simulação mesmo com dry_run=false', async () => {
    const result = await handleExchangeAction('place_order', {
      exchange: 'BINANCE', symbol: 'BTCUSDT', side: 'Buy', qty: '0.01', dry_run: false,
    }, ctx);
    expect(result.simulated).toBe(true);
    expect(result.reason).toBe('live_not_enabled');
  });

  it('exige confirmação HMAC com argumentos exatos para ordem real', async () => {
    const proposalArgs = {
      exchange: 'BINANCE', target_action: 'place_order',
      symbol: 'BTCUSDT', side: 'Buy', qty: '0.01',
    };
    const proposal = await handleExchangeAction('exchange_propose', proposalArgs, { ...ctx, readEnv });
    const pending = proposal.pending as { token: string; args: Record<string, unknown> };
    expect(pending.token.split('.')).toHaveLength(2);
    expect(pending.args).toEqual({ symbol: 'BTCUSDT', side: 'Buy', qty: '0.01' });

    await expect(handleExchangeAction('place_order', {
      exchange: 'BINANCE', dry_run: false,
      symbol: 'BTCUSDT', side: 'Buy', qty: '0.02', confirm_token: pending.token,
    }, liveCtx)).rejects.toThrow('Confirmação');

    let captured = '';
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      captured = String(input);
      return new Response(JSON.stringify({ orderId: 'REAL-1' }));
    }) as typeof fetch;
    const result = await handleExchangeAction('place_order', {
      exchange: 'BINANCE', dry_run: false,
      symbol: 'BTCUSDT', side: 'Buy', qty: '0.01', confirm_token: pending.token,
    }, liveCtx);
    expect(result.simulated).toBe(false);
    expect(captured).toContain('fapi.binance.com');
  });

  it('token assinado para outro usuário é rejeitado', async () => {
    const proposal = await handleExchangeAction('exchange_propose', {
      exchange: 'BINANCE', target_action: 'place_order', symbol: 'BTCUSDT', side: 'Buy', qty: '1',
    }, { ...ctx, readEnv });
    const token = (proposal.pending as { token: string }).token;
    await expect(handleExchangeAction('place_order', {
      exchange: 'BINANCE', dry_run: false, symbol: 'BTCUSDT', side: 'Buy', qty: '1', confirm_token: token,
    }, { ...liveCtx, userId: 'outro' })).rejects.toThrow('Confirmação');
  });

  it('ordem real é bloqueada sem estado de risco ou quando o orçamento acabou', async () => {
    let calls = 0;
    globalThis.fetch = (async () => { calls += 1; return new Response('{}'); }) as typeof fetch;
    const order = { exchange: 'BINANCE', dry_run: false, symbol: 'BTCUSDT', side: 'Buy', qty: '0.01' };
    await expect(handleExchangeAction('place_order', order, { ...ctx, readEnv })).rejects.toThrow('Estado de risco');
    await expect(handleExchangeAction('place_order', order, {
      ...liveCtx, riskState: { dailyPnlPct: -2, openPositions: 1, dailyTrades: 1 },
    })).rejects.toThrow('Limite de risco');
    await expect(handleExchangeAction('place_order', order, {
      ...liveCtx, riskState: { dailyPnlPct: 0, openPositions: 5, dailyTrades: 1 },
    })).rejects.toThrow('posições abertas');
    expect(calls).toBe(0);
  });

  it('simulação ignora o orçamento e continua disponível', async () => {
    const result = await handleExchangeAction('place_order', {
      exchange: 'BINANCE', symbol: 'BTCUSDT', side: 'Buy', qty: '0.01',
    }, { ...liveCtx, riskState: { dailyPnlPct: -5, openPositions: 99, dailyTrades: 99 } });
    expect(result.simulated).toBe(true);
    expect(result.reason).toBe('dry_run');
  });
});
