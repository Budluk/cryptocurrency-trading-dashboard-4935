import { createClient } from "npm:@supabase/supabase-js@2.57.4";


const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, upgrade',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const upgrade = req.headers.get('upgrade') || '';
  
  if (upgrade.toLowerCase() === 'websocket') {
    const { socket, response } = Deno.upgradeWebSocket(req);
    
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    let isActive = true;
    
    socket.onopen = () => {
      console.log('WebSocket connected for order flow analysis');
      
      // Enviar dados em tempo real a cada 5 segundos
      const interval = setInterval(async () => {
        if (!isActive) {
          clearInterval(interval);
          return;
        }

        try {
          const symbols = ['BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT'];
          const flowData = [];
          
          for (const symbol of symbols) {
            const analysis = await analyzeOrderFlow(symbol);
            
            // Salvar no banco
            await supabaseClient.from('order_flow_analysis').insert({
              symbol,
              timeframe: '5m',
              buy_volume: analysis.buy_volume,
              sell_volume: analysis.sell_volume,
              net_volume: analysis.net_volume,
              volume_delta_pct: analysis.volume_delta_pct,
              large_orders_count: analysis.large_orders_count,
              institutional_flow: analysis.institutional_flow,
              price: analysis.price,
              timestamp: new Date().toISOString(),
            });

            // Detectar grandes ordens
            if (analysis.large_orders.length > 0) {
              for (const order of analysis.large_orders) {
                await supabaseClient.from('large_orders').insert({
                  symbol,
                  side: order.side,
                  size: order.size,
                  price: order.price,
                  value_usd: order.value_usd,
                  is_institutional: order.is_institutional,
                  impact_score: order.impact_score,
                });
              }
            }

            flowData.push({
              symbol,
              ...analysis,
            });
          }

          socket.send(JSON.stringify({
            type: 'order_flow_update',
            data: flowData,
            timestamp: new Date().toISOString(),
          }));

        } catch (error) {
          console.error('Error analyzing order flow:', error);
          socket.send(JSON.stringify({
            type: 'error',
            message: error.message,
          }));
        }
      }, 5000); // A cada 5 segundos

      socket.addEventListener('close', () => {
        isActive = false;
        clearInterval(interval);
      });
    };

    socket.onmessage = (event) => {
      const message = JSON.parse(event.data);
      
      if (message.type === 'subscribe') {
        console.log('Client subscribed to symbols:', message.symbols);
      }
    };

    socket.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    return response;
  }

  // HTTP endpoint para histórico
  try {
    const { symbol, timeframe = '5m', limit = 50 } = await req.json().catch(() => ({}));

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Buscar análise de order flow
    const { data: flowData } = await supabaseClient
      .from('order_flow_analysis')
      .select('*')
      .eq('symbol', symbol || 'BTCUSDT')
      .eq('timeframe', timeframe)
      .order('timestamp', { ascending: false })
      .limit(limit);

    // Buscar grandes ordens recentes
    const { data: largeOrders } = await supabaseClient
      .from('large_orders')
      .select('*')
      .eq('symbol', symbol || 'BTCUSDT')
      .gte('detected_at', new Date(Date.now() - 60 * 60 * 1000).toISOString())
      .order('detected_at', { ascending: false });

    return new Response(
      JSON.stringify({
        success: true,
        flow_data: flowData,
        large_orders: largeOrders,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function analyzeOrderFlow(symbol: string) {
  // Simular análise de order flow (em produção, usar dados reais da exchange)
  const price = 100000 + Math.random() * 10000;
  const buyVolume = 1000000 + Math.random() * 5000000;
  const sellVolume = 1000000 + Math.random() * 5000000;
  const netVolume = buyVolume - sellVolume;
  const volumeDeltaPct = (netVolume / buyVolume) * 100;

  // Detectar fluxo institucional
  let institutionalFlow = 'neutral';
  if (volumeDeltaPct > 15) {
    institutionalFlow = 'accumulation'; // Compradores fortes
  } else if (volumeDeltaPct < -15) {
    institutionalFlow = 'distribution'; // Vendedores fortes
  }

  // Detectar grandes ordens (>$100k)
  const largeOrders = [];
  const numLargeOrders = Math.floor(Math.random() * 3);
  
  for (let i = 0; i < numLargeOrders; i++) {
    const size = 10 + Math.random() * 50; // BTC
    const valueUsd = size * price;
    
    if (valueUsd > 100000) {
      const side = Math.random() > 0.5 ? 'BUY' : 'SELL';
      const isInstitutional = valueUsd > 500000; // >$500k = institucional
      const impactScore = Math.min(100, (valueUsd / 10000)); // Score baseado no valor
      
      largeOrders.push({
        side,
        size,
        price: price * (0.998 + Math.random() * 0.004), // +/- 0.2%
        value_usd: valueUsd,
        is_institutional: isInstitutional,
        impact_score: impactScore,
      });
    }
  }

  return {
    buy_volume: buyVolume,
    sell_volume: sellVolume,
    net_volume: netVolume,
    volume_delta_pct: Number(volumeDeltaPct.toFixed(2)),
    large_orders_count: largeOrders.length,
    institutional_flow: institutionalFlow,
    price,
    large_orders: largeOrders,
  };
}