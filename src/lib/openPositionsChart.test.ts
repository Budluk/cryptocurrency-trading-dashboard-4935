import { describe, expect, test } from "vitest";
import { buildOpenPositionsChartData, sumOpenPnl } from "./openPositionsChart";

describe("openPositionsChart", () => {
  test("agrupa demo e real por símbolo e ordena pelo maior PnL absoluto", () => {
    const rows = buildOpenPositionsChartData(
      [
        { symbol: "BTCUSDT", pnl: 2.5, side: "Buy" },
        { symbol: "BTCUSDT", pnl: -1 },
        { symbol: "ETHUSDT", pnl: 0.75 },
      ],
      [
        { symbol: "BTCUSDT", pnl: 4 },
        { symbol: "SOLUSDT", pnl: -3.25 },
      ],
    );

    expect(rows).toHaveLength(3);
    expect(rows[0]).toMatchObject({ symbol: "BTCUSDT", demo: 1.5, real: 4, demoCount: 2, realCount: 1 });
    expect(rows[0].total).toBeCloseTo(5.5, 6);
    expect(rows[1]).toMatchObject({ symbol: "SOLUSDT", demo: 0, real: -3.25 });
    expect(rows[2]).toMatchObject({ symbol: "ETHUSDT", demo: 0.75, real: 0 });
  });

  test("ignora PnL inválido e respeita o limite de ativos", () => {
    const rows = buildOpenPositionsChartData(
      [
        { symbol: "A", pnl: Number.NaN },
        { symbol: "B", pnl: 1 },
        { symbol: "C", pnl: 2 },
      ],
      [],
      2,
    );

    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ symbol: "C", demo: 2 });
    expect(sumOpenPnl([{ symbol: "A", pnl: Number.NaN }, { symbol: "B", pnl: 1 }])).toBe(1);
  });
});
