/**
 * Adaptadores REST por exchange. Bybit NÃO passa por aqui: ele mantém o
 * assinante HMAC v2 próprio em bybit-trading/hmacSignature.ts.
 *
 * Nenhuma credencial é logada. O chamador decide entre simulação e live.
 */

import { getExchangeSpec, normalizeSymbol, type ExchangeId, type ExchangeSpec } from './exchangeRegistry.ts';

export type HttpMethod = 'GET' | 'POST' | 'DELETE';

export interface ExchangeCredentials {
  key: string;
  secret: string;
  passphrase: string;
}

export interface SignedRequest {
  url: string;
  method: HttpMethod;
  headers: Record<string, string>;
  body?: string;
}

export class UnsupportedExchangeAction extends Error {
  constructor(exchange: ExchangeId, action: string) {
    super(`Ação ${action} não suportada por ${exchange}`);
    this.name = 'UnsupportedExchangeAction';
  }
}

const enc = new TextEncoder();

async function hmacBytes(secret: string, data: string, algorithm: 'SHA-256' | 'SHA-512'): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: algorithm }, false, ['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(data)));
}

async function sha256Hex(data: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', enc.encode(data));
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function hmacHex(secret: string, data: string, algorithm: 'SHA-256' | 'SHA-512' = 'SHA-256'): Promise<string> {
  const bytes = await hmacBytes(secret, data, algorithm);
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function hmacBase64(secret: string, data: string): Promise<string> {
  const bytes = await hmacBytes(secret, data, 'SHA-256');
  return btoa(String.fromCharCode(...bytes));
}

function sortedQuery(values: Record<string, string>): string {
  return Object.keys(values).sort().map((k) =>
    `${encodeURIComponent(k)}=${encodeURIComponent(values[k])}`).join('&');
}

function str(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return '';
}

function sideOf(value: unknown, lower = false): string {
  const buy = /^(buy|compra|long)$/i.test(str(value));
  const side = buy ? 'BUY' : 'SELL';
  return lower ? side.toLowerCase() : side;
}

function reverseSide(value: unknown, lower = false): string {
  const buy = /^(buy|compra|long)$/i.test(str(value));
  const side = buy ? 'SELL' : 'BUY';
  return lower ? side.toLowerCase() : side;
}

export interface ActionRequestInput {
  exchange: ExchangeId;
  action: string;
  params: Record<string, unknown>;
  credentials: ExchangeCredentials;
  nowMs?: number;
}

/** Constrói a requisição assinada para a ação solicitada. */
export async function buildExchangeRequest(input: ActionRequestInput): Promise<SignedRequest> {
  const spec = getExchangeSpec(input.exchange);
  if (!spec?.baseUrl || input.exchange === 'BYBIT' || input.exchange === 'B3') {
    throw new UnsupportedExchangeAction(input.exchange, input.action);
  }
  const { key, secret, passphrase } = input.credentials;
  if (!key || !secret) throw new Error(`Credenciais ${spec.id} ausentes`);
  const now = Number.isFinite(input.nowMs) ? Number(input.nowMs) : Date.now();
  const symbol = normalizeSymbol(spec.id, input.params.symbol);
  const qty = str(input.params.qty);
  const reduceOnly = input.params.reduceOnly === true;
  const side = sideOf(input.params.side, spec.id !== 'BINANCE');
  const leverage = String(Math.max(1, Math.min(8, Number(input.params.leverage) || 3)));
  const stopLoss = str(input.params.stopLoss);
  const takeProfit = str(input.params.takeProfit);
  const base = spec.baseUrl.replace(/\/$/, '');

  switch (spec.id) {
    case 'BINANCE': {
      const timestamp = String(now);
      let path = '';
      let method: HttpMethod = 'GET';
      let body: Record<string, string> = {};
      switch (input.action) {
        case 'get_balance': path = '/fapi/v2/balance'; break;
        case 'get_positions': path = '/fapi/v2/positionRisk'; break;
        case 'get_ticker': path = '/fapi/v1/ticker/price'; break;
        case 'get_instruments': path = '/fapi/v1/exchangeInfo'; break;
        case 'place_order':
        case 'close_position':
          path = '/fapi/v1/order'; method = 'POST';
          body = {
            symbol, side: input.action === 'close_position' ? reverseSide(input.params.side) : side,
            type: 'MARKET', quantity: qty, timeInForce: 'GTC',
            ...(reduceOnly || input.action === 'close_position' ? { reduceOnly: 'true' } : {}),
          };
          break;
        case 'set_leverage':
          path = '/fapi/v1/leverage'; method = 'POST';
          body = { symbol, leverage };
          break;
        default: throw new UnsupportedExchangeAction(spec.id, input.action);
      }
      const query: Record<string, string> = {
        ...(body && method === 'GET' ? body : {}),
        timestamp,
        recvWindow: '30000',
        ...(symbol && method === 'GET' && path !== '/fapi/v1/exchangeInfo' ? { symbol } : {}),
      };
      if (method === 'POST') {
        Object.entries(body).forEach(([k, v]) => { query[k] = v; });
      }
      const payload = sortedQuery(query);
      const signature = await hmacHex(secret, payload);
      return {
        url: `${base}${path}?${payload}&signature=${signature}`,
        method,
        headers: { 'X-MBX-APIKEY': key, 'Content-Type': 'application/x-www-form-urlencoded' },
        ...(method === 'POST' ? { body: payload } : {}),
      };
    }
    case 'OKX': {
      let path = '';
      let method: HttpMethod = 'GET';
      let body: Record<string, unknown> = {};
      switch (input.action) {
        case 'get_balance': path = '/api/v5/account/balance'; break;
        case 'get_positions': path = '/api/v5/account/positions'; break;
        case 'get_ticker': path = '/api/v5/market/ticker'; break;
        case 'get_instruments': path = '/api/v5/public/instruments'; break;
        case 'place_order':
        case 'close_position':
          path = '/api/v5/trade/order'; method = 'POST';
          body = {
            instId: symbol, tdMode: 'cross',
            side: input.action === 'close_position' ? reverseSide(input.params.side, true) : side,
            ordType: 'market', sz: qty,
            ...(reduceOnly || input.action === 'close_position' ? { reduceOnly: 'true' } : {}),
            ...(stopLoss ? { slTriggerPx: stopLoss } : {}),
            ...(takeProfit ? { tpTriggerPx: takeProfit } : {}),
          };
          break;
        case 'set_leverage':
          path = '/api/v5/account/set-leverage'; method = 'POST';
          body = { instId: symbol, lever: leverage, mgnMode: 'cross' };
          break;
        default: throw new UnsupportedExchangeAction(spec.id, input.action);
      }
      const query: Record<string, string> = {};
      if (symbol && method === 'GET') query.instId = symbol;
      if (method === 'GET' && path === '/api/v5/public/instruments') query.instType = 'SWAP';
      const qs = sortedQuery(query);
      const requestPath = `${path}${qs ? `?${qs}` : ''}`;
      const timestamp = new Date(now).toISOString();
      const bodyStr = method === 'POST' ? JSON.stringify(body) : '';
      const signature = await hmacBase64(secret, `${timestamp}${method}${requestPath}${bodyStr}`);
      return {
        url: `${base}${requestPath}`, method,
        headers: {
          'OK-ACCESS-KEY': key, 'OK-ACCESS-SIGN': signature,
          'OK-ACCESS-TIMESTAMP': timestamp, 'OK-ACCESS-PASSPHRASE': passphrase,
          'Content-Type': 'application/json',
        },
        ...(bodyStr ? { body: bodyStr } : {}),
      };
    }
    case 'BITGET': {
      let path = '';
      let method: HttpMethod = 'GET';
      let body: Record<string, unknown> = {};
      switch (input.action) {
        case 'get_balance': path = '/api/v2/account/assets'; break;
        case 'get_positions': path = '/api/v2/mix/position/all-position'; break;
        case 'get_ticker': path = '/api/v2/mix/market/ticker'; break;
        case 'get_instruments': path = '/api/v2/mix/market/contracts'; break;
        case 'place_order':
        case 'close_position':
          path = '/api/v2/mix/order/place'; method = 'POST';
          body = {
            symbol, productType: 'USDT-FUTURES', marginMode: 'cross',
            side: input.action === 'close_position' ? reverseSide(input.params.side, true) : side,
            orderType: 'market', size: qty,
            ...(reduceOnly || input.action === 'close_position' ? { reduceOnly: true } : {}),
            ...(stopLoss ? { stopLossPrice: stopLoss } : {}),
            ...(takeProfit ? { takeProfitPrice: takeProfit } : {}),
          };
          break;
        case 'set_leverage': throw new UnsupportedExchangeAction(spec.id, input.action);
        default: throw new UnsupportedExchangeAction(spec.id, input.action);
      }
      const query: Record<string, string> = { productType: 'USDT-FUTURES' };
      if (symbol && method === 'GET') query.symbol = symbol;
      const qs = sortedQuery(query);
      const requestPath = `${path}?${qs}`;
      const timestamp = String(now);
      const bodyStr = method === 'POST' ? JSON.stringify(body) : '';
      const signature = await hmacBase64(secret, `${timestamp}${method}${requestPath}${bodyStr}`);
      return {
        url: `${base}${requestPath}`, method,
        headers: {
          'ACCESS-KEY': key, 'ACCESS-SIGN': signature,
          'ACCESS-TIMESTAMP': timestamp, 'ACCESS-PASSPHRASE': passphrase,
          'Content-Type': 'application/json',
        },
        ...(bodyStr ? { body: bodyStr } : {}),
      };
    }
    case 'KUCOIN': {
      let path = '';
      let method: HttpMethod = 'GET';
      let body: Record<string, unknown> = {};
      switch (input.action) {
        case 'get_balance': path = '/api/v1/accounts'; break;
        case 'get_positions': path = '/api/v1/positions'; break;
        case 'get_ticker': path = '/api/v1/market/quote'; break;
        case 'get_instruments': path = '/api/v1/contracts/active'; break;
        case 'place_order':
        case 'close_position':
          path = '/api/v1/orders'; method = 'POST';
          body = {
            symbol, side, type: 'market', size: qty,
            ...(reduceOnly || input.action === 'close_position' ? { reduceOnly: true } : {}),
            ...(stopLoss ? { stopLossPrice: stopLoss } : {}),
            ...(takeProfit ? { takeProfitPrice: takeProfit } : {}),
          };
          break;
        case 'set_leverage': throw new UnsupportedExchangeAction(spec.id, input.action);
        default: throw new UnsupportedExchangeAction(spec.id, input.action);
      }
      const query: Record<string, string> = {};
      if (symbol && method === 'GET' && path !== '/api/v1/contracts/active') query.symbol = symbol;
      const qs = sortedQuery(query);
      const requestPath = `${path}${qs ? `?${qs}` : ''}`;
      const timestamp = String(now);
      const bodyStr = method === 'POST' ? JSON.stringify(body) : '';
      const signature = await hmacBase64(secret, `${timestamp}${method}${requestPath}${bodyStr}`);
      const encryptedPassphrase = await hmacBase64(secret, passphrase);
      return {
        url: `${base}${requestPath}`, method,
        headers: {
          'KC-API-KEY': key, 'KC-API-SIGN': signature,
          'KC-API-TIMESTAMP': timestamp, 'KC-API-PASSPHRASE': encryptedPassphrase,
          'KC-API-KEY-VERSION': '2', 'Content-Type': 'application/json',
        },
        ...(bodyStr ? { body: bodyStr } : {}),
      };
    }
    case 'GATEIO': {
      let path = '';
      let method: HttpMethod = 'GET';
      let body: Record<string, unknown> = {};
      switch (input.action) {
        case 'get_balance': path = '/api/v4/futures/usdt/accounts'; break;
        case 'get_positions': path = '/api/v4/futures/usdt/positions'; break;
        case 'get_ticker': path = '/api/v4/futures/usdt/tickers'; break;
        case 'get_instruments': path = '/api/v4/futures/usdt/contracts'; break;
        case 'place_order':
        case 'close_position':
          path = '/api/v4/futures/usdt/orders'; method = 'POST';
          body = {
            contract: symbol,
            size: (input.action === 'close_position' ? reverseSide(input.params.side, true) : side) === 'buy'
              ? Math.abs(Number(qty) || 0)
              : -Math.abs(Number(qty) || 0),
            price: '0', tif: 'ioc',
            ...(stopLoss ? { stp_price: stopLoss } : {}),
            ...(takeProfit ? { tp_price: takeProfit } : {}),
          };
          break;
        case 'set_leverage': throw new UnsupportedExchangeAction(spec.id, input.action);
        default: throw new UnsupportedExchangeAction(spec.id, input.action);
      }
      const query: Record<string, string> = {};
      if (symbol && method === 'GET' && path.endsWith('/tickers')) query.contract = symbol;
      const qs = sortedQuery(query);
      const requestPath = `${path}${qs ? `?${qs}` : ''}`;
      const timestamp = String(Math.floor(now / 1000));
      const bodyStr = method === 'POST' ? JSON.stringify(body) : '';
      const signString = `${method}\n${path}\n${qs}\n${await sha256Hex(bodyStr)}\n${timestamp}`;
      const signature = await hmacHex(secret, signString, 'SHA-512');
      return {
        url: `${base}${requestPath}`, method,
        headers: {
          'KEY': key, 'Timestamp': timestamp, 'SIGN': signature,
          'Content-Type': 'application/json', 'Accept': 'application/json',
        },
        ...(bodyStr ? { body: bodyStr } : {}),
      };
    }
    default:
      throw new UnsupportedExchangeAction(input.exchange, input.action);
  }
}

export async function sendExchangeRequest(
  input: ActionRequestInput,
  fetchImpl: typeof fetch = fetch,
): Promise<unknown> {
  const request = await buildExchangeRequest(input);
  const res = await fetchImpl(request.url, {
    method: request.method,
    headers: request.headers,
    body: request.body,
    signal: AbortSignal.timeout(15000),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`HTTP ${res.status} em ${input.exchange}: ${text.slice(0, 300)}`);
  try { return JSON.parse(text); } catch { return { raw: text.slice(0, 1000) }; }
}

export function supportedLiveActions(spec: ExchangeSpec): string[] {
  const common = ['get_balance', 'get_positions', 'get_ticker', 'get_instruments', 'place_order', 'close_position'];
  return spec.id === 'BINANCE' || spec.id === 'OKX' ? [...common, 'set_leverage'] : common;
}
