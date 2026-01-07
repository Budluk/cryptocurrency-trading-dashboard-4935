// No external imports required

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const BYBIT_API_KEY = Deno.env.get('BYBIT_API_KEY') || '';
const BYBIT_API_SECRET = Deno.env.get('BYBIT_API_SECRET') || '';
const RECV_WINDOW = "30000";
const BASE_URL = "https://api.bybit.com";

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { action, params: nestedParams, ...restParams } = body;
    
    // Handle both nested params: { action, params: {...} } and flat params: { action, symbol, leverage, ... }
    const params = nestedParams || restParams;
    
    console.log(`Bybit MAINNET - Action: ${action}`);
    // Security: Do not log API key status or lengths

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
  // 110043 = leverage not modified (already set)
  // 110025 = position trading-stop not modified (SL/TP already set to same value)
  // 110017 = position trading-stop not modified (alternative code)
  const nonCriticalErrors = [110043, 110025, 110017];
  
  if (data.retCode !== 0) {
    // Check if it's a non-critical error code
    if (nonCriticalErrors.includes(data.retCode)) {
      console.log(`Bybit non-critical response (${data.retCode}): ${data.retMsg}`);
      return { success: true, message: data.retMsg, retCode: data.retCode };
    }
    // Also check for "not modified" in the message (catch-all for any "already set" scenarios)
    const lowerMsg = (data.retMsg || '').toLowerCase();
    if (lowerMsg.includes('not modified') || lowerMsg.includes('same value')) {
      console.log(`Bybit non-critical response (msg match): ${data.retMsg}`);
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
  // If exchange returns 0.0100, treat as 0.01 (2 decimals)
  const trimmed = frac.replace(/0+$/, '');
  return trimmed.length;
}

function floorToStep(value: number, step: number): number {
  // small epsilon to reduce floating precision issues
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
    // If floor dropped below min but raw was >= min, bump to min.
    if (rawQty >= meta.minOrderQty) {
      q = meta.minOrderQty;
    } else {
      // For reduceOnly, return null instead of throwing error
      // This allows the caller to handle gracefully (skip the order)
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

  // Avoid -0.00
  if (Object.is(q, -0)) q = 0;

  return q.toFixed(meta.decimals);
}

async function placeOrder(params: any) {
  const {
    symbol,
    side,
    qty,
    orderType = 'Market',
    price, // 🎯 Preço limite para ordens Limit
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

  // Validar preço para ordens Limit
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

  // Normalize qty to instrument filters (prevents Bybit retCode=10001 "Qty invalid")
  let qtyStr: string | null = String(qty);
  const lotMeta = await getLotSizeMeta(symbol);
  if (lotMeta) {
    qtyStr = normalizeQtyString(rawQty, lotMeta, !!reduceOnly);
    
    // 🔧 CORRIGIDO: Se qty é insuficiente para reduceOnly, retornar sucesso com aviso
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

  // 1) Cria a ordem
  const orderParams: Record<string, any> = {
    category: 'linear',
    symbol,
    side,
    orderType,
    qty: qtyStr,
    timeInForce: 'GTC',
    positionIdx: Number.isFinite(Number(positionIdx)) ? Number(positionIdx) : 0,
  };

  // 🎯 Adicionar preço para ordens Limit
  if (orderType === 'Limit' && price) {
    orderParams.price = String(price);
    console.log(`📋 ORDEM LIMITE: ${symbol} ${side} @ ${price}`);
  }

  // Respect reduceOnly when caller is trying to close/partial close
  if (reduceOnly !== undefined) {
    orderParams.reduceOnly = !!reduceOnly;
  }

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

  // 🔧 CORREÇÃO: Buscar posição aberta para saber o side e validar SL/TP
  const positions = await getPositionsBySymbol(symbol);
  const openPosition = positions.find((p: any) => Number(p.size || 0) > 0);
  
  if (!openPosition) {
    console.log(`⚠️ No open position for ${symbol} - skipping trading stop`);
    return { retCode: 0, retMsg: 'No position to set stop for', result: {} };
  }
  
  const side = openPosition.side as 'Buy' | 'Sell';
  const markPrice = Number(openPosition.markPrice || 0);
  const avgPrice = Number(openPosition.avgPrice || 0);
  const refPrice = markPrice > 0 ? markPrice : avgPrice;
  
  console.log(`📊 Position ${symbol} ${side}: markPrice=${markPrice}, avgPrice=${avgPrice}`);

  let validatedSL = stopLoss ? Number(stopLoss) : undefined;
  let validatedTP = takeProfit ? Number(takeProfit) : undefined;
  
  // 🛡️ VALIDAÇÃO: SL deve estar no lado correto
  if (validatedSL !== undefined && Number.isFinite(validatedSL) && refPrice > 0) {
    if (side === 'Buy') {
      // Para BUY, SL deve ser ABAIXO do preço atual (mark price)
      if (validatedSL >= refPrice) {
        // SL inválido - recalcular como 0.3% abaixo do preço
        const correctedSL = refPrice * 0.997;
        console.log(`⚠️ SL ${validatedSL} >= markPrice ${refPrice} para BUY. Corrigindo para ${correctedSL.toFixed(6)}`);
        validatedSL = correctedSL;
      }
    } else {
      // Para SELL, SL deve ser ACIMA do preço atual
      if (validatedSL <= refPrice) {
        const correctedSL = refPrice * 1.003;
        console.log(`⚠️ SL ${validatedSL} <= markPrice ${refPrice} para SELL. Corrigindo para ${correctedSL.toFixed(6)}`);
        validatedSL = correctedSL;
      }
    }
  }
  
  // 🛡️ VALIDAÇÃO: TP deve estar no lado correto
  if (validatedTP !== undefined && Number.isFinite(validatedTP) && refPrice > 0) {
    if (side === 'Buy') {
      // Para BUY, TP deve ser ACIMA do preço atual
      if (validatedTP <= refPrice) {
        const correctedTP = refPrice * 1.008;
        console.log(`⚠️ TP ${validatedTP} <= markPrice ${refPrice} para BUY. Corrigindo para ${correctedTP.toFixed(6)}`);
        validatedTP = correctedTP;
      }
    } else {
      // Para SELL, TP deve ser ABAIXO do preço atual
      if (validatedTP >= refPrice) {
        const correctedTP = refPrice * 0.992;
        console.log(`⚠️ TP ${validatedTP} >= markPrice ${refPrice} para SELL. Corrigindo para ${correctedTP.toFixed(6)}`);
        validatedTP = correctedTP;
      }
    }
  }

  const body: Record<string, any> = {
    category: 'linear',
    symbol,
    tpslMode: 'Full',
    positionIdx: 0,
  };

  if (validatedSL !== undefined && Number.isFinite(validatedSL)) {
    const decimals = refPrice < 1 ? 6 : refPrice < 100 ? 4 : 2;
    body.stopLoss = validatedSL.toFixed(decimals);
    body.slTriggerBy = 'MarkPrice';
  }

  if (validatedTP !== undefined && Number.isFinite(validatedTP)) {
    const decimals = refPrice < 1 ? 6 : refPrice < 100 ? 4 : 2;
    body.takeProfit = validatedTP.toFixed(decimals);
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
