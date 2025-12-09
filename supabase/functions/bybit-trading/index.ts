import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createHmac } from "https://deno.land/std@0.177.0/node/crypto.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Cache for server time offset
let serverTimeOffset = 0;
let lastTimeSync = 0;
const TIME_SYNC_INTERVAL = 60000; // Resync every 60 seconds

// Get Bybit server time to calculate offset
async function syncServerTime(baseUrl: string): Promise<void> {
  const now = Date.now();
  
  // Only sync if we haven't synced recently
  if (now - lastTimeSync < TIME_SYNC_INTERVAL) {
    return;
  }
  
  try {
    const response = await fetch(`${baseUrl}/v5/market/time`);
    const data = await response.json();
    
    if (data.retCode === 0 && data.result?.timeSecond) {
      const serverTime = parseInt(data.result.timeSecond) * 1000;
      serverTimeOffset = serverTime - Date.now();
      lastTimeSync = Date.now();
      console.log(`Time synced with Bybit. Offset: ${serverTimeOffset}ms`);
    }
  } catch (error) {
    console.error('Failed to sync server time:', error);
    // Use 0 offset if sync fails
    serverTimeOffset = 0;
  }
}

// Get synchronized timestamp
function getSyncedTimestamp(): number {
  return Date.now() + serverTimeOffset;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, isTestnet, params } = await req.json();
    
    let BYBIT_API_KEY = Deno.env.get('BYBIT_API_KEY');
    let BYBIT_API_SECRET = Deno.env.get('BYBIT_API_SECRET');

    // Trim whitespace from credentials
    if (BYBIT_API_KEY) BYBIT_API_KEY = BYBIT_API_KEY.trim();
    if (BYBIT_API_SECRET) BYBIT_API_SECRET = BYBIT_API_SECRET.trim();

    console.log('API Key configured:', BYBIT_API_KEY ? 'YES' : 'NO');
    console.log('API Key length:', BYBIT_API_KEY?.length);
    console.log('API Secret configured:', BYBIT_API_SECRET ? 'YES' : 'NO');
    console.log('API Secret length:', BYBIT_API_SECRET?.length);

    if (!BYBIT_API_KEY || !BYBIT_API_SECRET) {
      throw new Error('Bybit API credentials not configured');
    }

    // Select base URL based on environment
    const baseUrl = isTestnet 
      ? 'https://api-testnet.bybit.com'
      : 'https://api.bybit.com';

    console.log(`Bybit ${isTestnet ? 'TESTNET' : 'MAINNET'} - Action: ${action}`);

    // Sync server time before making authenticated requests
    await syncServerTime(baseUrl);

    // Route to appropriate handler
    let result;
    switch (action) {
      case 'get_balance':
        result = await getBalance(baseUrl, BYBIT_API_KEY, BYBIT_API_SECRET, params);
        break;
      case 'get_positions':
        result = await getPositions(baseUrl, BYBIT_API_KEY, BYBIT_API_SECRET, params);
        break;
      case 'place_order':
        result = await placeOrder(baseUrl, BYBIT_API_KEY, BYBIT_API_SECRET, params);
        break;
      case 'set_trading_stop':
        result = await setTradingStop(baseUrl, BYBIT_API_KEY, BYBIT_API_SECRET, params);
        break;
      case 'get_ticker':
        result = await getTicker(baseUrl, BYBIT_API_KEY, BYBIT_API_SECRET, params);
        break;
      case 'get_tickers':
        result = await getTickers(baseUrl, BYBIT_API_KEY, BYBIT_API_SECRET, params);
        break;
      case 'get_instruments':
        result = await getInstruments(baseUrl, BYBIT_API_KEY, BYBIT_API_SECRET, params);
        break;
      case 'set_leverage':
        result = await setLeverage(baseUrl, BYBIT_API_KEY, BYBIT_API_SECRET, params);
        break;
      case 'get_closed_pnl':
        result = await getClosedPnL(baseUrl, BYBIT_API_KEY, BYBIT_API_SECRET, params);
        break;
      case 'get_order_history':
        result = await getOrderHistory(baseUrl, BYBIT_API_KEY, BYBIT_API_SECRET, params);
        break;
      case 'get_execution_list':
        result = await getExecutionList(baseUrl, BYBIT_API_KEY, BYBIT_API_SECRET, params);
        break;
      default:
        throw new Error(`Unknown action: ${action}`);
    }

    return new Response(JSON.stringify({ success: true, data: result }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Bybit trading error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function generateSignature(timestamp: number, apiKey: string, apiSecret: string, recvWindow: string, params: string): string {
  const signaturePayload = `${timestamp}${apiKey}${recvWindow}${params}`;
  return createHmac('sha256', apiSecret).update(signaturePayload).digest('hex');
}

async function makeBybitRequest(
  baseUrl: string,
  endpoint: string,
  apiKey: string,
  apiSecret: string,
  method: string = 'GET',
  params: any = {}
) {
  // Use synced timestamp instead of Date.now()
  const timestamp = getSyncedTimestamp();
  const recvWindow = '20000'; // Increased to 20 seconds for more tolerance
  
  let queryString = '';
  let queryStringForSignature = '';
  
  if (method === 'GET' && Object.keys(params).length > 0) {
    // Filter out undefined/null values and sort parameters
    const sortedParams = Object.keys(params)
      .filter(key => params[key] !== undefined && params[key] !== null && params[key] !== '')
      .sort()
      .reduce((acc, key) => {
        acc[key] = params[key];
        return acc;
      }, {} as any);
    
    // For signature: no encoding
    queryStringForSignature = Object.keys(sortedParams)
      .map(key => `${key}=${sortedParams[key]}`)
      .join('&');
    
    // For URL: with encoding
    queryString = Object.keys(sortedParams)
      .map(key => `${key}=${encodeURIComponent(sortedParams[key])}`)
      .join('&');
  }
  
  const paramsStr = method === 'POST' ? JSON.stringify(params) : queryStringForSignature;
  const signature = generateSignature(timestamp, apiKey, apiSecret, recvWindow, paramsStr);
  
  console.log('Request details:', {
    method,
    endpoint,
    timestamp,
    serverTimeOffset,
    recvWindow,
    paramsStr: paramsStr.substring(0, 100),
    signature: signature.substring(0, 20) + '...'
  });

  const headers = {
    'X-BAPI-API-KEY': apiKey,
    'X-BAPI-SIGN': signature,
    'X-BAPI-TIMESTAMP': timestamp.toString(),
    'X-BAPI-RECV-WINDOW': recvWindow,
    'Content-Type': 'application/json',
  };

  let url = `${baseUrl}${endpoint}`;
  if (method === 'GET' && queryString) {
    url += `?${queryString}`;
  }

  const options: any = {
    method,
    headers,
  };

  if (method === 'POST' && paramsStr) {
    options.body = paramsStr;
  }

  console.log('Making request to:', url);
  const response = await fetch(url, options);
  
  if (!response.ok) {
    const errorText = await response.text();
    console.error('Bybit API HTTP Error:', response.status, errorText);
    console.error('Request headers:', headers);
    throw new Error(`Bybit API HTTP ${response.status}: ${errorText || 'Unknown error'}`);
  }

  const text = await response.text();
  if (!text) {
    throw new Error('Empty response from Bybit API');
  }

  let data;
  try {
    data = JSON.parse(text);
  } catch (e) {
    console.error('Failed to parse Bybit response:', text);
    throw new Error('Invalid JSON response from Bybit API');
  }

  // Handle "not modified" as success - these are not real errors:
  // 10005 = stop loss not modified
  // 110043 = leverage not modified
  // 110044 = available balance not enough (for leverage change)
  const nonErrorCodes = [0, 10005, 110043];
  if (!nonErrorCodes.includes(data.retCode)) {
    throw new Error(`Bybit API Error: ${data.retMsg || 'Unknown error'}`);
  }

  return data.result;
}

async function getBalance(baseUrl: string, apiKey: string, apiSecret: string, params: any) {
  return await makeBybitRequest(
    baseUrl,
    '/v5/account/wallet-balance',
    apiKey,
    apiSecret,
    'GET',
    { accountType: params.accountType || 'UNIFIED' }
  );
}

async function getPositions(baseUrl: string, apiKey: string, apiSecret: string, params: any) {
  // Bybit requires either 'symbol' OR 'settleCoin' to list positions
  const positionParams: any = { 
    category: params.category || 'linear'
  };
  
  // Add symbol if provided, otherwise use settleCoin
  if (params.symbol) {
    positionParams.symbol = params.symbol;
  } else if (params.settleCoin) {
    positionParams.settleCoin = params.settleCoin;
  }
  
  return await makeBybitRequest(
    baseUrl,
    '/v5/position/list',
    apiKey,
    apiSecret,
    'GET',
    positionParams
  );
}

async function placeOrder(baseUrl: string, apiKey: string, apiSecret: string, params: any) {
  return await makeBybitRequest(
    baseUrl,
    '/v5/order/create',
    apiKey,
    apiSecret,
    'POST',
    params
  );
}

async function getTicker(baseUrl: string, apiKey: string, apiSecret: string, params: any) {
  return await makeBybitRequest(
    baseUrl,
    '/v5/market/tickers',
    apiKey,
    apiSecret,
    'GET',
    { category: params.category || 'linear', symbol: params.symbol }
  );
}

async function getTickers(baseUrl: string, apiKey: string, apiSecret: string, params: any) {
  // Get all tickers for a category (without specifying symbol)
  return await makeBybitRequest(
    baseUrl,
    '/v5/market/tickers',
    apiKey,
    apiSecret,
    'GET',
    { category: params.category || 'linear' }
  );
}

async function getInstruments(baseUrl: string, apiKey: string, apiSecret: string, params: any) {
  return await makeBybitRequest(
    baseUrl,
    '/v5/market/instruments-info',
    apiKey,
    apiSecret,
    'GET',
    { 
      category: params.category || 'linear',
      limit: params.limit || 1000,
      status: 'Trading'
    }
  );
}

async function setTradingStop(baseUrl: string, apiKey: string, apiSecret: string, params: any) {
  return await makeBybitRequest(
    baseUrl,
    '/v5/position/trading-stop',
    apiKey,
    apiSecret,
    'POST',
    params
  );
}

async function setLeverage(baseUrl: string, apiKey: string, apiSecret: string, params: any) {
  return await makeBybitRequest(
    baseUrl,
    '/v5/position/set-leverage',
    apiKey,
    apiSecret,
    'POST',
    params
  );
}

// Get closed PnL history - últimos 2 anos de trades fechados
async function getClosedPnL(baseUrl: string, apiKey: string, apiSecret: string, params: any) {
  return await makeBybitRequest(
    baseUrl,
    '/v5/position/closed-pnl',
    apiKey,
    apiSecret,
    'GET',
    {
      category: params.category || 'linear',
      symbol: params.symbol,
      startTime: params.startTime,
      endTime: params.endTime,
      limit: params.limit || 100,
      cursor: params.cursor
    }
  );
}

// Get order history - histórico de ordens
async function getOrderHistory(baseUrl: string, apiKey: string, apiSecret: string, params: any) {
  return await makeBybitRequest(
    baseUrl,
    '/v5/order/history',
    apiKey,
    apiSecret,
    'GET',
    {
      category: params.category || 'linear',
      symbol: params.symbol,
      baseCoin: params.baseCoin,
      settleCoin: params.settleCoin,
      orderId: params.orderId,
      orderLinkId: params.orderLinkId,
      orderFilter: params.orderFilter,
      orderStatus: params.orderStatus,
      startTime: params.startTime,
      endTime: params.endTime,
      limit: params.limit || 50,
      cursor: params.cursor
    }
  );
}

// Get execution/trade list - todas as execuções
async function getExecutionList(baseUrl: string, apiKey: string, apiSecret: string, params: any) {
  return await makeBybitRequest(
    baseUrl,
    '/v5/execution/list',
    apiKey,
    apiSecret,
    'GET',
    {
      category: params.category || 'linear',
      symbol: params.symbol,
      baseCoin: params.baseCoin,
      startTime: params.startTime,
      endTime: params.endTime,
      execType: params.execType,
      limit: params.limit || 100,
      cursor: params.cursor
    }
  );
}
