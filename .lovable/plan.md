
Objetivo: eliminar os erros recorrentes do `bybit-trading` sem derrubar a UI, mantendo operação estável mesmo quando a Bybit retorna HTML/403 temporário.

1) Diagnóstico (confirmado pelos logs)
- O erro real é upstream: Bybit responde HTML com `403` (`Bybit returned HTML ...`).
- Em pelo menos uma janela, a função ainda respondeu `500` com payload transitório (rede mostra `Status: 500` com `{"success":false,"error":"Bybit returned HTML..."}`), o que dispara erro runtime no frontend.
- No cliente, `BybitPositionsPanel` faz `throw` quando `!data.success`; isso transforma falha temporária em erro visível e pode contribuir para “blank screen”/runtime error loop.

2) Plano de implementação (passo a passo)

Passo A — Endurecer tratamento de erro no Edge Function  
Arquivo: `supabase/functions/bybit-trading/index.ts`
- Substituir classificação por regex “solta” por erro tipado de upstream transitório:
  - `BybitTransientError` (campos: `code`, `status`, `retryAfterMs`, `endpoint`, `host`).
- Em `makeBybitRequest`:
  - Tratar explicitamente HTML, `403`, `429` e `5xx` como transitório.
  - Não depender só da mensagem textual.
  - Preservar fallback entre hosts (`api.bybit.com` / `api.bytick.com`) + backoff.
- No `catch` do handler:
  - Se erro transitório: retornar `200` com estrutura padrão:
    - `{ success: false, transient: true, code: 'BYBIT_UPSTREAM_UNAVAILABLE', error: '...' , retryAfterMs: ... }`
  - `500` apenas para erro interno real (bug de código/parametrização inválida).
- Adicionar log estruturado (endpoint, host, status) para facilitar diagnóstico.

Passo B — Parar de “quebrar” UI em falha transitória  
Arquivo: `src/components/BybitPositionsPanel.tsx`
- Em queries de posições/saldo:
  - Não dar `throw` para `!data.success` quando `transient === true`.
  - Reaproveitar último snapshot válido (query cache) e continuar renderizando.
- Ajustar `useQuery` para reduzir tempestade de retries:
  - `retry` custom: não repetir para erro transitório já classificado.
  - `keepPreviousData`/placeholder para evitar flicker e tela vazia.
- Exibir estado de degradação suave:
  - ex.: badge/aviso “Bybit instável, mostrando último dado”.

Passo C — Padronizar consumo do bybit-trading no cliente  
Arquivos: `src/hooks/useBybitSync.tsx`, `src/hooks/useManualTradeTracker.tsx` (e opcionalmente outros hooks com invoke)
- Criar helper de invocação (ex.: `invokeBybit`) para:
  - Normalizar leitura de `{ success, transient, code, error }`.
  - Evitar `throw` desnecessário em falhas transitórias.
  - Reduzir duplicação de tratamento de erro.
- Resultado: comportamento uniforme em todos os pontos de chamada.

Passo D — Garantir estabilidade sem perder responsividade  
- Manter atualização frequente, mas sem escalar erro:
  - Em falha transitória, entrar em pequeno cooldown local (ex.: 10–20s) antes de nova tentativa daquele endpoint no mesmo componente.
- Isso reduz pressão quando a Bybit estiver em bloqueio temporário.

3) Detalhes técnicos (importante)
- Raiz do problema não é JSON parsing em si; é resposta anti-bot/WAF da Bybit (HTML 403).
- “Corrigir” apenas com mais retries não basta; precisa:
  - classificação determinística de erro transitório no backend
  - fallback de UI no frontend
  - controle de retry/cooldown para não amplificar bloqueio.
- Mesmo com correção, bloqueio externo pode ocorrer; a meta é: sem `500` desnecessário e sem quebrar a interface.

4) Validação pós-implementação
- Verificar rede do preview por 5–10 min:
  - chamadas `bybit-trading` em falha transitória devem vir `200` com `success:false, transient:true`.
  - não deve aparecer `Edge function returned 500` para casos de HTML/403 da Bybit.
- Verificar logs da edge function:
  - continuam mostrando 403/HTML quando houver bloqueio, mas sem escalar para erro interno.
- Verificar UI:
  - painel continua renderizando com último snapshot válido.
  - sem blank screen/runtime loop.

5) Critério de pronto
- Zero ocorrências de `Edge function returned 500` para indisponibilidade transitória da Bybit.
- Sem tela em branco ao ocorrer 403/HTML.
- Dados voltam automaticamente quando Bybit normaliza.
