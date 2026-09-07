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
- Baseline (golden-file) calculation tests for all 4 LCA/TEA calculators in `tests/case_studies/` — see its README
- GitHub Actions: `tests.yml` on every push/PR, `deploy-pages.yml` gates the Pages deploy on it

## Recently tried
- 2026-09-07: Aligned the 4 case-study wrappers — all page-local <style>/<script> gone into css/case-study-format.css + js/case-study-frame.js; frame height/bg are now --cc-frame-* custom properties, locked by tests/case_studies/wrappers.style.spec.js
- 2026-09-07: Added the "Clove Circle" wordmark (Fraunces) beside the navbar logo on all 13 pages
- 2026-09-07: Built "Calculate LCA Step by Step" — click a stream/block on a drafted SVG flowsheet to edit it, press "Do mass balance" etc. per stage; editing marks downstream stale. All 3 models reproduce their standalone dashboards exactly (verified against live KPIs). Existing case study files untouched.
- 2026-09-07: Added tests/case_studies baseline calc tests (26 scenarios, 4 dashboards) + CI; mutation-verified they catch formula drift and ignore restyling
- 2026-09-07: Fixed hardcoded `D:\S\...` paths in tests/*.py; they now run but 5 of 6 FAIL on stale HTML assertions — left out of the CI gate

## Next
- Decide the fate of the stale markup tests (tests/*.py, tests/site.test.js): resources.html now links `standalone/*` directly, so the `case_studies/wrapper-*.html` pages look orphaned
- Switch Settings > Pages > Source to "GitHub Actions" or deploy-pages.yml's gate is inert
- Continue tuning PHA case-study economics (labor cost / jobs-per-Kt) based on commit cadence
- (Inferred) Extend the wrapper/iframe pattern to any future standalone case studies
