import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { aiFetch } from './aiRouter.ts';

const ANON_ID = '00000000-0000-0000-0000-000000000001';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const json = (d: unknown, status = 200) =>
  new Response(JSON.stringify(d), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

async function bybit(action: string, params: Record<string, unknown> = {}) {
  const r = await fetch(`${SUPABASE_URL}/functions/v1/bybit-trading`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${SERVICE_KEY}`, apikey: SERVICE_KEY },
    body: JSON.stringify({ action, params }),
  });
  return await r.json().catch(() => ({ success: false, error: `HTTP ${r.status}` }));
}

const SYSTEM = `Você é o assistente de trading do Lucas (cripto, Bybit, contratos lineares USDT). Responda em português, curto e objetivo.
Use as ferramentas de leitura para ver posições, saldo, preços, P&L fechado e configuração da estratégia antes de opinar.
Para abrir, fechar ou mudar SL/TP use SOMENTE as ferramentas propose_*: elas NÃO executam, apenas mostram um cartão que o Lucas confirma. Nunca diga que a ordem foi executada.
Regras da estratégia: majors líquidos (BTC/ETH/SOL), alavancagem 5-8x, risco 1-2% do saldo, SL máx 0,5%. SL de compra abaixo do preço, de venda acima. Avise quando um pedido violar essas regras.`;

const fn = (name: string, description: string, properties: Record<string, unknown>, required: string[]) =>
  ({ type: 'function', function: { name, description, parameters: { type: 'object', properties, required } } });
const str = { type: 'string' }; const num = { type: 'number' };
const TOOLS = [
  fn('get_positions', 'Posições abertas na Bybit', {}, []),
  fn('get_balance', 'Saldo da conta Bybit', {}, []),
  fn('get_ticker', 'Preço atual de um símbolo', { symbol: str }, ['symbol']),
  fn('get_closed_pnl', 'Últimos trades fechados com P&L', { limit: num }, []),
  fn('get_strategy_config', 'Configuração atual do robô de trading', {}, []),
  fn('propose_order', 'Propor abertura de ordem (precisa confirmação)', { symbol: str, side: { type: 'string', enum: ['Buy', 'Sell'] }, qty: num, orderType: { type: 'string', enum: ['Market', 'Limit'] }, price: num, stopLoss: num, takeProfit: num, leverage: num, reason: str }, ['symbol', 'side', 'qty', 'reason']),
  fn('propose_close', 'Propor fechamento de posição (precisa confirmação)', { symbol: str, side: { type: 'string', enum: ['Buy', 'Sell'], description: 'lado da posição aberta' }, qty: num, reason: str }, ['symbol', 'side', 'qty', 'reason']),
  fn('propose_set_stop', 'Propor ajuste de SL/TP (precisa confirmação)', { symbol: str, stopLoss: num, takeProfit: num, reason: str }, ['symbol', 'reason']),
];

const cut = (v: unknown) => JSON.stringify(v).slice(0, 6000);

async function runTool(db: any, name: string, args: any) {
  switch (name) {
    case 'get_positions': return cut(await bybit('get_positions'));
    case 'get_balance': return cut(await bybit('get_balance'));
    case 'get_ticker': return cut(await bybit('get_ticker', { symbol: String(args.symbol).toUpperCase() }));
    case 'get_closed_pnl': return cut(await bybit('get_closed_pnl', { limit: Math.min(Number(args.limit) || 20, 50) }));
    case 'get_strategy_config': {
      const [a, b] = await Promise.all([
        db.from('auto_trader_config').select('*').limit(1),
        db.from('aggressive_trading_config').select('*').limit(1),
      ]);
      return cut({ auto_trader_config: a.data, aggressive_trading_config: b.data });
    }
  }
  return null;
}

export async function handleTradingChat(req: Request): Promise<Response> {
  try {
    const db = createClient(SUPABASE_URL, SERVICE_KEY);
    let userId = ANON_ID;
    const auth = req.headers.get('Authorization');
    if (auth?.startsWith('Bearer ')) {
      const { data } = await db.auth.getUser(auth.slice(7));
      if (data?.user) userId = data.user.id;
    }
    const body = await req.json().catch(() => ({}));
    const action = body?.action;

    if (action === 'chat_history') {
      const { data, error } = await db.from('trading_chat_messages').select('*').eq('user_id', userId).order('created_at').limit(200);
      if (error) throw error;
      return json({ messages: data });
    }

    if (action === 'chat_clear') {
      const { error } = await db.from('trading_chat_messages').delete().eq('user_id', userId);
      if (error) throw error;
      return json({ ok: true });
    }

    if (action === 'chat_resolve') {
      const id = String(body.id || ''); const decision = body.decision;
      if (!id || !['confirm', 'cancel'].includes(decision)) return json({ error: 'Pedido inválido' }, 400);
      const { data: msg, error } = await db.from('trading_chat_messages').select('*').eq('id', id).eq('user_id', userId).maybeSingle();
      if (error) throw error;
      if (!msg?.proposal || msg.proposal_status !== 'pending') return json({ error: 'Essa proposta já foi resolvida' }, 409);
      if (decision === 'cancel') {
        await db.from('trading_chat_messages').update({ proposal_status: 'cancelled' }).eq('id', id);
        return json({ status: 'cancelled' });
      }
      const p = msg.proposal; const a = p.args;
      let result: any;
      if (p.type === 'propose_order') {
        if (a.leverage) await bybit('set_leverage', { symbol: a.symbol, leverage: a.leverage });
        result = await bybit('place_order', { symbol: a.symbol, side: a.side, qty: a.qty, orderType: a.orderType || 'Market', price: a.price, stopLoss: a.stopLoss, takeProfit: a.takeProfit });
      } else if (p.type === 'propose_close') {
        result = await bybit('close_position', { symbol: a.symbol, side: a.side, qty: a.qty });
      } else {
        result = await bybit('set_trading_stop', { symbol: a.symbol, stopLoss: a.stopLoss, takeProfit: a.takeProfit });
      }
      const ok = result?.success !== false;
      await db.from('trading_chat_messages').update({ proposal_status: ok ? 'executed' : 'failed' }).eq('id', id);
      const note = ok ? `✅ Executado na Bybit: ${p.summary}` : `❌ Falhou: ${result?.error || 'erro desconhecido'}`;
      await db.from('trading_chat_messages').insert({ user_id: userId, role: 'assistant', content: note });
      return json({ status: ok ? 'executed' : 'failed', result });
    }

    if (action === 'chat_send') {
      const text = String(body.message || '').trim().slice(0, 4000);
      if (!text) return json({ error: 'Mensagem vazia' }, 400);
      await db.from('trading_chat_messages').insert({ user_id: userId, role: 'user', content: text });
      const { data: hist } = await db.from('trading_chat_messages').select('role, content, proposal, proposal_status').eq('user_id', userId).order('created_at', { ascending: false }).limit(30);
      const messages: any[] = [{ role: 'system', content: SYSTEM }, ...(hist || []).reverse().map((m: any) => ({
        role: m.role,
        content: m.content + (m.proposal ? `\n[proposta ${m.proposal.summary} — status: ${m.proposal_status}]` : ''),
      }))];

      const proposals: any[] = [];
      let reply = '';
      for (let i = 0; i < 5; i++) {
        const res = await aiFetch({
          method: 'POST',
          headers: { Authorization: `Bearer ${Deno.env.get('LOVABLE_API_KEY')}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ model: 'google/gemini-3.8-flash', messages, tools: TOOLS }),
        });
        if (!res.ok) {
          const t = await res.text();
          return json({ error: res.status === 402 ? 'Créditos de IA esgotados' : res.status === 429 ? 'Muitas mensagens, aguarde um pouco' : `IA indisponível (${res.status})`, detail: t.slice(0, 300) }, res.status);
        }
        const data = await res.json();
        const m = data.choices?.[0]?.message;
        if (!m) break;
        const calls = m.tool_calls || [];
        if (!calls.length) { reply = m.content || ''; break; }
        messages.push({ role: 'assistant', content: m.content || '', tool_calls: calls });
        for (const c of calls) {
          let args: any = {}; try { args = JSON.parse(c.function.arguments || '{}'); } catch { /* */ }
          let out = await runTool(db, c.function.name, args);
          if (out === null && c.function.name.startsWith('propose_')) {
            if (args.symbol) args.symbol = String(args.symbol).toUpperCase();
            const summary = c.function.name === 'propose_order'
              ? `${args.side === 'Buy' ? 'COMPRA' : 'VENDA'} ${args.qty} ${args.symbol} ${args.orderType || 'Market'}${args.price ? ' @ ' + args.price : ''}${args.leverage ? ` ${args.leverage}x` : ''}${args.stopLoss ? ' SL ' + args.stopLoss : ''}${args.takeProfit ? ' TP ' + args.takeProfit : ''}`
              : c.function.name === 'propose_close'
                ? `FECHAR ${args.qty} ${args.symbol} (posição ${args.side === 'Buy' ? 'comprada' : 'vendida'})`
                : `AJUSTAR ${args.symbol}${args.stopLoss ? ' SL ' + args.stopLoss : ''}${args.takeProfit ? ' TP ' + args.takeProfit : ''}`;
            proposals.push({ type: c.function.name, args, summary });
            out = 'Proposta exibida ao usuário aguardando confirmação. NÃO foi executada.';
          }
          messages.push({ role: 'tool', tool_call_id: c.id, content: out ?? 'ferramenta desconhecida' });
        }
      }
      const rows = [{ user_id: userId, role: 'assistant', content: reply || (proposals.length ? 'Confira a proposta abaixo:' : 'Sem resposta.') }];
      for (const p of proposals) rows.push({ user_id: userId, role: 'assistant', content: p.args.reason || '', proposal: p, proposal_status: 'pending' } as any);
      const { error } = await db.from('trading_chat_messages').insert(rows);
      if (error) throw error;
      return json({ ok: true });
    }
    return json({ error: 'Ação inválida' }, 400);
  } catch (e) {
    console.error('[trading-chat]', e);
    return json({ error: (e as Error).message }, 500);
  }
}
