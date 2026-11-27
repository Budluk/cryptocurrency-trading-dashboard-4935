# Checklist de Deploy e Atualização do PR #1

Repositório: `https://github.com/Budluk/cryptocurrency-trading-dashboard-4935.git`
Branch: `feat/ai-gateway-security-ci` (commit da feature: `dba32ad`; correções seguintes também publicadas)
Projeto Supabase: **`uohdpxkfgxmtlosnmspf`** (definido em `supabase/config.toml`)

> ✅ Em 27/11/2026 foram aplicadas as **5 migrations**, publicadas as **4 functions** deste PR,
> ativados os **Anonymous Sign-Ins** (com correção da trigger de `demo_accounts`) e configurados
> a variável e o segredo do `agent-loop`. Os comandos abaixo permanecem como registro
> reprodutível; não precisa repeti-los. A migration B3/multi-exchange foi aplicada em 27/11/2026 (ver 2.4).
>
> ✅ Em 27/11/2026, após os commits `c757b15` e `785fa65`, a CI tornou-se 7/7 verde e
> a `bybit-trading` foi redeployada pela aba **Code** do Dashboard (HTTP 201). O smoke
> teste de `chat_send` com `dry_run: true` retornou HTTP 200 sem ordens nem escritas
> (detalhes em 5.1c). Nenhum PAT foi criado e nenhum segredo foi impresso.
>
> ✅ Em 27/11/2026, após o commit `d40417e`, a CI tornou-se 7/7 verde; a migration
> B3/multi-exchange foi aplicada, `B3_WEBHOOK_SECRET` configurado e as functions
> `bybit-trading` e `tradingview-webhook` redeployadas pela aba **Code**. Smoke tests:
> `exchange_list` (7 venues), `place_order` com `dry_run:true` (`simulated:true`,
> `reason:"dry_run"`, nenhuma ordem) e webhook B3 sem/ com assinatura inválida (401).
> Nenhuma ordem real foi disparada e nenhum segredo foi impresso.
>
> ✅ Em 28/11/2026 foram aplicadas as migrations de rollover B3 e de
> risco/telemetria (versões `20261128120000` e `20261128130000`), e as functions
> `bybit-trading`, `tradingview-webhook` e `ai-market-analysis` publicadas pela
> aba **Code** com o conteúdo local colado no editor
> (`POST /functions/deploy?slug=…` → HTTP 201). O CI passou a ter
> **8 checks bloqueantes** com o job de E2E/acessibilidade. Validação local:
> typecheck, lint (0 erros/116 avisos), 20 Vitest, 132 Bun, 5 Playwright, build,
> audit (0), `deno check` das 3 funções e YAML dos workflows. CI 8/8 no run
> `46076354002` e `Daily Smoke` verde no run `46077182693`. Nenhuma ordem real
> foi executada, nenhum segredo foi impresso e nenhum PAT foi criado.
>
> 🔄 Em 27/11/2026, o lote seguinte preparou: alertas de falha por issue no GitHub
> (`ci.yml` e `smoke.yml`), upgrade de `actions/checkout@v6`,
> `actions/setup-node@v5`, `oven-sh/setup-bun@v2` e `actions/github-script@v8`,
> duas venues paper (`BYBIT_TESTNET`/`BINANCE_TESTNET`), o painel de simulação
> unificada, a action somente leitura `exchange_risk_status` e a aba **Risco** na
> Observabilidade. O inventário completo das 12 funções está em
> `docs/edge-functions-inventory.md` — nenhuma função foi excluída. Validação
> local verde: typecheck, lint (116 avisos/0 erros), 20 Vitest, 90 Bun no
> conjunto de risco/exchange + 3 Bun de HMAC, build, `deno check` de
> `bybit-trading` e YAML dos workflows. Push/CI/deploy deste lote ainda não
> foram concluídos neste ponto.
>
> ⚠️ O primeiro `Daily Smoke` falhou no passo `ai_status` porque um deploy feito
> apenas clicando em **Deploy updates** republicou o código antigo que já estava
> no editor do Dashboard. É obrigatório colar/carregar o conteúdo local dos
> arquivos alterados (inclusive os `_shared`) antes de confirmar o deploy.

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

### 1.1 Revogar o token comprometido

✅ **Já executado:** o token vazado foi revogado via API pública não autenticada
(`POST https://api.github.com/credentials/revoke` com `{"credentials":["ghp_…"]}` → HTTP 202).
Uma chamada de verificação a `/user` com esse token agora retorna **401**. O dono recebeu
a notificação padrão do GitHub. Não tente reativá-lo — revogação é irreversível.

Ainda vale conferir:

1. Segredos do Actions (se o token estiver lá): <https://github.com/Budluk/cryptocurrency-trading-dashboard-4935/settings/secrets/actions> → remover/atualizar.
2. O credencial local usada pelo push é um OAuth (`gho_`), distinta do token vazado; substitua-a apenas se a auditoria 1.2 apontar uso indevido.

### 1.2 Auditoria do que o token antigo alcançou

- <https://github.com/settings/security-log> — filtre por `token`, `git` e `ssh`; procure repositórios criados, chaves adicionadas e webhooks novos.
- <https://github.com/settings/keys> — remova chaves SSH que você não reconheça.
- `Settings → Deploy keys` de cada repositório afetado — remova as desconhecidas.
- `Settings → Webhooks` — remova webhooks suspeitos.
- Se o token antigo tinha escopo em **outros** repositórios, verifique os commits recentes deles (`git log --since="2 weeks ago"`) em busca de alterações não esperadas.

### 1.3 Verificação local (já executada neste repo — refaça quando quiser)

```powershell
git log --all -S "ghp_"      --oneline
git log --all -S "github_pat_" --oneline
Select-String -Path .env -Pattern "ghp_|github_pat_"
```

> O `.env` só tem chaves `VITE_*` públicas. O histórico antigo ainda contém o PAT
> revogado em `c4f9bea` e `dba32ad`; como o git é imutável, esses dois commits
> estão na allowlist do `.gitleaks.toml` (credencial confirmada como **401**).
>
> Falsos positivos conhecidos — chave **publishable/anon** do Supabase (pública
> por design) e fixtures de `x-api-key` em `rateLimit.test.ts` — estão listados
> por fingerprint em `.gitleaksignore`. O formato por fingerprint funciona até
> na versão 8.24.3 usada pelo Action; qualquer **novo** secret continua
> bloqueando o CI.

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

## Etapa 2 — Aplicar as migrations pendentes (✅ aplicadas em 27/11/2026)

### 2.1 Conferir o que está pendente

```powershell
supabase migration list --project-ref uohdpxkfgxmtlosnmspf
```

As cinco abaixo foram aplicadas via Management API (`POST /v1/projects/{ref}/database/migrations`)
com o nome do arquivo como `name`. O `version` retornado é o timestamp da aplicação, não o prefixo do arquivo:

| # | Arquivo | Conteúdo |
|---|---|---|
| 1 | `supabase/migrations/20261127000000_fix_rls_policies.sql` | Substitui políticas `USING (true)`/"Allow anonymous access" por políticas por usuário em `risk_management_settings`, `ml_adaptive_config`, `portfolio_rebalance_config`, `demo_accounts`, `demo_positions`, `auto_trader_config`, `auto_trader_positions`, `auto_trader_logs`, `ai_learning_data`, `ai_decisions` + GRANTs. |
| 2 | `supabase/migrations/20261127010000_agent_autonomous_memory.sql` | Memória do agente autônomo: `agent_state`, `agent_trades`, `prompt_versions`, `agent_routine_log` (todas com RLS por usuário + service role). |
| 3 | `supabase/migrations/20261127020000_bot_errors_observability.sql` | Tabela `bot_errors` (DDL reprodutível) + índices + RLS, usada pelo painel de Observabilidade. |
| 4 | `supabase/migrations/20261127030000_agent_trades_take_profit.sql` | Coluna `agent_trades.take_profit` + índice de posições abertas; permite reconciliar saídas por TP no loop e no webhook. |
| 5 | `supabase/migrations/20261127040000_fix_anonymous_signin_trigger.sql` | Torna `create_demo_account_for_user()` idempotente (`ON CONFLICT DO NOTHING`); sem isso a segunda trigger em `auth.users` estourava `demo_accounts_user_id_unique` e o `/auth/v1/signup` anônimo respondia 500. |

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
psql $DB_URL -f supabase/migrations/20261127030000_agent_trades_take_profit.sql
psql $DB_URL -f supabase/migrations/20261127040000_fix_anonymous_signin_trigger.sql
```

> Todas usam `DROP POLICY IF EXISTS` / `CREATE TABLE IF NOT EXISTS` / `ADD COLUMN IF NOT EXISTS`
> → são seguras para reaplicar.

> ✅ `Dashboard → Authentication → Providers → Anonymous Sign-Ins` já está **ativado** e
> `VITE_SUPABASE_ANONYMOUS_SIGNIN="true"` está no `.env`. As políticas passam a exigir
> `auth.uid() = user_id`; sem sessão anônima real o app usaria o ID fixo de fallback e
> **não conseguiria** gravar configurações. O frontend só chama `signInAnonymously()`
> quando o flag está ligado (`src/lib/anonymousUser.ts`). Configurações antigas gravadas
> sob o ID fixo ficam invisíveis para o usuário anônimo; faça a migração desses dados no
> SQL Editor, se necessário. Com o flag desligado, o app não tenta `/auth/v1/signup` e
> grava apenas localmente, sem 401/422 no console.

### 2.3 Verificação pós-aplicação

```powershell
supabase migration list --project-ref uohdpxkfgxmtlosnmspf   # conferir os 5 nomes abaixo no histórico
```

Nomes confirmados no remoto: `20261127000000_fix_rls_policies`,
`20261127010000_agent_autonomous_memory`, `20261127020000_bot_errors_observability`,
`20261127030000_agent_trades_take_profit` e `20261127040000_fix_anonymous_signin_trigger`.

Validação realizada em 27/11/2026: `POST /auth/v1/signup` (anon key) retornou **200** com
`is_anonymous: true`; o token resultante leu `ai_decisions` com **200**; as seis tabelas
do agente/observabilidade retornaram **200** via service role.

No SQL Editor do Dashboard:

```sql
select count(*) from public.bot_errors;          -- tabela existe (pode ser 0)
select count(*) from public.agent_state;
select policyname from pg_policies where tablename = 'auto_trader_config';
-- não deve restar nenhuma política "Allow anonymous access"
```

### 2.4 Migration B3 + multi-exchange (✅ aplicada em 27/11/2026)

Em 27/11/2026 foi versionada
`supabase/migrations/20261127120000_multi_exchange_b3.sql`. Ela cria
`b3_ticks`, `b3_signals`, `b3_analysis` e `exchange_simulations`, com RLS
(leitura autenticada; escrita por `service_role`) e índices por símbolo/data.
Contratos aceitos: **WINZ26** e **WDOZ26** — os antigos WINZ25/WDOF26 venceram
e são rejeitados por `CHECK`.

Foi aplicada **depois** das cinco migrations da etapa 2.2, pela aba **SQL Editor**
do Dashboard (sem PAT). Verificação: `b3_analysis`, `b3_signals`, `b3_ticks` e
`exchange_simulations` presentes em `public`, e a versão registrada em
`supabase_migrations.schema_migrations` (`20261127120000`).

O segredo `B3_WEBHOOK_SECRET` foi configurado em Edge Functions → Secrets e as
functions `bybit-trading`/`tradingview-webhook` foram redeployadas pela aba
**Code** (incluindo os arquivos `_shared` novos). As corretoras cripto entram em
simulação: para habilitar ordens reais é preciso configurar as credenciais e o
flag `<ID>_ENABLE_LIVE=true`, além do token HMAC de confirmação. Nomes em
`.env.example`.

### 2.5 Enviar sinal B3 (somente leitura)

`POST https://uohdpxkfgxmtlosnmspf.supabase.co/functions/v1/tradingview-webhook`

- Cabeçalho `X-B3-Signature`: HMAC-SHA256 do corpo em Base64, usando
  `B3_WEBHOOK_SECRET`. Também é aceito `X-TradingView-Signature` com o mesmo
  segredo.
- Corpo (exemplo sem valores reais de segredo):

```json
{
  "market": "B3",
  "symbol": "WINZ26",
  "action": "buy",
  "price": 130000,
  "confidence": 90,
  "qty": 1,
  "atr": 300,
  "rsi": 61,
  "stop_loss": 129350,
  "take_profit": 131950
}
```

O webhook grava `b3_ticks` + `b3_signals`, aplica pregão 09:00–17:50 BRT,
confiança mínima 80, stop máximo de 0,5% e deduplica em 5 s. Ele **nunca**
chama `place_order`. Contratos vencidos (WINZ25/WDOF26) são ignorados.

### 2.6 Rollover B3 e orçamento de risco (✅ aplicadas em 28/11/2026)

Duas migrations foram aplicadas pelo **SQL Editor** do Dashboard (sem PAT) e
registradas em `supabase_migrations.schema_migrations`:

| Arquivo | Conteúdo |
|---|---|
| `20261128120000_b3_contract_rollover.sql` | Cria `b3_contracts` com vigência por símbolo (`WINZ26` até 16/12, `WDOZ26` até 01/12, `WDOF27` desde 02/12, `WINF27` desde 17/12), remove os CHECKs antigos e valida por trigger em `b3_ticks`, `b3_signals` e `b3_analysis`. `WINZ25`/`WDOF26` continuam proibidos. |
| `20261128130000_risk_budget_and_retention.sql` | Cria `risk_budgets` por usuário (`-2%`/dia, 5 posições, 20 trades), trigger de bloqueio em `agent_trades` e `cleanup_old_telemetry(30,90)` executável somente por `service_role`. |

Verificação no SQL Editor: 4 contratos vigentes, 4 functions/triggers presentes
(`b3_assert_valid_contract_symbol`, `enforce_risk_budget_on_agent_trade`,
`cleanup_old_telemetry` e os triggers nas tabelas B3/agent_trades) e versões
`20261128120000`/`20261128130000` no histórico. Nenhuma linha de telemetria foi
apagada manualmente; a limpeza padrão respeita 30/90 dias.

---

## Etapa 3 — Deploy das Edge Functions (✅ aplicadas em 27/11/2026)

> Execute **na raiz do repositório** para que a CLI use o `supabase/config.toml` (que define `verify_jwt` por função).
> Versões anteriores confirmadas: `ai-market-analysis` v138, `ai-signal-gateway` v1,
> `bybit-trading` v164 e `tradingview-webhook` v124. Em 28/11/2026,
> `bybit-trading`, `tradingview-webhook` e `ai-market-analysis` foram atualizadas
> pela aba **Code** (HTTP 201); o Dashboard incrementa a versão automaticamente.

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

> Ao usar a aba **Code**, selecione cada arquivo alterado no editor, substitua o
> conteúdo pelo texto do repositório e só então clique em **Deploy updates**.
> Clicar diretamente no botão republica o que já estava hospedado — foi o que
> causou a primeira falha do `ai_status` no smoke de 28/11.

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
| `GROQ_API_KEY` (+ `GROQ_MODEL`, default `llama-3.3-70b-versatile`, **descontinuado**) | 2º provedor do `aiRouter`; use `openai/gpt-oss-120b` | recomendado |
| `OPENAI_API_KEY` (+ `OPENAI_MODEL`, default `gpt-4o-mini`) | 3º provedor do `aiRouter` | opcional |
| `LOVABLE_API_KEY` | fallback final do `aiRouter`, chat (`google/gemini-3.8-flash`), `ai-market-analysis`, `ai-comprehensive-analysis`, `ai-trading-intelligence`, `ml-auto-corrector` | **sim — sem ela o chat não responde** |
| `GITHUB_TOKEN` | `researchAgent` e `tradingChat` (API do GitHub) | recomendado; sem token o limite é 60 req/h |
| `B3_WEBHOOK_SECRET` | `tradingview-webhook` (HMAC do canal B3) | sim, para sinais B3; no Actions é opcional (smoke pula o teste assinado) |
| `<ID>_API_KEY` / `<ID>_API_SECRET` / `<ID>_API_PASSPHRASE` | roteador multi-exchange em `bybit-trading` | só se quiser ordens reais na venue; `BINANCE_ENABLE_LIVE` e equivalentes permanecem desligados |

> Segredos com espaços ou `=` no valor precisam de aspas (PowerShell: use aspas duplas, como acima).
> Procedimento de rotação sem expor valores: `docs/secrets-runbook.md`.
> Depois de setar: `supabase secrets list --project-ref uohdpxkfgxmtlosnmspf` para conferir.

---

## Etapa 4b — Agendador do agente (✅ configurado em 27/11/2026)

O workflow `.github/workflows/agent-loop.yml` roda `agent_loop` a cada 5 min e `agent_daily` às 00:00 UTC. Configuração confirmada no repositório:

- `Settings → Secrets and variables → Actions → Variables`: `SUPABASE_URL = https://uohdpxkfgxmtlosnmspf.supabase.co` ✅
- `Settings → Secrets and variables → Actions → Secrets`: `SUPABASE_SERVICE_ROLE_KEY` ✅ (valor não exibido aqui)

> O workflow lê `vars.SUPABASE_URL` (variável) e `secrets.SUPABASE_SERVICE_ROLE_KEY`.
> Também existe um secret `SUPABASE_URL` com o mesmo valor; ele é inofensivo e não é usado.

Não disparei `agent_loop`/`agent_daily` manualmente em modo real sem sua confirmação.
Quando quiser validar, use **dry-run**: `Actions → Agent Loop → Run workflow` com
`agent_loop`, `force = true` e **`dry_run = true`**. O payload enviado é
`{"action":"agent_loop","force":true,"dry_run":true}`; a resposta traz
`"dryRun": true` e `"writesSkipped": true`, e **não** cria linhas em
`ai_decisions`, `agent_routine_log`, `agent_state` ou `agent_trades`.

> O `dry_run` do workflow depende do `ai-market-analysis` publicado com o código
> mais recente. Se a resposta não trouxer `dryRun`, faça o redeploy da função
> antes de testar (o segredo temporário de deploy deve ser revogado logo após).
>
> **Validação em 27/11/2026:** após o redeploy da função v139, dois disparos com
> `dry_run=true` retornaram `dryRun/writesSkipped = true` para 3 símbolos e as
> contagens de `ai_decisions`, `agent_routine_log`, `agent_state` e
> `agent_trades` permaneceram em **0** (consultadas via SQL Editor antes e
> depois). O PAT temporário de deploy foi revogado no mesmo dia.
>
> Somente após o dry-run verde e com sua autorização explícita, dispare sem
> `dry_run` para produzir auditoria real. Use `agent_daily` com `force: true`
> apenas fora da janela 00:00–00:05 UTC.

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

### 5.1b Chat com leitura de links, vídeos, repositório e arquivos

No chat flutuante:

1. Clique no ícone 📖 (modo pesquisa) ou cole uma URL — o chat passa a chamar
   `ai-market-analysis` com `action: "research"` e `persist_chat: true`.
2. Clique no clipe 📎 e anexe até 5 arquivos de texto/código (`.md`, `.ts`, `.py`,
   `.sql`, `.json`, `.csv`, etc.). Binários são recusados no navegador.
3. Confira que a resposta termina com `Modo pesquisa: nenhuma ordem foi executada.`
   e com as fontes numeradas; a ficha JSON aparece em "Ver ficha estruturada".

```powershell
# Pesquisa direta (equivale ao modo pesquisa do chat; exige sessão com role admin)
curl.exe -s -X POST "$URL/functions/v1/ai-market-analysis" `
  -H "Authorization: Bearer <TOKEN_DA_SESSAO>" -H "apikey: $ANON" -H "Content-Type: application/json" `
  -d '{\"action\":\"research\",\"message\":\"Resuma a estratégia deste repo\",\"urls\":[\"https://github.com/Budluk/cryptocurrency-trading-dashboard-4935\"],\"persist_chat\":true}'
# esperado: {"reply":"...Fontes: [1] ...","ficha":{...},"research":true}
# 403 = usuário sem role admin; 429 = limite de 20 pesquisas/hora
```

> O agente de pesquisa **não importa Bybit, não lê chaves de exchange e não
> executa ordens**. Conteúdo externo (inclusive anexos) é tratado como dado.
> Sem `PERPLEXITY_API_KEY` a busca web fica indisponível; sem `GITHUB_TOKEN`
> a API do GitHub limita a 60 requisições/hora.
>
> **Validação em 27/11/2026:** autenticação/autorização, leitura de URLs, ficha
> estruturada, fontes e persistência no histórico foram confirmados em runtime.
> O modelo antigo `llama-3.3-70b-versatile` foi descontinuado no Groq; configurei
> `GROQ_MODEL=openai/gpt-oss-120b`, reduzi as fontes do prompt para 1.800
> caracteres e limitei a resposta a 1.600 tokens. `aiRouter` passou a expor o
> `429` do provedor somente quando o chamador pede (`exposeRetryable429`, uso
> exclusivo da pesquisa) e `researchAgent` repete uma vez após o `retry-after`
> (teto de 10 s); o fallback final do trading permanece inalterado. A função
> `ai-market-analysis` foi redeployada pela aba **Code** do Dashboard (HTTP 201,
> após a v141). O smoke test final com a URL deste repositório retornou HTTP
> 200, `research: true`, ficha válida, `Fontes: [1] ...` e
> `Modo pesquisa: nenhuma ordem foi executada.`; o SQL confirmou 2 mensagens e 1
> evento `research` em `audit_log`, com 0 leads e 0 ordens. O fallback Lovable
> segue sem créditos e a OpenAI sem quota; se ainda assim aparecer 429 por
> tokens/minuto do plano free, aguarde ~60 s (circuit breaker) e repita.
>
> O fluxo também foi validado na **interface** (Chrome headless apontando para o
> `npm run dev` local, com sessão admin temporária injetada): abrir o chat
> flutuante, ativar o botão de Pesquisa, enviar a URL do repositório e conferir
> o badge "Pesquisa", a resposta com `Fontes: [1] ...`, o aviso
> `Modo pesquisa: nenhuma ordem foi executada.` e o resumo "Ver ficha
> estruturada". A conta temporária e os arquivos de sessão foram removidos
> logo após o teste.

### 5.1c Chat normal: confirmação e simulação

- **Modo simulação:** botão de béquer no rodapé do chat (ou `dry_run: true` no
  `chat_send`). As ferramentas `execute_order`/`execute_close`/`execute_set_stop`
  apenas descrevem o que fariam; nenhuma ordem é enviada e nada é gravado em
  `trading_chat_messages`, `agent_state`, `agent_trades` ou `agent_routine_log`.
- **Modo real:** a IA devolve um pedido de confirmação com token HMAC assinado
  pela service role key (validade 5 min, argumentos exatos, uso único enquanto o
  histórico for mantido). O cartão "Aguardando" só executa depois de
  **Confirmar**; **Cancelar** chama `chat_cancel`. Kill switch, blacklist,
  horários, RVOL, stop e sizing são reaplicados no instante da confirmação.
  A proposta original muda de status e os botões desaparecem.

```powershell
# Simulação segura para validar sem ordens nem escritas
curl.exe -s -X POST "$URL/functions/v1/bybit-trading" `
  -H "Authorization: Bearer $ANON" -H "apikey: $ANON" -H "Content-Type: application/json" `
  -d '{\"action\":\"chat_send\",\"message\":\"Abra 0,01 BTCUSDT com stop de 0,4%\",\"dry_run\":true}'
# esperado: {"ok":true,"dryRun":true,"reply":"...","simulated":[{"summary":"COMPRA ...","simulated":true}]}
# conferir no SQL: contagens de trading_chat_messages/agent_* inalteradas e nenhuma ordem em get_order_history
```

> **Validação em 27/11/2026:** com o código de `c757b15` já em `main` e a CI 7/7
> verde em `785fa65` (o check estrito do Deno passou a instalar as dependências
> antes de rodar), a `bybit-trading` foi redeployada pela aba **Code** do
> Dashboard — `POST /functions/deploy?slug=bybit-trading` retornou **201**. O
> conteúdo publicado de `tradingChat.ts` e `autonomousPrompt.ts` foi comparado
> por hash com os arquivos do repositório (idênticos). O smoke test acima,
> enviado com `action:"chat_send"`, `dry_run:true` e mensagem de compra de
> BTCUSDT com stop ATR, retornou **200** com `{"ok":true,"dryRun":true,...}` e
> nenhuma ação simulada (`simulated: []`). No SQL Editor, as contagens antes e
> depois foram **26** mensagens, **0** `agent_state`, **0** `agent_trades` e
> **0** `agent_routine_log`. Os logs da função registraram apenas **uma** chamada
> `POST` na janela, sem `execute_order`. Nenhuma ordem real foi disparada e o B3
> (`WINZ25`/`WDOF26`) permanece intocado.

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

Na aplicação: abrir o painel **Observabilidade** → as consultas (`bot_errors`, `auto_trader_logs`, `ai_decisions`, `audit_log` e estado do agente) devem carregar sem erro → clicar em **"Testar chave"** (chama `chat_api_status`) → esperar `chave válida`. O painel também mostra o provedor de IA ativo, consultado pela action `ai_status`:

```powershell
curl.exe -s -X POST "$URL/functions/v1/ai-market-analysis" `
  -H "Authorization: Bearer $ANON" -H "apikey: $ANON" -H "Content-Type: application/json" `
  -d '{\"action\":\"ai_status\"}'
# esperado: {"success":true,"providers":[...],"fallbackConfigured":true}
# cada provider traz apenas name/model/configured/circuitOpen/failures/rateLimited
```

> `ai_status` não chama modelos e nunca devolve chaves, URLs ou segredos. A função
> mantém `verify_jwt = true`; use o token da sessão ou a anon key.

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
npm run lint:ci              # 0 erros e no máximo 116 avisos (orçamento atual)
npm run audit:ci             # bloqueia vulnerabilidades de produção moderate/high/critical (hoje: 0)
npm run typecheck            # tsc --noEmit -p tsconfig.app.json  (deve passar)
npm run test                 # Vitest (20 testes)
npm run build

# E2E e acessibilidade (o chamador inicia o preview):
npm run build
npm run preview -- --host 127.0.0.1 --port 4173   # em outro terminal
npm run test:e2e -- --workers=1                   # 5 testes Playwright

# Edge functions (Bun): inclui exchangeGateway/exchangeRegistry/exchangeAdapters/b3Signals
cd supabase\functions\_shared
bun test *.test.ts
cd ..\bybit-trading
bun test hmacSignature.test.ts
cd ..\..\..

# Checagem estrita das funções bloqueantes:
npx --yes deno@latest check supabase/functions/bybit-trading/index.ts supabase/functions/tradingview-webhook/index.ts supabase/functions/ai-market-analysis/index.ts
```

O CI de `main` tem **8 checks bloqueantes**: Lint & Typecheck, Vitest,
E2E/Acessibilidade, Bun, Build, Security Audit, gitleaks e Edge Functions Check.
O job `test-e2e` instala Chromium, sobe o `vite preview` e anexa o relatório do
Playwright como artifact.

### 5.6 Daily Smoke (produção, somente simulação)

`Actions → Daily Smoke → Run workflow` (também agenda todo dia às 09:00 BRT).
Usa `vars.SUPABASE_URL` e `secrets.SUPABASE_SERVICE_ROLE_KEY`; nunca imprime
valores de segredo e **não** executa ordens reais:

- `exchange_list`: espera 9 venues (7 anteriores + `BYBIT_TESTNET` e
  `BINANCE_TESTNET`, ambas `paper:true`/`simulationOnly:true`).
- `exchange_risk_status`: snapshot somente leitura (`limits`, `usage`, `budget`,
  `kill`, `blockedUtcHour`), sem chaves, flags de live ou URLs.
- `place_order`: `dry_run:true` → `simulated:true`, `reason:"dry_run"`.
- `ai_status`: lista configurada de provedores, sem chaves/URLs.
- Webhook B3 sem assinatura → 401; com `B3_WEBHOOK_SECRET` configurado no
  Actions, assinatura válida com `confidence:75` → `ignored` (abaixo do mínimo 80,
  portanto sem gravar sinal).
- `bot_errors` em 24 h (aviso, não falha) e `cleanup_old_telemetry(30,90)`.

> **Validação em 28/11/2026 (run `46077182693`):** sucesso — 7 venues
> (`B3 BINANCE BITGET BYBIT GATEIO KUCOIN OKX`), `place_order` simulado com
> `reason=dry_run`, `ai_status` com Groq/OpenAI configurados e nenhum segredo no
> resumo, webhook B3 sem assinatura respondendo 401, `bot_errors` 0 em 24 h e
> limpeza com 0 linhas removidas. O passo assinado foi pulado porque
> `B3_WEBHOOK_SECRET` não está configurado no Actions (opcional).
>
> **Atualização em 27/11/2026:** o smoke passou a exigir 9 venues e a validar
> `exchange_risk_status` sem segredos; o próximo `Run workflow` confirmará o
> novo contrato em produção. Além disso, falhas de `CI` e `Daily Smoke` abrem ou
> comentam uma issue `[Alerta] …` via `GITHUB_TOKEN` (sem webhook externo).

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

# 4) acompanhar a CI do PR (7 checks) até ficar verde
```

---

## Etapa 7 — Pós-deploy e rollback

- [x] `supabase migration list` → 5 migrations "Applied" (registradas via Management API; nomes em 2.3) + `20261127120000` (B3/multi-exchange, registrada manualmente após aplicação pelo SQL Editor).
- [x] Edge Functions deployadas: `bybit-trading`, `tradingview-webhook`, `ai-market-analysis` e `ai-signal-gateway`. `bybit-trading`, `tradingview-webhook` e `ai-market-analysis` foram redeployadas pela aba **Code** do Dashboard.
- [x] Smoke tests 5.1b (Pesquisa, por API e interface) e 5.1c (chat normal em `dry_run`, sem escritas nem ordens). Itens 5.1a, 5.2–5.4 seguem disponíveis para conferência futura.
- [x] CI verde em `785fa65` e novamente em `d40417e` — 7 checks bloqueantes (Build, Vitest, Bun, Lint/Typecheck, Audit, Edge Functions, gitleaks). O `c757b15` falhou apenas no check estrito do Deno por falta de `node_modules`; corrigido com `npm ci` no workflow.
- [x] Smoke tests multi-exchange/B3: `exchange_list` com 7 venues, `place_order` em `dry_run` sem ordem real e webhook B3 com 401 para assinatura ausente/inválida (segredo configurado). Nenhuma escrita de auditoria em modo simulação.
- [x] Build de produção corrigido: `manualChunks` agora isola os helpers CJS do Rollup em `vendor-helpers` e mantém `decimal.js` fora de `charts`, removendo o ciclo que causava `Cannot access 'P' before initialization` no preview. Validado com `vite preview` (sem erros no console e painel B3/corretores renderizado). O preview gerenciado pelo Lovable atualizou-se sozinho após o push (`8853184`) e passou a servir os novos chunks sem erros no console.
- [x] Observabilidade (24 h): único `ERROR` no Postgres veio do comando manual de registro da migration (`column "applied_at" does not exist`), corrigido em seguida; não há erros de aplicação. API Gateway 0,02%, Auth 0,04%.
- [x] Release `v1.0.3` publicada no GitHub com aprovação explícita, apontando para `89839e2`: https://github.com/Budluk/cryptocurrency-trading-dashboard-4935/releases/tag/v1.0.3
- [x] Revisão responsiva: preview em desktop e em iframe com viewport de 390 px — sem rolagem horizontal, navegação e painel B3/corretores renderizados, nenhum erro no console.
- [x] Decisão do usuário: manter somente simulação. Nenhuma ordem real foi autorizada/executada e `BINANCE_ENABLE_LIVE` continua desligado.
- [x] Melhorias de 28/11: rollover B3, saúde dos provedores de IA, risco no servidor, telemetria com retenção, E2E/acessibilidade, simplificação visual e runbook de segredos. Migrations aplicadas, 3 functions redeployadas pela aba **Code** e validação local verde (inclui Playwright 5/5 e Bun 132).
- [x] CI 8/8 verde no run `46076354002` (`98ef4fa`): Lint & Typecheck, Vitest, E2E/Acessibilidade, Bun, Build, Audit, gitleaks e Edge Functions Check.
- [x] `Daily Smoke` de produção verde no run `46077182693` (detalhes em 5.6). Nenhuma ordem real foi enviada.
- [x] Release `v1.0.4` publicada em 28/11/2026 com aprovação explícita, apontando para `aaa87f9`: https://github.com/Budluk/cryptocurrency-trading-dashboard-4935/releases/tag/v1.0.4
- [ ] Painel Observabilidade sem erros (acompanhar nas próximas horas após o deploy).
- [ ] Lote de 27/11: commit/push dos workflows (alertas + upgrades), das testnets paper, do `exchange_risk_status`, do painel **Risco** e da documentação; deploys pela aba **Code**; CI 8/8 e `Daily Smoke` com 9 venues/risk_status verde; `B3_WEBHOOK_SECRET` digitado pelo usuário no form do Actions. Nenhuma release nova sem aprovação explícita.

Rollbacks:

- **Function:** `git checkout <sha-do-commit-bom>` e redesploy da função afetada com o mesmo comando da Etapa 3.
- **Migration:** a CLI não desfaz sozinha — por isso, antes do `db push` faça um dump de segurança:
  `supabase db dump --project-ref uohdpxkfgxmtlosnmspf -f backup_antes_do_deploy.sql`
  e tenha em mãos o SQL inverso (as 5 migrations são aditivas; na dúvida, recriar política anterior).
- **Secrets:** `supabase secrets set <KEY>=<valor-antigo> --project-ref ...` (nenhum segredo foi apagado).

---

## Pendências conhecidas (não são bloqueadores do deploy)

1. **B3/multi-exchange em produção, mas somente sinais/simulação** — migration aplicada, segredo configurado e functions redeployadas. Não há ordens reais para B3 (corretoras brasileiras não expõem API pública de ordens para pessoa física neste projeto); as demais venues exigem opt-in + credenciais + token HMAC.
2. **FreeLLMAPI sem endereço público** — pendente Cloudflare Tunnel (`FREELLMAPI_URL`); sem ela o roteador cai para Groq/OpenAI/Lovable.
3. **Dívida de lint** — 116 warnings em `MultiAssetTrader`/hooks, 0 erros. O CI roda `npm run lint:ci` com orçamento de warnings; não é mais `continue-on-error`.
4. **`npm audit` — resolvido em 27/11/2026.** `react-router-dom` subiu de `^6.26.2` para `^7.18.7` (com `react-router@7.18.7`), corrigindo os 2 avisos `moderate` (open redirect e desserialização de erro em SSR). `npm run audit:ci` agora usa `--audit-level=moderate` e reporta **0 vulnerabilidades**; typecheck, 20 testes Vitest, lint (0 erros/116 avisos) e build passaram com a v7. O uso de rotas no app é apenas declarativo (`BrowserRouter`/`Routes`/`Route`/`Navigate`/`Outlet`), preservado na v7.
5. **Chat normal com IA real** — o modo Pesquisa foi validado e o `dry_run` do chat comum passou em produção (seção 5.1c), sem ordens nem escritas. A confirmação de ordens reais segue sem teste em produção: só execute com sua autorização explícita, conferindo a proposta assinada antes de Confirmar. A `bybit-trading` já foi redeployada pela aba **Code**.
6. **Plano Pro do Supabase** — necessário apenas para os alertas de "senhas vazadas".
7. **Conta admin permanente** — a validação na UI usou sessão temporária; a revisão visual em desktop e no viewport de 390 px foi concluída em 28/11 (Playwright/axe sem violações críticas/graves), mas a conta do usuário ainda não foi usada.
8. **Créditos na OpenAI/Lovable** — OpenAI sem quota e Lovable sem créditos; o Groq free tier pode devolver `429` (~60 s). O `aiRouter` repete uma vez com `Retry-After` curto; créditos eliminam o gargalo.
9. **`ai_status` e segredo B3 no Actions** — `ai_status` exige JWT da função (`verify_jwt = true`); `B3_WEBHOOK_SECRET` no Actions é opcional e, se ausente, o `Daily Smoke` pula só o teste assinado.
