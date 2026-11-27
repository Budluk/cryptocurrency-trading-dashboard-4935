# AI signal gateway, segurança, CI e agente autônomo

Este PR leva o dashboard de "protótipo com IA solta" para um fluxo auditável: uma IA centralizada, pesquisa com fontes, gates de risco antes de qualquer ordem, memória persistente, observabilidade e testes no CI.

## Segurança e governança

- Row Level Security corrigido em tabelas que estavam abertas (`risk_management_settings`, `ml_adaptive_config`, `demo_accounts`, `auto_trader_*`, `ai_learning_data`, `ai_decisions`) com políticas por `auth.uid()` + GRANTs explícitos.
- Token GitHub vazado precisa ser revogado fora do repositório antes de qualquer push (o histórico do git e o `.env` não contêm tokens).
- Busca web centralizada em `aiRouter.webSearchFetch`: hosts privados bloqueados, conteúdo externo tratado como dado, nunca como instrução, com citação de fontes.
- Assinatura HMAC-SHA256 v2 da Bybit mantida em helper isolado e testada para GET e POST; o frontend nunca assina requisições nem usa chaves RSA automáticas.

## Chat com IA e pesquisa

- Tools de web/GitHub/YouTube/artigos/código via `researchAgent` e `tradingChat`, roteadas por `action: research*` dentro de `ai-market-analysis` (sem nova Edge Function, conforme `AGENTS.md`).
- Roteador único `aiRouter`: FreeLLMAPI (com tool calling preservado) → Groq → OpenAI → Lovable, com circuit breaker, rate limit e fallback.
- Novas tools: `get_indicators`, `agent_status`, `agent_record_result`, `daily_review`. `execute_order` passou a gravar trades abertos e a atualizar memória no fechamento.
- O chat normal agora exige **confirmação explícita** antes de `execute_order`/`execute_close`/`execute_set_stop`: token HMAC assinado pelo servidor (5 min, uso único), argumentos exatos e gates reaplicados na confirmação. O botão **Cancelar** registra a ação como cancelada, sem ordem.
- Novo **modo simulação** (`dry_run`): nenhuma ordem é enviada e nada é gravado em `trading_chat_messages`, `agent_state`, `agent_trades` ou `agent_routine_log`. Útil para validar o chat sem risco.

## Agente autônomo

- `autonomousRisk.ts`: risco 0,5% da banca, alavancagem 3x–6x (teto absoluto 8x), stop ATR máx. 0,5%, kill switch após 3 perdas ou -2% diário (pausa de 3h), blacklist por stops/win rate, RVOL mínimo 1.5 e horários UTC bloqueados 0h/13h/21h.
- `indicators.ts`: ATR, RSI, ADX, VWAP, EMA, Bollinger e RVOL calculados em código; o LLM recebe números, nunca inventa indicadores.
- `autonomousAgent.ts` + migration `agent_state`, `agent_trades`, `prompt_versions`, `agent_routine_log`: gate de entradas, aplicação de resultados e rotina diária.
- `agentLoop.ts` + `.github/workflows/agent-loop.yml`: `agent_loop` a cada 5 minutos e `agent_daily` às 00:00 UTC, server-side, sem depender de aba aberta. O loop **nunca executa ordens**; ele grava `ai_decisions` e `agent_routine_log` para auditoria.
- Os mesmos gates valem no chat e no webhook da TradingView. `ai-signal-gateway` agora usa kill switch/blacklist/horário central, limita alavancagem a 3x–6x e atua como veto no `MultiAssetTrader`.
- Unificação de risco no frontend: `src/config/riskLimits.ts` espelha o `RISK` do backend; stops de 2% e alavancagens fora da faixa foram removidos dos fallbacks.

## Observabilidade

- Aba **Observar** com erros (`bot_errors`), logs do robô (`auto_trader_logs`), decisões IA (`ai_decisions`) e auditoria (`audit_log`).
- Migration `20261127020000_bot_errors_observability.sql` cria a tabela que antes só existia no schema gerado, com índices e RLS.

## CI e testes

- 7 checks bloqueantes: typecheck, Vitest, testes Bun das Edge Functions, build, `npm run lint:ci` (orçamento de warnings) e `npm run audit:ci` (high/critical). O check do Deno é bloqueante para `bybit-trading` e `ai-market-analysis`; as demais funções com erros legados seguem informativas.
- Lint: 0 erros, 116 warnings dentro do orçamento. Audit: 0 high/critical, restam 2 `moderate` em `react-router`.
- Cobertura Vitest ~87%; testes Bun do agente, indicadores, risco, roteador de IA, HMAC, parsing do loop, contexto de pesquisa e confirmação do chat incluídos.

## Deploy

Ver `docs/deploy-checklist.md`: migrations, deploy de functions, secrets, smoke tests e agendamento.

## Estado das pendências antigas

1. [x] Token GitHub vazado e PATs temporários revogados; nenhum segredo impresso.
2. [x] 5 migrations aplicadas e 4 Edge Functions publicadas no projeto `uohdpxkfgxmtlosnmspf`.
3. [ ] Reconciliação automática de saídas por stop/TP fora do chat (win rate e blacklist dependem disso).
4. [ ] B3 (`WINZ25`/`WDOF26`) permanece não operacional; não há migration `b3_*` no repositório.
5. [x] Tipos do Supabase regenerados com as tabelas `agent_*` e `strategy_leads`.
6. [ ] Chat normal com IA real em produção — a confirmação e o modo simulação já existem; o modo Pesquisa foi validado por API e UI em 27/11/2026.
