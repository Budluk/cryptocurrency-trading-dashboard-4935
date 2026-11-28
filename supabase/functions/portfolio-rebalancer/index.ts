import { createClient } from "npm:@supabase/supabase-js@2.57.4";


const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) throw new Error('Unauthorized');

    // Buscar configuração de rebalanceamento
    const { data: config } = await supabaseClient
      .from('portfolio_rebalance_config')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (!config || !config.is_enabled) {
      return new Response(
        JSON.stringify({ success: false, message: 'Rebalancing not enabled' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Buscar posições abertas
    const { data: positions } = await supabaseClient
      .from('auto_trader_positions')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'OPEN');

    if (!positions || positions.length === 0) {
      return new Response(
        JSON.stringify({ success: false, message: 'No open positions' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Calcular alocação atual
    const totalValue = positions.reduce((sum, p) => {
      const value = p.qty * p.current_price * (p.leverage || 1);
      return sum + value;
    }, 0);

    const currentAllocations: Record<string, number> = {};
    positions.forEach(p => {
      const value = p.qty * p.current_price * (p.leverage || 1);
      const allocation = (value / totalValue) * 100;
      currentAllocations[p.symbol] = allocation;
    });

    // Comparar com alocações target
    const targetAllocations = config.target_allocations as Record<string, number>;
    const recommendations = [];
    let needsRebalance = false;

    for (const [symbol, targetPct] of Object.entries(targetAllocations)) {
      const currentPct = currentAllocations[symbol] || 0;
      const drift = Math.abs(currentPct - targetPct);

      if (drift > config.max_position_drift_pct) {
        needsRebalance = true;
        const action = currentPct > targetPct ? 'reduce' : 'increase';
        const changeNeeded = targetPct - currentPct;
        
        recommendations.push({
          symbol,
          current_allocation: currentPct.toFixed(2) + '%',
          target_allocation: targetPct.toFixed(2) + '%',
          drift: drift.toFixed(2) + '%',
          action,
          change_needed: changeNeeded.toFixed(2) + '%',
          priority: drift > config.max_position_drift_pct * 1.5 ? 'high' : 'medium',
        });
      }
    }

    // Análise de correlação
    const correlationIssues = analyzeCorrelations(positions, config.min_correlation_threshold);
    if (correlationIssues.length > 0) {
      needsRebalance = true;
      recommendations.push(...correlationIssues);
    }

    // Análise de performance
    const performanceIssues = analyzePerformance(positions);
    if (performanceIssues.length > 0) {
      recommendations.push(...performanceIssues);
    }

    // Salvar histórico
    await supabaseClient
      .from('portfolio_rebalance_history')
      .insert({
        user_id: user.id,
        rebalance_type: needsRebalance ? 'drift' : 'check',
        recommendations,
        executed: false,
        performance_before: {
          total_value: totalValue,
          allocations: currentAllocations,
          position_count: positions.length,
        },
      });

    return new Response(
      JSON.stringify({
        success: true,
        needs_rebalance: needsRebalance,
        recommendations,
        current_allocations: currentAllocations,
        target_allocations: targetAllocations,
        total_portfolio_value: totalValue.toFixed(2),
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Portfolio Rebalancer Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function analyzeCorrelations(positions: any[], threshold: number) {
  const issues = [];
  const HIGH_CORRELATION_PAIRS: Record<string, string[]> = {
    'BTCUSDT': ['ETHUSDT', 'BNBUSDT'],
    'ETHUSDT': ['BTCUSDT', 'LINKUSDT'],
  };

  const symbols = positions.map(p => p.symbol);
  
  for (let i = 0; i < symbols.length; i++) {
    const symbol1 = symbols[i];
    const correlatedSymbols = HIGH_CORRELATION_PAIRS[symbol1] || [];
    
    for (let j = i + 1; j < symbols.length; j++) {
      const symbol2 = symbols[j];
      
      if (correlatedSymbols.includes(symbol2)) {
        issues.push({
          type: 'correlation',
          symbols: [symbol1, symbol2],
          message: `${symbol1} e ${symbol2} são altamente correlacionados`,
          action: 'reduce_one',
          priority: 'high',
        });
      }
    }
  }

  return issues;
}

function analyzePerformance(positions: any[]) {
  const issues: { type: string; symbol: string; message: string; action: string; priority: string; current_pnl: string }[] = [];
  
  // Identificar posições com performance ruim
  const losingPositions = positions.filter(p => 
    p.unrealized_pnl && p.unrealized_pnl < 0 && 
    Math.abs(p.unrealized_pnl / (p.qty * p.entry_price)) > 0.15 // -15%
  );

  if (losingPositions.length > 0) {
    losingPositions.forEach(p => {
      issues.push({
        type: 'performance',
        symbol: p.symbol,
        message: `${p.symbol} com perda de ${((p.unrealized_pnl / (p.qty * p.entry_price)) * 100).toFixed(2)}%`,
        action: 'consider_closing',
        priority: 'medium',
        current_pnl: p.unrealized_pnl.toFixed(2),
      });
    });
  }

  return issues;
}