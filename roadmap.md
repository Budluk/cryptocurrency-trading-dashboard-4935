# Roadmap

## Concluído em 27/11/2026
- [x] PR #1 mergeado (`da99e44`); releases `v1.0.0`, `v1.0.1` e `v1.0.2`.
- [x] Autenticação/RLS, 5 migrations aplicadas, Edge Functions deployadas e segredos configurados.
- [x] Aba Pesquisa (somente leitura): tabelas, agente dentro de `ai-market-analysis` e UI com URLs, anexos e ficha estruturada.
- [x] Bloqueios 401/403 da Pesquisa testados; pesquisa real validada por API e pela interface com sessão admin temporária (removida depois). Nenhuma ordem foi executada.
- [x] CI com 7 checks bloqueantes, 7/7 verdes; gitleaks com allowlist dos commits antigos já revogados.
- [x] Chat flutuante validado na UI com URL do repositório: fontes citadas, ficha e persistência no histórico.
- [x] Chat normal com **confirmação explícita** (token HMAC assinado pelo servidor, 5 min) antes de abrir/fechar/ajustar ordens e **modo simulação** (`dry_run`) sem ordens nem escritas. Gates reaplicados na confirmação.

## Simplificação visual (pendente)
- [ ] Organizar navegação, saldo e posições; separar controles do robô e recolher detalhes extras
- [ ] Conferir navegação e aparência no celular e computador
- [ ] Exclusões definitivas de funções — aguardando indicação do usuário

## Validações que dependem do usuário
- [ ] Chat de trading normal com IA real — começar pelo modo simulação (já disponível) e só autorizar uma ordem real depois de conferir a proposta
- [ ] Painel de Observabilidade sem erros após acompanhamento pós-deploy
- [ ] Alertas de "senhas vazadas" — exigem plano Pro do Supabase

## Pendências externas/opcionais
- [ ] B3 (`WINZ25`/`WDOF26`) não operacional — SQL `b3_*` nunca foi versionado; permanece intocado
- [ ] FreeLLMAPI sem endereço público (Cloudflare Tunnel pendente); o roteador já usa Groq/OpenAI/Lovable
- [ ] Créditos na OpenAI/Lovable para reduzir a dependência do free tier do Groq
