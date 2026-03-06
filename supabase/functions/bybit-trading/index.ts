import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const BYBIT_API_KEY = Deno.env.get('BYBIT_API_KEY') || '';
const BYBIT_API_SECRET = Deno.env.get('BYBIT_API_SECRET') || '';
const RECV_WINDOW = "30000";
const BYBIT_BASE_URLS = ["https://api.bybit.com", "https://api.bytick.com"];

// Typed transient error for deterministic classification
class BybitTransientError extends Error {
  public readonly transient = true;
  public readonly code: string;
  public readonly httpStatus: number;
  public readonly retryAfterMs: number;
  public readonly endpoint: string;
  public readonly host: string;

  constructor(opts: { message: string; code?: string; httpStatus?: number; retryAfterMs?: number; endpoint?: string; host?: string }) {
    super(opts.message);
    this.name = 'BybitTransientError';
    this.code = opts.code || 'BYBIT_UPSTREAM_UNAVAILABLE';
    this.httpStatus = opts.httpStatus || 0;
    this.retryAfterMs = opts.retryAfterMs || 10000;
    this.endpoint = opts.endpoint || '';
    this.host = opts.host || '';
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    let userId: string | null = null;
    if (authHeader?.startsWith('Bearer ')) {
      const { data: userData } = await supabaseClient.auth.getUser(authHeader.replace('Bearer ', ''));
      userId = userData?.user?.id || null;
    }

    console.log(`Bybit MAINNET request - user: ${userId || 'anonymous'}`);

    const body = await req.json();
    const { action, params: nestedParams, userId: bodyUserId, ...restParams } = body;
    
    if (!userId && bodyUserId) userId = bodyUserId;
    const params = nestedParams || restParams;
    
    console.log(`Bybit MAINNET - Action: ${action} - User: ${userId || 'anonymous'}`);

    let result;

    switch (action) {
      case 'get_balance':
        result = await getBalance();
        break;
      case 'get_positions':
        result = await getPositions();
        break;
      case 'place_order':
        result = await placeOrder(params);
        break;
      case 'close_position':
        result = await closePosition(params);
        break;
      case 'get_instruments':
        result = await getInstruments(params.symbol);
        break;
      case 'get_tickers':
      case 'get_ticker':
        result = await getTickers(params.symbol);
        break;
      case 'set_leverage':
        result = await setLeverage(params);
        break;
      case 'get_closed_pnl':
        result = await getClosedPnL(params);
        break;
      case 'get_order_history':
        result = await getOrderHistory(params);
        break;
      case 'get_execution_list':
        result = await getExecutionList(params);
        break;
      case 'get_klines':
        result = await getKlines(params);
        break;
      case 'set_trading_stop':
        result = await setTradingStop(params);
        break;
      default:
        throw new Error(`Unknown action: ${action}`);
    }

    return new Response(JSON.stringify({ success: true, data: result }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    // Deterministic transient error classification
    if (error instanceof BybitTransientError) {
      console.warn(`[TRANSIENT] ${error.code} | endpoint=${error.endpoint} host=${error.host} status=${error.httpStatus}`);
      return new Response(JSON.stringify({
        success: false,
        transient: true,
        code: error.code,
        error: error.message,
        retryAfterMs: error.retryAfterMs,
      }), {
        status: 200, // Never 500 for transient upstream issues
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fallback: check message for transient patterns (safety net)
    const message = error instanceof Error ? error.message : String(error);
    const isTransient = /cloudflare|temporarily unavailable|unexpected token|fetch failed|network|returned html|bybit returned|ECONNREFUSED|ETIMEDOUT|503|502/i.test(message);

    if (isTransient) {
      console.warn(`[TRANSIENT-FALLBACK] ${message}`);
      return new Response(JSON.stringify({
        success: false,
        transient: true,
        code: 'BYBIT_UPSTREAM_UNAVAILABLE',
        error: message,
        retryAfterMs: 10000,
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Real internal error → 500
    console.error('Bybit trading error:', error);
    return new Response(JSON.stringify({ success: false, error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

// Get fresh Bybit server timestamp
async function getBybitServerTime(): Promise<number> {
  try {
    for (const baseUrl of BYBIT_BASE_URLS) {
      try {
        const response = await fetch(`${baseUrl}/v5/market/time`);
        const text = await response.text();
        if (text.startsWith('<!DOCTYPE') || text.startsWith('<html')) {
          console.warn(`Bybit time endpoint returned HTML on ${baseUrl}`);
          continue;
        }

        const data = JSON.parse(text);
        
        if (data.retCode === 0 && data.time) {
          const serverTime = Math.floor(Number(data.time));
          console.log(`Bybit server time (direct): ${serverTime}`);
          return serverTime;
        }
        
        if (data.retCode === 0 && data.result?.timeSecond) {
          const serverTime = Math.floor(Number(data.result.timeSecond)) * 1000;
          console.log(`Bybit server time (calculated): ${serverTime}`);
          return serverTime;
        }
      } catch {
        continue;
      }
    }

    // All hosts failed for time - use local fallback (not a hard error)
    const fallback = Math.floor(Date.now() - 1000);
    console.log(`Bybit server time (fallback): ${fallback}`);
    return fallback;
  } catch (error) {
    console.error('Server time fetch error:', error);
    const fallback = Math.floor(Date.now() - 1000);
    console.log(`Bybit server time (fallback): ${fallback}`);
    return fallback;
  }
}

async function generateSignature(params: string, timestamp: number): Promise<string> {
  const encoder = new TextEncoder();
  const key = encoder.encode(BYBIT_API_SECRET);
  const message = encoder.encode(`${timestamp}${BYBIT_API_KEY}${RECV_WINDOW}${params}`);
  
  const cryptoKey = await crypto.subtle.importKey(
    "raw", key, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  
  const signature = await crypto.subtle.sign("HMAC", cryptoKey, message);
  return Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

async function makeBybitRequest(
  method: string,
  endpoint: string,
  params: Record<string, any> = {},
  requiresAuth: boolean = true
): Promise<any> {
  const timestamp = requiresAuth ? await getBybitServerTime() : Math.floor(Date.now());
  
  let body = '';
  let paramsStr = '';

  if (method === 'GET') {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        searchParams.append(key, String(value));
      }
    });
    paramsStr = searchParams.toString();
  } else {
    body = JSON.stringify(params);
    paramsStr = body;
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'User-Agent': 'Mozilla/5.0 (compatible; SupabaseEdge/1.0)',
    'Accept': 'application/json',
  };

  if (requiresAuth) {
    const signature = await generateSignature(paramsStr, timestamp);
    headers['X-BAPI-API-KEY'] = BYBIT_API_KEY;
    headers['X-BAPI-SIGN'] = signature;
    headers['X-BAPI-SIGN-TYPE'] = '2';
    headers['X-BAPI-TIMESTAMP'] = String(timestamp);
    headers['X-BAPI-RECV-WINDOW'] = RECV_WINDOW;
    
    console.log(`Request: ${method} ${endpoint}, timestamp: ${timestamp}`);
  }

  const maxRetriesPerHost = 3;
  let data: any;
  let lastError = '';
  let lastHttpStatus = 0;
  let lastHost = '';

  for (const baseUrl of BYBIT_BASE_URLS) {
    let url = `${baseUrl}${endpoint}`;
    if (method === 'GET' && paramsStr) {
      url += `?${paramsStr}`;
    }

    for (let attempt = 0; attempt < maxRetriesPerHost; attempt++) {
      try {
        const response = await fetch(url, {
          method,
          headers,
          body: method !== 'GET' ? body : undefined,
        });

        lastHttpStatus = response.status;
        lastHost = baseUrl;

        // Classify HTTP-level transient errors before reading body
        if (response.status === 429) {
          lastError = `Bybit rate limited (429) on ${baseUrl}`;
          console.warn(`${lastError} for ${endpoint}`);
          await new Promise(r => setTimeout(r, 3000 * (attempt + 1)));
          continue;
        }

        const responseText = await response.text();
        
        // HTML response = Cloudflare/WAF block
        if (responseText.startsWith('<!DOCTYPE') || responseText.startsWith('<html')) {
          lastError = `Bybit returned HTML on ${baseUrl}`;
          console.error(`${lastError} for ${endpoint} (attempt ${attempt + 1}/${maxRetriesPerHost}). Status: ${response.status}`);
          if (attempt < maxRetriesPerHost - 1) {
            await new Promise(r => setTimeout(r, 2000 * (attempt + 1)));
            continue;
          }
          break; // try next host
        }

        // 5xx from Bybit itself
        if (response.status >= 500) {
          lastError = `Bybit server error ${response.status} on ${baseUrl}`;
          console.error(`${lastError} for ${endpoint}`);
          if (attempt < maxRetriesPerHost - 1) {
            await new Promise(r => setTimeout(r, 2000 * (attempt + 1)));
            continue;
          }
          break;
        }
        
        data = JSON.parse(responseText);
        break;
      } catch (fetchErr: any) {
        lastError = fetchErr?.message || String(fetchErr);
        lastHost = baseUrl;
        console.error(`Fetch error on ${baseUrl}${endpoint}: ${lastError}`);
        if (attempt < maxRetriesPerHost - 1) {
          await new Promise(r => setTimeout(r, 2000 * (attempt + 1)));
          continue;
        }
        break;
      }
    }

    if (data) break;
  }

  if (!data) {
    // All hosts exhausted → throw typed transient error
    throw new BybitTransientError({
      message: lastError || 'Bybit API temporarily unavailable',
      httpStatus: lastHttpStatus,
      endpoint,
      host: lastHost,
      retryAfterMs: lastHttpStatus === 429 ? 15000 : 10000,
    });
  }
  
  // Handle non-critical Bybit errors
  const nonCriticalErrors = [110043, 110025, 110017, 110012, 10001];
  
  const retCodeNum = Number(data.retCode);

  if (retCodeNum !== 0) {
    if (nonCriticalErrors.includes(retCodeNum)) {
      console.log(`Bybit non-critical response (${retCodeNum}): ${data.retMsg}`);
      return { success: true, message: data.retMsg, retCode: retCodeNum };
    }

    const lowerMsg = (data.retMsg || '').toLowerCase();
    if (retCodeNum === 10001 && lowerMsg.includes('leverage invalid')) {
      console.log(`Bybit leverage validation treated as non-critical: ${data.retMsg}`);
      return { success: true, message: data.retMsg, retCode: retCodeNum };
    }

    if (lowerMsg.includes('not modified') || lowerMsg.includes('same value')) {
      console.log(`Bybit non-critical response (msg match): ${data.retMsg}`);
      return { success: true, message: data.retMsg, retCode: retCodeNum };
    }

    console.error(`Bybit API Error:`, JSON.stringify(data));
    throw new Error(`Bybit API Error: ${data.retMsg}`);
  }

  return data.result;
}

async function getBalance() {
  const result = await makeBybitRequest('GET', '/v5/account/wallet-balance', { accountType: 'UNIFIED' });
  const usdtCoin = result?.list?.[0]?.coin?.find((c: any) => c.coin === 'USDT');
  
  return {
    totalEquity: result?.list?.[0]?.totalEquity || '0',
    totalWalletBalance: result?.list?.[0]?.totalWalletBalance || '0',
    totalAvailableBalance: result?.list?.[0]?.totalAvailableBalance || '0',
    usdtBalance: usdtCoin?.walletBalance || '0',
    usdtAvailable: usdtCoin?.availableToWithdraw || '0',
  };
}

async function getPositions() {
  const result = await makeBybitRequest('GET', '/v5/position/list', { category: 'linear', settleCoin: 'USDT' });
  return result?.list || [];
}

type LotSizeMeta = {
  qtyStep: number;
  minOrderQty: number;
  maxOrderQty?: number;
  decimals: number;
  qtyStepRaw: string;
  minOrderQtyRaw: string;
  maxOrderQtyRaw?: string;
};

function decimalsFromStep(stepStr: string): number {
  if (!stepStr.includes('.')) return 0;
  const frac = stepStr.split('.')[1] ?? '';
  const trimmed = frac.replace(/0+$/, '');
  return trimmed.length;
}

function floorToStep(value: number, step: number): number {
  return Math.floor((value + 1e-12) / step) * step;
}

async function getLotSizeMeta(symbol: string): Promise<LotSizeMeta | null> {
  try {
    const list = await getInstruments(symbol);
    const instrument = list?.[0];
    const lot = instrument?.lotSizeFilter;

    const qtyStepRaw = lot?.qtyStep ? String(lot.qtyStep) : '';
    const minOrderQtyRaw = lot?.minOrderQty ? String(lot.minOrderQty) : '';
    const maxOrderQtyRaw = lot?.maxOrderQty ? String(lot.maxOrderQty) : undefined;

    const qtyStep = Number(qtyStepRaw);
    const minOrderQty = Number(minOrderQtyRaw);
    const maxOrderQty = maxOrderQtyRaw !== undefined ? Number(maxOrderQtyRaw) : undefined;

    if (!Number.isFinite(qtyStep) || qtyStep <= 0) return null;

    return {
      qtyStep,
      minOrderQty: Number.isFinite(minOrderQty) && minOrderQty > 0 ? minOrderQty : qtyStep,
      maxOrderQty: Number.isFinite(maxOrderQty as number) && (maxOrderQty as number) > 0 ? (maxOrderQty as number) : undefined,
      decimals: decimalsFromStep(qtyStepRaw),
      qtyStepRaw,
      minOrderQtyRaw,
      maxOrderQtyRaw,
    };
  } catch (e) {
    console.log('Lot size fetch warning:', e?.message ?? String(e));
    return null;
  }
}

function normalizeQtyString(rawQty: number, meta: LotSizeMeta, reduceOnly: boolean): string | null {
  let q = floorToStep(rawQty, meta.qtyStep);

  if (meta.minOrderQty && q < meta.minOrderQty) {
    if (rawQty >= meta.minOrderQty) {
      q = meta.minOrderQty;
    } else {
      if (reduceOnly) {
        console.log(`⚠️ Qty ${rawQty} below minOrderQty ${meta.minOrderQty} for reduceOnly - skipping order`);
        return null;
      }
      q = meta.minOrderQty;
    }
  }

  if (meta.maxOrderQty && q > meta.maxOrderQty) {
    q = meta.maxOrderQty;
  }

  if (Object.is(q, -0)) q = 0;

  return q.toFixed(meta.decimals);
}

async function placeOrder(params: any) {
  const {
    symbol,
    side,
    qty,
    orderType = 'Market',
    price,
    stopLoss,
    takeProfit,
    leverage,
    reduceOnly,
    positionIdx,
  } = params;

  if (!symbol) throw new Error('place_order: symbol is required');
  if (side !== 'Buy' && side !== 'Sell') throw new Error(`place_order: invalid side '${side}'`);

  const rawQty = Number(qty);
  if (!Number.isFinite(rawQty) || rawQty <= 0) {
    throw new Error(`place_order: invalid qty '${qty}'`);
  }

  if (orderType === 'Limit' && !price) {
    throw new Error('place_order: price is required for Limit orders');
  }

  if (leverage) {
    try {
      await setLeverage({ symbol, leverage });
    } catch (e) {
      console.log('Leverage warning:', e.message);
    }
  }

  let qtyStr: string | null = String(qty);
  const lotMeta = await getLotSizeMeta(symbol);
  if (lotMeta) {
    qtyStr = normalizeQtyString(rawQty, lotMeta, !!reduceOnly);
    
    if (qtyStr === null) {
      console.log(`⚠️ Ordem ${symbol} ignorada: qty insuficiente para reduceOnly`);
      return {
        retCode: 0,
        retMsg: 'SKIPPED',
        result: { 
          orderId: null, 
          reason: `Qty ${rawQty} below minOrderQty ${lotMeta.minOrderQty} - order skipped`,
          skipped: true
        }
      };
    }
    
    console.log(
      `Qty normalized for ${symbol}: raw=${rawQty} -> ${qtyStr} (step=${lotMeta.qtyStepRaw}, min=${lotMeta.minOrderQtyRaw}) reduceOnly=${!!reduceOnly}`
    );
  }

  const orderParams: Record<string, any> = {
    category: 'linear',
    symbol,
    side,
    orderType,
    qty: qtyStr,
    timeInForce: 'GTC',
    positionIdx: Number.isFinite(Number(positionIdx)) ? Number(positionIdx) : 0,
  };

  if (orderType === 'Limit' && price) {
    orderParams.price = String(price);
    console.log(`📋 ORDEM LIMITE: ${symbol} ${side} @ ${price}`);
  }

  if (reduceOnly !== undefined) {
    orderParams.reduceOnly = !!reduceOnly;
  }

  console.log('Order params:', JSON.stringify(orderParams));
  const orderResult = await makeBybitRequest('POST', '/v5/order/create', orderParams);

  if (stopLoss || takeProfit) {
    try {
      const basePrice = await waitForPositionAvgPrice(symbol, side);
      const refPrice = basePrice ?? (await getLastPrice(symbol));

      const corrected = correctStopsAgainstPrice({
        symbol,
        side,
        refPrice,
        stopLoss,
        takeProfit,
      });

      const stopParams = {
        symbol,
        stopLoss: corrected.stopLoss ?? (stopLoss ? String(stopLoss) : undefined),
        takeProfit: corrected.takeProfit ?? (takeProfit ? String(takeProfit) : undefined),
      };

      const stopResult = await setTradingStop(stopParams);
      return { ...orderResult, stopResult };
    } catch (e) {
      console.error('Trading stop error:', e);
      return { ...orderResult, stopResult: { error: e?.message ?? String(e) } };
    }
  }

  return orderResult;
}

function formatPriceForBybit(price: number, refPrice: number): string {
  const decimals = refPrice < 1 ? 6 : refPrice < 100 ? 4 : 2;
  return price.toFixed(decimals);
}

function correctStopsAgainstPrice({
  side,
  refPrice,
  stopLoss,
  takeProfit,
}: {
  symbol: string;
  side: 'Buy' | 'Sell';
  refPrice: number | null;
  stopLoss?: string | number;
  takeProfit?: string | number;
}): { stopLoss?: string; takeProfit?: string; refPrice: number | null } {
  if (!refPrice || !Number.isFinite(refPrice)) {
    return { refPrice: null };
  }

  const result: { stopLoss?: string; takeProfit?: string; refPrice: number | null } = { refPrice };

  if (stopLoss) {
    const slVal = Number(stopLoss);
    if (Number.isFinite(slVal)) {
      if (side === 'Buy' && slVal >= refPrice) {
        const correctedSL = refPrice * 0.98;
        console.log(`⚠️ SL corrigido para Buy: ${slVal} → ${correctedSL.toFixed(4)} (ref=${refPrice})`);
        result.stopLoss = formatPriceForBybit(correctedSL, refPrice);
      } else if (side === 'Sell' && slVal <= refPrice) {
        const correctedSL = refPrice * 1.02;
        console.log(`⚠️ SL corrigido para Sell: ${slVal} → ${correctedSL.toFixed(4)} (ref=${refPrice})`);
        result.stopLoss = formatPriceForBybit(correctedSL, refPrice);
      } else {
        result.stopLoss = formatPriceForBybit(slVal, refPrice);
      }
    }
  }

  if (takeProfit) {
    const tpVal = Number(takeProfit);
    if (Number.isFinite(tpVal)) {
      if (side === 'Buy' && tpVal <= refPrice) {
        const correctedTP = refPrice * 1.02;
        console.log(`⚠️ TP corrigido para Buy: ${tpVal} → ${correctedTP.toFixed(4)} (ref=${refPrice})`);
        result.takeProfit = formatPriceForBybit(correctedTP, refPrice);
      } else if (side === 'Sell' && tpVal >= refPrice) {
        const correctedTP = refPrice * 0.98;
        console.log(`⚠️ TP corrigido para Sell: ${tpVal} → ${correctedTP.toFixed(4)} (ref=${refPrice})`);
        result.takeProfit = formatPriceForBybit(correctedTP, refPrice);
      } else {
        result.takeProfit = formatPriceForBybit(tpVal, refPrice);
      }
    }
  }

  return result;
}

async function waitForPositionAvgPrice(symbol: string, side: string, retries = 3): Promise<number | null> {
  for (let i = 0; i < retries; i++) {
    try {
      const positions = await getPositions();
      const pos = positions.find((p: any) => p.symbol === symbol && p.side === side && parseFloat(p.size) > 0);
      if (pos?.avgPrice) {
        const avg = parseFloat(pos.avgPrice);
        if (avg > 0) return avg;
      }
    } catch {
      // ignore
    }
    await new Promise(r => setTimeout(r, 1000));
  }
  return null;
}

async function getLastPrice(symbol: string): Promise<number> {
  try {
    const tickers = await getTickers(symbol);
    const ticker = Array.isArray(tickers) ? tickers[0] : tickers;
    return parseFloat(ticker?.lastPrice || '0');
  } catch {
    return 0;
  }
}

async function closePosition(params: any) {
  const { symbol, side, qty, positionIdx } = params;
  return placeOrder({
    symbol,
    side: side === 'Buy' ? 'Sell' : 'Buy',
    qty,
    orderType: 'Market',
    reduceOnly: true,
    positionIdx: positionIdx ?? 0,
  });
}

async function getInstruments(symbol?: string) {
  const params: Record<string, string> = { category: 'linear' };
  if (symbol) params.symbol = symbol;
  const result = await makeBybitRequest('GET', '/v5/market/instruments-info', params, false);
  return result?.list || [];
}

async function getTickers(symbol?: string) {
  const params: Record<string, string> = { category: 'linear' };
  if (symbol) params.symbol = symbol;
  const result = await makeBybitRequest('GET', '/v5/market/tickers', params, false);
  return result?.list || [];
}

async function setLeverage(params: any) {
  const { symbol } = params;
  let leverage = Number(params.leverage || params.buyLeverage);

  // Cap leverage at asset's max allowed leverage
  try {
    const instruments = await getInstruments(symbol);
    const instrument = instruments?.[0];
    const maxLev = Number(instrument?.leverageFilter?.maxLeverage);
    if (Number.isFinite(maxLev) && maxLev > 0 && leverage > maxLev) {
      console.log(`⚠️ Leverage ${leverage}x exceeds max ${maxLev}x for ${symbol}, capping`);
      leverage = maxLev;
    }
  } catch (e) {
    console.log('Leverage filter fetch warning:', e?.message ?? String(e));
  }

  if (!Number.isFinite(leverage) || leverage < 1) leverage = 1;

  return makeBybitRequest('POST', '/v5/position/set-leverage', {
    category: 'linear',
    symbol,
    buyLeverage: String(leverage),
    sellLeverage: String(leverage),
  });
}

async function getClosedPnL(params: any) {
  return makeBybitRequest('GET', '/v5/position/closed-pnl', {
    category: 'linear',
    ...params,
  });
}

async function getOrderHistory(params: any) {
  return makeBybitRequest('GET', '/v5/order/history', {
    category: 'linear',
    ...params,
  });
}

async function getExecutionList(params: any) {
  return makeBybitRequest('GET', '/v5/execution/list', {
    category: 'linear',
    ...params,
  });
}

async function getKlines(params: any) {
  return makeBybitRequest('GET', '/v5/market/kline', {
    category: 'linear',
    ...params,
  }, false);
}

async function setTradingStop(params: any) {
  const { symbol, stopLoss, takeProfit, positionIdx } = params;
  const body: Record<string, any> = {
    category: 'linear',
    symbol,
    positionIdx: positionIdx ?? 0,
  };

  if (stopLoss) body.stopLoss = String(stopLoss);
  if (takeProfit) body.takeProfit = String(takeProfit);

  return makeBybitRequest('POST', '/v5/position/trading-stop', body);
}
