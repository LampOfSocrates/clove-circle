# LATEST

## What this is
Static marketing/consulting website for Clove Circle Consulting (net zero strategy, life cycle assessment, sustainability), founded by Prof. Jhuma Sadhukhan. Plain HTML/CSS/JS site with embedded interactive LCA/TEA case-study dashboards.

## Where it runs
Live at clovecircle.com (custom domain via CNAME), likely GitHub Pages given `.nojekyll` and CNAME. No build step; static files served directly.

## Features
- Core marketing pages: index, about, services, pricing, portfolio, contact, resources, references, infographics
- Standalone interactive LCA/TEA dashboards embedded via iframe wrappers: Flue2Chem, Laterite, PHA-from-lignocellulose
- postMessage-based iframe height sizing for embedded dashboards
- Playwright + Python test suite covering typography, case studies, references/infographics pages, PHA data removal

## Recently tried
- 2026-05-24: Updated laterite-lca-tea.html figures
- 2026-05-06: Multiple updates to labor cost, job metrics, and jobsPerKt value in PHA-from-lignocellulose dashboard
- 2026-05-06 (earlier): Updated dashboard layouts and regression tests ("Latest by jhuma")
- 2026-05-06 (earlier): Reduced Flue2Chem embedded height, tightened wrapper iframe spacing
- 2026-05-06 (earlier): Moved Flue2Chem reset buttons into tab bar; restored dynamic LCA and renamed wrappers

## Next
- Continue tuning PHA case-study economics (labor cost / jobs-per-Kt) based on commit cadence
- (Inferred) Extend the wrapper/iframe pattern to any future standalone case studies
- (Inferred) Keep Playwright/pytest suite in sync as dashboard HTML changes
