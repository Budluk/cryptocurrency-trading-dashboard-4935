# Inventário das Edge Functions (27/11/2026)

Escopo: `supabase/functions/`. Leitura somente: **nenhuma função foi removida, renomeada ou desativada**. `_shared/` é biblioteca interna (27 arquivos, sem `index.ts` e sem entrada em `config.toml`), não é uma função deployável.

## 1. Funções deployáveis

Há **12 diretórios** com `index.ts` executável. Onze estão declarados em `supabase/config.toml`; `ml-auto-corrector` é chamada pelo frontend mas **não** tem entrada no arquivo de configuração.

| Função | `verify_jwt` | Chamadores ativos encontrados | Situação |
|---|---|---|---|
| `ai-market-analysis` | `true` | UI (`AdvancedAISignals`, `ResearchTab`, `TradingChat`, `ObservabilityPanel`), gateway, `agent-loop.yml`, `Daily Smoke` | Ativa; centraliza `research*` e `ai_status` |
| `bybit-trading` | `true` | `invokeBybit`, `invokeExchange`, hooks/componentes de trading, webhook B3, smoke, E2E | Ativa; roteador Bybit + multi-exchange + `exchange_risk_status` |
| `tradingview-webhook` | `false` | Pine script, `TRADINGVIEW_SETUP.md`, `Daily Smoke`, migrations | Ativa; valida HMAC (TradingView/B3) |
| `ai-signal-gateway` | `false` | `useSignalGateway`, funções de IA/ML internas | Ativa; grava `ai_decisions` |
| `ai-comprehensive-analysis` | `false` | `useSignalAnalysis`, `useComprehensiveAI`, gateway | Ativa |
| `ai-trading-intelligence` | `false` | `useAITradingIntelligence`, gateway | Ativa |
| `market-intelligence` | `false` | `useMarketIntelligence` | Ativa (algumas actions sem chamada externa, ver §2) |
| `ml-adaptive-learning` | `false` | `useAutoMLSync`, `useContinuousMLTraining`, `MLAdaptiveSettings`, `MultiAssetTrader`, gateway | Ativa |
| `ml-auto-corrector` | **sem entrada** | `useMLAutoCorrector`, `MultiAssetTrader` | Ativa em código; falta declarar em `config.toml` |
| `order-flow-analysis` | `true` | `OrderFlowDashboard` (WebSocket) | Ativa; conferir envio do JWT na conexão WS |
| `portfolio-rebalancer` | `true` | `PortfolioRebalancer` | Ativa |
| `sentiment-analysis` | `true` | `SentimentDashboard` | Ativa; dados ainda simulados |

## 2. Superfície sem chamada ativa local

Isso **não** significa código morto: clientes externos/manuais e testes podem consumir essas actions. Nenhuma exclusão foi feita ou recomendada sem indicação explícita.

- `market-intelligence`: `analyze_symbol_news` (sem chamador em absoluto); `get_market_events` e `get_whale_alerts` só são chamados por `refreshAllIntelligence`, que não é disparado pela UI atual.
- `ai-trading-intelligence`: action externa `get_realtime_news` sem chamador (a lógica interna continua ativa via `comprehensive_ai_analysis`/`get_trading_signal`); callbacks `analyzeWhales`/`analyzeSentiment` existem, mas não têm call site.
- `bybit-trading`: `get_order_history`, `get_execution_list` e `exchange_propose`/`exchange_balance`/`exchange_positions`/`exchange_ticker`/`exchange_instruments` (as duas últimas fazem parte do fluxo assinado e da suíte de testes). `exchange_list`, `exchange_risk_status` e `place_order` (`dry_run:true`) são ativas.
- Helpers de frontend sem consumidor: `useComprehensiveAI`, `clearGatewayCache`, `getOptimizedParameters`, `getCorrectedParams`, `getAutoMLRecommendations`.

## 3. Riscos de integridade observados (somente registro)

1. `ml-auto-corrector` ausente em `config.toml`: o comportamento de `verify_jwt` fica implícito, embora a função use `BYBIT_API_KEY`/`BYBIT_API_SECRET`.
2. Contrato `predict` divergente: `ai-signal-gateway` envia `{ action: 'predict', … }`, mas `ml-adaptive-learning` não tem `switch` de ação e sua resposta não contém `prediction`; o consenso ML não entra hoje.
3. Assinatura Bybit duplicada em `ml-auto-corrector/index.ts`, fora do helper testado `bybit-trading/hmacSignature.ts`.
4. Chamadas de IA diretas (Perplexity/Lovable) fora de `_shared/aiRouter.ts` em alguns arquivos, contrariando a regra de centralização de provedores do `AGENTS.md`.
5. `order-flow-analysis` com `verify_jwt = true` enquanto o frontend abre WebSocket sem cabeçalho explícito de autorização.
6. `sentiment-analysis` ainda retorna sentimento simulado; é um insumo qualitativo, não uma ordem.
7. `ml-adaptive-learning` e `ml-auto-corrector` gravam a mesma `ml_adaptive_config` com `onConflict: 'user_id'`; a ordem de execução importa.

## 4. Conformidade verificada

- Research agent: `supabase/functions/_shared/researchAgent.ts`, roteado por `action.startsWith('research')` em `ai-market-analysis`; sem imports de exchange/chaves.
- HMAC Bybit: helper `hmacSignature.ts` com testes de GET/POST executados no CI.
- Robô entre abas: `src/pages/Index.tsx` mantém `forceMount` com painéis inativos ocultos.
- Nenhum segredo foi lido ou impresso durante o inventário.

## 5. Decisão

Nenhuma função foi apagada. Limpeza/consolidação futura depende de indicação explícita do usuário. Os itens de maior prioridade para uma próxima rodada são (1) declarar `ml-auto-corrector` no `config.toml`, (2) alinhar o contrato `predict` e (3) centralizar as chamadas de IA no `aiRouter`.
