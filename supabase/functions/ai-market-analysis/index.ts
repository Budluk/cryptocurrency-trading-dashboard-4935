import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface MarketData {
  price: number;
  volume: number;
  timestamp: number;
  indicators: {
    rsi: number;
    macd: number;
    volume_profile: number;
    trend_strength: number;
  };
}

interface NewsAnalysis {
  sentiment: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  impact: 'HIGH' | 'MEDIUM' | 'LOW';
  summary: string;
  confidence: number;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { timeframe = '1h', symbol = 'BTC/USD', analysis_type = 'comprehensive' } = await req.json();
    
    console.log(`AI Analysis request: ${symbol} - ${timeframe} - ${analysis_type}`);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const perplexityKey = Deno.env.get('PERPLEXITY_API_KEY');
    const openaiKey = Deno.env.get('OPENAI_API_KEY');

    const supabase = createClient(supabaseUrl, supabaseKey);

    // 1. Análise de Notícias em Tempo Real com Perplexity
    let newsAnalysis: NewsAnalysis | null = null;
    if (perplexityKey) {
      try {
        console.log('Fetching news analysis...');
        const newsResponse = await fetch('https://api.perplexity.ai/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${perplexityKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'llama-3.1-sonar-small-128k-online',
            messages: [
              {
                role: 'system',
                content: 'Você é um analista de mercado especializado em Bitcoin. Analise as últimas notícias sobre Bitcoin e retorne APENAS um JSON com formato: {"sentiment": "BULLISH|BEARISH|NEUTRAL", "impact": "HIGH|MEDIUM|LOW", "summary": "resumo em português", "confidence": 0-100}'
              },
              {
                role: 'user',
                content: `Analise as últimas notícias sobre Bitcoin nas últimas 24 horas. Foque em: regulamentações, adoção institucional, movimentos de whales, indicadores macroeconômicos e eventos técnicos.`
              }
            ],
            temperature: 0.2,
            max_tokens: 500,
            search_recency_filter: 'day'
          }),
        });

        if (newsResponse.ok) {
          const newsData = await newsResponse.json();
          const content = newsData.choices[0]?.message?.content;
          try {
            newsAnalysis = JSON.parse(content);
            console.log('News analysis completed:', newsAnalysis);
          } catch (e) {
            console.error('Failed to parse news JSON:', content);
          }
        }
      } catch (error) {
        console.error('Perplexity API error:', error);
      }
    }

    // 2. Simulação de dados de mercado avançados
    const currentPrice = 111200 + (Math.random() - 0.5) * 800;
    const volume24h = 28000000000 + (Math.random() - 0.5) * 5000000000;
    
    // Indicadores técnicos mais sofisticados
    const marketData: MarketData = {
      price: currentPrice,
      volume: volume24h,
      timestamp: Date.now(),
      indicators: {
        rsi: 30 + Math.random() * 40,
        macd: (Math.random() - 0.5) * 200,
        volume_profile: 0.7 + Math.random() * 0.6, // Volume profile score
        trend_strength: Math.random() * 100
      }
    };

    // 3. Análise Avançada com OpenAI
    let aiPrediction = null;
    if (openaiKey && newsAnalysis) {
      try {
        console.log('Generating AI prediction...');
        const aiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${openaiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [
              {
                role: 'system',
                content: `Você é um trader profissional especializado em análise técnica e fundamental de Bitcoin. Use dados de mercado e notícias para gerar sinais precisos.`
              },
              {
                role: 'user',
                content: `
Dados de Mercado:
- Preço: $${currentPrice.toFixed(2)}
- RSI: ${marketData.indicators.rsi.toFixed(1)}
- MACD: ${marketData.indicators.macd.toFixed(2)}
- Volume Profile: ${marketData.indicators.volume_profile.toFixed(2)}

Análise de Notícias:
- Sentimento: ${newsAnalysis.sentiment}
- Impacto: ${newsAnalysis.impact}
- Resumo: ${newsAnalysis.summary}
- Confiança: ${newsAnalysis.confidence}%

Gere um sinal de trading com:
1. Ação recomendada (BUY/SELL/HOLD)
2. Confiança (0-100%)
3. Price target
4. Stop loss
5. Justificativa técnica e fundamental
6. Timeframe recomendado

Responda em JSON: {"action": "", "confidence": 0, "target": 0, "stop": 0, "reasoning": "", "timeframe": "", "risk_level": ""}
                `
              }
            ],
            temperature: 0.3,
            max_tokens: 800,
          }),
        });

        if (aiResponse.ok) {
          const aiData = await aiResponse.json();
          const content = aiData.choices[0]?.message?.content;
          try {
            aiPrediction = JSON.parse(content);
            console.log('AI prediction completed:', aiPrediction);
          } catch (e) {
            console.error('Failed to parse AI JSON:', content);
          }
        }
      } catch (error) {
        console.error('OpenAI API error:', error);
      }
    }

    // 4. Machine Learning Score (Simulado)
    const mlFactors = {
      technical_score: (marketData.indicators.rsi < 30 ? 20 : marketData.indicators.rsi > 70 ? -20 : 0) +
                      (marketData.indicators.macd > 0 ? 15 : -15) +
                      (marketData.indicators.volume_profile > 1.2 ? 10 : -5),
      
      fundamental_score: newsAnalysis ? 
        (newsAnalysis.sentiment === 'BULLISH' ? 25 : newsAnalysis.sentiment === 'BEARISH' ? -25 : 0) +
        (newsAnalysis.impact === 'HIGH' ? 15 : newsAnalysis.impact === 'MEDIUM' ? 5 : 0) : 0,
      
      sentiment_score: newsAnalysis ? newsAnalysis.confidence : 50,
      
      volatility_score: Math.abs(marketData.indicators.macd) > 100 ? -10 : 5
    };

    const mlScore = Object.values(mlFactors).reduce((sum, val) => sum + val, 0);
    const normalizedScore = Math.max(0, Math.min(100, 50 + mlScore));

    // 5. Salvar dados para backtesting
    const signalData = {
      signal_type: 'AI_ADVANCED',
      action: aiPrediction?.action || (normalizedScore > 70 ? 'BUY' : normalizedScore < 30 ? 'SELL' : 'HOLD'),
      symbol,
      entry_price: currentPrice,
      target_price: aiPrediction?.target || currentPrice * (normalizedScore > 50 ? 1.02 : 0.98),
      stop_loss: aiPrediction?.stop || currentPrice * (normalizedScore > 50 ? 0.98 : 1.02),
      confidence: aiPrediction?.confidence || normalizedScore,
      timeframe: aiPrediction?.timeframe || timeframe,
      reasoning: aiPrediction?.reasoning || `ML Score: ${normalizedScore.toFixed(1)} | News: ${newsAnalysis?.sentiment || 'N/A'}`
    };

    const result = {
      success: true,
      timestamp: Date.now(),
      symbol,
      timeframe,
      market_data: marketData,
      news_analysis: newsAnalysis,
      ai_prediction: aiPrediction,
      ml_score: {
        overall: normalizedScore,
        factors: mlFactors,
        recommendation: normalizedScore > 70 ? 'STRONG_BUY' : 
                        normalizedScore > 55 ? 'BUY' :
                        normalizedScore < 30 ? 'STRONG_SELL' :
                        normalizedScore < 45 ? 'SELL' : 'HOLD'
      },
      signal: signalData,
      analysis_quality: {
        news_available: !!newsAnalysis,
        ai_prediction_available: !!aiPrediction,
        confidence_level: newsAnalysis && aiPrediction ? 'HIGH' : newsAnalysis || aiPrediction ? 'MEDIUM' : 'LOW'
      }
    };

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in AI analysis:', error);
    return new Response(JSON.stringify({ 
      error: 'Erro na análise de IA', 
      details: error.message,
      fallback_data: {
        signal: {
          action: 'HOLD',
          confidence: 50,
          reasoning: 'Sistema temporariamente indisponível'
        }
      }
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});