# Roadmap

## Concluído em 27/11/2026
- [x] PR #1 mergeado (`da99e44`); releases `v1.0.0`, `v1.0.1` e `v1.0.2`.
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
- [x] Correção do build de produção: os helpers CJS do Rollup foram isolados em `vendor-helpers`, eliminando o ciclo `react-vendor → charts → react-vendor` que impedia a renderização (`Cannot access 'P' before initialization`). Build local servido via `vite preview`: painel carrega sem erros no console.

## Simplificação visual (pendente)
- [ ] Organizar navegação, saldo e posições; separar controles do robô e recolher detalhes extras
- [ ] Conferir navegação e aparência no celular e computador
- [ ] Exclusões definitivas de funções — aguardando indicação do usuário

## Validações que dependem do usuário
- [ ] Chat de trading normal com ordem real — o `dry_run` já foi validado; autorizar uma ordem real só depois de conferir a proposta assinada e dar confirmação explícita
- [ ] Release `v1.0.3` para `c757b15`/`785fa65`/`a471a5d`/`2564baf`/`d40417e` — criar somente com sua aprovação
- [ ] Painel de Observabilidade sem erros após acompanhamento pós-deploy
- [ ] Alertas de "senhas vazadas" — exigem plano Pro do Supabase

## Pendências externas/opcionais
- [ ] FreeLLMAPI sem endereço público (Cloudflare Tunnel pendente); o roteador já usa Groq/OpenAI/Lovable
- [ ] Créditos na OpenAI/Lovable para reduzir a dependência do free tier do Groq
