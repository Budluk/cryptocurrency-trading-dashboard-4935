import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

/**
 * Violações críticas/graves conhecidas, documentadas até que os componentes
 * possam ser corrigidos (esta camada E2E não edita componentes).
 * Cada item deve ser a descrição completa (id + alvo) gerada por describeViolation.
 */
const KNOWN_VIOLATIONS: string[] = [];

function describeViolation(violation: {
  id: string;
  impact?: string | null;
  help: string;
  nodes: Array<{ target: unknown }>;
}): string {
  const targets = violation.nodes
    .map((node) => JSON.stringify(node.target))
    .join(", ");
  return `${violation.id} (${violation.impact}): ${violation.help} em ${targets}`;
}

test("Visão geral não introduz violações críticas/graves de acessibilidade", async ({
  page,
}) => {
  // Cache HTTP desligado: a varredura usa sempre os assets atuais do preview.
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Network.setCacheDisabled", { cacheDisabled: true });

  await page.goto("/");
  await expect(page.getByRole("tab", { name: "Visão geral" })).toHaveAttribute(
    "data-state",
    "active",
  );

  // Inclui o painel "B3 + corretoras" na varredura, mesmo quando ele está
  // dentro de um disclosure recolhido na Visão geral.
  const exchangePanel = page.getByRole("heading", { name: "B3 + corretoras" });
  if (!(await exchangePanel.isVisible())) {
    await page.getByText("Corretoras e simulação", { exact: true }).click();
    await expect(exchangePanel).toBeVisible();
  }

  const results = await new AxeBuilder({ page })
    .options({
      // Sem cache de referências de elemento nem preload: a varredura sempre
      // trabalha sobre o DOM atual, sem reaproveitar resultados de execuções
      // anteriores.
      elementRef: false,
      preload: false,
    })
    .analyze();

  const blocking = results.violations.filter((violation) =>
    ["critical", "serious"].includes(violation.impact ?? ""),
  );
  const found = blocking.map(describeViolation);

  // Quando KNOWN_VIOLATIONS estiver vazio, exige zero violações bloqueantes.
  // Se houver pendências reais, liste os ids aqui (com comentário explicando)
  // para que o teste continue detectando regressões além da lista documentada.
  expect(found.sort(), found.join("\n")).toEqual([...KNOWN_VIOLATIONS].sort());
});
