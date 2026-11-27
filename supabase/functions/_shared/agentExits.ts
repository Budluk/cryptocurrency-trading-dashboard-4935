// Reconciliação persistente de saídas por stop/take profit.
// Usada pelo loop (5 min) e pelo webhook da TradingView — ou seja, funciona
// mesmo quando o fechamento acontece fora do chat. Nenhuma ordem é executada
// aqui: apenas o histórico e a memória do agente são atualizados.
import {
  applyTradeResult,
  guardFromState,
  reconcileExits,
  type AgentStateRow,
  type AgentTradeRow,
  type ReconciledExit,
} from './autonomousAgent.ts';

const SYSTEM_USER_ID = '00000000-0000-0000-0000-000000000001';

// As versões de supabase-js diferem entre functions; o runtime é o mesmo.
export type ExitDb = { from(table: string): any };

export interface ExitReconciliation {
  symbol: string;
  price?: number;
  exits: ReconciledExit[];
  errors: string[];
}

const message = (e: unknown): string => (e as { message?: string })?.message ?? String(e);

/**
 * Fecha na memória as posições abertas de um ativo cujo preço atual cruzou
 * stop_loss ou take_profit. Falhas são acumuladas em `errors` e nunca impedem
 * o chamador (loop/webhook) de continuar.
 */
export async function reconcileSymbolExits(
  db: ExitDb,
  symbol: string,
  price?: number,
): Promise<ExitReconciliation> {
  const errors: string[] = [];
  const normalized = String(symbol ?? '').toUpperCase();
  if (!normalized || !price || !Number.isFinite(price) || price <= 0) {
    return { symbol: normalized, price, exits: [], errors };
  }

  let rows: AgentTradeRow[] = [];
  try {
    const query = await db.from('agent_trades')
      .select('id, user_id, symbol, side, entry, stop_loss, take_profit, opened_at, result')
      .eq('symbol', normalized).eq('result', 'open')
      .order('opened_at', { ascending: false }).limit(50);
    if (query.error) {
      errors.push(message(query.error));
      return { symbol: normalized, price, exits: [], errors };
    }
    rows = (query.data ?? []) as AgentTradeRow[];
  } catch (e) {
    errors.push(message(e));
    return { symbol: normalized, price, exits: [], errors };
  }

  const exits = reconcileExits(rows, { [normalized]: price });
  const saved: ReconciledExit[] = [];
  const now = new Date().toISOString();

  for (const exit of exits) {
    try {
      const userId = exit.user_id ?? SYSTEM_USER_ID;
      const closed = await db.from('agent_trades').update({
        result: exit.result,
        pnl_pct: exit.pnlPct,
        closed_at: now,
      }).eq('id', exit.id);
      if (closed.error) {
        errors.push(message(closed.error));
        continue;
      }

      const stateQuery = await db.from('agent_state').select('*')
        .eq('user_id', userId).eq('symbol', normalized).limit(1);
      if (stateQuery.error) errors.push(message(stateQuery.error));
      const current = (stateQuery.data?.[0] ?? { symbol: normalized }) as AgentStateRow;
      const next = applyTradeResult(current, exit.result, exit.pnlPct);
      const upsert = await db.from('agent_state').upsert(
        { ...next, user_id: userId, updated_at: now },
        { onConflict: 'user_id,symbol' },
      );
      if (upsert.error) errors.push(message(upsert.error));

      const gate = guardFromState(next, {}, new Date().getUTCHours(), new Date());
      const kind = gate.kill.active ? 'kill_switch' : gate.blacklisted ? 'blacklist' : 'loop';
      const log = await db.from('agent_routine_log').insert({
        user_id: userId,
        kind,
        summary: `${normalized} saída por ${exit.reason} (${exit.result} ${exit.pnlPct.toFixed(2)}%)`,
        payload: { ...exit, price, at: now, gate },
      });
      if (log.error) errors.push(message(log.error));

      saved.push(exit);
    } catch (e) {
      errors.push(message(e));
    }
  }

  return { symbol: normalized, price, exits: saved, errors };
}
