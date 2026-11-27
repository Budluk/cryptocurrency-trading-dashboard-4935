import { describe, expect, it } from 'bun:test';
import { createHmac, createHash } from 'node:crypto';
import { buildExchangeRequest, UnsupportedExchangeAction } from './exchangeAdapters.ts';
import { SUPPORTED_EXCHANGES, type ExchangeId } from './exchangeRegistry.ts';

const NOW = 1_700_000_000_000;
const credentials = { key: 'test-key', secret: 'test-secret', passphrase: 'test-pass' };

function spec(id: ExchangeId) {
  const found = SUPPORTED_EXCHANGES.find((s) => s.id === id);
  if (!found) throw new Error(`Missing ${id}`);
  return found;
}

function request(exchange: ExchangeId, action: string, params: Record<string, unknown> = {}) {
  return buildExchangeRequest({
    exchange, action, params: { symbol: 'BTCUSDT', qty: '0.01', side: 'Buy', ...params },
    credentials, nowMs: NOW,
  });
}

describe('exchange adapters', () => {
  it('Bybit e B3 não usam o adaptador genérico', async () => {
    await expect(request('BYBIT', 'get_balance')).rejects.toBeInstanceOf(UnsupportedExchangeAction);
    await expect(request('B3', 'get_balance')).rejects.toBeInstanceOf(UnsupportedExchangeAction);
  });

  it('Binance assina a query string com HMAC-SHA256', async () => {
    const signed = await request('BINANCE', 'get_balance');
    const url = new URL(signed.url);
    const signature = url.searchParams.get('signature');
    const query = url.search.slice(1).replace(/&signature=[^&]+/, '');
    expect(createHmac('sha256', credentials.secret).update(query).digest('hex')).toBe(signature);
    expect(signed.headers['X-MBX-APIKEY']).toBe(credentials.key);
  });

  it('Binance inverte o lado ao fechar posição', async () => {
    const signed = await request('BINANCE', 'close_position');
    expect(new URLSearchParams(signed.body).get('side')).toBe('SELL');
    expect(new URLSearchParams(signed.body).get('reduceOnly')).toBe('true');
  });

  it('OKX usa payload timestamp+method+path+body em base64', async () => {
    const signed = await request('OKX', 'place_order', { stopLoss: '100', takeProfit: '110' });
    const path = new URL(signed.url).pathname + new URL(signed.url).search;
    const prehash = `${new Date(NOW).toISOString()}POST${path}${signed.body}`;
    expect(signed.headers['OK-ACCESS-SIGN']).toBe(
      createHmac('sha256', credentials.secret).update(prehash).digest('base64')
    );
    expect(signed.headers['OK-ACCESS-PASSPHRASE']).toBe(credentials.passphrase);
    expect(JSON.parse(signed.body ?? '{}')).toMatchObject({ tdMode: 'cross', ordType: 'market', slTriggerPx: '100' });
  });

  it('Bitget e KuCoin usam cabeçalhos próprios', async () => {
    const bitget = await request('BITGET', 'get_positions');
    expect(bitget.headers['ACCESS-KEY']).toBe(credentials.key);
    expect(bitget.headers['ACCESS-TIMESTAMP']).toBe(String(NOW));
    const kucoin = await request('KUCOIN', 'place_order');
    expect(kucoin.headers['KC-API-KEY-VERSION']).toBe('2');
    expect(kucoin.headers['KC-API-PASSPHRASE']).toBe(
      createHmac('sha256', credentials.secret).update(credentials.passphrase).digest('base64')
    );
  });

  it('Gate.io assina HMAC-SHA512 com hash do body', async () => {
    const signed = await request('GATEIO', 'place_order');
    const url = new URL(signed.url);
    const timestamp = signed.headers.Timestamp;
    const bodyHash = createHash('sha256').update(signed.body ?? '').digest('hex');
    const payload = `POST\n${url.pathname}\n${url.search.replace(/^\?/, '')}\n${bodyHash}\n${timestamp}`;
    expect(signed.headers.SIGN).toBe(createHmac('sha512', credentials.secret).update(payload).digest('hex'));
    expect(JSON.parse(signed.body ?? '{}').size).toBeGreaterThan(0); // compra na Gate.io usa size positivo
  });

  it('rejeita credenciais ausentes e ações não suportadas', async () => {
    await expect(buildExchangeRequest({
      exchange: 'BINANCE', action: 'get_balance', credentials: { key: '', secret: '', passphrase: '' },
    })).rejects.toThrow('Credenciais');
    await expect(request('GATEIO', 'set_leverage')).rejects.toBeInstanceOf(UnsupportedExchangeAction);
    expect(spec('BITGET').supportsOrders).toBe(true);
  });
});
