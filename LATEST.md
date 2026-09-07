# LATEST

## What this is
Static marketing/consulting website for Clove Circle Consulting (net zero strategy, life cycle assessment, sustainability), founded by Prof. Jhuma Sadhukhan. Plain HTML/CSS/JS site with embedded interactive LCA/TEA case-study dashboards.

## Where it runs
Live at clovecircle.com (custom domain via CNAME), likely GitHub Pages given `.nojekyll` and CNAME. No build step; static files served directly.

## Features
- Core marketing pages: index, about, services, pricing, portfolio, contact, resources, references, infographics
- Standalone interactive LCA/TEA dashboards embedded via iframe wrappers: Flue2Chem, Laterite, PHA-from-lignocellulose, Palladium bio-recovery
- postMessage-based iframe height sizing for embedded dashboards
- Google Analytics 4 (G-RBTNS3ZZP2) via js/analytics.js on all pages + wrappers; standalone dashboards left untagged to avoid double-counting iframe views
- Playwright + Python test suite covering typography, case studies, references/infographics pages, PHA data removal

## Recently tried
- 2026-09-07: Added Palladium bio-recovery case study (4th tab in resources.html + case_studies wrapper); source copied from jhumasadhukhan/Palladium-biorecovery-LCA-TEA, self-contained, no reset control so wrapper omits the reset button
- 2026-08-20: Resources nav link became a "Try our sample calculators" pill button after Services; plain Resources link removed
- 2026-08-20: Fixed playwright.config.js — `browser: 'chromium'` in `use` made the whole suite error out before running
- 2026-08-20: Added GA4 tracking (js/analytics.js, skips localhost/file:)
- 2026-05-24: Updated laterite-lca-tea.html figures

## Next
- Continue tuning PHA case-study economics (labor cost / jobs-per-Kt) based on commit cadence
- (Inferred) Extend the wrapper/iframe pattern to any future standalone case studies
- (Inferred) Keep Playwright/pytest suite in sync as dashboard HTML changes
