/**
 * Helpers puros para sinais B3. Nenhuma função desta pasta envia ordem:
 * a B3 é integrada como fonte de sinais e simulação ao lado da Bybit.
 */

import { B3_SYMBOLS, isB3Symbol, isExpiredB3Symbol, normalizeSymbol } from './exchangeRegistry.ts';
import { RISK, clampLeverage } from './autonomousRisk.ts';

export interface B3Alert {
  action: string;
  symbol: string;
  price: number;
  confidence: number;
  qty?: number;
  atr?: number;
  rsi?: number;
  stop_loss?: number;
  take_profit?: number;
  leverage?: number;
  market?: string;
  exchange?: string;
}

export interface NormalizedB3Alert {
  symbol: string;
  side: 'BUY' | 'SELL';
  price: number;
  confidence: number;
  qty: number;
  atr: number | null;
  rsi: number | null;
  stopLoss: number;
  takeProfit: number;
  leverage: number;
}

export type B3Validation = { ok: true; alert: NormalizedB3Alert } | { ok: false; reason: string };

/** Pregão B3, de segunda a sexta, 09:00–17:50 no horário de Brasília. */
export function isB3TradingWindow(date: Date): boolean {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Sao_Paulo', weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  const weekday = get('weekday');
  if (weekday === 'Sat' || weekday === 'Sun') return false;
  const hour = Number(get('hour'));
  const minute = Number(get('minute'));
  const minutes = hour * 60 + minute;
  return minutes >= 9 * 60 && minutes <= 17 * 60 + 50;
}

export function validateB3Alert(input: B3Alert, date = new Date()): B3Validation {
  if (!isB3Symbol(input.symbol)) {
    return { ok: false, reason: `Símbolo B3 inválido. Use ${B3_SYMBOLS.join(' ou ')}` };
  }
  if (isExpiredB3Symbol(input.symbol)) {
    return { ok: false, reason: 'Contrato vencido (WINZ25/WDOF26). Usar WINZ26/WDOZ26' };
  }
  if (!/^(buy|sell|compra|venda)$/i.test(String(input.action ?? ''))) {
    return { ok: false, reason: 'Ação deve ser buy ou sell' };
  }
  const price = Number(input.price);
  if (!Number.isFinite(price) || price <= 0) return { ok: false, reason: 'Preço inválido' };
  const confidence = Number(input.confidence);
  if (!Number.isFinite(confidence) || confidence < 80) return { ok: false, reason: 'Confiança mínima 80' };
  if (!isB3TradingWindow(date)) return { ok: false, reason: 'Fora do pregão B3 (09:00-17:50 BRT, seg-sex)' };

  const side = /^(buy|compra)$/i.test(input.action) ? 'BUY' : 'SELL';
  const atr = Number.isFinite(Number(input.atr)) ? Number(input.atr) : null;
  const direction = side === 'BUY' ? -1 : 1;
  const defaultStop = price * (1 + direction * RISK.maxStopPct / 100);
  let stopLoss = Number.isFinite(Number(input.stop_loss)) ? Number(input.stop_loss) : defaultStop;
  const rawStopPct = Math.abs(price - stopLoss) / price * 100;
  if (rawStopPct > RISK.maxStopPct) stopLoss = defaultStop;
  const takeProfit = Number.isFinite(Number(input.take_profit)) && Number(input.take_profit) > 0
    ? Number(input.take_profit)
    : price * (1 - direction * RISK.maxStopPct * 3 / 100);

  return {
    ok: true,
    alert: {
      symbol: normalizeSymbol('B3', input.symbol),
      side,
      price,
      confidence,
      qty: Number(input.qty) > 0 ? Number(input.qty) : 1,
      atr,
      rsi: Number.isFinite(Number(input.rsi)) ? Number(input.rsi) : null,
      stopLoss,
      takeProfit,
      leverage: clampLeverage(Number(input.leverage) || RISK.minLeverage),
    },
  };
}

export function b3SignalRow(alert: NormalizedB3Alert, source: string, at: Date = new Date()) {
  return {
    symbol: alert.symbol,
    side: alert.side,
    price: alert.price,
    confidence: alert.confidence,
    qty: alert.qty,
    atr: alert.atr,
    rsi: alert.rsi,
    stop_loss: alert.stopLoss,
    take_profit: alert.takeProfit,
    leverage: alert.leverage,
    source,
    mode: 'signal_only',
    executed: false,
    created_at: at.toISOString(),
  };
}

export function b3TickRow(alert: NormalizedB3Alert, at: Date = new Date()) {
  return {
    symbol: alert.symbol,
    price: alert.price,
    atr: alert.atr,
    rsi: alert.rsi,
    created_at: at.toISOString(),
  };
}

/** Texto curto para o painel; nunca inclui segredos. */
export function describeB3Alert(alert: NormalizedB3Alert): string {
  return `${alert.side === 'BUY' ? 'COMPRA' : 'VENDA'} ${alert.qty} ${alert.symbol} @ ${alert.price} (${alert.confidence}%)`;
}
