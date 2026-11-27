# Checklist de Deploy e Atualização do PR #1

Repositório: `https://github.com/Budluk/cryptocurrency-trading-dashboard-4935.git`
Branch: `feat/ai-gateway-security-ci` (commit da feature: `dba32ad`; correções seguintes também publicadas)
Projeto Supabase: **`uohdpxkfgxmtlosnmspf`** (definido em `supabase/config.toml`)

> ✅ Em 27/11/2026 foram aplicadas as **5 migrations**, publicadas as **4 functions** deste PR,
> ativados os **Anonymous Sign-Ins** (com correção da trigger de `demo_accounts`) e configurados
> a variável e o segredo do `agent-loop`. Os comandos abaixo permanecem como registro
> reprodutível; não precisa repeti-los. O B3 continua sem migration operacional (ver 2.4).

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
- Se existir, aplique **depois** das cinco da etapa 2.2, seguindo a ordem dos nomes de arquivo.
- As demais migrations do diretório já foram aplicadas em execuções anteriores (confirme pelo `migration list`).

---

## Etapa 3 — Deploy das Edge Functions (✅ aplicadas em 27/11/2026)

> Execute **na raiz do repositório** para que a CLI use o `supabase/config.toml` (que define `verify_jwt` por função).
> Versões ativas confirmadas: `ai-market-analysis` v138, `ai-signal-gateway` v1,
> `bybit-trading` v164 e `tradingview-webhook` v124.

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
| `GROQ_API_KEY` (+ `GROQ_MODEL`, default `llama-3.3-70b-versatile`, **descontinuado**) | 2º provedor do `aiRouter`; use `openai/gpt-oss-120b` | recomendado |
| `OPENAI_API_KEY` (+ `OPENAI_MODEL`, default `gpt-4o-mini`) | 3º provedor do `aiRouter` | opcional |
| `LOVABLE_API_KEY` | fallback final do `aiRouter`, chat (`google/gemini-3.8-flash`), `ai-market-analysis`, `ai-comprehensive-analysis`, `ai-trading-intelligence`, `ml-auto-corrector` | **sim — sem ela o chat não responde** |
| `GITHUB_TOKEN` | `researchAgent` e `tradingChat` (API do GitHub) | recomendado; sem token o limite é 60 req/h |

> Segredos com espaços ou `=` no valor precisam de aspas (PowerShell: use aspas duplas, como acima).
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
> `GROQ_MODEL=openai/gpt-oss-120b` e reduzi as fontes enviadas ao prompt para
> 3.000 caracteres (deploy da função `ai-market-analysis` v141). Uma pesquisa com
> a URL deste repositório retornou `research: true`, texto em português, ficha
> válida e `Fontes: [1] ...`, terminando com
> `Modo pesquisa: nenhuma ordem foi executada.`. O fallback Lovable segue sem
> créditos e a OpenAI sem quota; se o Groq devolver 429 por limite de
> tokens/minuto do plano free, aguarde ~60 s (circuit breaker) e repita —
> nenhuma ordem é enviada em nenhum caso.
>
> O fluxo também foi validado na **interface** (Chrome headless apontando para o
> `npm run dev` local, com sessão admin temporária injetada): abrir o chat
> flutuante, ativar o botão de Pesquisa, enviar a URL do repositório e conferir
> o badge "Pesquisa", a resposta com `Fontes: [1] ...`, o aviso
> `Modo pesquisa: nenhuma ordem foi executada.` e o resumo "Ver ficha
> estruturada". A conta temporária e os arquivos de sessão foram removidos
> logo após o teste.

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
npm run lint:ci              # 0 erros e no máximo 116 avisos (orçamento atual)
npm run audit:ci             # bloqueia vulnerabilidades de produção high/critical
npm run typecheck            # tsc --noEmit -p tsconfig.app.json  (deve passar)
npm run test:coverage        # Vitest (inclui src/lib/chatAttachments.test.ts)

cd supabase\functions\_shared
bun test rateLimit.test.ts aiRouter.test.ts autonomousRisk.test.ts autonomousAgent.test.ts indicators.test.ts agentLoop.test.ts researchContext.test.ts
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

- [ ] `supabase migration list` → 4 migrations "Applied".
- [ ] `supabase functions list` → 4 functions "Loaded"/deployadas.
- [ ] Smoke tests 5.1–5.4 verdes.
- [ ] CI do PR verde (6 jobs: lint/typecheck, vitest, edge tests, build, audit, edge check).
- [ ] Painel Observabilidade sem erros.

Rollbacks:

- **Function:** `git checkout <sha-do-commit-bom>` e redesploy da função afetada com o mesmo comando da Etapa 3.
- **Migration:** a CLI não desfaz sozinha — por isso, antes do `db push` faça um dump de segurança:
  `supabase db dump --project-ref uohdpxkfgxmtlosnmspf -f backup_antes_do_deploy.sql`
  e tenha em mãos o SQL inverso (as 4 migrations são aditivas; na dúvida, recriar política anterior).
- **Secrets:** `supabase secrets set <KEY>=<valor-antigo> --project-ref ...` (nenhum segredo foi apagado).

---

## Pendências conhecidas (não são bloqueadores do deploy)

1. **B3 (WINZ25/WDOF26) não operacional** — migração `b3_*` nunca aplicada e **não existe no repositório** (só em `.lovable/plan.md`/`roadmap.md`). Opcional.
2. **FreeLLMAPI sem endereço público** — pendente Cloudflare Tunnel (`FREELLMAPI_URL`); sem ela o roteador cai para Groq/OpenAI/Lovable.
3. **Dívida de lint** (~150 erros em `MultiAssetTrader`/hooks) — CI roda ESLint com `continue-on-error` para não bloquear o PR.
4. **`npm audit`** roda com `continue-on-error` até o PR de upgrade de dependências.
5. **Chat com IA real (Groq)** ainda precisa de teste em produção com as chaves novas.
6. **Plano Pro do Supabase** segue pendente (itens de "senhas vazadas" já corrigidos).
