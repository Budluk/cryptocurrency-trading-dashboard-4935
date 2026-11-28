/**
 * Agregação pura para o gráfico de operações em andamento.
 *
 * Nenhuma função aqui acessa rede, banco ou credenciais: o componente apenas
 * recebe as posições já carregadas pelo robô (paper e reais) e monta as séries.
 */

export interface ChartPositionInput {
  symbol: string;
  pnl: number;
  side?: string | null;
  leverage?: number | null;
  entryPrice?: number | null;
  currentPrice?: number | null;
}

export interface OpenPositionsChartRow {
  symbol: string;
  demo: number;
  real: number;
  demoCount: number;
  realCount: number;
  total: number;
}

const safeNumber = (value: number | null | undefined): number =>
  Number.isFinite(value ?? NaN) ? Number(value) : 0;

/** Agrupa posições abertas por ativo, separando paper de real. */
export function buildOpenPositionsChartData(
  demoPositions: readonly ChartPositionInput[],
  realPositions: readonly ChartPositionInput[],
  limit = 10,
): OpenPositionsChartRow[] {
  const rows = new Map<string, OpenPositionsChartRow>();

  const ensureRow = (symbol: string): OpenPositionsChartRow => {
    const key = symbol || 'DESCONHECIDO';
    let row = rows.get(key);
    if (!row) {
      row = { symbol: key, demo: 0, real: 0, demoCount: 0, realCount: 0, total: 0 };
      rows.set(key, row);
    }
    return row;
  };

  for (const position of demoPositions) {
    const row = ensureRow(position.symbol);
    const pnl = safeNumber(position.pnl);
    row.demo += pnl;
    row.demoCount += 1;
  }

  for (const position of realPositions) {
    const row = ensureRow(position.symbol);
    const pnl = safeNumber(position.pnl);
    row.real += pnl;
    row.realCount += 1;
  }

  return [...rows.values()]
    .map(row => ({ ...row, total: row.demo + row.real }))
    .sort((a, b) => Math.abs(b.total) - Math.abs(a.total) || a.symbol.localeCompare(b.symbol))
    .slice(0, Math.max(1, limit));
}

/** Somatório de PnL aberto de uma das séries do gráfico. */
export function sumOpenPnl(positions: readonly ChartPositionInput[]): number {
  return positions.reduce((sum, position) => sum + safeNumber(position.pnl), 0);
}
