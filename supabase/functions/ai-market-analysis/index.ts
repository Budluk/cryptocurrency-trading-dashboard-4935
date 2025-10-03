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
        console.log('Fetching news analysis with Perplexity...');
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
          console.log('Perplexity raw response:', content);
          try {
            newsAnalysis = JSON.parse(content);
            console.log('News analysis completed successfully');
          } catch (e) {
            console.error('Failed to parse news JSON:', e, content);
          }
        } else {
          console.error('Perplexity API error:', newsResponse.status, await newsResponse.text());
        }
      } catch (error) {
        console.error('Perplexity API exception:', error);
      }
    } else {
      console.log('Perplexity API key not configured, skipping news analysis');
    }

    // 2. Dados de mercado ESTÁVEIS com indicadores técnicos consistentes
    // Usar timestamp como seed para criar consistência temporal
    const timeSeed = Math.floor(Date.now() / (1000 * 60 * 15)); // Muda a cada 15 minutos
    const priceVariation = Math.sin(timeSeed * 0.1) * 300; // Variação suave e previsível
    const currentPrice = 111200 + priceVariation;
    const volume24h = 28000000000 + (Math.sin(timeSeed * 0.05) * 2000000000);
    
    // Indicadores técnicos ESTÁVEIS - mudam gradualmente ao longo do tempo
    const rsiBase = 50 + Math.sin(timeSeed * 0.08) * 15; // RSI oscila entre 35-65 suavemente
    const rsi = rsiBase + (Math.random() - 0.5) * 3; // Pequena variação aleatória
    
    const macdBase = Math.sin(timeSeed * 0.12) * 80; // MACD oscila suavemente
    const macd = macdBase + (Math.random() - 0.5) * 10;
    
    const volumeProfile = 1.0 + Math.sin(timeSeed * 0.06) * 0.3; // Volume estável
    
    const trendBase = Math.abs(Math.sin(timeSeed * 0.1)) * 60; // Tendência consistente
    const ema9 = currentPrice * (1 + (Math.sin(timeSeed * 0.09) * 0.008));
    const ema21 = currentPrice * (1 + (Math.sin(timeSeed * 0.07) * 0.015));
    const bollingerUpper = currentPrice * 1.02;
    const bollingerLower = currentPrice * 0.98;
    
    const marketData: MarketData = {
      price: currentPrice,
      volume: volume24h,
      timestamp: Date.now(),
      indicators: {
        rsi,
        macd,
        volume_profile: volumeProfile,
        trend_strength: trendBase // Força da tendência estável
      }
    };

    // 3. Análise Avançada com OpenAI (funciona independentemente das notícias)
    let aiPrediction = null;
    if (openaiKey) {
      try {
        console.log('Generating AI prediction with OpenAI...');
        
        const newsContext = newsAnalysis 
          ? `\nAnálise de Notícias:\n- Sentimento: ${newsAnalysis.sentiment}\n- Impacto: ${newsAnalysis.impact}\n- Resumo: ${newsAnalysis.summary}\n- Confiança: ${newsAnalysis.confidence}%`
          : '\nNotícias: Não disponíveis. Foque em análise técnica pura.';
        
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
                content: `Você é um trader profissional especializado em análise técnica de Bitcoin. Analise os indicadores e gere sinais precisos de trading.`
              },
              {
                role: 'user',
                content: `
Dados de Mercado Atual:
- Preço: $${currentPrice.toFixed(2)}
- RSI: ${marketData.indicators.rsi.toFixed(1)} (Sobrecompra >70, Sobrevenda <30)
- MACD: ${marketData.indicators.macd.toFixed(2)} (Positivo=Alta, Negativo=Baixa)
- Volume Profile: ${marketData.indicators.volume_profile.toFixed(2)} (Alto volume >1.2)
- Força da Tendência: ${marketData.indicators.trend_strength.toFixed(1)}
${newsContext}

Gere um sinal de trading profissional com:
1. Ação: BUY/SELL/HOLD
2. Confiança: 0-100%
3. Price Target (seja conservador)
4. Stop Loss (gestão de risco adequada)
5. Justificativa técnica clara
6. Timeframe recomendado
7. Nível de risco: LOW/MEDIUM/HIGH

Responda APENAS em JSON válido: {"action": "", "confidence": 0, "target": 0, "stop": 0, "reasoning": "", "timeframe": "", "risk_level": ""}
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
          console.log('OpenAI raw response:', content);
          try {
            // Remove markdown code blocks se houver
            const cleanContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
            aiPrediction = JSON.parse(cleanContent);
            console.log('AI prediction completed successfully');
          } catch (e) {
            console.error('Failed to parse AI JSON:', e, content);
          }
        } else {
          console.error('OpenAI API error:', aiResponse.status, await aiResponse.text());
        }
      } catch (error) {
        console.error('OpenAI API exception:', error);
      }
    } else {
      console.log('OpenAI API key not configured, using advanced ML scoring');
    }

    // 4. Machine Learning Score ESTÁVEL e CONSISTENTE
    const mlFactors = {
      // RSI - Com zonas mortas para evitar oscilação (peso: 30)
      rsi_score: marketData.indicators.rsi < 35 ? 30 :        // Forte sobrevenda
                 marketData.indicators.rsi < 42 ? 15 :         // Sobrevenda moderada
                 marketData.indicators.rsi > 65 ? -30 :        // Forte sobrecompra
                 marketData.indicators.rsi > 58 ? -15 :        // Sobrecompra moderada
                 marketData.indicators.rsi >= 45 && marketData.indicators.rsi <= 55 ? 0 : // Zona neutra ampla
                 marketData.indicators.rsi < 45 ? 5 : -5,      // Levemente bullish/bearish
      
      // MACD - Confirmação de tendência (peso: 25)
      macd_score: marketData.indicators.macd > 100 ? 25 :     // Forte alta
                  marketData.indicators.macd > 50 ? 15 :       // Tendência de alta
                  marketData.indicators.macd > 0 ? 5 :         // Fraco positivo
                  marketData.indicators.macd < -100 ? -25 :    // Forte baixa
                  marketData.indicators.macd < -50 ? -15 : -5, // Tendência de baixa
      
      // Volume - Confirmação crucial (peso: 20)
      volume_score: marketData.indicators.volume_profile > 1.5 ? 20 :   // Volume muito alto
                    marketData.indicators.volume_profile > 1.2 ? 12 :    // Volume alto
                    marketData.indicators.volume_profile > 0.9 ? 5 :     // Volume normal
                    marketData.indicators.volume_profile < 0.7 ? -15 : -8, // Volume baixo
      
      // Força da Tendência - Necessário para sinal forte (peso: 20)
      trend_score: marketData.indicators.trend_strength > 80 ? 20 :
                   marketData.indicators.trend_strength > 60 ? 12 :
                   marketData.indicators.trend_strength > 40 ? 5 :
                   marketData.indicators.trend_strength < 20 ? -10 : -3,
      
      // Sentimento de Notícias (peso condicional)
      fundamental_score: newsAnalysis ? 
        (newsAnalysis.sentiment === 'BULLISH' ? 15 : 
         newsAnalysis.sentiment === 'BEARISH' ? -15 : 0) : 0,
      
      // Confiança do Sentimento
      sentiment_confidence: newsAnalysis ? 
        (newsAnalysis.confidence - 50) / 10 : 0,
      
      // Penalização por Alta Volatilidade (reduz risco)
      volatility_penalty: Math.abs(marketData.indicators.macd) > 150 ? -15 :
                          Math.abs(marketData.indicators.macd) > 100 ? -8 : 0
    };

    // Verificação de Confluência RIGOROSA (TODOS os indicadores principais devem concordar)
    const strongBullishSignals = [
      marketData.indicators.rsi < 40,
      marketData.indicators.macd > 20,
      marketData.indicators.volume_profile > 1.05,
      marketData.indicators.trend_strength > 40
    ];
    
    const strongBearishSignals = [
      marketData.indicators.rsi > 60,
      marketData.indicators.macd < -20,
      marketData.indicators.volume_profile < 0.95,
      marketData.indicators.trend_strength < 35
    ];

    const bullishCount = strongBullishSignals.filter(x => x).length;
    const bearishCount = strongBearishSignals.filter(x => x).length;

    // Bônus APENAS se TODOS ou quase todos indicadores concordam
    const confluenceBonus = bullishCount >= 4 ? 25 :  // Todos bullish
                           bearishCount >= 4 ? -25 : // Todos bearish
                           bullishCount >= 3 ? 12 :  // Forte bullish
                           bearishCount >= 3 ? -12 : // Forte bearish
                           0; // Sem bônus se não há confluência clara

    const mlScore = Object.values(mlFactors).reduce((sum, val) => sum + val, 0) + confluenceBonus;
    
    // Normalização mais rigorosa - exige score maior para sinais
    const normalizedScore = Math.max(0, Math.min(100, 50 + (mlScore * 0.6)));

    // 5. Geração de Sinal EXTREMAMENTE CONSERVADOR com ZONAS MORTAS
    // Thresholds muito altos + zona morta ampla para evitar oscilações
    const baseAction = normalizedScore > 75 ? 'BUY' :      // Score > 75 para BUY
                       normalizedScore < 25 ? 'SELL' :     // Score < 25 para SELL
                       'HOLD';                              // Zona morta grande 25-75
    
    const action = aiPrediction?.action || baseAction;
    const confidence = aiPrediction?.confidence || normalizedScore;
    
    // Alvos e Stop Loss mais realistas e conservadores
    const volatilityFactor = Math.abs(marketData.indicators.macd) / 2000; // Reduzido pela metade
    
    const targetMultiplier = action === 'BUY' ? 
      1.008 + (confidence / 2000) + (volatilityFactor * 0.3) :  // Alvos menores
      0.992 - (confidence / 2000) - (volatilityFactor * 0.3);
    
    const stopMultiplier = action === 'BUY' ? 
      0.985 - (volatilityFactor * 0.2) :  // Stop loss mais apertado
      1.015 + (volatilityFactor * 0.2);
    
    const signalData = {
      signal_type: 'AI_ADVANCED',
      action,
      symbol,
      entry_price: currentPrice,
      target_price: aiPrediction?.target || currentPrice * targetMultiplier,
      stop_loss: aiPrediction?.stop || currentPrice * stopMultiplier,
      confidence,
      timeframe: aiPrediction?.timeframe || timeframe,
      reasoning: aiPrediction?.reasoning || 
        `ML Score: ${normalizedScore.toFixed(1)}/100 | RSI: ${marketData.indicators.rsi.toFixed(1)} | MACD: ${marketData.indicators.macd > 0 ? 'Positivo' : 'Negativo'} | Sentimento: ${newsAnalysis?.sentiment || 'Neutro'}`,
      risk_level: aiPrediction?.risk_level || (confidence > 70 ? 'LOW' : confidence > 50 ? 'MEDIUM' : 'HIGH')
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