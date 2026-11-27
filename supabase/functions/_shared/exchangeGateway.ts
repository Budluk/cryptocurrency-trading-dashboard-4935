/**
 * Roteador multi-exchange usado pela bybit-trading (sem nova edge function).
 *
 * Regras:
 * - leitura e escrita por exchange com simulação como padrão;
 * - escrita real exige: opt-in por variável de ambiente, credenciais completas,
 *   dry_run=false e token HMAC assinado pelo servidor com os argumentos exatos;
 * - B3 nunca chega ao caminho de ordens (somente sinais/simulação).
 */

import {
  exchangeCredentials, exchangeSummary, getExchangeSpec, isExchangeLiveEnabled, normalizeSymbol,
  type EnvReader, type ExchangeSpec,
} from './exchangeRegistry.ts';
import { sendExchangeRequest } from './exchangeAdapters.ts';
import { checkRiskBudget, clampLeverage, RISK, type RiskBudgetState } from './autonomousRisk.ts';
import { makeConfirmationToken, matchesConfirmation, verifyConfirmationToken } from './tradingChat.ts';

export type ExchangeParams = Record<string, unknown>;

export interface ExchangeContext {
  userId: string;
  confirmationKey: string;
  readEnv?: EnvReader;
  /** Estado de risco do usuário; obrigatório para ordens reais (falha fechada). */
  riskState?: RiskBudgetState;
}

const WRITE_TOOLS: Record<string, string> = {
  place_order: 'execute_order',
  close_position: 'execute_close',
  set_trading_stop: 'execute_set_stop',
  set_leverage: 'execute_set_stop',
};

const ROUTED_ACTIONS = new Set([
  ...Object.keys(WRITE_TOOLS),
  'exchange_balance', 'exchange_positions', 'exchange_ticker', 'exchange_instruments',
]);

function canonicalArgs(params: ExchangeParams): ExchangeParams {
  const { exchange: _exchange, dry_run: _dryRun, confirm_token: _token, __auth_user_id: _auth, ...args } = params;
  return args;
}

function requireSpec(params: ExchangeParams): ExchangeSpec {
  const spec = getExchangeSpec(params.exchange);
  if (!spec) throw new Error('Exchange inválida ou não suportada');
  return spec;
}

function summary(tool: string, args: ExchangeParams): string {
  if (tool === 'execute_order') {
    const side = String(args.side ?? '').toLowerCase() === 'buy' ? 'COMPRA' : 'VENDA';
    return `${side} ${String(args.qty ?? '?')} ${String(args.symbol ?? '?')} via ${String(args.exchange ?? '')}`;
  }
  if (tool === 'execute_close') return `FECHAR ${String(args.qty ?? '?')} ${String(args.symbol ?? '?')}`;
  return `AJUSTAR ${String(args.symbol ?? '?')}`;
}

function simulatedRead(spec: ExchangeSpec, action: string) {
  return {
    exchange: spec.id,
    simulated: true,
    reason: 'simulation_only',
    action,
    data: action === 'exchange_positions' ? [] : action === 'exchange_balance' ? { totalEquity: '0' } : null,
  };
}

function simulatedWrite(spec: ExchangeSpec, action: string, params: ExchangeParams, reason: string) {
  const requestedStop = Number(params.stopLoss);
  const entry = Number(params.price ?? params.entryPrice ?? 0);
  let stopLoss = params.stopLoss;
  const rawStopPct = entry > 0 ? Math.abs(entry - requestedStop) / entry * 100 : 0;
  if (entry > 0 && Number.isFinite(requestedStop) && rawStopPct > RISK.maxStopPct) {
    const direction = String(params.side ?? '').toLowerCase() === 'buy' ? -1 : 1;
    stopLoss = entry * (1 + direction * RISK.maxStopPct / 100);
  }
  const leverage = clampLeverage(Number(params.leverage) || RISK.minLeverage);
  return {
    exchange: spec.id,
    action,
    simulated: true,
    reason,
    orderId: `SIM-${spec.id}-${Date.now()}`,
    symbol: normalizeSymbol(spec.id, params.symbol),
    side: params.side,
    qty: params.qty,
    leverage,
    stopLoss,
    takeProfit: params.takeProfit,
    createdAt: new Date().toISOString(),
  };
}

export async function handleExchangeAction(
  action: string,
  params: ExchangeParams,
  ctx: ExchangeContext,
): Promise<Record<string, unknown>> {
  if (action === 'exchange_list') {
    return { exchanges: exchangeSummary() };
  }
  if (action === 'exchange_propose') {
    const spec = requireSpec(params);
    const targetAction = String(params.target_action ?? '');
    const tool = WRITE_TOOLS[targetAction];
    if (!tool) throw new Error('Ação proposta inválida');
    if (spec.id === 'BYBIT') throw new Error('Use as ações nativas da Bybit');
    if (spec.id === 'B3' || !spec.supportsOrders) throw new Error('B3 não envia ordens; somente sinais');
    const args = canonicalArgs(params);
    const { exchange: _exchange, target_action: _target, ...toolArgs } = args;
    const token = await makeConfirmationToken({
      tool, args: toolArgs, u: ctx.userId, exp: Date.now() + 5 * 60 * 1000,
      id: crypto.randomUUID(),
    }, ctx.confirmationKey);
    return {
      exchange: spec.id,
      pending: { tool, args: toolArgs, summary: summary(tool, toolArgs), token },
      expiresInSeconds: 300,
    };
  }
  if (!ROUTED_ACTIONS.has(action)) throw new Error(`Ação desconhecida: ${action}`);

  const spec = requireSpec(params);
  // A Bybit continua no caminho nativo (HMAC v2); o roteador serve apenas
  // às venues adicionadas, para não criar um segundo caminho de ordens reais.
  if (spec.id === 'BYBIT') throw new Error('Use as ações nativas da Bybit');
  const readEnv = ctx.readEnv;
  const isWrite = action in WRITE_TOOLS;
  const args = canonicalArgs(params);
  const dryRun = params.dry_run !== false;

  if (isWrite) {
    if (spec.id === 'B3' || !spec.supportsOrders) {
      throw new Error('B3 é somente sinais/simulação; nenhuma ordem é enviada');
    }
    if (dryRun) return simulatedWrite(spec, action, params, 'dry_run');
    const creds = exchangeCredentials(spec, readEnv);
    if (!isExchangeLiveEnabled(spec, readEnv) || !creds.key || !creds.secret) {
      return simulatedWrite(spec, action, params, 'live_not_enabled');
    }
    if (action === 'place_order') {
      if (!ctx.riskState) throw new Error('Estado de risco indisponível; ordem real bloqueada');
      const budget = checkRiskBudget(ctx.riskState);
      if (!budget.allowed) throw new Error(`Limite de risco: ${budget.reason}`);
    }
    const tool = WRITE_TOOLS[action];
    const confirmation = await verifyConfirmationToken(params.confirm_token, ctx.userId, ctx.confirmationKey);
    if (!matchesConfirmation(confirmation, tool, args)) {
      throw new Error('Confirmação ausente, expirada ou divergente dos argumentos da ordem');
    }
    const result = await sendExchangeRequest({
      exchange: spec.id, action, params: args,
      credentials: creds,
    });
    return { exchange: spec.id, action, simulated: false, result };
  }

  // Leituras: usam a API real somente com credenciais + opt-in; senão simuladas.
  const creds = exchangeCredentials(spec, readEnv);
  const live = isExchangeLiveEnabled(spec, readEnv) || spec.liveByDefault;
  if (!live || !creds.key || !creds.secret) return simulatedRead(spec, action);
  const result = await sendExchangeRequest({
    exchange: spec.id, action, params: args, credentials: creds,
  });
  return { exchange: spec.id, action, simulated: false, result };
}
