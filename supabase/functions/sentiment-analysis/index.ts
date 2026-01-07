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
    const { symbols } = await req.json();
    const symbolList = symbols || ['BTCUSDT', 'ETHUSDT'];

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const sentimentResults = [];

    for (const symbol of symbolList) {
      // Simular análise de sentimento (em produção, chamar APIs reais)
      const mockSentiment = analyzeMockSentiment(symbol);
      
      // Salvar análise no banco
      const { error } = await supabaseClient
        .from('sentiment_analysis')
        .insert({
          symbol,
          source: mockSentiment.source,
          sentiment_score: mockSentiment.sentiment_score,
          confidence: mockSentiment.confidence,
          content: mockSentiment.content,
          keywords: mockSentiment.keywords,
          impact_prediction: mockSentiment.impact_prediction,
        });

      if (error) {
        console.error(`Error saving sentiment for ${symbol}:`, error);
      }

      sentimentResults.push({
        symbol,
        sentiment: mockSentiment.sentiment_score > 0 ? 'BULLISH' : mockSentiment.sentiment_score < 0 ? 'BEARISH' : 'NEUTRAL',
        score: mockSentiment.sentiment_score,
        confidence: mockSentiment.confidence,
        recommendation: mockSentiment.impact_prediction,
      });
    }

    // Buscar sentimentos recentes do banco
    const { data: recentSentiments } = await supabaseClient
      .from('sentiment_analysis')
      .select('*')
      .in('symbol', symbolList)
      .gte('analyzed_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .order('analyzed_at', { ascending: false })
      .limit(50);

    return new Response(
      JSON.stringify({
        success: true,
        current_analysis: sentimentResults,
        recent_sentiments: recentSentiments,
        summary: calculateSentimentSummary(recentSentiments || []),
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Sentiment Analysis Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function analyzeMockSentiment(symbol: string) {
  // Simular análise de múltiplas fontes
  const sources = ['news', 'twitter', 'reddit', 'telegram'];
  const source = sources[Math.floor(Math.random() * sources.length)];
  
  // Gerar sentimento aleatório mas realista
  const baseSentiment = (Math.random() * 2) - 1; // -1 a 1
  const confidence = 60 + Math.random() * 35; // 60-95%
  
  const keywords = generateKeywords(symbol, baseSentiment);
  
  return {
    source,
    sentiment_score: Number(baseSentiment.toFixed(3)),
    confidence: Number(confidence.toFixed(2)),
    content: generateMockContent(symbol, baseSentiment, source),
    keywords,
    impact_prediction: {
      short_term: baseSentiment > 0 ? 'positive' : baseSentiment < 0 ? 'negative' : 'neutral',
      price_impact: `${(baseSentiment * 5).toFixed(2)}%`,
      volatility_expected: Math.abs(baseSentiment) > 0.5 ? 'high' : 'moderate',
    }
  };
}

function generateKeywords(symbol: string, sentiment: number): string[] {
  const positive = ['bullish', 'pump', 'rally', 'breakout', 'moon', 'adoption'];
  const negative = ['bearish', 'dump', 'crash', 'selloff', 'fear', 'regulation'];
  const neutral = ['trading', 'analysis', 'market', 'volatility'];
  
  if (sentiment > 0.3) {
    return [...positive.slice(0, 3), ...neutral.slice(0, 2)];
  } else if (sentiment < -0.3) {
    return [...negative.slice(0, 3), ...neutral.slice(0, 2)];
  }
  return neutral;
}

function generateMockContent(symbol: string, sentiment: number, source: string): string {
  if (sentiment > 0.3) {
    return `${source} buzz: ${symbol} showing strong bullish momentum with increasing adoption signals`;
  } else if (sentiment < -0.3) {
    return `${source} alert: ${symbol} facing bearish pressure amid market uncertainty`;
  }
  return `${source} update: ${symbol} trading sideways with mixed signals`;
}

function calculateSentimentSummary(sentiments: any[]) {
  if (!sentiments.length) return { overall: 'neutral', avg_score: 0, confidence: 0 };
  
  const avgScore = sentiments.reduce((acc, s) => acc + s.sentiment_score, 0) / sentiments.length;
  const avgConfidence = sentiments.reduce((acc, s) => acc + s.confidence, 0) / sentiments.length;
  
  return {
    overall: avgScore > 0.2 ? 'bullish' : avgScore < -0.2 ? 'bearish' : 'neutral',
    avg_score: Number(avgScore.toFixed(3)),
    confidence: Number(avgConfidence.toFixed(2)),
    total_signals: sentiments.length,
  };
}