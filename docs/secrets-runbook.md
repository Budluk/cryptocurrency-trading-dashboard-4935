# Runbook de segredos (sem expor valores)

Projeto: `uohdpxkfgxmtlosnmspf`. Toda rotação é feita pelo **Dashboard do Supabase**
(`Edge Functions → Secrets`) ou por `Settings → Secrets and variables → Actions`
do GitHub. **Nunca** cole segredos em `.env`, commits, issues, logs ou mensagens
de chat. Não é necessário criar PAT — os deploys pela aba **Code** usam a sessão
do navegador.

## Regras gerais

1. Gerar o novo valor localmente e mantê-lo apenas em variável de sessão:
   ```powershell
   $novo = [Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Max 256 }))
   ```
2. Atualizar o segredo no destino; **não** imprimir `$novo` nem usá-lo em dois lugares.
3. Redeploy das funções que leem o segredo (use sempre a aba **Code** do Dashboard).
4. Validar por smoke test; só então apagar/inativar o valor antigo.
5. Registrar no `docs/deploy-checklist.md` **somente** o nome do segredo e a data.

## 1. Rotacionar `B3_WEBHOOK_SECRET`

- Dashboard → Edge Functions → Secrets → editar `B3_WEBHOOK_SECRET`.
- Redeploy de `tradingview-webhook` (ela valida o HMAC) e de `bybit-trading`
  (o painel usa o mesmo segredo apenas no lado servidor).
- Validar:
  - sem `X-B3-Signature` → **401**;
  - assinatura antiga → **401**;
  - assinatura nova com `confidence: 75` (abaixo do mínimo 80) → **200** com
    `{"status":"ignored"}` e nenhuma linha nova em `b3_signals`.
- Atualizar o segredo opcional `B3_WEBHOOK_SECRET` em GitHub Actions
  (`Settings → Secrets and variables → Actions`) para o smoke diário continuar
  cobrindo a assinatura válida. Se ele não existir, o job apenas pula esse passo.

## 2. Rotacionar credenciais de exchange (Bybit/Binance/OKX/Bitget/KuCoin/Gate.io)

- Nomes: `<ID>_API_KEY`, `<ID>_API_SECRET` e, quando aplicável, `<ID>_API_PASSPHRASE`.
- Manter `<ID>_ENABLE_LIVE` **desligado** até que a rotação esteja verificada;
  o padrão do projeto é simulação (`dry_run`).
- Redeploy de `bybit-trading` (roteador `exchange_*`) após a troca.
- Validar com `exchange_balance`/`exchange_instruments` em modo simulado e com
  `place_order` + `dry_run:true`, confirmando `simulated:true` e nenhuma ordem.
- Se alguma chave antiga vazou: revogar **no site da exchange** antes de trocar
  a nova; nunca reutilizar a antiga.

## 3. `SUPABASE_SERVICE_ROLE_KEY` e segredos do Actions

- A service role key é gerenciada pelo Supabase; vê-la em
  `Dashboard → Settings → API → service_role`. Se precisar rotacionar, use o
  botão do próprio Dashboard e atualize o secret `SUPABASE_SERVICE_ROLE_KEY`
  em GitHub Actions na sequência (agent-loop e Daily Smoke dependem dele).
- `vars.SUPABASE_URL` é uma **variável** pública; não precisa de rotação.
- Após trocar a service role, redeploy das functions que assinam tokens HMAC de
  confirmação (`bybit-trading`) — tokens emitidos antes da troca deixam de ser
  válidos, o que é desejável.

## 4. Provedores de IA

- `GROQ_API_KEY`, `OPENAI_API_KEY`, `LOVABLE_API_KEY`, `FREELLMAPI_KEY`,
  `PERPLEXITY_API_KEY` e `GITHUB_TOKEN`: trocar no Dashboard e redeploy de
  `ai-market-analysis`, `bybit-trading` e das funções de pesquisa que os usam.
- `GROQ_MODEL` não é segredo; manter `openai/gpt-oss-120b`.
- Validar sem gastar: action `ai_status` em `ai-market-analysis` devolve apenas
  `{ name, model, configured, circuitOpen, failures, rateLimited }`.

## 5. Incidentes

- Se um segredo aparecer em commit: revogar imediatamente na origem, rodar
  `gitleaks` local, adicionar fingerprint apenas para false positives conhecidos
  e **nunca** adicionar um segredo real à allowlist.
- Se um PAT temporário foi criado para deploy: revogar em
  `https://github.com/settings/tokens` no mesmo dia.
- Nenhum valor deve ser colado em `docs/deploy-checklist.md` — apenas o nome e
  a data da rotação.
