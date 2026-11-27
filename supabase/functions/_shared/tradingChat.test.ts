// Testes puros da confirmação de ordens do chat. Rede/banco ficam de fora:
// o que se valida aqui é o token assinado, o casamento dos argumentos e os
// resumos exibidos ao usuário antes de ele autorizar.
import { describe, expect, test } from 'bun:test';
import type { ConfirmPayload } from './tradingChat.ts';

const KEY = 'chave-de-teste-nao-producao';
const USER = '11111111-1111-4111-8111-111111111111';
const NOW = 1_790_000_000_000;

(globalThis as unknown as { Deno: unknown }).Deno = {
  env: { get: (key: string) => (key === 'SUPABASE_SERVICE_ROLE_KEY' ? KEY : undefined) },
};

const {
  describeAction,
  isConsumedConfirmation,
  isExecutionTool,
  makeConfirmationToken,
  matchesConfirmation,
  verifyConfirmationToken,
} = await import('./tradingChat.ts');

const payload = (over: Partial<ConfirmPayload> = {}): ConfirmPayload => ({
  tool: 'execute_order',
  args: { symbol: 'BTCUSDT', side: 'Buy', qty: 0.01, stopLoss: 99000, reason: 'pullback no VWAP' },
  u: USER,
  exp: NOW + 4 * 60 * 1000,
  id: 'abc-123',
  ...over,
});

describe('[tradingChat] confirmação assinada', () => {
  test('aceita um token emitido pelo próprio servidor', async () => {
    const p = payload();
    const token = await makeConfirmationToken(p, KEY);
    expect(await verifyConfirmationToken(token, USER, KEY, NOW)).toEqual(p);
  });

  test('rejeita assinatura alterada', async () => {
    const token = await makeConfirmationToken(payload(), KEY);
    const [body, sig] = token.split('.');
    const trocado = sig.slice(0, -1) + (sig.endsWith('A') ? 'B' : 'A');
    expect(await verifyConfirmationToken(`${body}.${trocado}`, USER, KEY, NOW)).toBeNull();
  });

  test('rejeita token expirado ou de outro usuário', async () => {
    const expirado = await makeConfirmationToken(payload({ exp: NOW - 1 }), KEY);
    expect(await verifyConfirmationToken(expirado, USER, KEY, NOW)).toBeNull();
    const alheio = await makeConfirmationToken(payload(), KEY);
    expect(await verifyConfirmationToken(alheio, 'outro-usuario', KEY, NOW)).toBeNull();
  });

  test('rejeita ferramenta que não executa ordem e tokens malformados', async () => {
    const leitura = await makeConfirmationToken(payload({ tool: 'get_balance' }), KEY);
    expect(await verifyConfirmationToken(leitura, USER, KEY, NOW)).toBeNull();
    expect(await verifyConfirmationToken('nao-e-token', USER, KEY, NOW)).toBeNull();
    expect(await verifyConfirmationToken(null, USER, KEY, NOW)).toBeNull();
  });
});

describe('[tradingChat] casamento dos argumentos', () => {
  test('só confirma a ação exata proposta', async () => {
    const p = payload();
    expect(matchesConfirmation(p, p.tool, { ...p.args })).toBe(true);
    expect(matchesConfirmation(p, p.tool, { ...p.args, qty: 1 })).toBe(false);
    expect(matchesConfirmation(p, 'execute_close', { ...p.args })).toBe(false);
    expect(matchesConfirmation(null, p.tool, { ...p.args })).toBe(false);
  });

  test('execução só é permitida nas três ferramentas de ordem', () => {
    expect(isExecutionTool('execute_order')).toBe(true);
    expect(isExecutionTool('execute_close')).toBe(true);
    expect(isExecutionTool('execute_set_stop')).toBe(true);
    expect(isExecutionTool('agent_record_result')).toBe(false);
    expect(isExecutionTool('get_balance')).toBe(false);
  });

  test('confirmação já executada ou cancelada não pode ser reutilizada', () => {
    expect(isConsumedConfirmation('executed')).toBe(true);
    expect(isConsumedConfirmation('cancelled')).toBe(true);
    expect(isConsumedConfirmation('pending')).toBe(false);
    expect(isConsumedConfirmation('failed')).toBe(false);
  });
});

describe('[tradingChat] resumo da ação proposta', () => {
  test('abertura usa alavancagem dentro da faixa permitida', () => {
    expect(describeAction('execute_order', {
      symbol: 'BTCUSDT', side: 'Buy', qty: 0.01, orderType: 'Market',
      leverage: 12, stopLoss: 99000, takeProfit: 101000,
    })).toBe('COMPRA 0.01 BTCUSDT Market 6x SL 99000 TP 101000');
  });

  test('fechamento e ajuste de stop', () => {
    expect(describeAction('execute_close', { symbol: 'ETHUSDT', side: 'Sell', qty: 2 }))
      .toBe('FECHAR 2 ETHUSDT (vendida)');
    expect(describeAction('execute_set_stop', { symbol: 'BTCUSDT', stopLoss: 99000, takeProfit: 101000 }))
      .toBe('AJUSTAR BTCUSDT SL 99000 TP 101000');
  });
});
