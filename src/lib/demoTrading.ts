/**
 * Regras puras do modo demo operacional.
 *
 * Nenhuma função de cálculo aqui acessa rede, banco ou credenciais. Elas são
 * usadas pelo `useDemoTrading` para calcular margem, PnL e saídas de stop/take
 * profit sem depender da API da exchange — o que mantém o demo isolado de
 * ordens reais. As funções de storage apenas guardam preferências locais.
 */

export const DEMO_INITIAL_BALANCE = 20;
export const DEMO_MAX_MARGIN_RATIO = 0.95;
export const DEMO_MODE_STORAGE_KEY = "trading-demo-mode";
const DEMO_LEVERAGE_PREFIX = "demo-position-leverage:";

export type DemoSide = "Buy" | "Sell";
export type DemoExitReason = "stop_loss" | "take_profit";

/** PnL de uma posição demo, já com alavancagem aplicada. */
export function calculateDemoPnl(
  side: DemoSide,
  entryPrice: number,
  exitPrice: number,
  quantity: number,
  leverage: number,
): number {
  const values = [entryPrice, exitPrice, quantity, leverage];
  if (!values.every(Number.isFinite)) return 0;
  if (entryPrice <= 0 || exitPrice <= 0 || quantity <= 0 || leverage <= 0) return 0;

  const direction = side === "Buy" ? exitPrice - entryPrice : entryPrice - exitPrice;
  return direction * quantity * leverage;
}

/**
 * Margem reservada ao abrir uma posição demo.
 * `leverage` é o multiplicador (ex.: 5 = 5x), não a divisão da margem.
 */
export function calculateDemoMargin(
  entryPrice: number,
  quantity: number,
  leverage: number,
): number {
  if (![entryPrice, quantity, leverage].every(Number.isFinite)) return 0;
  if (entryPrice <= 0 || quantity <= 0 || leverage <= 0) return 0;
  return (entryPrice * quantity) / leverage;
}

/** Maior margem que o saldo demo permite usar em uma abertura. */
export function demoAvailableMargin(balance: number): number {
  if (!Number.isFinite(balance) || balance <= 0) return 0;
  return balance * DEMO_MAX_MARGIN_RATIO;
}

/**
 * Decide se uma posição demo deve sair por stop ou take profit.
 * Stop tem precedência quando os dois níveis são cruzados no mesmo tick.
 */
export function demoExitReason(
  side: DemoSide,
  price: number,
  stopLoss: number | null | undefined,
  takeProfit: number | null | undefined,
): DemoExitReason | null {
  if (!Number.isFinite(price) || price <= 0) return null;

  if (stopLoss != null && Number.isFinite(stopLoss)) {
    if (side === "Buy" && price <= stopLoss) return "stop_loss";
    if (side === "Sell" && price >= stopLoss) return "stop_loss";
  }

  if (takeProfit != null && Number.isFinite(takeProfit)) {
    if (side === "Buy" && price >= takeProfit) return "take_profit";
    if (side === "Sell" && price <= takeProfit) return "take_profit";
  }

  return null;
}

function safeStorage(): Storage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

/** O modo demo sobrevive a reload; sem storage ele volta ao padrão (real). */
export function readDemoMode(): boolean {
  return safeStorage()?.getItem(DEMO_MODE_STORAGE_KEY) === "true";
}

export function writeDemoMode(enabled: boolean): void {
  const storage = safeStorage();
  if (!storage) return;
  if (enabled) storage.setItem(DEMO_MODE_STORAGE_KEY, "true");
  else storage.removeItem(DEMO_MODE_STORAGE_KEY);
}

/**
 * `demo_positions` não tem coluna de alavancagem; guardamos o multiplicador
 * localmente para que o PnL não mude após um reload.
 */
export function rememberDemoLeverage(positionId: string, leverage: number): void {
  safeStorage()?.setItem(`${DEMO_LEVERAGE_PREFIX}${positionId}`, String(leverage));
}

export function recallDemoLeverage(positionId: string, fallback: number): number {
  const raw = safeStorage()?.getItem(`${DEMO_LEVERAGE_PREFIX}${positionId}`);
  const parsed = raw == null ? NaN : Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function forgetDemoLeverage(positionId: string): void {
  safeStorage()?.removeItem(`${DEMO_LEVERAGE_PREFIX}${positionId}`);
}
