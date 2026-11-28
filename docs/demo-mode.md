# Modo demo operacional (paper trading)

O modo demo permite testar o **ciclo operacional completo do robô** sem dinheiro
real: sinal → decisão → ordem simulada → posição → stop/take profit → PnL → log.

## Como usar

1. Aba **Robô** → ligue **Modo Demo (paper)**.
2. O saldo virtual começa em **$20** (ou usa o saldo já existente da conta demo).
3. Clique em **Iniciar robô** para o loop de 60 s, ou em **Rodar 1 ciclo** para
   disparar um ciclo imediato enquanto testa.
4. Acompanhe **Saldo virtual**, **PnL não realizado**, **PnL total** e a aba
   **Conta Demo** (até 10 posições).
5. **Reset** ao lado do switch restaura $20 e fecha as posições paper.

O modo fica salvo no `localStorage` (`trading-demo-mode`). Depois de recarregar a
página, o robô volta em demo — nunca em "conta real" por acidente.

## O que é simulado

| Etapa | Comportamento no demo |
|---|---|
| Preço | API pública de tickers da Bybit (sem chave, sem assinatura) |
| Abertura | `openDemoPosition`: margem = preço × quantidade ÷ alavancagem, debitada do saldo |
| Posição | `demo_positions` com `status='open'`, stop, take profit e alavancagem local |
| Saída | `updateDemoPositions` a cada 10 s cruza SL/TP; stop tem precedência |
| Fechamento | `demo_positions` marcada como `closed` com `close_reason` e `closed_at` |
| Resultado | margem + PnL devolvidos ao saldo; trade gravado em `demo_trades` |
| Auditoria | log no console com `mode=DEMO`; nenhuma escrita em `agent_*` |

Não foi criada nenhuma tabela ou migration: o demo usa `demo_accounts`,
`demo_positions` e `demo_trades`, que já existem.

## Isolamento de ordens reais

Com o demo ligado, o robô **não chama**:

- `place_order` (abertura, pyramiding, ordens armadas ou painel do robô);
- `set_trading_stop` e as saídas inteligentes (`updateSmartExits`);
- `get_positions`/`get_balance` da conta real na inicialização;
- sincronização de PnL de posições reais (`syncClosedPositionsPnL`);
- limpeza de posições órfãs (`cleanupOrphanPositions`).

Ordens armadas S/R ficam desativadas no demo. Os painéis manuais de corretora
(fora do robô) continuam com seu comportamento normal e não devem ser usados
para testar o demo.

## Validação

- `src/lib/demoTrading.test.ts`: margem, PnL, precedência do stop e persistência.
- `e2e/dashboard.spec.ts`: liga o demo, roda um ciclo, recarrega e afirma que
  **nenhum** `place_order`/`set_trading_stop` foi enviado.
- `dry_run` do chat continua separado: ele não grava nada e não abre ordens.
