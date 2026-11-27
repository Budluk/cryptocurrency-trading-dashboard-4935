# Roadmap

## Concluído em 27/11/2026
- [x] PR #1 mergeado (`da99e44`); releases `v1.0.0`, `v1.0.1`, `v1.0.2` e `v1.0.3`.
- [x] Autenticação/RLS, 5 migrations aplicadas, Edge Functions deployadas e segredos configurados.
- [x] Aba Pesquisa (somente leitura): tabelas, agente dentro de `ai-market-analysis` e UI com URLs, anexos e ficha estruturada.
- [x] Bloqueios 401/403 da Pesquisa testados; pesquisa real validada por API e pela interface com sessão admin temporária (removida depois). Nenhuma ordem foi executada.
- [x] CI com 7 checks bloqueantes, 7/7 verdes; gitleaks com allowlist dos commits antigos já revogados.
- [x] Chat flutuante validado na UI com URL do repositório: fontes citadas, ficha e persistência no histórico.
- [x] Chat normal com **confirmação explícita** (token HMAC assinado pelo servidor, 5 min) antes de abrir/fechar/ajustar ordens e **modo simulação** (`dry_run`) sem ordens nem escritas. Gates reaplicados na confirmação.
- [x] CI 7/7 verde em `785fa65` (correção do check Deno com `npm ci`); `bybit-trading` redeployada pela aba **Code** (HTTP 201) e smoke test `chat_send`/`dry_run:true` validado em produção: 200, contagens inalteradas e nenhuma ordem.
- [x] `npm audit` sem vulnerabilidades de produção: `react-router-dom` atualizado para `^7.18.7` e `audit:ci` endurecido para `--audit-level=moderate`; typecheck, testes, lint e build verdes.
- [x] Multi-exchange no mesmo `bybit-trading` (sem nova função): Binance, OKX, Bitget, KuCoin e Gate.io em simulação por padrão, com assinantes REST, roteador, token HMAC para ordens reais e opt-in por exchange.
- [x] B3 rodando junto com a Bybit como canal somente de sinais: contratos vigentes `WINZ26`/`WDOZ26`, webhook existente com segredo `B3_WEBHOOK_SECRET`, migration versionada e painel read-only. Nenhuma ordem B3 é enviada.
- [x] Deploy da fase B3/multi-exchange em 27/11/2026: migration aplicada, segredo configurado, `bybit-trading`/`tradingview-webhook` redeployadas pela aba **Code** e CI 7/7 verde em `d40417e`. Smoke tests: 7 venues, `dry_run` sem ordem e webhook com 401 para assinatura inválida/ausente.
- [x] Correção do build de produção: os helpers CJS do Rollup foram isolados em `vendor-helpers`, eliminando o ciclo `react-vendor → charts → react-vendor` que impedia a renderização (`Cannot access 'P' before initialization`). Validado no `vite preview` e no preview do Lovable após o push: painel carrega sem erros no console. CI 7/7 verde em `8853184`.

## Concluído em 28/11/2026
- [x] Rollover B3 por vigência: `b3_contracts` com `WINZ26`/`WDOZ26`, `WDOF27` (desde 02/12) e `WINF27` (desde 17/12); `WINZ25`/`WDOF26` continuam rejeitados. Migration `20261128120000` aplicada e versão registrada.
- [x] Saúde dos provedores de IA: `aiRouter` com no máximo 1 retry em 429/5xx, `Retry-After` com teto curto e circuit breaker exposto pela action `ai_status` (sem chaves, URLs ou segredos). O painel de Observabilidade passou a mostrar o provedor ativo.
- [x] Orçamento de risco no servidor: `-2%`/dia, 5 posições e 20 trades/dia em `autonomousRisk.ts`; `exchangeGateway` exige `riskState` e falha fechada antes de qualquer ordem real. Migration `20261128130000` aplicada, com trigger em `agent_trades` e limpeza de telemetria 30/90 dias.
- [x] Observabilidade proativa: workflow `Daily Smoke` cobre 7 venues, `place_order` em `dry_run`, `ai_status`, webhook B3 sem assinatura (401) e assinada com `confidence:75`, erros de aplicação em 24 h e limpeza controlada. Runbook em `docs/secrets-runbook.md`.
- [x] E2E + acessibilidade: 5 testes Playwright (console, B3/venues, `dry_run`, viewport 390 px e `axe` sem violações críticas/graves) e novo job `test-e2e` no CI, que passa a ter 8 checks bloqueantes.
- [x] Simplificação visual: cabeçalho e resumo enxutos, detalhes secundários recolhidos em `<details>`, rótulos acessíveis e alvos mobile maiores; o robô permanece montado entre abas (`forceMount`).
- [x] Validação local em 28/11: typecheck, `lint:ci` (116 avisos/0 erros), Vitest (20), Bun (132), build, `audit:ci` (0 vulnerabilidades), `deno check` das 3 funções bloqueantes, YAML dos workflows e Playwright (5/5) — todos verdes.
- [x] Migrations aplicadas pelo SQL Editor com versões registradas e functions `bybit-trading`, `tradingview-webhook` e `ai-market-analysis` redeployadas pela aba **Code** com o conteúdo local colado no editor (HTTP 201). Nenhum segredo foi impresso, nenhum PAT foi criado e nenhuma ordem real foi executada.
- [x] CI 8/8 verde no run `46076354002` (`98ef4fa`); `Daily Smoke` verde no run `46077182693`: 7 venues, `dry_run`, `ai_status` sem segredos, webhook B3 sem assinatura 401, 0 erros em 24 h e limpeza com 0 linhas. O primeiro disparo do smoke falhou porque um deploy anterior da aba **Code** ainda continha o código antigo; após colar os arquivos locais no editor e publicar novamente, o smoke passou.

## Simplificação visual (concluída em 28/11/2026)
- [x] Organizar navegação, saldo e posições; separar controles do robô e recolher detalhes extras
- [x] Conferir navegação e aparência no celular e computador: preview em largura desktop e em iframe de 390 px (sem overflow horizontal, abas e painel B3/corretores visíveis, zero erros no console)
- [ ] Exclusões definitivas de funções — aguardando indicação do usuário

## Validações que dependem do usuário
- [x] Decisão do usuário em 27/11/2026: manter apenas simulação. O `dry_run` foi validado, mas nenhuma ordem real foi autorizada ou executada; o flag `BINANCE_ENABLE_LIVE` permanece desligado.
- [ ] Release `v1.0.4`: não criada. Será publicada somente com aprovação explícita após o push e o CI 8/8 verde.
- [x] Release `v1.0.3` publicada em 27/11/2026 com sua aprovação, apontando para `89839e2` (inclui `c757b15`, `785fa65`, `a471a5d`, `2564baf`, `d40417e`, `ae1c80d` e `8853184`)
- [x] Painel de Observabilidade conferido: sem erros de aplicação nas últimas 24 h (o único `ERROR` foi o comando manual de registro da migration, já corrigido)
- [ ] Alertas de "senhas vazadas" — exigem plano Pro do Supabase

## Pendências externas/opcionais
- [ ] FreeLLMAPI sem endereço público (Cloudflare Tunnel pendente); o roteador já usa Groq/OpenAI/Lovable
- [ ] Créditos na OpenAI/Lovable para reduzir a dependência do free tier do Groq
- [ ] `B3_WEBHOOK_SECRET` no GitHub Actions é opcional: sem ele o `Daily Smoke` pula apenas o teste com assinatura válida
- [ ] `ai_status` exige o JWT da própria função (`verify_jwt = true`); chamada pública não foi habilitada
