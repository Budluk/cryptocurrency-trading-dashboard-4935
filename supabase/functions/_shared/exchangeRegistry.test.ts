import { describe, expect, it } from 'bun:test';
import {
  B3_CONTRACTS, B3_SYMBOLS, exchangeCredentials, exchangeSummary, getExchangeSpec,
  isB3Symbol, isExchangeLiveEnabled, isExpiredB3Symbol, normalizeSymbol, SUPPORTED_EXCHANGES,
} from './exchangeRegistry.ts';

const dia20 = new Date('2026-11-20T14:00:00Z');
const dia02 = new Date('2026-12-02T14:00:00Z');
const dia03 = new Date('2026-12-03T14:00:00Z');
const dia18 = new Date('2026-12-18T14:00:00Z');

describe('exchange registry', () => {
  it('registra Bybit, cinco exchanges, B3 e duas testnets', () => {
    expect(SUPPORTED_EXCHANGES.map((s) => s.id)).toEqual([
      'BYBIT', 'BINANCE', 'OKX', 'BITGET', 'KUCOIN', 'GATEIO', 'B3',
      'BYBIT_TESTNET', 'BINANCE_TESTNET',
    ]);
    expect(exchangeSummary()).toHaveLength(9);
  });

  it('testnets são paper: nunca habilitam ordem real', () => {
    for (const id of ['BYBIT_TESTNET', 'BINANCE_TESTNET'] as const) {
      const spec = getExchangeSpec(id)!;
      expect(spec.paper).toBe(true);
      expect(spec.supportsOrders).toBe(false);
      expect(isExchangeLiveEnabled(spec, () => 'true')).toBe(false);
      expect(exchangeSummary().find((s) => s.id === id)?.simulationOnly).toBe(true);
    }
  });

  it('registra os quatro contratos vigentes/agendados sem habilitar ordens na B3', () => {
    const b3 = getExchangeSpec('B3')!;
    expect(b3.symbols).toEqual(['WINZ26', 'WDOZ26', 'WINF27', 'WDOF27']);
    expect([...B3_SYMBOLS]).toEqual(b3.symbols);
    expect(B3_CONTRACTS.map((c) => [c.symbol, c.validFrom, c.expiresAt, c.ativo])).toEqual([
      ['WINZ26', '2026-01-01', '2026-12-16', true],
      ['WDOZ26', '2026-01-01', '2026-12-01', true],
      ['WINF27', '2026-12-17', '2027-01-31', true],
      ['WDOF27', '2026-12-02', '2027-01-31', true],
    ]);
    expect(b3.supportsOrders).toBe(false);
    expect(isExchangeLiveEnabled(b3, () => 'true')).toBe(false);
  });

  it('aceita somente contratos B3 vigentes na data informada', () => {
    expect(isB3Symbol('WINZ26', dia20)).toBe(true);
    expect(isB3Symbol('WDOZ26', dia20)).toBe(true);
    expect(isB3Symbol('WDOF27', dia20)).toBe(false);
    expect(isB3Symbol('WINF27', dia20)).toBe(false);
    expect(isB3Symbol('WDOZ26', dia02)).toBe(false);
    expect(isB3Symbol('WDOF27', dia02)).toBe(true);
    expect(isB3Symbol('WDOF27', dia03)).toBe(true);
    expect(isB3Symbol('WINZ26', dia18)).toBe(false);
    expect(isB3Symbol('WINF27', dia18)).toBe(true);
    expect(isB3Symbol('winf27-perp', dia18)).toBe(true);
    expect(isB3Symbol('WINZ25', dia20)).toBe(false);
    expect(isB3Symbol('WINZ25', dia18)).toBe(false);
    expect(isB3Symbol('WDOF26', dia20)).toBe(false);
    expect(isB3Symbol('WDOF26', dia18)).toBe(false);
    expect(isB3Symbol('BTCUSDT', dia20)).toBe(false);
    expect(isB3Symbol('WINZ26', new Date('invalid'))).toBe(false);
  });

  it('mantém a rejeição explícita dos contratos legados', () => {
    expect(isExpiredB3Symbol('WINZ25')).toBe(true);
    expect(isExpiredB3Symbol('WDOF26')).toBe(true);
    expect(isExpiredB3Symbol('winz25-perp')).toBe(true);
    expect(isExpiredB3Symbol('WINZ26')).toBe(false);
    expect(isExpiredB3Symbol('WDOF27')).toBe(false);
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
