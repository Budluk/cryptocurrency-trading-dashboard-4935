import { expect, test, type ConsoleMessage, type Page } from "@playwright/test";

const BYBIT_TRADING_ROUTE = "**/functions/v1/bybit-trading";

/**
 * Widgets de terceiros (TradingView e o script gpteng carregado no index.html)
 * emitem mensagens próprias de rede/console que não pertencem ao dashboard.
 * Apenas essas origens conhecidas são ignoradas; qualquer outro erro falha o teste.
 */
const EXTERNAL_WIDGET_PATTERNS = [/tradingview/i, /cdn\.gpteng\.co/i];

function isExternalWidgetMessage(message: string, url = ""): boolean {
  return [message, url].some((value) =>
    EXTERNAL_WIDGET_PATTERNS.some((pattern) => pattern.test(value)),
  );
}

/**
 * O painel pode estar dentro de um <details> recolhido ("Corretoras e
 * simulação"). Abrimos o disclosure apenas quando ele ainda não está visível.
 */
async function ensureExchangePanelVisible(page: Page): Promise<void> {
  const heading = page.getByRole("heading", { name: "B3 + corretoras" });
  if (await heading.isVisible()) return;

  await page.getByText("Corretoras e simulação", { exact: true }).click();
  await expect(heading).toBeVisible();
}

function collectConsoleErrors(page: Page): string[] {
  const errors: string[] = [];

  page.on("console", (message: ConsoleMessage) => {
    if (message.type() !== "error") return;
    const text = message.text();
    const url = message.location().url ?? "";
    if (isExternalWidgetMessage(text, url)) return;
    errors.push(`${text}${url ? ` @ ${url}` : ""}`);
  });

  page.on("pageerror", (error) => {
    if (isExternalWidgetMessage(error.message)) return;
    errors.push(`pageerror: ${error.message}`);
  });

  return errors;
}

test.beforeEach(async ({ page }) => {
  // Leitura de sinais B3 sem rede/credenciais: o teste só valida a UI.
  await page.route("**/rest/v1/b3_signals*", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: "[]",
    }),
  );
});

test("carrega o dashboard sem erros de console não-TradingView", async ({ page }) => {
  const errors = collectConsoleErrors(page);

  await page.goto("/");
  await expect(page.getByRole("heading", { name: "AI Trading" })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Visão geral" })).toHaveAttribute(
    "data-state",
    "active",
  );
  await page.waitForLoadState("load");
  await page.waitForTimeout(1000);

  expect(errors.join("\n"), errors.join("\n")).toBe("");
});

test("Visão geral mostra B3 + corretoras, as 9 venues e os contratos vigentes", async ({
  page,
}) => {
  await page.goto("/");

  await expect(page.getByRole("tab", { name: "Visão geral" })).toHaveAttribute(
    "data-state",
    "active",
  );
  await ensureExchangePanelVisible(page);

  // Registry vigente em src/config/exchanges.ts (espelho do registry do backend).
  const venues = [
    "Bybit",
    "Binance Futures",
    "OKX",
    "Bitget",
    "KuCoin Futures",
    "Gate.io Futures",
    "B3 (WIN/WDO)",
    "Bybit Testnet",
    "Binance Testnet",
  ];
  for (const venue of venues) {
    await expect(page.getByText(venue, { exact: true }).first()).toBeVisible();
  }

  await expect(page.getByText(/WINZ26/).first()).toBeVisible();
  await expect(page.getByText(/WDOZ26/).first()).toBeVisible();
});

test("Simular ordem envia dry_run=true e nunca uma ordem real", async ({ page }) => {
  type BybitBody = { action?: string; params?: Record<string, unknown> };
  const sentBodies: BybitBody[] = [];

  await page.route(BYBIT_TRADING_ROUTE, async (route) => {
    const request = route.request();
    let body: BybitBody = {};
    try {
      body = request.postDataJSON() as BybitBody;
    } catch {
      // Requisições sem corpo (health check etc.) também são respondidas localmente.
    }
    sentBodies.push(body);

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(
        body.action === "place_order"
          ? { success: true, data: { simulated: true, reason: "dry_run" } }
          : { success: false, error: "stubbed by E2E" },
      ),
    });
  });

  await page.goto("/");
  await ensureExchangePanelVisible(page);

  await page.getByRole("button", { name: "Simular ordem" }).click();

  await expect
    .poll(() => sentBodies.find((body) => body.action === "place_order"))
    .toBeTruthy();

  const order = sentBodies.find((body) => body.action === "place_order");
  expect(order?.params?.dry_run).toBe(true);
  expect(order?.params).toMatchObject({
    dry_run: true,
    exchange: "BINANCE",
    symbol: "BTCUSDT",
    side: "Buy",
  });
  // A UI não envia chaves, tokens nem opt-in de live trading.
  expect(JSON.stringify(order)).not.toMatch(/api[_-]?key|api[_-]?secret|token/i);
});

test("Modo demo persiste e nunca envia place_order real", async ({ page }) => {
  type BybitBody = { action?: string; params?: Record<string, unknown> };
  const sentBodies: BybitBody[] = [];

  await page.route(BYBIT_TRADING_ROUTE, async (route) => {
    const request = route.request();
    let body: BybitBody = {};
    try {
      body = request.postDataJSON() as BybitBody;
    } catch {
      // Sem corpo: apenas health check.
    }
    sentBodies.push(body);

    const response =
      body.action === "get_instruments"
        ? {
            success: true,
            data: [
              {
                symbol: "BTCUSDT",
                status: "Trading",
                quoteCoin: "USDT",
                lotSizeFilter: { minOrderQty: "0.001", qtyStep: "0.001", maxOrderQty: "100" },
              },
            ],
          }
        : body.action === "get_ticker"
          ? {
              success: true,
              data: [
                {
                  symbol: "BTCUSDT",
                  lastPrice: "50000",
                  price24hPcnt: "1.5",
                  turnover24h: "5000000",
                  bid1Price: "49999",
                  ask1Price: "50001",
                },
              ],
            }
          : { success: false, error: "stubbed by E2E" };

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(response),
    });
  });

  await page.route("https://api.bybit.com/v5/market/tickers*", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ result: { list: [{ lastPrice: "50000" }] } }),
    }),
  );

  await page.goto("/");
  await page.getByRole("tab", { name: "Robô" }).click();
  await page.getByRole("switch").first().click();

  await expect(page.getByText("Modo Demo (paper)")).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem("trading-demo-mode")))
    .toBe("true");

  await page.getByRole("button", { name: /Rodar 1 ciclo/ }).click();
  await page.waitForTimeout(2500);

  expect(sentBodies.filter((body) => body.action === "place_order")).toEqual([]);
  expect(sentBodies.filter((body) => body.action === "set_trading_stop")).toEqual([]);

  // Recarregar não pode restaurar o robô em modo real.
  await page.reload();
  await page.getByRole("tab", { name: "Robô" }).click();
  await expect(page.getByText("Demo (paper)", { exact: true }).first()).toBeVisible();
  expect(sentBodies.filter((body) => body.action === "place_order")).toEqual([]);
});
