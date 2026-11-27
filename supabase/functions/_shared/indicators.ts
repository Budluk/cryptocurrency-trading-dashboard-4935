// Indicadores determinísticos para o agente autônomo.
// Regra dos repos analisados: o LLM recebe números calculados em código; nunca
// inventa ATR/RSI/ADX. Sem dados suficientes, o campo volta com status "missing".

export interface Candle {
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  timestamp: number;
}

export type IndicatorStatus = 'ok' | 'missing';
export interface Indicator<T = number> {
  value: T;
  formula_version: string;
  status: IndicatorStatus;
  missing?: string[];
}

const VERSION = 'indicators-1.0.0';
const ok = <T>(value: T): Indicator<T> => ({ value, formula_version: VERSION, status: 'ok' });
const missing = <T>(reason: string): Indicator<T> => ({ value: undefined as T, formula_version: VERSION, status: 'missing', missing: [reason] });

const finite = (n: number) => Number.isFinite(n);

/** Converte o formato `/v5/market/kline` da Bybit para velas ordenadas (mais antiga primeiro). */
export function candlesFromBybitKlines(raw: unknown): Candle[] {
  const result = raw as { list?: unknown[] } | unknown[] | undefined;
  const rows = Array.isArray(result) ? result : Array.isArray(result?.list) ? result.list : [];
  const candles = rows
    .map((row: any) => {
      const [timestamp, open, high, low, close, volume] = Array.isArray(row) ? row : [];
      const c: Candle = {
        timestamp: Number(timestamp),
        open: Number(open),
        high: Number(high),
        low: Number(low),
        close: Number(close),
        volume: Number(volume),
      };
      return c;
    })
    .filter((c) => [c.timestamp, c.open, c.high, c.low, c.close, c.volume].every(finite))
    .filter((c) => c.high >= c.low && c.close > 0 && c.volume >= 0)
    .sort((a, b) => a.timestamp - b.timestamp);
  return candles;
}

export function sma(values: number[], period: number): Indicator<number> {
  if (period <= 0 || values.length < period || values.slice(-period).some((v) => !finite(v))) return missing(`sma requer ${period} velas`);
  const window = values.slice(-period);
  return ok(window.reduce((a, b) => a + b, 0) / period);
}

export function emaSeries(values: number[], period: number): number[] {
  if (period <= 0 || values.length === 0) return [];
  const k = 2 / (period + 1);
  const out: number[] = [];
  let prev = values[0];
  for (const v of values) {
    prev = out.length === 0 ? v : v * k + prev * (1 - k);
    out.push(prev);
  }
  return out;
}

export function ema(values: number[], period: number): Indicator<number> {
  const series = emaSeries(values, period);
  const value = series[series.length - 1];
  return value !== undefined && finite(value) && values.length >= period ? ok(value) : missing(`ema requer ${period} velas`);
}

/** Wilder ATR sobre as velas fornecidas. */
export function atr(candles: Candle[], period = 14): Indicator<number> {
  if (candles.length < period + 1) return missing(`atr requer ${period + 1} velas`);
  const trs: number[] = [];
  for (let i = 1; i < candles.length; i++) {
    const c = candles[i];
    const prev = candles[i - 1].close;
    trs.push(Math.max(c.high - c.low, Math.abs(c.high - prev), Math.abs(c.low - prev)));
  }
  if (trs.slice(0, period).some((v) => !finite(v))) return missing('atr: OHLC inválido');
  let value = trs.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < trs.length; i++) value = (value * (period - 1) + trs[i]) / period;
  return ok(value);
}

/** RSI de Wilder. */
export function rsi(closes: number[], period = 14): Indicator<number> {
  if (closes.length < period + 1) return missing(`rsi requer ${period + 1} fechamentos`);
  let gains = 0;
  let losses = 0;
  for (let i = 1; i <= period; i++) {
    const d = closes[i] - closes[i - 1];
    if (d >= 0) gains += d; else losses -= d;
  }
  let avgGain = gains / period;
  let avgLoss = losses / period;
  for (let i = period + 1; i < closes.length; i++) {
    const d = closes[i] - closes[i - 1];
    const g = d >= 0 ? d : 0;
    const l = d < 0 ? -d : 0;
    avgGain = (avgGain * (period - 1) + g) / period;
    avgLoss = (avgLoss * (period - 1) + l) / period;
  }
  if (avgLoss === 0) return ok(100);
  const rs = avgGain / avgLoss;
  const value = 100 - 100 / (1 + rs);
  return finite(value) ? ok(value) : missing('rsi: cálculo inválido');
}

/** ADX de Wilder (+DI, -DI, DX suavizados). */
export function adx(candles: Candle[], period = 14): Indicator<number> {
  if (candles.length < period * 2 + 1) return missing(`adx requer ${period * 2 + 1} velas`);
  const tr: number[] = [];
  const plusDm: number[] = [];
  const minusDm: number[] = [];
  for (let i = 1; i < candles.length; i++) {
    const c = candles[i];
    const p = candles[i - 1];
    const up = c.high - p.high;
    const down = p.low - c.low;
    tr.push(Math.max(c.high - c.low, Math.abs(c.high - p.close), Math.abs(c.low - p.close)));
    plusDm.push(up > down && up > 0 ? up : 0);
    minusDm.push(down > up && down > 0 ? down : 0);
  }
  const sum = (a: number[]) => a.reduce((x, y) => x + y, 0);
  let trN = sum(tr.slice(0, period));
  let plusN = sum(plusDm.slice(0, period));
  let minusN = sum(minusDm.slice(0, period));
  const dx: number[] = [];
  const step = (i: number) => {
    const pdi = trN === 0 ? 0 : (plusN / trN) * 100;
    const mdi = trN === 0 ? 0 : (minusN / trN) * 100;
    const denom = pdi + mdi;
    dx.push(denom === 0 ? 0 : (Math.abs(pdi - mdi) / denom) * 100);
  };
  step(period);
  for (let i = period; i < tr.length; i++) {
    trN = trN - trN / period + tr[i];
    plusN = plusN - plusN / period + plusDm[i];
    minusN = minusN - minusN / period + minusDm[i];
    step(i);
  }
  if (dx.length < period) return missing('adx: série curta');
  let value = sum(dx.slice(0, period)) / period;
  for (let i = period; i < dx.length; i++) value = (value * (period - 1) + dx[i]) / period;
  return finite(value) ? ok(value) : missing('adx: cálculo inválido');
}

/** VWAP da janela de velas recebida (em cripto 24/7, use a janela da sessão desejada). */
export function vwap(candles: Candle[]): Indicator<number> {
  let pv = 0;
  let vol = 0;
  for (const c of candles) {
    const typical = (c.high + c.low + c.close) / 3;
    pv += typical * c.volume;
    vol += c.volume;
  }
  if (vol <= 0 || !finite(pv)) return missing('vwap sem volume');
  return ok(pv / vol);
}

export interface Bollinger {
  middle: number;
  upper: number;
  lower: number;
  widthPct: number;
}

export function bollinger(closes: number[], period = 20, multiplier = 2): Indicator<Bollinger> {
  const mid = sma(closes, period);
  if (mid.status !== 'ok') return missing(`bollinger requer ${period} fechamentos`);
  const window = closes.slice(-period);
  const variance = window.reduce((acc, v) => acc + (v - mid.value) ** 2, 0) / period;
  const sd = Math.sqrt(variance);
  const upper = mid.value + multiplier * sd;
  const lower = mid.value - multiplier * sd;
  const widthPct = mid.value ? ((upper - lower) / mid.value) * 100 : 0;
  return ok({ middle: mid.value, upper, lower, widthPct });
}

/** Volume relativo: última vela / média das N anteriores. */
export function rvol(volumes: number[], period = 20): Indicator<number> {
  if (volumes.length < period + 1) return missing(`rvol requer ${period + 1} volumes`);
  const last = volumes[volumes.length - 1];
  const avg = volumes.slice(-(period + 1), -1).reduce((a, b) => a + b, 0) / period;
  if (!finite(last) || !finite(avg) || avg <= 0) return missing('rvol: volume inválido');
  return ok(last / avg);
}

/** Tri-state normalizado por ATR, útil para confirmar impulsos. */
export function atrState(close: number, prevClose: number, atr14: number): 'up' | 'down' | 'side' | 'N/A' {
  if (!(atr14 > 0) || !finite(close) || !finite(prevClose)) return 'N/A';
  const z = ((close - prevClose) / atr14) * 1e12 / 1e12;
  return z >= 0.3 ? 'up' : z <= -0.3 ? 'down' : 'side';
}

/** Pacote completo injetado no prompt do agente. */
export function computeIndicators(candles: Candle[]) {
  const closes = candles.map((c) => c.close);
  const volumes = candles.map((c) => c.volume);
  const atr14 = atr(candles);
  return {
    price: candles.length ? ok(candles[candles.length - 1].close) : missing('sem velas'),
    ema20: ema(closes, 20),
    ema50: ema(closes, 50),
    rsi14: rsi(closes, 14),
    adx14: adx(candles, 14),
    atr14,
    atrPct: atr14.status === 'ok' && candles.length
      ? ok((atr14.value / candles[candles.length - 1].close) * 100)
      : missing('atrPct depende de atr14'),
    vwap: vwap(candles),
    bollinger: bollinger(closes, 20, 2),
    rvol20: rvol(volumes, 20),
    atrState: atr14.status === 'ok' && candles.length >= 2
      ? ok(atrState(closes[closes.length - 1], closes[closes.length - 2], atr14.value))
      : missing('atrState depende de atr14'),
  };
}

/** Resumo compacto para o tool output do chat. */
export function indicatorSummary(candles: Candle[]) {
  const i = computeIndicators(candles);
  const pick = (x: Indicator<any>) => x.status === 'ok' ? x.value : `N/A (${x.missing?.join(', ')})`;
  return {
    preco: pick(i.price),
    ema20: pick(i.ema20),
    ema50: pick(i.ema50),
    rsi14: pick(i.rsi14),
    adx14: pick(i.adx14),
    atr14: pick(i.atr14),
    atrPct: pick(i.atrPct),
    vwap: pick(i.vwap),
    bollinger: pick(i.bollinger),
    rvol20: pick(i.rvol20),
    atrState: pick(i.atrState),
    formula_version: VERSION,
  };
}
