import { test, expect, describe } from 'bun:test';
import {
  sma, ema, atr, rsi, adx, vwap, bollinger, rvol, atrState, computeIndicators, indicatorSummary, candlesFromBybitKlines,
  type Candle,
} from './indicators.ts';

const candles = (n: number, base = 100, step = 1): Candle[] =>
  Array.from({ length: n }, (_, i) => {
    const close = base + i * step;
    return { open: close - step / 2, high: close + 1, low: close - 1, close, volume: 1000 + i * 10, timestamp: i };
  });

describe('indicators', () => {
  test('converte klines da Bybit e ordena da mais antiga para a mais recente', () => {
    const out = candlesFromBybitKlines({
      list: [
        ['2000', '11', '12', '10', '11', '5'],
        ['1000', '10', '11', '9', '10', '3'],
        ['bad', '10', '11', '9', '10', '3'],
      ],
    });
    expect(out).toHaveLength(2);
    expect(out[0].timestamp).toBe(1000);
    expect(out[1].close).toBe(11);
  });

  test('sma calcula a média da janela', () => {
    const r = sma([1, 2, 3, 4, 5], 3);
    expect(r.status).toBe('ok');
    expect(r.value).toBe(4);
  });

  test('sma reporta dados insuficientes', () => {
    expect(sma([1, 2], 3).status).toBe('missing');
  });

  test('ema suaviza corretamente', () => {
    const r = ema([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 3);
    expect(r.status).toBe('ok');
    expect(r.value).toBeCloseTo(9.00195, 4);
  });

  test('atr usa Wilder e mantém range constante', () => {
    const r = atr(candles(40), 14);
    expect(r.status).toBe('ok');
    expect(r.value).toBeCloseTo(2, 6);
  });

  test('rsi é 100 em sequência de altas e reporta falta de dados', () => {
    expect(rsi([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16], 14).value).toBe(100);
    expect(rsi([1, 2, 3], 14).status).toBe('missing');
  });

  test('adx detecta tendência forte', () => {
    const r = adx(candles(60), 14);
    expect(r.status).toBe('ok');
    expect(r.value).toBeGreaterThan(20);
  });

  test('vwap pondera pelo volume', () => {
    const r = vwap([
      { open: 10, high: 10, low: 10, close: 10, volume: 1 },
      { open: 20, high: 20, low: 20, close: 20, volume: 3 },
    ]);
    expect(r.status).toBe('ok');
    expect(r.value).toBe(17.5);
  });

  test('bollinger devolve bandas e largura em %', () => {
    const r = bollinger(Array.from({ length: 20 }, (_, i) => 100 + Math.sin(i)), 20, 2);
    expect(r.status).toBe('ok');
    expect(r.value.upper).toBeGreaterThan(r.value.middle);
    expect(r.value.lower).toBeLessThan(r.value.middle);
    expect(r.value.widthPct).toBeGreaterThan(0);
  });

  test('rvol compara a última vela com a média anterior', () => {
    const volumes = Array.from({ length: 21 }, () => 100);
    volumes[20] = 200;
    const r = rvol(volumes, 20);
    expect(r.status).toBe('ok');
    expect(r.value).toBeCloseTo(2, 6);
  });

  test('atrState classifica impulso normalizado', () => {
    expect(atrState(102, 100, 1)).toBe('up');
    expect(atrState(98, 100, 1)).toBe('down');
    expect(atrState(100.1, 100, 1)).toBe('side');
    expect(atrState(102, 100, 0)).toBe('N/A');
  });

  test('computeIndicators marca campos como missing com dados curtos', () => {
    const out = computeIndicators(candles(5));
    expect(out.price.status).toBe('ok');
    expect(out.atr14.status).toBe('missing');
    expect(out.atrPct.status).toBe('missing');
    expect(out.bollinger.status).toBe('missing');
  });

  test('indicatorSummary gera payload compacto com formula_version', () => {
    const s = indicatorSummary(candles(60));
    expect(s.formula_version).toBe('indicators-1.0.0');
    expect(typeof s.preco).toBe('number');
    expect(s.rsi14).toBe(100);
  });
});
