import { describe, expect, it } from 'bun:test';
import {
  exchangeCredentials, exchangeSummary, isB3Symbol, isExchangeLiveEnabled,
  isExpiredB3Symbol, normalizeSymbol, SUPPORTED_EXCHANGES,
} from './exchangeRegistry.ts';

describe('exchange registry', () => {
  it('registra Bybit, cinco exchanges e B3', () => {
    expect(SUPPORTED_EXCHANGES.map((s) => s.id)).toEqual([
      'BYBIT', 'BINANCE', 'OKX', 'BITGET', 'KUCOIN', 'GATEIO', 'B3',
    ]);
    expect(exchangeSummary()).toHaveLength(7);
  });

  it('aceita somente contratos B3 vigentes', () => {
    expect(isB3Symbol('WINZ26')).toBe(true);
    expect(isB3Symbol('WDOZ26')).toBe(true);
    expect(isB3Symbol('WINZ25')).toBe(false); // vencido não é aceito
    expect(isExpiredB3Symbol('WINZ25')).toBe(true);
    expect(isExpiredB3Symbol('WDOF26')).toBe(true);
    expect(isExpiredB3Symbol('WINZ26')).toBe(false);
  });

  it('normaliza símbolos por exchange', () => {
    expect(normalizeSymbol('OKX', 'btc/usdt-swap')).toBe('BTC-USDT-SWAP');
    expect(normalizeSymbol('GATEIO', 'btc-usdt')).toBe('BTC_USDT');
    expect(normalizeSymbol('BINANCE', 'btc/usdt')).toBe('BTCUSDT');
    expect(normalizeSymbol('B3', 'winz26-perp')).toBe('WINZ26');
  });

  it('credenciais nunca vêm de literal no código', () => {
    const spec = SUPPORTED_EXCHANGES.find((s) => s.id === 'OKX')!;
    const read = (name: string) => (name === 'OKX_API_KEY' ? 'k' : name === 'OKX_API_SECRET' ? 's' : 'p');
    expect(exchangeCredentials(spec, read)).toEqual({ key: 'k', secret: 's', passphrase: 'p' });
  });

  it('novas corretoras exigem opt-in e credenciais; B3 nunca habilita ordens', () => {
    const binance = SUPPORTED_EXCHANGES.find((s) => s.id === 'BINANCE')!;
    const b3 = SUPPORTED_EXCHANGES.find((s) => s.id === 'B3')!;
    const withKeys = (name: string) =>
      name === 'BINANCE_API_KEY' ? 'key' : name === 'BINANCE_API_SECRET' ? 'secret' : undefined;
    expect(isExchangeLiveEnabled(binance, withKeys)).toBe(false);
    expect(isExchangeLiveEnabled(binance, (name) =>
      name === 'BINANCE_ENABLE_LIVE' ? 'true' : withKeys(name))).toBe(true);
    expect(isExchangeLiveEnabled(b3, () => 'true')).toBe(false);
  });
});
