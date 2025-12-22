import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright configuration for E2E anti-regression tests
 * 
 * Usage:
 *   STOREFRONT_BASE_URL=https://loja.example.com npx playwright test
 *   
 * Or run with default (platform subdomain simulation):
 *   npx playwright test
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  
  use: {
    // Base URL from environment or default to localhost
    baseURL: process.env.STOREFRONT_BASE_URL || 'http://localhost:8080',
    
    // Collect trace on failure
    trace: 'on-first-retry',
    
    // Screenshot on failure
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  // Run local dev server before tests if no base URL is set
  webServer: process.env.STOREFRONT_BASE_URL ? undefined : {
    command: 'npm run dev',
    url: 'http://localhost:8080',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
});
