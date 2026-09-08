// @ts-check
const { defineConfig, devices } = require('@playwright/test');

const PORT = 8123;

module.exports = defineConfig({
  testDir: './tests',
  testMatch: '**/*.spec.js',
  timeout: 30000,
  forbidOnly: !!process.env.CI,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',

  /* Serve the site over HTTP. Specs that need a real origin — anything using
     localStorage, or an iframe reading its own contentDocument — cannot use
     file://, where Chromium gives every file an opaque origin. Older specs
     still address pages by absolute file:// URL and are unaffected. */
  webServer: {
    command: `python -m http.server ${PORT} --bind 127.0.0.1`,
    url: `http://127.0.0.1:${PORT}/index.html`,
    reuseExistingServer: !process.env.CI,
    stdout: 'ignore',
    timeout: 30000,
  },

  use: {
    headless: true,
    baseURL: `http://127.0.0.1:${PORT}`,
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
