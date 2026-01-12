-- Criar conta demo com $20 para teste
INSERT INTO demo_accounts (
  user_id,
  initial_balance,
  current_balance,
  total_pnl
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  20,
  20,
  0
);

-- Também atualizar a config do auto_trader para usar balance mínimo compatível
UPDATE auto_trader_config 
SET min_balance = 5
WHERE min_balance > 5;