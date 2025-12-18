import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const BYBIT_API_KEY = Deno.env.get('BYBIT_API_KEY') || '';
const BYBIT_API_SECRET = Deno.env.get('BYBIT_API_SECRET') || '';
const RECV_WINDOW = "30000";
const BASE_URL = "https://api.bybit.com";

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { action, params: nestedParams, ...restParams } = body;
    
    // Handle both nested params: { action, params: {...} } and flat params: { action, symbol, leverage, ... }
    const params = nestedParams || restParams;
    
    console.log(`Bybit MAINNET - Action: ${action}`);
    console.log(`Params received:`, JSON.stringify(params));
    console.log(`API Key configured: ${BYBIT_API_KEY ? 'YES' : 'NO'}`);
    console.log(`API Secret configured: ${BYBIT_API_SECRET ? 'YES' : 'NO'}`);
    console.log(`API Key length: ${BYBIT_API_KEY.length}`);
    console.log(`API Secret length: ${BYBIT_API_SECRET.length}`);

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
    console.error('Bybit trading error:', error);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

// Get fresh Bybit server timestamp - uses the 'time' field directly from response
async function getBybitServerTime(): Promise<number> {
  try {
    const response = await fetch(`${BASE_URL}/v5/market/time`);
    const data = await response.json();
    
    // Use the 'time' field directly - it's already in milliseconds as integer
    if (data.retCode === 0 && data.time) {
      const serverTime = Math.floor(Number(data.time));
      console.log(`Bybit server time (direct): ${serverTime}`);
      return serverTime;
    }
    
    // Fallback: use timeSecond and convert
    if (data.retCode === 0 && data.result?.timeSecond) {
      const serverTime = Math.floor(Number(data.result.timeSecond)) * 1000;
      console.log(`Bybit server time (calculated): ${serverTime}`);
      return serverTime;
    }
    
    throw new Error('Invalid server time response');
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
  
  let url = `${BASE_URL}${endpoint}`;
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
    if (paramsStr) url += `?${paramsStr}`;
  } else {
    body = JSON.stringify(params);
    paramsStr = body;
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
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

  const response = await fetch(url, {
    method,
    headers,
    body: method !== 'GET' ? body : undefined,
  });

  const data = await response.json();
  
  // Handle non-critical Bybit errors that are actually success cases
  const nonCriticalErrors = [110043]; // 110043 = leverage not modified (already set)
  
  if (data.retCode !== 0) {
    if (nonCriticalErrors.includes(data.retCode)) {
      console.log(`Bybit non-critical response (${data.retCode}): ${data.retMsg}`);
      return { success: true, message: data.retMsg, retCode: data.retCode };
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

async function placeOrder(params: any) {
  const { symbol, side, qty, orderType = 'Market', stopLoss, takeProfit, leverage } = params;

  if (leverage) {
    try {
      await setLeverage({ symbol, leverage });
    } catch (e) {
      console.log('Leverage warning:', e.message);
    }
  }

  // 1) Cria a ordem SEM SL/TP para evitar erro de base_price (slippage em Market)
  const orderParams: Record<string, any> = {
    category: 'linear',
    symbol,
    side,
    orderType,
    qty: String(qty),
    timeInForce: 'GTC',
    positionIdx: 0,
  };

  console.log('Order params:', JSON.stringify(orderParams));
  const orderResult = await makeBybitRequest('POST', '/v5/order/create', orderParams);

  // 2) Aplica SL/TP logo após a execução usando o preço REAL (avgPrice)
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

      // Se não conseguimos obter preço de referência, ainda tentamos setar com o que veio
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

  const buffer = 0.0015; // 0.15% só para garantir "lado correto" no preço real
  const rr = 2.5;

  let sl = stopLoss !== undefined && stopLoss !== null ? Number(stopLoss) : undefined;
  let tp = takeProfit !== undefined && takeProfit !== null ? Number(takeProfit) : undefined;

  if (side === 'Buy') {
    if (sl !== undefined && Number.isFinite(sl) && sl >= refPrice) {
      sl = refPrice * (1 - buffer);
    }
    if (tp !== undefined && Number.isFinite(tp) && tp <= refPrice) {
      tp = refPrice * (1 + buffer * rr);
    }
  } else {
    if (sl !== undefined && Number.isFinite(sl) && sl <= refPrice) {
      sl = refPrice * (1 + buffer);
    }
    if (tp !== undefined && Number.isFinite(tp) && tp >= refPrice) {
      tp = refPrice * (1 - buffer * rr);
    }
  }

  return {
    refPrice,
    stopLoss: sl !== undefined && Number.isFinite(sl) ? formatPriceForBybit(sl, refPrice) : undefined,
    takeProfit: tp !== undefined && Number.isFinite(tp) ? formatPriceForBybit(tp, refPrice) : undefined,
  };
}

async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForPositionAvgPrice(symbol: string, side: 'Buy' | 'Sell'): Promise<number | null> {
  for (let i = 0; i < 5; i++) {
    await sleep(250);
    const positions = await getPositionsBySymbol(symbol);
    const pos = positions.find((p: any) => p.symbol === symbol && p.side === side && Number(p.size || 0) > 0);
    const avg = pos?.avgPrice ? Number(pos.avgPrice) : NaN;
    if (Number.isFinite(avg) && avg > 0) return avg;
  }
  return null;
}

async function getPositionsBySymbol(symbol: string) {
  const result = await makeBybitRequest('GET', '/v5/position/list', { category: 'linear', symbol });
  return result?.list || [];
}

async function getLastPrice(symbol: string): Promise<number | null> {
  try {
    const list = await getTickers(symbol);
    const t = list?.find((x: any) => x.symbol === symbol) ?? list?.[0];
    const p = t?.lastPrice ? Number(t.lastPrice) : NaN;
    return Number.isFinite(p) ? p : null;
  } catch {
    return null;
  }
}

async function setTradingStop(params: { symbol: string; stopLoss?: string; takeProfit?: string }) {
  const { symbol, stopLoss, takeProfit } = params;

  const body: Record<string, any> = {
    category: 'linear',
    symbol,
    tpslMode: 'Full',
    positionIdx: 0,
  };

  if (stopLoss) {
    body.stopLoss = String(stopLoss);
    // Usar MarkPrice reduz stops por wick/spread em scalping (menos "stop hunt" no LastPrice)
    body.slTriggerBy = 'MarkPrice';
  }

  if (takeProfit) {
    body.takeProfit = String(takeProfit);
    body.tpTriggerBy = 'LastPrice';
  }

  console.log('Trading-stop params:', JSON.stringify(body));
  return await makeBybitRequest('POST', '/v5/position/trading-stop', body);
}

async function closePosition(params: any) {
  const { symbol, side, qty } = params;
  const closeSide = side === 'Buy' ? 'Sell' : 'Buy';
  
  const orderParams = {
    category: 'linear',
    symbol,
    side: closeSide,
    orderType: 'Market',
    qty: String(qty),
    timeInForce: 'GTC',
    positionIdx: 0,
    reduceOnly: true,
  };

  console.log('Close params:', JSON.stringify(orderParams));
  return await makeBybitRequest('POST', '/v5/order/create', orderParams);
}

async function getInstruments(symbol?: string) {
  const params: Record<string, any> = { category: 'linear' };
  if (symbol) params.symbol = symbol;
  const result = await makeBybitRequest('GET', '/v5/market/instruments-info', params, false);
  return result?.list || [];
}

async function getTickers(symbol?: string) {
  const params: Record<string, any> = { category: 'linear' };
  if (symbol) params.symbol = symbol;
  const result = await makeBybitRequest('GET', '/v5/market/tickers', params, false);
  return result?.list || [];
}

async function setLeverage(params: any) {
  const { symbol, leverage, buyLeverage, sellLeverage } = params;
  
  if (!symbol) {
    console.error('setLeverage: symbol is required but was:', symbol);
    throw new Error('Symbol is required for setLeverage');
  }
  
  const leverageValue = leverage || buyLeverage || '10';
  console.log(`Setting leverage for ${symbol}: ${leverageValue}x`);
  
  return await makeBybitRequest('POST', '/v5/position/set-leverage', {
    category: 'linear',
    symbol,
    buyLeverage: String(leverageValue),
    sellLeverage: String(sellLeverage || leverageValue),
  });
}

async function getClosedPnL(params: any) {
  const { symbol, startTime, endTime, limit = 100, cursor } = params;
  const queryParams: Record<string, any> = { category: 'linear', limit };
  if (symbol) queryParams.symbol = symbol;
  if (startTime) queryParams.startTime = startTime;
  if (endTime) queryParams.endTime = endTime;
  if (cursor) queryParams.cursor = cursor;
  
  const result = await makeBybitRequest('GET', '/v5/position/closed-pnl', queryParams);
  return { list: result?.list || [], nextPageCursor: result?.nextPageCursor || null };
}

async function getOrderHistory(params: any) {
  const { symbol, startTime, endTime, limit = 50, cursor } = params;
  const queryParams: Record<string, any> = { category: 'linear', limit };
  if (symbol) queryParams.symbol = symbol;
  if (startTime) queryParams.startTime = startTime;
  if (endTime) queryParams.endTime = endTime;
  if (cursor) queryParams.cursor = cursor;
  
  const result = await makeBybitRequest('GET', '/v5/order/history', queryParams);
  return { list: result?.list || [], nextPageCursor: result?.nextPageCursor || null };
}

async function getExecutionList(params: any) {
  const { symbol, startTime, endTime, limit = 100, cursor } = params;
  const queryParams: Record<string, any> = { category: 'linear', limit };
  if (symbol) queryParams.symbol = symbol;
  if (startTime) queryParams.startTime = startTime;
  if (endTime) queryParams.endTime = endTime;
  if (cursor) queryParams.cursor = cursor;
  
  const result = await makeBybitRequest('GET', '/v5/execution/list', queryParams);
  return { list: result?.list || [], nextPageCursor: result?.nextPageCursor || null };
}

// Buscar candles (klines) para análise de S/R
async function getKlines(params: any) {
  const { symbol, interval = '5', limit = 100, start, end } = params;
  const queryParams: Record<string, any> = {
    category: 'linear',
    symbol,
    interval, // 1, 3, 5, 15, 30, 60, 120, 240, 360, 720, D, W, M
    limit
  };
  if (start) queryParams.start = start;
  if (end) queryParams.end = end;
  
  // Klines é public endpoint - sem auth
  const result = await makeBybitRequest('GET', '/v5/market/kline', queryParams, false);
  return { list: result?.list || [] };
}
