# 🔥 Configuração Bybit - Conta Real

## ⚠️ IMPORTANTE: Este sistema opera com DINHEIRO REAL

Antes de ativar o Multi-Asset Trader, siga estas etapas:

## 1️⃣ Criar Conta Bybit (se não tiver)

1. Acesse: https://www.bybit.com/
2. Registre-se e complete KYC (verificação de identidade)
3. Faça depósito mínimo (recomendado: $50-100 para operar com $9)

## 2️⃣ Criar API Keys (Conta Real)

### Passo a Passo:

1. **Acesse Bybit**: https://www.bybit.com/
2. **Vá para API Management**:
   - Clique no seu perfil (canto superior direito)
   - Selecione "API"
   - Clique "Create New Key"

3. **Configure as Permissões**:
   - ✅ **Trading** (obrigatório)
   - ✅ **Position** (obrigatório)
   - ✅ **Wallet** (para consultar saldo)
   - ❌ **Withdrawal** (NÃO marcar por segurança)

4. **Configurações de Segurança**:
   - Nome da API: `SmartFlow_Trading`
   - IP Restriction: Deixe em branco (ou adicione IP fixo)
   - 2FA: Digite código de autenticação

5. **Copie as Chaves**:
   ```
   API Key: [sua_api_key_aqui]
   API Secret: [sua_api_secret_aqui]
   ```
   ⚠️ **GUARDE EM LOCAL SEGURO - APARECE APENAS UMA VEZ!**

## 3️⃣ Adicionar Chaves ao Supabase

### Via Supabase Dashboard:

1. Acesse: https://supabase.com/dashboard/project/uohdpxkfgxmtlosnmspf/settings/functions
2. Vá para "Edge Functions" → "Secrets"
3. Adicione os seguintes secrets:

```bash
BYBIT_API_KEY = [sua_api_key_real]
BYBIT_API_SECRET = [sua_api_secret_real]
```

### Via CLI (alternativo):

```bash
# Instalar Supabase CLI
npm install -g supabase

# Login
supabase login

# Adicionar secrets
supabase secrets set BYBIT_API_KEY="sua_api_key_aqui"
supabase secrets set BYBIT_API_SECRET="sua_api_secret_aqui"
```

## 4️⃣ Testar Conexão

1. No app, vá para o componente **BybitModeToggle**
2. Alterne para modo **REAL** (switch à direita)
3. Clique em **"Testar Conexão"**
4. Verifique se aparece:
   - ✅ Status: Conectado
   - ✅ Saldo exibido
   - ✅ Número de trades históricos

## 5️⃣ Configurar Alavancagem na Bybit

1. Acesse Bybit → Trading → Derivatives
2. Selecione um par (ex: BTCUSDT)
3. Configure alavancagem máxima:
   - Isolated: 20x (recomendado)
   - Cross: Depende do risco

## 6️⃣ Ativar Multi-Asset Trader

### Checklist Antes de Iniciar:

- [ ] API Keys configuradas no Supabase
- [ ] Conexão testada com sucesso
- [ ] Saldo visível no app
- [ ] Modo **REAL** selecionado (não Testnet)
- [ ] Alavancagem configurada na Bybit

> Estado em 27/11/2026: os três primeiros itens foram validados (credenciais HMAC
> v2 configuradas, conexão testada e saldo/posições reais visíveis no painel, sem
> enviar ordens). Os dois últimos dependem da configuração da sua conta Bybit e
> não foram alterados por esta entrega.

### Como Usar:

1. Vá para aba **"Auto Trader"**
2. Localize **"Multi-Asset Trader 24/7"**
3. Verifique:
   - Badge: **⚡ REAL** (não 🧪 TESTNET)
   - Bankroll: $9.00 (ou valor disponível)
   - Alavancagem: 15x (ajusta automaticamente)
4. Clique **"Iniciar Trader 24/7"**

## 📊 Como Funciona

### Ciclo de Operação (a cada 3 minutos):

1. **Busca**: 100 ativos da Bybit
2. **Filtra**: Ativos com volume > $5M e volatilidade > 2%
3. **Analisa**: 20 melhores ativos
4. **Seleciona**: 15% dos ativos com critérios atingidos
5. **Executa**: Ordem Market com SL/TP automáticos

### Estratégia de Entrada:

```
✅ Entra se:
- Volume 24h > $5 milhões
- Variação de preço > 2% (volatilidade)
- Probabilidade aleatória: 15%

📈 Tamanho da posição:
- Capital < $15: 5% por trade
- Capital ≥ $15: 3% por trade

🎯 Stop Loss: 1.5 x ATR
🎯 Take Profit: 3 x ATR

⚡ Alavancagem dinâmica:
- < $5: 20x
- $5-10: 15x
- $10-20: 10x
- $20-50: 8x
- > $50: 5x
```

## ⚠️ Riscos e Avisos

### Riscos Principais:
1. **Liquidação**: Alavancagem alta pode liquidar rapidamente
2. **Slippage**: Preço de execução pode variar
3. **Volatilidade**: Movimentos bruscos em criptomoedas
4. **Fees**: Custos de trading (maker/taker)
5. **Gap**: Mercado pode abrir com gap de preço

### Proteções Implementadas:
- ✅ Stop Loss automático
- ✅ Take Profit definido
- ✅ Limite de saldo mínimo ($2)
- ✅ Diversificação entre ativos
- ✅ Cooldown entre operações
- ✅ Alavancagem dinâmica

### Recomendações:
1. **Comece pequeno**: Teste com $50-100
2. **Monitore**: Primeiros dias acompanhe ativamente
3. **Ajuste**: Baseado em resultados
4. **Stop Loss**: Defina limite de perda diário
5. **Lucro**: Retire parte dos ganhos regularmente

## 🛑 Como Parar

1. Clique **"Parar Trader"**
2. Feche posições abertas manualmente (se necessário):
   - Bybit → Trading → Positions
   - Close All Positions
3. Verifique P&L final no app

## 📱 Monitoramento

### No App:
- 💰 Bankroll atual
- 📊 P&L total e %
- ⚡ Alavancagem ativa
- 📈 Trades executados
- 🔄 Ciclos completos

### Na Bybit:
- https://www.bybit.com/app/trade/
- Trading History
- Open Positions
- Account Balance

## 🆘 Suporte

### Problemas Comuns:

**1. "Erro ao conectar"**
- Verifique API Keys no Supabase
- Confirme permissões da API
- Tente recriar as chaves

**2. "Saldo não aparece"**
- Certifique-se que depositou na conta
- Transfira para "Derivatives Account"
- Aguarde alguns minutos

**3. "Ordens não executam"**
- Verifique saldo suficiente
- Confirme alavancagem na Bybit
- Veja logs da Edge Function

**4. "Liquidação"**
- Reduza alavancagem
- Aumente capital inicial
- Use stop loss mais conservador

### Logs de Debug:
- Edge Function Logs: https://supabase.com/dashboard/project/uohdpxkfgxmtlosnmspf/functions/bybit-trading/logs
- Trader Logs: Tabela `auto_trader_logs` no Supabase

## 📚 Recursos Úteis

- Bybit API Docs: https://bybit-exchange.github.io/docs/v5/intro
- Bybit Trading Guide: https://learn.bybit.com/
- Leverage Calculator: https://www.bybit.com/en-US/help-center/

---

**⚠️ DISCLAIMER**: Trading de criptomoedas com alavancagem envolve risco significativo. Você pode perder mais do que seu investimento inicial. Este sistema é para fins educacionais. Não constitui conselho financeiro. Use por sua própria conta e risco.
