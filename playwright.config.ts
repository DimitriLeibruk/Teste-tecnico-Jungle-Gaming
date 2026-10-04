import { defineConfig, devices } from '@playwright/test'

/**
 * Testes E2E executados contra o BUILD de demonstração (mesmo artefato do deploy),
 * com a camada de mocks (MSW + Socket.IO simulado) ativa.
 *
 * - Cada teste usa um contexto novo: localStorage vazio → banco simulado recriado
 *   a partir das fixtures (estado isolado e determinístico).
 * - Cenários são escolhidos por teste (ver e2e/fixtures.ts).
 * - Relatório HTML em playwright-report/ e traces das falhas em test-results/.
 */
const PORT = Number(process.env.PW_PORT ?? 4173)
const baseURL = process.env.PW_BASE_URL ?? `http://localhost:${PORT}`

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  timeout: 45_000,
  expect: {
    timeout: 8_000,
    toHaveScreenshot: { maxDiffPixelRatio: 0.02, animations: 'disabled', caret: 'hide' },
  },
  // Baselines versionadas em e2e/__screenshots__ (sem sufixo de plataforma).
  snapshotPathTemplate: '{testDir}/__screenshots__/{projectName}/{testFileName}/{arg}{ext}',
  reporter: [['html', { open: 'never' }], ['list']],
  use: {
    baseURL,
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
  },
  projects: [
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
    },
    {
      name: 'mobile',
      use: { ...devices['Pixel 7'], viewport: { width: 390, height: 844 } },
    },
  ],
  webServer: process.env.PW_BASE_URL
    ? undefined
    : {
        command: `npm run build && npx vite preview --port ${PORT} --strictPort`,
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 240_000,
      },
})
