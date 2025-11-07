import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
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
    if (!user) {
      throw new Error('Unauthorized');
    }

    // Fetch closed trades for analysis (last 100 trades)
    const { data: trades, error: tradesError } = await supabaseClient
      .from('auto_trader_positions')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'CLOSED')
      .not('realized_pnl', 'is', null)
      .order('closed_at', { ascending: false })
      .limit(100);

    if (tradesError) throw tradesError;

    if (!trades || trades.length < 10) {
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Insufficient data. Need at least 10 closed trades for ML analysis.',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Analyze trades
    const winningTrades = trades.filter(t => t.realized_pnl > 0);
    const losingTrades = trades.filter(t => t.realized_pnl <= 0);
    const winRate = winningTrades.length / trades.length;

    // Analyze by leverage
    const leverageAnalysis: Record<number, { wins: number; total: number; avgPnl: number }> = {};
    trades.forEach(trade => {
      const lev = trade.leverage || 10;
      if (!leverageAnalysis[lev]) {
        leverageAnalysis[lev] = { wins: 0, total: 0, avgPnl: 0 };
      }
      leverageAnalysis[lev].total++;
      if (trade.realized_pnl > 0) leverageAnalysis[lev].wins++;
      leverageAnalysis[lev].avgPnl += trade.realized_pnl;
    });

    // Calculate optimal leverage
    let bestLeverage = 10;
    let bestWinRate = 0;
    Object.entries(leverageAnalysis).forEach(([lev, stats]) => {
      const wr = stats.wins / stats.total;
      if (stats.total >= 5 && wr > bestWinRate) {
        bestWinRate = wr;
        bestLeverage = Number(lev);
      }
    });

    // Analyze stop loss patterns
    const successfulSLs = winningTrades
      .filter(t => t.stop_loss && t.entry_price)
      .map(t => {
        const slDistance = t.side === 'BUY' 
          ? ((t.entry_price - t.stop_loss) / t.entry_price) * 100
          : ((t.stop_loss - t.entry_price) / t.entry_price) * 100;
        return Math.abs(slDistance);
      });

    const avgSuccessfulSL = successfulSLs.length > 0
      ? successfulSLs.reduce((a, b) => a + b, 0) / successfulSLs.length
      : 2.0;

    // Analyze take profit patterns
    const successfulTPs = winningTrades
      .filter(t => t.take_profit && t.entry_price)
      .map(t => {
        const tpDistance = t.side === 'BUY'
          ? ((t.take_profit - t.entry_price) / t.entry_price) * 100
          : ((t.entry_price - t.take_profit) / t.entry_price) * 100;
        return Math.abs(tpDistance);
      });

    const avgSuccessfulTP = successfulTPs.length > 0
      ? successfulTPs.reduce((a, b) => a + b, 0) / successfulTPs.length
      : 4.0;

    // Calculate confidence score (0-100)
    const confidenceScore = Math.min(100, (trades.length / 100) * 50 + winRate * 50);

    // Prepare optimal patterns
    const optimalPatterns = {
      avgTradeDuration: trades.reduce((acc, t) => {
        if (t.opened_at && t.closed_at) {
          const duration = new Date(t.closed_at).getTime() - new Date(t.opened_at).getTime();
          return acc + duration / (1000 * 60 * 60); // hours
        }
        return acc;
      }, 0) / trades.length,
      bestTimeToTrade: analyzeBestTradingHours(trades),
      riskRewardRatio: avgSuccessfulTP / avgSuccessfulSL,
    };

    // Save or update ML config
    const { data: existingConfig } = await supabaseClient
      .from('ml_adaptive_config')
      .select('*')
      .eq('user_id', user.id)
      .single();

    const mlConfig = {
      user_id: user.id,
      recommended_stop_loss_pct: Number(avgSuccessfulSL.toFixed(2)),
      recommended_take_profit_pct: Number(avgSuccessfulTP.toFixed(2)),
      recommended_leverage: bestLeverage,
      confidence_score: Number(confidenceScore.toFixed(2)),
      trades_analyzed: trades.length,
      win_rate_by_leverage: leverageAnalysis,
      optimal_patterns: optimalPatterns,
      last_analysis_at: new Date().toISOString(),
    };

    if (existingConfig) {
      await supabaseClient
        .from('ml_adaptive_config')
        .update(mlConfig)
        .eq('user_id', user.id);
    } else {
      await supabaseClient
        .from('ml_adaptive_config')
        .insert({ ...mlConfig, is_enabled: false });
    }

    return new Response(
      JSON.stringify({
        success: true,
        config: mlConfig,
        analysis: {
          totalTrades: trades.length,
          winRate: (winRate * 100).toFixed(2) + '%',
          bestLeverage,
          avgSuccessfulSL: avgSuccessfulSL.toFixed(2) + '%',
          avgSuccessfulTP: avgSuccessfulTP.toFixed(2) + '%',
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('ML Analysis Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function analyzeBestTradingHours(trades: any[]): string {
  const hourlyPerformance: Record<number, { wins: number; total: number }> = {};
  
  trades.forEach(trade => {
    if (!trade.opened_at) return;
    const hour = new Date(trade.opened_at).getUTCHours();
    if (!hourlyPerformance[hour]) {
      hourlyPerformance[hour] = { wins: 0, total: 0 };
    }
    hourlyPerformance[hour].total++;
    if (trade.realized_pnl > 0) hourlyPerformance[hour].wins++;
  });

  let bestHour = 0;
  let bestWinRate = 0;
  Object.entries(hourlyPerformance).forEach(([hour, stats]) => {
    if (stats.total >= 3) {
      const wr = stats.wins / stats.total;
      if (wr > bestWinRate) {
        bestWinRate = wr;
        bestHour = Number(hour);
      }
    }
  });

  return `${bestHour}:00-${(bestHour + 1) % 24}:00 UTC (${(bestWinRate * 100).toFixed(0)}% WR)`;
}