// Testes puros do loop autônomo: parsing de JSON da IA e normalização de ação.
// O restante do loop depende de rede/banco e é coberto pelos testes de
// autonomousAgent (gates) e autonomousRisk (limites).
import { describe, expect, test } from 'bun:test';
import { extractJson, normalizeAction, runAgentDaily, runAgentLoop } from './agentLoop.ts';

// Bun não tem Deno.env; o router e o loop leem as chaves em runtime.
const denoShim = {
  env: {
    get: (key: string) => (key === 'LOVABLE_API_KEY' ? 'test-key' : undefined),
  },
};
(globalThis as unknown as { Deno: typeof denoShim }).Deno = denoShim;

describe('[agentLoop] extractJson', () => {
  test('extrai JSON limpo', () => {
    expect(extractJson('{"action":"BUY","confidence":72}')).toEqual({ action: 'BUY', confidence: 72 });
  });

  test('extrai JSON cercado de texto', () => {
    const out = extractJson('Análise ok.\n{"action":"WAIT","confidence":10}\nFim');
    expect(out).toEqual({ action: 'WAIT', confidence: 10 });
  });

  test('remove cercas de código markdown', () => {
    const out = extractJson('```json\n{"action":"SELL","confidence":55}\n```');
    expect(out).toEqual({ action: 'SELL', confidence: 55 });
  });

  test('retorna null para respostas inválidas', () => {
    expect(extractJson('')).toBeNull();
    expect(extractJson('não sei')).toBeNull();
    expect(extractJson('{quebrado')).toBeNull();
  });

  test('retorna null quando não é objeto', () => {
    expect(extractJson('[1,2,3]')).toBeNull();
  });
});

describe('[agentLoop] normalizeAction', () => {
  test('aceita sinônimos de compra', () => {
    for (const a of ['BUY', 'buy', 'LONG', 'Comprar']) {
      expect(normalizeAction(a)).toBe('BUY');
    }
  });

  test('aceita sinônimos de venda', () => {
    for (const a of ['SELL', 'sell', 'SHORT', 'Vender']) {
      expect(normalizeAction(a)).toBe('SELL');
    }
  });

  test('qualquer outra coisa vira WAIT', () => {
    for (const a of ['HOLD', '', null, undefined, 'xyz', 42]) {
      expect(normalizeAction(a)).toBe('WAIT');
    }
  });
});

// --- Dry-run: o loop deve exercitar indole/regras/IA, sem efeito colateral ----
type ReadResult = { data: Record<string, unknown>[]; error: null };
type WriteOp = { table: string; op: 'insert' | 'update' | 'upsert' };
type Query = {
  select: () => Query;
  eq: () => Query;
  order: () => Query;
  limit: () => Query;
  then: <T>(
    resolve: (value: ReadResult) => T | PromiseLike<T>,
    reject?: (reason?: unknown) => void,
  ) => Promise<T>;
};

const makeQuery = (result: ReadResult): Query => {
  const query = {
    select: () => query,
    eq: () => query,
    order: () => query,
    limit: () => query,
    then: (<T>(
      resolve: (value: ReadResult) => T | PromiseLike<T>,
      reject?: (reason?: unknown) => void,
    ) => Promise.resolve(result).then(resolve, reject)) as Query['then'],
  };
  return query;
};

const fakeDb = (writes: WriteOp[]) => ({
  from: (table: string) => ({
    select: () => makeQuery({ data: [], error: null }),
    insert: () => {
      writes.push({ table, op: 'insert' });
      return Promise.resolve({ error: null });
    },
    update: () => {
      writes.push({ table, op: 'update' });
      return makeQuery({ data: [], error: null });
    },
    upsert: () => {
      writes.push({ table, op: 'upsert' });
      return Promise.resolve({ error: null });
    },
  }),
});

const fakeCandles = () => Array.from({ length: 200 }, (_, i) => {
  const base = 100 + i * 0.1;
  return [
    String(1_700_000_000_000 + i * 300_000),
    String(base),
    String(base + 1),
    String(base - 1),
    String(base + 0.5),
    String(1_000 + i * 10),
  ];
});

describe('[agentLoop] dry-run', () => {
  test('agent_loop calcula decisão sem gravar no banco', async () => {
    const writes: WriteOp[] = [];
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/v5/market/kline')) {
        return new Response(JSON.stringify({ retCode: 0, result: { list: fakeCandles() } }), { status: 200 });
      }
      if (url.includes('/v5/market/tickers')) {
        return new Response(JSON.stringify({
          retCode: 0,
          result: { list: [{ bid1Price: '119.4', ask1Price: '119.5', lastPrice: '119.45' }] },
        }), { status: 200 });
      }
      if (url.includes('chat/completions')) {
        return new Response(JSON.stringify({
          choices: [{ message: { content: JSON.stringify({
            action: 'BUY', confidence: 78, target: 125, stop: 118, reasoning: 'tendência',
          }) } }],
        }), { status: 200 });
      }
      throw new Error(`fetch inesperado no dry-run: ${url}`);
    }) as typeof fetch;

    try {
      const result = await runAgentLoop(fakeDb(writes), {
        symbols: ['BTCUSDT'],
        limit: 200,
        dry_run: true,
      });
      expect(result.dryRun).toBe(true);
      expect(result.writesSkipped).toBe(true);
      expect(writes).toEqual([]);
      expect(result.results).toHaveLength(1);
      expect(result.results[0].status).toBe('ok');
      expect(result.results[0].logged).toBe(false);
      expect(['BUY', 'SELL', 'WAIT']).toContain(result.results[0].action);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test('agent_daily respeita dry_run e não faz upsert nem log', async () => {
    const writes: WriteOp[] = [];
    const result = await runAgentDaily(fakeDb(writes), { force: true, dryRun: true });
    expect(result.dryRun).toBe(true);
    expect(result.writesSkipped).toBe(true);
    expect(writes).toEqual([]);
  });
});
