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
- `lcagraph/`: LCA Model (code name LCA Graph) — a JSON process-modelling language (PML) compiled into a calc graph, solved step by step, with targets + sensitivity (tornado/sweep/scenario/Monte Carlo); 4 models reproduce the standalone dashboards via golden replay; app at `lcagraph/app/`, linked from Try our Process Calculators > LCA Model. Read `lcagraph/docs/plan.md` first.

## Recently tried
- 2026-09-08: Renamed the product label to "LCA Model" (folder/code stay `lcagraph`); "Try our Process Calculators" is now a plain dropdown with four items (Case Studies, LCA Step by Step, LCA Model, LCA Graph (Beta)); the green pill styling on that menu entry is gone.
- 2026-09-08: Menus: "Try our Process Calculators" is now a dropdown (case studies, LCA Graph, LCA Graph (Beta)); the beta gate carries the site header/footer and, after the code, offers both the finished LCA Graph and the flowsheet drafter. Worker: cheap models only (Gemini 2.5 Flash) unless the user ticks "stronger model" or presses "retry with the stronger model"; price ceiling, monthly budget, per-code spend in KV. Cheap model now drafts a compiling Flue2Chem model in 4-5 rounds (~3 min, ~$0.10); numbers still need review.
- 2026-09-08: Deleted the 4 case_studies/wrapper-*.html pages and js/case-study-frame.js — orphaned (0 inbound links) since resources.html started framing standalone/* directly. standalone/ stays: it is the reference the calc baselines are captured from and that lcagraph's goldens and the step-by-step models are checked against. Site is now 19/19 pages reachable from the homepage.
- 2026-09-08: LCA Graph beta drafts a full PML model from an uploaded flowsheet image (+ text/data) via the Worker `/draft` route; browser-side compile/lint/solve loop with repair rounds and a plausibility pass; array literals added to the expression language. Live: compiling model from the Flue2Chem picture in 2 rounds.
- 2026-09-08: Started the LCA Graph agentic beta: Cloudflare Worker proxy for OpenRouter with beta-code gating (`lcagraph/worker/`, tested locally), noindex gate page `lcagraph/app/beta.html`, "LCA Graph Beta" item in every Resources menu. Not deployed yet: needs wrangler login, KV namespace, two secrets, then the Worker URL pasted into beta.html.

## Next
- Decide whether the PHA CHP-feed double-deduction should be fixed in the published dashboard, or kept and documented
- tests/case_study_typography_test.py and 3 other tests/*.py still assert HTML that has since changed (e.g. `.hdr-sub` in the PHA standalone, now a CSS custom property); out of the CI gate
- Switch Settings > Pages > Source to "GitHub Actions" or deploy-pages.yml's gate is inert
- Continue tuning PHA case-study economics (labor cost / jobs-per-Kt) based on commit cadence
- (Inferred) Extend the wrapper/iframe pattern to any future standalone case studies
