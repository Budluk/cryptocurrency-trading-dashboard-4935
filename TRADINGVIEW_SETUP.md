# 🚀 SmartFlow Pro - Integração TradingView

## 📋 O que foi implementado

Sistema profissional de trading que combina:
- ✅ **TradingView (Pine Script)**: Gera sinais com indicadores técnicos
- ✅ **Webhook Edge Function**: Valida e filtra sinais conservadoramente
- ✅ **Sistema de Proteção**: Anti-duplicatas, validação de confiança >=80%
- ✅ **Bybit Integration**: Executa ordens automaticamente
- ✅ **Learning System**: Salva histórico de trades para análise

---

## 🎯 Como Funciona

```
TradingView (Pine Script)
    ↓ (quando sinal >= 80% confiança)
Webhook (Edge Function)
    ↓ (valida RSI, EMA, ATR, volatilidade)
Score Conservador
    ↓ (se aprovado)
Bybit Trading
    ↓
Salva Log + Learning
```

---

## 📝 Passo 1: Configurar Indicador no TradingView

### 1.1 Criar Indicador
1. Abra o TradingView: https://www.tradingview.com/chart/
2. Clique em "Pine Editor" (parte inferior da tela)
3. Cole o código do arquivo `tradingview-indicator.pine`
4. Clique em "Salvar" e depois "Adicionar ao gráfico"

### 1.2 Configurar Parâmetros
No gráfico, clique no indicador e ajuste:
- **EMA Rápida**: 9 (padrão)
- **EMA Lenta**: 21 (padrão)
- **RSI Período**: 14 (padrão)
- **Confiança Mínima**: 80% ⚠️ **IMPORTANTE**
- **Quantidade**: 0.01 (ajuste conforme seu capital)

---

## 📝 Passo 2: Criar Alerta com Webhook

### 2.1 Criar Alerta
1. No gráfico, clique no ícone de **sino** (Create Alert)
2. Em "Condition":
   - Selecione: **SmartFlow Pro - Lovable Integration**
   - Quando: **Any alert() function call**

### 2.2 Configurar Webhook
3. Em "Notifications":
   - ✅ Marque **"Webhook URL"**
   - Cole esta URL:
   ```
   https://uohdpxkfgxmtlosnmspf.supabase.co/functions/v1/tradingview-webhook
   ```

4. Em "Alert name": `SmartFlow - BTC/USD`

5. Em "Expiration": Escolha a duração (ex: Open-ended)

6. Clique em **"Create"**

✅ **Pronto!** Agora o TradingView enviará sinais automaticamente quando:
- EMA rápida cruzar EMA lenta
- RSI estiver em zona favorável
- Confiança >= 80%

---

## 🎛️ Passo 3: Monitorar no Dashboard

Acesse a aba **"TradingView"** no seu app para ver:
- ✅ Status da conexão webhook
- ✅ Último sinal recebido
- ✅ Confiança original vs ajustada
- ✅ Indicadores (RSI, ATR, EMAs)
- ✅ Motivo da validação

---

## 🔒 Sistema de Proteção

### Filtros Automáticos:

1. **Confiança Mínima**: >= 80%
2. **Anti-Duplicatas**: Cooldown de 5 segundos por símbolo+direção
3. **Validação RSI**:
   - BUY: RSI não pode estar > 70 (sobrecomprado)
   - SELL: RSI não pode estar < 30 (sobrevendido)
4. **Validação EMA**:
   - BUY: EMA rápida deve estar > EMA lenta (+10%)
   - SELL: EMA lenta deve estar > EMA rápida (+10%)
5. **Volatilidade**: Se ATR > 3% do preço, reduz score em -10%

### Ajuste de Score:
```
Score Inicial = TradingView (60-100%)
  + RSI favorável: +20%
  + EMA confirmação: +10%
  - RSI extremo: -15%
  - EMA divergente: -10%
  - Alta volatilidade: -10%
= Score Final (deve ser >= 80%)
```

---

## 📊 Exemplo de Fluxo

### Sinal BUY no TradingView:
```json
{
  "action": "buy",
  "symbol": "BTCUSDT",
  "price": 111500,
  "confidence": 85,
  "rsi": 48,
  "ema_fast": 111600,
  "ema_slow": 111400,
  "atr": 1200,
  "qty": 0.01,
  "stop_loss": 109700,
  "take_profit": 114500
}
```

### Validação no Webhook:
```
✅ Confiança: 85% >= 80%
✅ RSI: 48 (não está sobrecomprado)
✅ EMA: Fast > Slow (confirma bullish) +10%
✅ ATR: 1.07% do preço (normal)
✅ Sem duplicatas nos últimos 5s

Score Final: 95% → APROVADO
```

### Resultado:
- ✅ Ordem enviada para Bybit
- ✅ Salvo em `auto_trader_logs` (tipo: TRADINGVIEW_SIGNAL)
- ✅ Visível no dashboard TradingView

---

## 🧪 Testando

### Teste 1: Enviar Sinal Manualmente (via curl)
```bash
curl -X POST https://uohdpxkfgxmtlosnmspf.supabase.co/functions/v1/tradingview-webhook \
  -H "Content-Type: application/json" \
  -d '{
    "action": "buy",
    "symbol": "BTCUSDT",
    "price": 111500,
    "confidence": 85,
    "rsi": 48,
    "atr": 1200,
    "ema_fast": 111600,
    "ema_slow": 111400,
    "qty": 0.01,
    "stop_loss": 109700,
    "take_profit": 114500
  }'
```

### Teste 2: Verificar Logs
1. Acesse: https://supabase.com/dashboard/project/uohdpxkfgxmtlosnmspf/functions/tradingview-webhook/logs
2. Veja os logs de recepção e validação

---

## ⚙️ Configurações Avançadas

### Ajustar Limiar de Confiança
Edite `supabase/functions/tradingview-webhook/index.ts`:
```typescript
const MIN_CONFIDENCE = 80; // Aumente para ser mais conservador (ex: 85)
```

### Ajustar Cooldown Anti-Duplicatas
```typescript
if (!canExecute(key, 10000)) { // 10s em vez de 5s
```

### Desativar Validação de EMA
Comente o bloco:
```typescript
// if (data.ema_fast && data.ema_slow) { ... }
```

---

## 📈 Vantagens vs Python/FastAPI

| Característica | Solução Atual | Python/FastAPI |
|----------------|---------------|----------------|
| **Infraestrutura** | ✅ Serverless (sem servidor) | ❌ Requer servidor 24/7 |
| **Custo** | ✅ Pay-per-use | ❌ Fixo mensal |
| **Escalabilidade** | ✅ Automática | ❌ Manual |
| **Manutenção** | ✅ Zero | ❌ Updates, patches |
| **Latência** | ✅ Edge global | ❌ Região única |
| **Integração** | ✅ Nativa (React+Supabase) | ❌ API separada |

---

## 🐛 Troubleshooting

### Sinais não chegam
1. ✅ Verifique URL do webhook no alerta TradingView
2. ✅ Confirme que confiança >= 80%
3. ✅ Veja logs: https://supabase.com/dashboard/project/uohdpxkfgxmtlosnmspf/functions/tradingview-webhook/logs

### Sinal ignorado
Verifique o motivo no dashboard "TradingView" → "Validação":
- `"low_confidence"`: Confiança < 80%
- `"duplicate"`: Sinal repetido em < 5s
- `"strategy_filter"`: Não passou na validação (RSI, EMA, ATR)

### Ordem não executada
1. ✅ Verifique se Bybit API keys estão configuradas
2. ✅ Confirme modo (testnet vs mainnet)
3. ✅ Veja logs do Bybit: https://supabase.com/dashboard/project/uohdpxkfgxmtlosnmspf/functions/bybit-trading/logs

---

## 🎯 Próximos Passos

1. ✅ **Monitorar Performance**: Acompanhe win rate na aba Performance
2. ✅ **Ajustar Parâmetros**: Teste diferentes EMAs, ATR multipliers
3. ✅ **Backtesting**: Use dados históricos na aba Backtesting
4. ✅ **Multi-símbolos**: Crie alertas para BTC, ETH, SOL, etc.
5. ✅ **Refinamento**: Analise trades vencedores/perdedores e ajuste strategy

---

## 📚 Recursos

- **TradingView Pine Script**: https://www.tradingview.com/pine-script-docs/
- **Supabase Edge Functions**: https://supabase.com/docs/guides/functions
- **Bybit API**: https://bybit-exchange.github.io/docs/v5/intro

---

## 💡 Dicas Profissionais

1. **Comece com capital pequeno** (qty: 0.01) para testar
2. **Monitore RSI**: Evite sinais em zonas extremas (< 30 ou > 70)
3. **Use trailing stop** para proteger lucros
4. **Diversifique**: Não opere apenas 1 símbolo
5. **Revise logs semanalmente** para identificar padrões

---

🚀 **Sistema pronto para operar!** Configure o TradingView e comece a receber sinais automaticamente.
