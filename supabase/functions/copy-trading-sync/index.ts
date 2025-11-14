import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CopyTradeRequest {
  trader_user_id: string;
  symbol: string;
  side: string;
  qty: number;
  entry_price: number;
  stop_loss: number | null;
  take_profit: number | null;
  leverage: number;
  confidence: number;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body = await req.json() as CopyTradeRequest;
    
    // Input validation
    if (!body.trader_user_id || typeof body.trader_user_id !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Invalid trader_user_id' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }
    
    if (!body.symbol || typeof body.symbol !== 'string' || !/^[A-Z]+\/[A-Z]+$/.test(body.symbol)) {
      return new Response(
        JSON.stringify({ error: 'Invalid symbol format' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }
    
    if (!['Buy', 'Sell'].includes(body.side)) {
      return new Response(
        JSON.stringify({ error: 'Invalid side, must be Buy or Sell' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }
    
    if (typeof body.qty !== 'number' || body.qty <= 0 || body.qty > 1000000) {
      return new Response(
        JSON.stringify({ error: 'Invalid qty' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }
    
    if (typeof body.entry_price !== 'number' || body.entry_price <= 0) {
      return new Response(
        JSON.stringify({ error: 'Invalid entry_price' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }
    
    if (typeof body.leverage !== 'number' || body.leverage < 1 || body.leverage > 100) {
      return new Response(
        JSON.stringify({ error: 'Invalid leverage, must be between 1 and 100' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }
    
    if (typeof body.confidence !== 'number' || body.confidence < 0 || body.confidence > 100) {
      return new Response(
        JSON.stringify({ error: 'Invalid confidence, must be between 0 and 100' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }
    
    const { trader_user_id, symbol, side, qty, entry_price, stop_loss, take_profit, leverage, confidence } = body;

    console.log(`📋 Copy Trading Sync: ${symbol} ${side} for trader ${trader_user_id}`);

    // Buscar seguidores ativos deste trader
    const { data: followers, error: followersError } = await supabase
      .from('copy_trading_followers')
      .select(`
        *,
        copy_trading_config!inner(*)
      `)
      .eq('trader_user_id', trader_user_id)
      .eq('is_active', true);

    if (followersError) {
      console.error('Erro ao buscar seguidores:', followersError);
      throw followersError;
    }

    if (!followers || followers.length === 0) {
      console.log('Nenhum seguidor ativo encontrado');
      return new Response(
        JSON.stringify({ message: 'No active followers', copied: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    console.log(`📊 Encontrados ${followers.length} seguidores ativos`);

    let copiedTrades = 0;
    const results = [];

    for (const follower of followers) {
      try {
        // Verificar se o seguidor tem capital disponível
        const { data: balance } = await supabase
          .from('auto_trader_config')
          .select('*')
          .eq('user_id', follower.follower_user_id)
          .single();

        if (!balance) {
          console.log(`⚠️ Seguidor ${follower.follower_user_id} sem configuração de balance`);
          continue;
        }

        // Calcular quantidade proporcional baseada na alocação de capital
        const followerCapital = (follower.copy_trading_config as any).total_capital_for_copy;
        const allocationPercent = follower.capital_allocation_percent / 100;
        const capitalToUse = followerCapital * allocationPercent;

        // Ajustar leverage se necessário
        const followerLeverage = Math.min(leverage, follower.max_leverage);

        // Calcular quantidade proporcional
        const followerQty = (qty * capitalToUse) / (entry_price * qty);

        // Verificar se atende aos critérios de confiança
        if (confidence < follower.min_confidence) {
          console.log(`⚠️ Trade não atende min_confidence (${confidence} < ${follower.min_confidence})`);
          continue;
        }

        // Criar posição copiada
        const { data: copiedPosition, error: copyError } = await supabase
          .from('auto_trader_positions')
          .insert({
            user_id: follower.follower_user_id,
            symbol,
            side,
            qty: Math.max(followerQty, 0.001), // Mínimo de 0.001
            entry_price,
            current_price: entry_price,
            highest_price: entry_price,
            stop_loss,
            take_profit,
            leverage: followerLeverage,
            status: 'OPEN',
            confidence,
            trailing_stop_percentage: 1.5,
            unrealized_pnl: 0,
            opened_at: new Date().toISOString()
          });

        if (copyError) {
          console.error(`Erro ao copiar trade para ${follower.follower_user_id}:`, copyError);
          results.push({ follower_user_id: follower.follower_user_id, success: false, error: copyError.message });
        } else {
          console.log(`✅ Trade copiado para ${follower.follower_user_id}: ${symbol} ${side}`);
          copiedTrades++;
          results.push({ follower_user_id: follower.follower_user_id, success: true, position_id: copiedPosition });
        }
      } catch (error: any) {
        console.error(`Erro ao processar seguidor ${follower.follower_user_id}:`, error);
        results.push({ follower_user_id: follower.follower_user_id, success: false, error: error.message });
      }
    }

    console.log(`✅ Copy Trading completo: ${copiedTrades}/${followers.length} trades copiados`);

    return new Response(
      JSON.stringify({ 
        message: 'Copy trading sync completed',
        copied: copiedTrades,
        total_followers: followers.length,
        results
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  } catch (error: any) {
    console.error('Erro na função copy-trading-sync:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
