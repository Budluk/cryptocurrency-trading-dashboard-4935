import { describe, expect, it } from 'bun:test';
import { b3SignalRow, b3TickRow, describeB3Alert, isB3TradingWindow, validateB3Alert } from './b3Signals.ts';

const pregão = new Date('2026-11-27T14:00:00Z'); // sexta, 11:00 BRT
const fora = new Date('2026-11-27T02:00:00Z');   // quinta, 23:00 BRT
const sábado = new Date('2026-11-28T14:00:00Z'); // sábado, 11:00 BRT
const dia20 = new Date('2026-11-20T14:00:00Z');  // sexta, 11:00 BRT
const dia02 = new Date('2026-12-02T14:00:00Z');  // quarta, 11:00 BRT
const dia03 = new Date('2026-12-03T14:00:00Z');  // quinta, 11:00 BRT
const dia18 = new Date('2026-12-18T14:00:00Z');  // sexta, 11:00 BRT

describe('sinais B3', () => {
  it('respeita o pregão de seg-sex, 09:00-17:50 BRT', () => {
    expect(isB3TradingWindow(pregão)).toBe(true);
    expect(isB3TradingWindow(fora)).toBe(false);
    expect(isB3TradingWindow(sábado)).toBe(false);
  });

  it('rejeita contratos vencidos e símbolos de cripto', () => {
    const base = { action: 'buy', price: 130000, confidence: 90 };
    expect(validateB3Alert({ ...base, symbol: 'WINZ25' }, pregão)).toMatchObject({ ok: false });
    expect(validateB3Alert({ ...base, symbol: 'WDOF26' }, pregão)).toMatchObject({ ok: false });
    expect(validateB3Alert({ ...base, symbol: 'BTCUSDT' }, pregão)).toMatchObject({ ok: false });
    expect(validateB3Alert({ ...base, symbol: 'WINZ26' }, fora)).toMatchObject({ ok: false });
  });

  it('rola o dólar: WDOZ26 até 01/12/2026 e WDOF27 a partir de 02/12/2026', () => {
    const base = { action: 'buy', price: 5.4, confidence: 85 };
    expect(validateB3Alert({ ...base, symbol: 'WDOZ26' }, dia20).ok).toBe(true);
    expect(validateB3Alert({ ...base, symbol: 'WDOF27' }, dia20).ok).toBe(false);
    expect(validateB3Alert({ ...base, symbol: 'WDOZ26' }, dia02).ok).toBe(false);
    expect(validateB3Alert({ ...base, symbol: 'WDOF27' }, dia02).ok).toBe(true);
    expect(validateB3Alert({ ...base, symbol: 'WDOF27' }, dia03).ok).toBe(true);
  });

  it('rola o índice: WINZ26 até 16/12/2026 e WINF27 a partir de 17/12/2026', () => {
    const base = { action: 'buy', price: 130000, confidence: 90 };
    expect(validateB3Alert({ ...base, symbol: 'WINF27' }, dia20).ok).toBe(false);
    expect(validateB3Alert({ ...base, symbol: 'WINZ26' }, dia18).ok).toBe(false);
    const rolled = validateB3Alert({ ...base, symbol: 'winf27-perp' }, dia18);
    expect(rolled.ok).toBe(true);
    if (rolled.ok) expect(rolled.alert.symbol).toBe('WINF27');
  });

  it('rejeita WINZ25/WDOF26 em qualquer data com mensagem genérica', () => {
    for (const symbol of ['WINZ25', 'WDOF26']) {
      for (const date of [pregão, dia20, dia02, dia03, dia18]) {
        const result = validateB3Alert({
          action: 'buy', symbol, price: 130000, confidence: 90,
        }, date);
        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.reason).not.toMatch(/WINZ\d{2}|WDO[A-Z]\d{2}/);
      }
    }
  });

  it('normaliza e limita o stop a 0,5%', () => {
    const result = validateB3Alert({
      action: 'buy', symbol: 'winz26', price: 130000, confidence: 92,
      qty: 2, atr: 300, rsi: 61, stop_loss: 140000, leverage: 12,
    }, pregão);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.alert.symbol).toBe('WINZ26');
    expect(result.alert.side).toBe('BUY');
    expect(result.alert.leverage).toBeLessThanOrEqual(6);
    expect(Math.abs(130000 - result.alert.stopLoss) / 130000).toBeLessThanOrEqual(0.0051);
    expect(describeB3Alert(result.alert)).toContain('WINZ26');
    expect(b3SignalRow(result.alert, 'teste').mode).toBe('signal_only');
    expect(b3SignalRow(result.alert, 'teste').executed).toBe(false);
    expect(b3TickRow(result.alert).symbol).toBe('WINZ26');
  });

  it('aceita WDOZ26 com lado de venda', () => {
    const result = validateB3Alert({
      action: 'sell', symbol: 'WDOZ26', price: 5.4, confidence: 85,
    }, pregão);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.alert.side).toBe('SELL');
  });
});
