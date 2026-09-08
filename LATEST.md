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
- `lcagraph/`: LCA Graph — a JSON process-modelling language (PML) compiled into a calc graph, solved step by step, with targets + sensitivity (tornado/sweep/scenario/Monte Carlo); 4 models reproduce the standalone dashboards via golden replay; app at `lcagraph/app/`, linked from Resources > LCA Graph. Read `lcagraph/docs/plan.md` first.

## Recently tried
- 2026-09-08: Deleted the 4 case_studies/wrapper-*.html pages and js/case-study-frame.js — orphaned (0 inbound links) since resources.html started framing standalone/* directly. standalone/ stays: it is the reference the calc baselines are captured from and that lcagraph's goldens and the step-by-step models are checked against. Site is now 19/19 pages reachable from the homepage.
- 2026-09-08: Started the LCA Graph agentic beta: Cloudflare Worker proxy for OpenRouter with beta-code gating (`lcagraph/worker/`, tested locally), noindex gate page `lcagraph/app/beta.html`, "LCA Graph Beta" item in every Resources menu. Not deployed yet: needs wrangler login, KV namespace, two secrets, then the Worker URL pasted into beta.html.
- 2026-09-08: Laterite step-by-step gained Guided Mode (default) / Expert Mode. Guided gates the page to one engine-checked task per step and dims everything else; Expert is the old sandbox plus six practice questions under Goal & scope. Broke CI three times getting there — stepbystep.spec.js assumed the sandbox, the questions panel blew the one-screen budget, and hunk-staging a file another agent was editing shipped its assertions without its feature. Do not partial-stage a file someone else is mid-edit in.
- 2026-09-08: All browser specs moved off file:// onto an HTTP webServer; file:// gives an opaque origin, so localStorage throws and wrapper auto-fit silently never ran under test.
- 2026-09-08: Added the 4th step-by-step case study, PHA biocomposite (`case_studies/stepbystep/pha.html` + `models/pha.model.js`). The dashboard ships no flowsheet, so the topology was deduced from the balance equations and the sizing basis of each equipment-list row; reproduces the standalone exactly (1,000 t/y, TCI $16.18M, GWP 1.51 kg CO2e/kg, NPV $10.66M). Its mass balance does NOT close (-7.48%) and that is shown as an "Error being looked at" banner: 209.3 t/y of the 261.8 t/y gap is the biofiller being deducted twice in the published CHP-feed formula.

## Next
- Decide whether the PHA CHP-feed double-deduction should be fixed in the published dashboard, or kept and documented
- tests/case_study_typography_test.py and 3 other tests/*.py still assert HTML that has since changed (e.g. `.hdr-sub` in the PHA standalone, now a CSS custom property); out of the CI gate
- Switch Settings > Pages > Source to "GitHub Actions" or deploy-pages.yml's gate is inert
- Continue tuning PHA case-study economics (labor cost / jobs-per-Kt) based on commit cadence
- (Inferred) Extend the wrapper/iframe pattern to any future standalone case studies
