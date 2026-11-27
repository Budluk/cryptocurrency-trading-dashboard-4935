# Checklist de Deploy e Atualização do PR #1

Repositório: `https://github.com/Budluk/cryptocurrency-trading-dashboard-4935.git`
Branch: `feat/ai-gateway-security-ci` (último commit local: `74077f8`)
Projeto Supabase: **`uohdpxkfgxmtlosnmspf`** (definido em `supabase/config.toml`)

> ⚠️ Este documento é um **guia para você executar**. Nenhum push nem deploy foi feito.
> Execute na raiz do repositório e em ordem.

---

## Pré-requisitos

```powershell
# 1) Ferramentas
supabase --version        # Supabase CLI instalada (se não: winget install supabase.cli)
supabase login            # se ainda não estiver autenticado
node --version            # Node 20+
bun --version             # usado apenas nos testes de edge functions (opcional local)

# 2) Link do projeto (se ainda não feito)
supabase link --project-ref uohdpxkfgxmtlosnmspf

# 3) Estado do git — deve estar limpo antes de qualquer coisa
git status
git log --oneline -5
```

Chaves que você vai usar nos testes (já estão no `.env`, que é versionado e só contém chaves **públicas**):

```powershell
Select-Content .env   # contém apenas VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY / VITE_SUPABASE_PROJECT_ID
```

---

## Etapa 1 — Revogar o token GitHub vazado e criar um novo (PAT ou SSH)

### 1.1 Revogar o token comprometido (faça primeiro, antes de qualquer push)

1. Token classic: <https://github.com/settings/tokens> → clique no token expirado → **Delete**.
2. Token fine-grained: <https://github.com/settings/personal-access-tokens> → **Revoke**.
3. Se for token de GitHub App/OAuth: <https://github.com/settings/apps/authorizations> → **Revoke**.
4. Segredos do Actions (se o token estiver lá): <https://github.com/Budluk/cryptocurrency-trading-dashboard-4935/settings/secrets/actions> → remover/atualizar.

### 1.2 Auditoria do que o token antigo alcançou

- <https://github.com/settings/security-log> — filtre por `token`, `git` e `ssh`; procure repositórios criados, chaves adicionadas e webhooks novos.
- <https://github.com/settings/keys> — remova chaves SSH que você não reconheça.
- `Settings → Deploy keys` de cada repositório afetado — remova as desconhecidas.
- `Settings → Webhooks` — remova webhooks suspeitos.
- Se o token antigo tinha escopo em **outros** repositórios, verifique os commits recentes deles (`git log --since="2 weeks ago"`) em busca de alterações não esperadas.

### 1.3 Verificação local (já executada neste repo — refaça quando quiser)

```powershell
git log --all -S "ghp_"      --oneline   # deve retornar vazio
git log --all -S "github_pat_" --oneline  # deve retornar vazio
Select-String -Path .env -Pattern "ghp_|github_pat_"
```

> Confirmado neste repositório: **não há token no histórico do git nem no `.env`** (o `.env` só tem chaves `VITE_*` públicas). Mesmo assim, rotacione o token — ele foi exposto fora do repositório.

### 1.4 Criar o novo PAT (recomendado: fine-grained, escopo mínimo)

<https://github.com/settings/personal-access-tokens/new>

| Campo | Valor |
|---|---|
| Repository access | Only select repositories → `Budluk/cryptocurrency-trading-dashboard-4935` |
| Contents | Read and write |
| Pull requests | Read and write |
| Metadata | Read (obrigatório) |
| Workflows | Read and write (**só** se for alterar arquivos de `.github/workflows/`) |
| Expiration | 30–90 dias |

Guarda o valor **sem versionar** — só na sessão do terminal ou em cofre de senhas:

```powershell
# Uso pontual na sessão atual (o valor não vai para nenhum arquivo)
$env:GH_TOKEN = "ghp_..."        # para a CLI do GitHub, se você instalar o gh
# ou, se preferir SSH (não expõe token nenhum):
# ssh-keygen -t ed25519 -C "lucas@desktop"
# ssh-add "$env:USERPROFILE\.ssh\id_ed25519"
# # publique a chave pública em https://github.com/settings/keys
# git remote set-url origin git@github.com:Budluk/cryptocurrency-trading-dashboard-4935.git
```

**Nunca** cole o token em `.env`, em commits, em issues ou no corpo do PR.

---

## Etapa 2 — Aplicar as migrations pendentes (Supabase CLI)

### 2.1 Conferir o que está pendente

```powershell
supabase migration list --project-ref uohdpxkfgxmtlosnmspf
```

Confira que estas **três** aparecem como pendentes e anote se há alguma outra:

| # | Arquivo | Conteúdo |
|---|---|---|
| 1 | `supabase/migrations/20261127000000_fix_rls_policies.sql` | Substitui políticas `USING (true)`/"Allow anonymous access" por políticas por usuário em `risk_management_settings`, `ml_adaptive_config`, `portfolio_rebalance_config`, `demo_accounts`, `demo_positions`, `auto_trader_config`, `auto_trader_positions`, `auto_trader_logs`, `ai_learning_data`, `ai_decisions` + GRANTs. |
| 2 | `supabase/migrations/20261127010000_agent_autonomous_memory.sql` | Memória do agente autônomo: `agent_state`, `agent_trades`, `prompt_versions`, `agent_routine_log` (todas com RLS por usuário + service role). |
| 3 | `supabase/migrations/20261127020000_bot_errors_observability.sql` | Tabela `bot_errors` (DDL reprodutível) + índices + RLS, usada pelo painel de Observabilidade. |

### 2.2 Aplicar na ordem exata

**Opção A — recomendada (a CLI aplica na ordem lexicográfica, que é a ordem correta):**

```powershell
supabase db push --project-ref uohdpxkfgxmtlosnmspf
```

**Opção B — aplicar uma a uma (mais controle; usa a connection string do Dashboard → Settings → Database):**

```powershell
$DB_URL = "postgresql://postgres:SENHA@db.uohdpxkfgxmtlosnmspf.supabase.co:5432/postgres"

psql $DB_URL -f supabase/migrations/20261127000000_fix_rls_policies.sql
psql $DB_URL -f supabase/migrations/20261127010000_agent_autonomous_memory.sql
psql $DB_URL -f supabase/migrations/20261127020000_bot_errors_observability.sql
```

> Todas usam `DROP POLICY IF EXISTS` / `CREATE TABLE IF NOT EXISTS` → são seguras para reaplicar.

### 2.3 Verificação pós-aplicação

```powershell
supabase migration list --project-ref uohdpxkfgxmtlosnmspf   # as três devem estar "Applied"
```

No SQL Editor do Dashboard:

```sql
select count(*) from public.bot_errors;          -- tabela existe (pode ser 0)
select count(*) from public.agent_state;
select policyname from pg_policies where tablename = 'auto_trader_config';
-- não deve restar nenhuma política "Allow anonymous access"
```

### 2.4 Outras migrations pendentes (b3_*)

**Verificado:** não existe **nenhum** arquivo de migration `b3_*` no repositório nem no histórico do Git:

```powershell
Get-ChildItem -Recurse -Filter "*b3*.sql"          # nenhum arquivo de migration (só hashes de nomes antigos)
git log --all -S "b3_ticks" -- "*.sql"            # vazio
```

As únicas referências estão em `.lovable/plan.md` (`b3_ticks`, `b3_signals`, `b3_analysis`) e em `roadmap.md`:

> `- [ ] B3 (WINZ25/WDOF26) não operacional — migração b3_* nunca aplicada`

Portanto:

- **Não há o que aplicar do repositório.** A migração b3_* é uma **pendência conhecida/opcional**: só faça deploy da aba B3 se você recuperar esse SQL (fora do versionamento) e quiser reativar o B3.
- Se existir, aplique **depois** das três da etapa 2.2, seguindo a ordem dos nomes de arquivo.
- Nenhuma outra migration nova foi criada neste branch; as demais do diretório já foram aplicadas em execuções anteriores (confirme pelo `migration list`).

---

## Etapa 3 — Deploy das Edge Functions

> Execute **na raiz do repositório** para que a CLI use o `supabase/config.toml` (que define `verify_jwt` por função).

```powershell
supabase functions deploy bybit-trading       --project-ref uohdpxkfgxmtlosnmspf
supabase functions deploy tradingview-webhook --project-ref uohdpxkfgxmtlosnmspf
supabase functions deploy ai-market-analysis  --project-ref uohdpxkfgxmtlosnmspf
supabase functions deploy ai-signal-gateway   --project-ref uohdpxkfgxmtlosnmspf
```

Confirmar:

```powershell
supabase functions list --project-ref uohdpxkfgxmtlosnmspf
```

Detalhes de `verify_jwt` (importante para os testes):

| Function | verify_jwt | Observação |
|---|---|---|
| `bybit-trading` | `true` | exige `Authorization: Bearer <anon key>` |
| `ai-market-analysis` | `true` | exige `Authorization`; recebe as actions `research*`, `agent_loop`, `agent_daily` |
| `tradingview-webhook` | `false` | autentica por assinatura HMAC (`X-TradingView-Signature`) |
| `ai-signal-gateway` | `false` | interno, rate limit 60 req/min |

A pasta `supabase/functions/_shared/` **não é deployada à parte** — é empacotada junto em cada função.
Se você mexeu em qualquer outra função (`ml-adaptive-learning`, `ai-comprehensive-analysis`, `market-intelligence`, `sentiment-analysis`, `ai-trading-intelligence`, `order-flow-analysis`, `portfolio-rebalancer`, `ml-auto-corrector`), redesploye também.

---

## Etapa 4 — Secrets necessários

```powershell
supabase secrets list --project-ref uohdpxkfgxmtlosnmspf      # conferir o que já existe
```

### 4.1 Quais são automáticas (não precisa setar)

- `SUPABASE_URL`, `SUPABASE_ANON_KEY` — injetadas pela plataforma.
- `SUPABASE_SERVICE_ROLE_KEY` — **gerenciada pelo Supabase**; só aparece em `secrets list` se algo a tiver sobrescrito. Se estiver ausente, **não** invente um valor: ela é exibida no Dashboard → Settings → API → `service_role` secret.

### 4.2 Quais você precisa definir/atualizar

```powershell
supabase secrets set `
  "BYBIT_API_KEY=SUA_CHAVE" `
  "BYBIT_API_SECRET=SEU_SEGREDO" `
  "TRADINGVIEW_WEBHOOK_SECRET=UM_SEGREDO_NOVO_ALEATORIO" `
  "PERPLEXITY_API_KEY=..." `
  "FREELLMAPI_URL=https://seu-servidor" `
  "FREELLMAPI_KEY=..." `
  "FREELLMAPI_MODEL=auto" `
  "GROQ_API_KEY=..." `
  "OPENAI_API_KEY=..." `
  "LOVABLE_API_KEY=..." `
  "GITHUB_TOKEN=ghp_NOVO_TOKEN_DA_ETAPA_1" `
  --project-ref uohdpxkfgxmtlosnmspf
```

| Secret | Onde é usado | Obrigatório? |
|---|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | praticamente todas as functions | automático (plataforma) |
| `BYBIT_API_KEY` / `BYBIT_API_SECRET` | `bybit-trading` (HMAC-SHA256 v2), `ml-adaptive-learning`, `ml-auto-corrector`, `ai-comprehensive-analysis` | sim, para ordens/saldo |
| `TRADINGVIEW_WEBHOOK_SECRET` | `tradingview-webhook` | **sim — sem ela a função responde 503** |
| `PERPLEXITY_API_KEY` | `aiRouter.webSearchFetch` (busca web) + notícias em `ai-market-analysis` + `market-intelligence` | sim, para pesquisa web |
| `FREELLMAPI_URL` / `FREELLMAPI_KEY` / `FREELLMAPI_MODEL` | 1º provedor do `aiRouter` (`model` default `auto`) | URL só se o FreeLLMAPI estiver exposto publicamente (ver pendências) |
| `GROQ_API_KEY` (+ `GROQ_MODEL`, default `llama-3.3-70b-versatile`) | 2º provedor do `aiRouter` | recomendado |
| `OPENAI_API_KEY` (+ `OPENAI_MODEL`, default `gpt-4o-mini`) | 3º provedor do `aiRouter` | opcional |
| `LOVABLE_API_KEY` | fallback final do `aiRouter`, chat (`google/gemini-3.8-flash`), `ai-market-analysis`, `ai-comprehensive-analysis`, `ai-trading-intelligence`, `ml-auto-corrector` | **sim — sem ela o chat não responde** |
| `GITHUB_TOKEN` | `researchAgent` e `tradingChat` (API do GitHub) | recomendado; sem token o limite é 60 req/h |

> Segredos com espaços ou `=` no valor precisam de aspas (PowerShell: use aspas duplas, como acima).
> Depois de setar: `supabase secrets list --project-ref uohdpxkfgxmtlosnmspf` para conferir.

---

## Etapa 4b — Agendador do agente (GitHub Actions)

O workflow `.github/workflows/agent-loop.yml` roda `agent_loop` a cada 5 min e `agent_daily` às 00:00 UTC. Configure no repositório:

- `Settings → Secrets and variables → Actions → Variables`: `SUPABASE_URL = https://uohdpxkfgxmtlosnmspf.supabase.co`
- `Settings → Secrets and variables → Actions → Secrets`: `SUPABASE_SERVICE_ROLE_KEY = <service_role do Dashboard → Settings → API>`

Depois, dispare manualmente em `Actions → Agent Loop → Run workflow` com `agent_loop` e confirme em `ai_decisions`/`agent_routine_log`. Use `agent_daily` com `force: true` apenas para teste fora da janela.

O gateway pode ser desligado no frontend com `VITE_USE_SIGNAL_GATEWAY=false` (padrão: ligado, usado como veto).

---

## Etapa 5 — Smoke tests

Variáveis base (PowerShell):

```powershell
$PROJECT = "uohdpxkfgxmtlosnmspf"
$URL     = "https://$PROJECT.supabase.co"
$ANON    = "<valor de VITE_SUPABASE_PUBLISHABLE_KEY do .env>"
```

### 5.1 Chat (`bybit-trading`)

```powershell
# a) Status da API/IA (é o mesmo botão "Testar chave" do painel de Observabilidade)
curl.exe -s -X POST "$URL/functions/v1/bybit-trading" `
  -H "Authorization: Bearer $ANON" -H "apikey: $ANON" -H "Content-Type: application/json" `
  -d '{\"action\":\"chat_api_status\"}'
# esperado: JSON com ok/conf (se vier "IA indisponível" -> falta LOVABLE_API_KEY/GROQ/FREELLMAPI)

# b) Envio de mensagem (usa IA + ferramentas; pode demorar ~30s)
curl.exe -s -X POST "$URL/functions/v1/bybit-trading" `
  -H "Authorization: Bearer $ANON" -H "apikey: $ANON" -H "Content-Type: application/json" `
  -d '{\"action\":\"chat_send\",\"message\":\"Qual e o BTC agora? faca uma busca web\"}'
# esperado: resposta de texto + linha nova em trading_chat_messages

# c) Histórico
curl.exe -s -X POST "$URL/functions/v1/bybit-trading" `
  -H "Authorization: Bearer $ANON" -H "apikey: $ANON" -H "Content-Type: application/json" `
  -d '{\"action\":\"chat_history\"}'
```

Na aplicação: abrir a aba de chat, mandar uma pergunta que force `web_search`/`github_repo`/`youtube_transcript` e confirmar a resposta.

### 5.2 Webhook da TradingView (`tradingview-webhook`)

Sem assinatura → deve dar 401; sem secret → 503:

```powershell
curl.exe -s -o NUL -w "%{http_code}" -X POST "$URL/functions/v1/tradingview-webhook" `
  -H "Content-Type: application/json" -d '{}'
# esperado: 401 (sem X-TradingView-Signature)
```

Com assinatura válida (HMAC-SHA256 do corpo, em base64):

```powershell
$body   = '{\"action\":\"buy\",\"symbol\":\"BTCUSDT\",\"price\":95000,\"confidence\":75,\"qty\":0.01,\"rsi\":45,\"atr\":500,\"ema_fast\":94000,\"ema_slow\":93000}'
$secret = "<TRADINGVIEW_WEBHOOK_SECRET>"
$hmac   = New-Object System.Security.Cryptography.HMACSHA256([Text.Encoding]::UTF8.GetBytes($secret))
$sig    = [Convert]::ToBase64String($hmac.ComputeHash([Text.Encoding]::UTF8.GetBytes($body)))

curl.exe -s -X POST "$URL/functions/v1/tradingview-webhook" `
  -H "Content-Type: application/json" -H "X-TradingView-Signature: $sig" -d $body
# esperado: 200 -> {"status":"ignored","reason":"low_confidence"|"duplicate"|"strategy_filter"|"risk_gate"}
#           ou {"status":"success",...} se passar em todos os gates
```

> 🚨 **Segurança do teste:** `confidence: 75` fica **abaixo** do mínimo (80) → sinal ignorado, ideal para validar só a assinatura.
> Nunca suba `confidence >= 80` em teste: a função roda `isTestnet: false` (**conta real**) e pode **executar uma ordem** se os gates passarem.
> Para testar o rate limit: 31ª requisição no mesmo minuto → `429` (limite 30/min).

### 5.3 Observabilidade

```powershell
# a) Tabela bot_errors via REST (valida RLS + migration 3)
curl.exe -s "$URL/rest/v1/bot_errors?select=id,error_type,error_message,resolved,created_at&order=created_at.desc&limit=10" `
  -H "apikey: $ANON" -H "Authorization: Bearer $ANON"
# esperado: 200 com array (pode ser [])

# b) Loop do agente (valida memória + auditoria; precisa do token de usuário/anon)
curl.exe -s -X POST "$URL/functions/v1/ai-market-analysis" `
  -H "Authorization: Bearer $ANON" -H "apikey: $ANON" -H "Content-Type: application/json" `
  -d '{\"action\":\"agent_loop\",\"options\":{\"symbols\":[\"BTCUSDT\"]}}'
# esperado: JSON com results; linhas novas em ai_decisions e agent_routine_log
```

Na aplicação: abrir o painel **Observabilidade** → as 4 consultas (`bot_errors`, `auto_trader_logs`, `ai_decisions`, `audit_log`) devem carregar sem erro → clicar em **"Testar chave"** (chama `chat_api_status`) → esperar `chave válida`.

### 5.4 Gateway de sinais (`ai-signal-gateway`)

```powershell
curl.exe -s -X POST "$URL/functions/v1/ai-signal-gateway" `
  -H "Content-Type: application/json" `
  -d '{\"symbol\":\"BTCUSDT\",\"timeframe\":\"1h\",\"sources\":[\"market\"],\"minConfidence\":70,\"requireConsensus\":false}'
# esperado: JSON com finalAction, finalConfidence, sourcesUsed, consensus, gatePass
# 429 = rate limit atingido (60 req/min)
```

### 5.5 Testes locais / CI

```powershell
npm ci --legacy-peer-deps
npm run lint                 # pode reportar dívida pré-existente (não bloqueia a CI)
npm run typecheck            # tsc --noEmit -p tsconfig.app.json  (deve passar)
npm run test:coverage        # Vitest (setup em src/test/setup.tsx)

cd supabase\functions\_shared
bun test rateLimit.test.ts aiRouter.test.ts autonomousRisk.test.ts autonomousAgent.test.ts indicators.test.ts agentLoop.test.ts
cd ..\bybit-trading
bun test hmacSignature.test.ts
cd ..\..\..
```

---

## Etapa 6 — Atualizar o PR #1 (sem fazer agora; execute quando estiver pronto)

O branch local tem commits que **não estão no remote** e as histories **divergiram** (o remote tem 3 commits com os mesmos assuntos, SHAs diferentes). Confira antes de empurrar:

```powershell
git log --oneline origin/feat/ai-gateway-security-ci..HEAD   # o que falta publicar
git log --oneline HEAD..origin/feat/ai-gateway-security-ci   # o que existe só no remote
```

```powershell
# 1) commitar o material novo (docs/) — ainda não feito
git add docs/deploy-checklist.md docs/pr-description.md
git commit -m "docs: checklist de deploy e corpo do PR"

# 2) push — como as histories divergiram, será preciso:
git push --force-with-lease origin feat/ai-gateway-security-ci
#    (confirme antes que nada valioso existe só no remote: git diff HEAD origin/feat/ai-gateway-security-ci)

# 3) atualizar o corpo do PR #1 com o texto do docs/pr-description.md
#    Opção A (CLI do GitHub):
gh pr edit 1 --repo Budluk/cryptocurrency-trading-dashboard-4935 --body-file docs/pr-description.md
#    Opção B: colar o conteúdo de docs/pr-description.md na descrição na UI do GitHub.

# 4) acompanhar a CI do PR (6 jobs) até ficar verde
```

---

## Etapa 7 — Pós-deploy e rollback

- [ ] `supabase migration list` → 3 migrations "Applied".
- [ ] `supabase functions list` → 4 functions "Loaded"/deployadas.
- [ ] Smoke tests 5.1–5.4 verdes.
- [ ] CI do PR verde (6 jobs: lint/typecheck, vitest, edge tests, build, audit, edge check).
- [ ] Painel Observabilidade sem erros.

Rollbacks:

- **Function:** `git checkout <sha-do-commit-bom>` e redesploy da função afetada com o mesmo comando da Etapa 3.
- **Migration:** a CLI não desfaz sozinha — por isso, antes do `db push` faça um dump de segurança:
  `supabase db dump --project-ref uohdpxkfgxmtlosnmspf -f backup_antes_do_deploy.sql`
  e tenha em mãos o SQL inverso (as 3 migrations são aditivas; na dúvida, recriar política anterior).
- **Secrets:** `supabase secrets set <KEY>=<valor-antigo> --project-ref ...` (nenhum segredo foi apagado).

---

## Pendências conhecidas (não são bloqueadores do deploy)

1. **B3 (WINZ25/WDOF26) não operacional** — migração `b3_*` nunca aplicada e **não existe no repositório** (só em `.lovable/plan.md`/`roadmap.md`). Opcional.
2. **FreeLLMAPI sem endereço público** — pendente Cloudflare Tunnel (`FREELLMAPI_URL`); sem ela o roteador cai para Groq/OpenAI/Lovable.
3. **Dívida de lint** (~150 erros em `MultiAssetTrader`/hooks) — CI roda ESLint com `continue-on-error` para não bloquear o PR.
4. **`npm audit`** roda com `continue-on-error` até o PR de upgrade de dependências.
5. **Chat com IA real (Groq)** ainda precisa de teste em produção com as chaves novas.
6. **Plano Pro do Supabase** segue pendente (itens de "senhas vazadas" já corrigidos).
