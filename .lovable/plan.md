## Objetivo

Substituir a fonte de dados cripto/Bybit por WINZ25 e WDOF26 (B3), usando **TradingView webhooks** como única fonte de cotação/sinal. Manter intactos: ML, gates de qualidade, auditoria por trade, presets de risco (conservador/equilibrado/agressivo), sistema de notificações.

Modo: **somente sinais** (sem execução em corretora). O bot exibe recomendações; você opera manualmente no Profit/corretora.

---

## Arquitetura

```text
TradingView (alertas Pine Script M1 + M5)
        │  POST JSON  (HMAC opcional)
        ▼
Edge Function: tv-b3-webhook
        │  insere tick + dispara análise
        ▼
Tabelas: b3_ticks, b3_signals, b3_analysis
        │  realtime
        ▼
Frontend: B3Trader (novo) reaproveita
  - useTradingCalculations (SL/TP)
  - gateAudit + GateAuditTable
  - qualityRiskConfig + presets
  - AdvancedAISignals (ML)
  - useWebNotifications
```

---

## Mudanças

### 1. Backend (Supabase)

**Migração SQL** — cria:
- `b3_ticks` (symbol, price, volume, tf, ts) — histórico de ticks recebidos do TV
- `b3_signals` (symbol, tf, action BUY/SELL, price, ema9, ema21, vwap, rsi, atr, ts) — sinais brutos
- `b3_analysis` (symbol, quality, confidence, score, sl, tp, trailing, leverage_suggested, gate_pass, gate_blocked_by, applied_preset, ts) — decisão final do bot
- RLS: leitura/escrita anônima (mesmo padrão dos ai_learning_data já existentes)
- GRANTs para anon/authenticated/service_role
- Índices por symbol+ts DESC
- Publica em `supabase_realtime`

**Edge Function `tv-b3-webhook`** (nova):
- Recebe POST do TradingView
- Valida HMAC via `TRADINGVIEW_WEBHOOK_SECRET` (já existe nos secrets)
- Insere tick + sinal
- Roda pipeline: gates → ML lookup → decisão → grava `b3_analysis`
- Reutiliza `gateAudit` server-side (portado pra Deno)

### 2. Frontend

**Novos arquivos:**
- `src/components/B3Trader.tsx` — dashboard principal WIN/WDO (substitui MultiAssetTrader na rota `/`)
- `src/components/B3SignalCard.tsx` — card por ativo mostrando último sinal, quality, confiança, SL/TP sugeridos
- `src/components/B3WebhookInstructions.tsx` — mostra URL do webhook + Pine Script pronto pra copiar
- `src/hooks/useB3Realtime.ts` — subscribe em `b3_analysis` via Supabase realtime

**Reaproveitados sem mudança:**
- `qualityRiskConfig.ts`, `gateAudit.ts`, `useTradingCalculations`
- `GateAuditTable`, `GateDiagnosticsPanel`, `RiskPresetSelector`, `RiskPresetEditor`
- `AdvancedAISignals` (adaptado para ler `b3_signals`)
- `useWebNotifications` (dispara ao entrar novo APPROVED)

**Removidos da rota principal** (não deletados do repo, só desligados do UI):
- MultiAssetTrader, OrderFlowDashboard, componentes Bybit
- MiniCharts cripto → substituídos por widget TradingView de WIN/WDO

**Constantes:**
- `B3_SYMBOLS = ['WINZ25', 'WDOF26']`
- `B3_TIMEFRAMES = { entry: '1', confirm: '5' }`

### 3. TradingView (você configura uma vez)

Vou entregar Pine Script pronto para colar no TV com alerta que dispara em cada fechamento de candle M1 e M5 e envia:

```json
{
  "secret": "SEU_TRADINGVIEW_WEBHOOK_SECRET",
  "symbol": "{{ticker}}",
  "tf": "{{interval}}",
  "action": "{{strategy.order.action}}",
  "price": {{close}},
  "ema9": {{plot("EMA9")}},
  "ema21": {{plot("EMA21")}},
  "vwap": {{plot("VWAP")}},
  "rsi": {{plot("RSI")}},
  "atr": {{plot("ATR")}},
  "ts": "{{timenow}}"
}
```

URL do webhook: `https://uohdpxkfgxmtlosnmspf.supabase.co/functions/v1/tv-b3-webhook`

---

## Detalhes técnicos

- **Ticker**: WINZ25 (mini índice, venc. dez/25) e WDOF26 (mini dólar, venc. jan/26). Quando rolar, você edita a constante `B3_SYMBOLS` — vou marcar com comentário `// TODO rolagem`.
- **ML**: continua treinando com histórico de `b3_analysis` (win/loss inferido pelo próximo tick vs SL/TP simulado, já que não há execução real). O `ai_learning_data` recebe novos registros com `market: 'B3'`.
- **Gates**: mesmos gates de M1/M5, confiança, score, Fear&Greed é ignorado (não aplica em índice/dólar BR); em vez disso adiciono gate de **horário de pregão B3** (09h-17h55 BRT) e gate de **eventos macro BR** via `PERPLEXITY_API_KEY` (já existe).
- **Presets de risco**: SL/TP em pontos de WIN (1pt=R$0,20) e WDO (1pt=R$10). Multiplicadores atuais viram base; vou adaptar unidades em `qualityRiskConfig`.
- **Notificações**: dispara quando `b3_analysis.gate_pass=true` com quality Premium/High.
- **Sem execução**: sem chamada Bybit em lugar nenhum. Bot é read-only + análise.

---

## Escopo fora deste plano

- Rolagem automática de contratos (você troca símbolo manualmente na virada de vencimento).
- Integração com corretora BR (Profit/MT5) — pediu sinais apenas.
- Backfill histórico de WIN/WDO (TV free não expõe API de histórico gratuita; ML começa a treinar do zero conforme ticks chegam).

Se aprovar, implemento em uma passada: migração + edge function + frontend novo + Pine Script pronto.