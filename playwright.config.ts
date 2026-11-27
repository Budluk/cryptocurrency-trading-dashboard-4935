import { defineConfig, devices } from "@playwright/test";

/**
 * Camada E2E leve: aponta para um servidor já existente, sem iniciar webServer.
 *
 * Pré-requisito (CI ou local):
 *   npm run build
 *   npm run preview -- --host 127.0.0.1 --port 4173
 *
 * Para testar outro ambiente: PLAYWRIGHT_BASE_URL=https://meu-preview.example.com npm run test:e2e
 *
 * Nenhum teste faz login, usa segredos ou envia ordens reais: a única ação de
 * escrita é interceptada e respondida localmente com `dry_run: true`.
 */
const baseURL = process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:4173";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"], ["html", { open: "never" }]],

  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "off",
    // Opcional: reutilizar um Chromium já instalado em ambientes sem download.
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH }
      : {},
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
