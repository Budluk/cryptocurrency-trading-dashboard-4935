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
  
  if (data.retCode !== 0) {
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

  const orderParams: Record<string, any> = {
    category: 'linear',
    symbol,
    side,
    orderType,
    qty: String(qty),
    timeInForce: 'GTC',
    positionIdx: 0,
  };

  if (stopLoss) {
    orderParams.stopLoss = String(stopLoss);
    orderParams.slTriggerBy = 'LastPrice';
  }
  
  if (takeProfit) {
    orderParams.takeProfit = String(takeProfit);
    orderParams.tpTriggerBy = 'LastPrice';
  }

  console.log('Order params:', JSON.stringify(orderParams));
  return await makeBybitRequest('POST', '/v5/order/create', orderParams);
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
