-- Atualizar o ML config do usuário real com os dados do anônimo
-- Primeiro, copiar os dados de trades_analyzed e optimal_patterns do anônimo para o usuário real
UPDATE ml_adaptive_config 
SET 
  trades_analyzed = (SELECT trades_analyzed FROM ml_adaptive_config WHERE user_id = '00000000-0000-0000-0000-000000000000'),
  optimal_patterns = (SELECT optimal_patterns FROM ml_adaptive_config WHERE user_id = '00000000-0000-0000-0000-000000000000'),
  confidence_score = (SELECT confidence_score FROM ml_adaptive_config WHERE user_id = '00000000-0000-0000-0000-000000000000'),
  recommended_leverage = (SELECT recommended_leverage FROM ml_adaptive_config WHERE user_id = '00000000-0000-0000-0000-000000000000'),
  recommended_stop_loss_pct = (SELECT recommended_stop_loss_pct FROM ml_adaptive_config WHERE user_id = '00000000-0000-0000-0000-000000000000'),
  recommended_take_profit_pct = (SELECT recommended_take_profit_pct FROM ml_adaptive_config WHERE user_id = '00000000-0000-0000-0000-000000000000'),
  updated_at = NOW()
WHERE user_id = 'd4976f6f-9295-42c9-b154-90499855e002';

-- Também copiar dados de ai_learning_data do anônimo para o usuário real
UPDATE ai_learning_data 
SET user_id = 'd4976f6f-9295-42c9-b154-90499855e002' 
WHERE user_id = '00000000-0000-0000-0000-000000000000';