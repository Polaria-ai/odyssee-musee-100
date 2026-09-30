import { defineConfig, devices } from '@playwright/test'
import { STUB_SUPABASE_ANON_KEY, STUB_SUPABASE_URL } from './e2e/support/supabaseStub'

/**
 * E2E sur smartphone d'abord. Le serveur est le build de production (`vite preview`).
 * En local sans navigateur Playwright : exporter PW_CHROMIUM_PATH vers un Chrome for Testing.
 */
const executablePath = process.env.PW_CHROMIUM_PATH || undefined
const launchOptions = executablePath ? { executablePath } : {}
const webgl = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list']],
  use: {
    baseURL: process.env.E2E_BASE_URL || 'http://127.0.0.1:4173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'iphone',
      use: { ...devices['iPhone 13'], browserName: 'chromium', launchOptions: { ...launchOptions, args: webgl } },
    },
    {
      name: 'android',
      use: { ...devices['Pixel 7'], launchOptions: { ...launchOptions, args: webgl } },
    },
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], launchOptions: { ...launchOptions, args: webgl } },
    },
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: 'pnpm build && pnpm preview',
        url: 'http://127.0.0.1:4173',
        reuseExistingServer: !process.env.CI,
        timeout: 180_000,
        // En CI, ni `.env.local` ni secret : `getSupabase()` vaudrait `null` et le jeu ne lirait jamais
        // Supabase, donc aucun test ne pourrait intercepter ses requêtes. Le build E2E reçoit un faux
        // projet, auquel répond `gotoMusee` (`e2e/support/supabaseStub.ts`). Hors CI on garde le
        // `.env.local` réel, dont dépend le test `@live`.
        env: process.env.CI
          ? { VITE_SUPABASE_URL: STUB_SUPABASE_URL, VITE_SUPABASE_ANON_KEY: STUB_SUPABASE_ANON_KEY }
          : {},
      },
})
