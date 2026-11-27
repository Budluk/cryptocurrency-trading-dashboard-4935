// Testes puros do loop autônomo: parsing de JSON da IA e normalização de ação.
// O restante do loop depende de rede/banco e é coberto pelos testes de
// autonomousAgent (gates) e autonomousRisk (limites).
import { describe, expect, test } from 'bun:test';
import { extractJson, normalizeAction } from './agentLoop.ts';

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
