import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createHmac } from "https://deno.land/std@0.177.0/node/crypto.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, isTestnet, params } = await req.json();
    
    const BYBIT_API_KEY = Deno.env.get('BYBIT_API_KEY');
    const BYBIT_API_SECRET = Deno.env.get('BYBIT_API_SECRET');

    if (!BYBIT_API_KEY || !BYBIT_API_SECRET) {
      throw new Error('Bybit API credentials not configured');
    }

    // Select base URL based on environment
    const baseUrl = isTestnet 
      ? 'https://api-testnet.bybit.com'
      : 'https://api.bybit.com';

    console.log(`Bybit ${isTestnet ? 'TESTNET' : 'MAINNET'} - Action: ${action}`);

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
      case 'get_ticker':
        result = await getTicker(baseUrl, BYBIT_API_KEY, BYBIT_API_SECRET, params);
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
  const signaturePayload = timestamp + apiKey + recvWindow + params;
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
  const timestamp = Date.now();
  const recvWindow = '5000';
  const paramsStr = method === 'GET' ? '' : JSON.stringify(params);
  const signature = generateSignature(timestamp, apiKey, apiSecret, recvWindow, paramsStr);

  const headers = {
    'X-BAPI-API-KEY': apiKey,
    'X-BAPI-SIGN': signature,
    'X-BAPI-TIMESTAMP': timestamp.toString(),
    'X-BAPI-RECV-WINDOW': recvWindow,
    'Content-Type': 'application/json',
  };

  let url = `${baseUrl}${endpoint}`;
  if (method === 'GET' && Object.keys(params).length > 0) {
    const queryString = new URLSearchParams(params).toString();
    url += `?${queryString}`;
  }

  const options: any = {
    method,
    headers,
  };

  if (method !== 'GET') {
    options.body = paramsStr;
  }

  const response = await fetch(url, options);
  
  if (!response.ok) {
    const errorText = await response.text();
    console.error('Bybit API HTTP Error:', response.status, errorText);
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

  if (data.retCode !== 0) {
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
  return await makeBybitRequest(
    baseUrl,
    '/v5/position/list',
    apiKey,
    apiSecret,
    'GET',
    { category: params.category || 'linear', symbol: params.symbol }
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
