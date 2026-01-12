-- LIMPAR TODAS duplicatas por symbol+side (manter apenas 1 posição aberta por símbolo+lado)
DELETE FROM auto_trader_positions
WHERE id IN (
  SELECT id FROM (
    SELECT id,
           ROW_NUMBER() OVER (PARTITION BY symbol, side ORDER BY opened_at ASC) as rn
    FROM auto_trader_positions
    WHERE status = 'OPEN'
  ) sub
  WHERE rn > 1
);

-- Agora criar o índice único
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_open_position 
ON auto_trader_positions (symbol, side) 
WHERE status = 'OPEN';