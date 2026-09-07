#!/usr/bin/env node
// Regenerates every case-study baseline. A wrapper script rather than an inline
// env var so `npm run test:case-studies:update` works on Windows and POSIX alike.
const { spawnSync } = require('node:child_process');
const path = require('node:path');

const repoRoot = path.join(__dirname, '..', '..');
const playwrightCli = require.resolve('@playwright/test/cli', { paths: [repoRoot] });

const result = spawnSync(
  process.execPath,
  [playwrightCli, 'test', 'tests/case_studies/case-studies.calc.spec.js'],
  {
    cwd: repoRoot,
    stdio: 'inherit',
    env: { ...process.env, UPDATE_BASELINE: '1' },
  }
);

process.exit(result.status === null ? 1 : result.status);
