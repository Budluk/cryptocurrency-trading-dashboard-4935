import { expect, test } from "@playwright/test";

test.use({ viewport: { width: 390, height: 844 } });

test("viewport 390x844 não transborda e mantém as abas de navegação visíveis", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "AI Trading" })).toBeVisible();

  const tabs = ["Visão geral", "Robô", "Histórico", "Pesquisa", "Observar", "Ajustes"];
  for (const name of tabs) {
    await expect(page.getByRole("tab", { name })).toBeVisible();
  }

  const dimensions = await page.evaluate(() => ({
    scrollWidth: document.body.scrollWidth,
    innerWidth: window.innerWidth,
  }));

  expect(
    dimensions.scrollWidth,
    `body.scrollWidth=${dimensions.scrollWidth}, window.innerWidth=${dimensions.innerWidth}`,
  ).toBeLessThanOrEqual(dimensions.innerWidth);
});
