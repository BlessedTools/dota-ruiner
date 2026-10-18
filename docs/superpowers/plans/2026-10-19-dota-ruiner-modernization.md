# DOTA RUINER Modernization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the monolithic prototype with a tested, explainable, secure, accessible, static-first DOTA RUINER release containing every feature approved in the modernization spec.

**Architecture:** A Vite-built Vanilla JavaScript application consumes normalized OpenDota data through pure domain modules and renders safe view models through focused UI modules. A separate ESM Node server provides an optional localhost proxy with server-held credentials, caching, rate limiting, and confined static serving; GitHub Pages continues to run the keyless static build.

**Tech Stack:** Node.js 22+, Vanilla JavaScript ES modules, Vite, Vitest, jsdom, Playwright, axe-core, native Node HTTP APIs, Canvas 2D, localStorage, Service Worker API.

**Spec:** `docs/superpowers/specs/2026-10-19-dota-ruiner-modernization-design.md`

## Global Constraints

- Never fabricate match facts, time series, player names, or probability-like confidence percentages.
- Private OpenDota credentials come only from `OPENDOTA_API_KEY` on the local server and never enter browser code, browser storage, client-generated URLs, committed files, or logs.
- Score models are deterministic, versioned, explainable, normalized to 0–100, and exclude unavailable metrics instead of converting them to zero.
- Suppress the primary verdict below 50% weighted data coverage and show role/data uncertainty categorically.
- Store at most 15 compact, schema-versioned analysis snapshots; never store raw API responses or secrets.
- Demo data is immutable, starts only from its own action, never enters real-match history, and is labeled `DEMO` in the UI and exports.
- GitHub Pages must work as a static keyless deployment with no Node runtime assumptions.
- All untrusted strings are rendered through safe DOM APIs; remote image URLs are origin-allowlisted.
- New behavior follows red-green-refactor: verify each new test fails for the intended missing behavior before implementation.
- Preserve the recognizable dark Dota match identity, responsive layouts, keyboard access, visible focus, reduced motion, and 44×44 px interaction targets.

## Review Focus

- A partial OpenDota response containing `null`, numeric strings, `NaN`-like text, or uneven time-series arrays must produce unavailable components and visible warnings, not zeros or invented points; Task 2 adds fixture and normalization tests.
- A zero-kill, short, 9-player, or 11-player match must return a controlled analysis or explicit insufficient-data result without throwing; Tasks 2 and 3 add boundary fixtures and assertions.
- Two overlapping searches where the first resolves last must leave only the second result in the UI, hash, and history; Task 4 adds coordinator and browser tests.
- Hostile `personaname`, hero metadata, or image URLs must remain inert text/blocked URLs in the DOM and PNG export; Tasks 4 and 7 add jsdom and Playwright injection tests.
- Offline startup with corrupt/quota-blocked localStorage and an obsolete service-worker cache must still open the shell and labeled demo; Tasks 6 and 8 add storage and PWA browser tests.

---

### Task 1: Project Tooling and Test Harness

**Files:**
- Create: `package.json`
- Create: `package-lock.json`
- Create: `vite.config.js`
- Create: `vitest.config.js`
- Create: `playwright.config.js`
- Create: `tests/setup/dom.js`
- Create: `tests/unit/smoke.test.js`
- Modify: `.gitignore`
- Retain: `.nojekyll`

**Interfaces:**
- Consumes: Node.js 22+ and the current repository checkout.
- Produces: scripts `dev`, `start`, `build`, `preview`, `test`, `test:watch`, `test:e2e`, and `check`; Vite base-path configuration; Vitest jsdom/node projects; Playwright web-server configuration.

- [ ] **Step 1: Write the failing tooling smoke test**

  Add `tests/unit/smoke.test.js` importing the planned `src/data/scoring-config.js` and asserting that an exported `MODEL_VERSIONS` object contains `ruin-v2.0.0` and `impact-v2.0.0`.

- [ ] **Step 2: Run the test and verify RED**

  Run: `npm test -- tests/unit/smoke.test.js`  
  Expected: FAIL because the package/test configuration or module does not exist.

- [ ] **Step 3: Add the package and tool configuration**

  Pin Node `>=22`, Vite, Vitest, jsdom, Playwright, and axe-core. Configure GitHub Pages base from `GITHUB_REPOSITORY`, defaulting to `/`, and keep source maps out of the production build.

- [ ] **Step 4: Add the minimal scoring config export and ignore generated artifacts**

  Create `src/data/scoring-config.js` with only `MODEL_VERSIONS`; expand `.gitignore` for dependencies, build, coverage, Playwright artifacts, caches, logs, IDE files, and `.env*` while allowing `.env.example`.

- [ ] **Step 5: Install dependencies and verify GREEN**

  Run: `npm install` then `npm test -- tests/unit/smoke.test.js`  
  Expected: PASS with a committed lockfile and no warnings from project configuration.

- [ ] **Step 6: Commit**

  ```bash
  git add package.json package-lock.json vite.config.js vitest.config.js playwright.config.js tests/setup tests/unit/smoke.test.js src/data/scoring-config.js .gitignore
  git commit -m "build: add vite and test toolchain"
  ```

### Task 2: Match Normalization and Fixtures

**Files:**
- Create: `src/domain/normalize-match.js`
- Create: `src/data/demo-match.js`
- Create: `tests/fixtures/ranked.json`
- Create: `tests/fixtures/turbo.json`
- Create: `tests/fixtures/partial.json`
- Create: `tests/fixtures/zero-kill.json`
- Create: `tests/fixtures/abandon.json`
- Create: `tests/unit/normalize-match.test.js`
- Create: `tests/unit/demo-match.test.js`

**Interfaces:**
- Consumes: raw OpenDota match JSON or the bundled demo fixture.
- Produces: `normalizeMatch(raw, options?) -> NormalizedMatchResult`, `isFiniteMetric(value) -> boolean`, `DEMO_MATCH`, and `createDemoAnalysisInput()`. `NormalizedMatchResult` is `{ ok, match, warnings, errors }`; missing observed values remain `null`.

- [ ] **Step 1: Write failing normalization tests**

  Cover a valid Ranked fixture; Turbo mode detection; `null` and invalid numeric values; uneven `gold_t`/`xp_t`; unknown heroes; zero kills; five-minute minimum; fewer than two usable players; separated 9- and 11-player teams; and malformed player arrays. Assert warnings and controlled `ok: false` results rather than exceptions.

- [ ] **Step 2: Run tests and verify RED**

  Run: `npm test -- tests/unit/normalize-match.test.js`  
  Expected: FAIL because `normalizeMatch` is missing.

- [ ] **Step 3: Implement the normalized data boundary**

  Validate match identity, duration, modes, teams, finite metrics, optional names, parsing state, and observed series. Preserve sparse/unavailable fields as `null`; clip invalid trailing series values without interpolating gaps.

- [ ] **Step 4: Verify normalization GREEN**

  Run: `npm test -- tests/unit/normalize-match.test.js`  
  Expected: PASS for standard, partial, and unusual compositions.

- [ ] **Step 5: Write failing demo-isolation tests**

  Assert the bundled object is immutable, always has `source: 'demo'`, has a dedicated demo ID, and cannot accept a requested real Match ID through its factory.

- [ ] **Step 6: Implement the immutable demo module and verify GREEN**

  Run: `npm test -- tests/unit/demo-match.test.js`  
  Expected: PASS; demo creation never mutates or aliases caller data.

- [ ] **Step 7: Commit**

  ```bash
  git add src/domain/normalize-match.js src/data/demo-match.js tests/fixtures tests/unit/normalize-match.test.js tests/unit/demo-match.test.js
  git commit -m "feat: validate and normalize match data"
  ```

### Task 3: Role Inference and Versioned Scoring

**Files:**
- Modify: `src/data/scoring-config.js`
- Create: `src/domain/score-utils.js`
- Create: `src/domain/roles.js`
- Create: `src/domain/ruin-score.js`
- Create: `src/domain/impact-score.js`
- Create: `src/domain/confidence.js`
- Create: `src/domain/recommendations.js`
- Create: `tests/unit/score-utils.test.js`
- Create: `tests/unit/roles.test.js`
- Create: `tests/unit/scoring.test.js`
- Create: `tests/unit/confidence.test.js`
- Create: `tests/unit/recommendations.test.js`

**Interfaces:**
- Consumes: normalized match/player/team objects from Task 2 and optional hero-role metadata passed as plain data; Task 5 later supplies the live/fallback hero catalog.
- Produces: `inferRole(player, team, hero) -> { position, certainty, evidence }`; `normalizeScore(components) -> { score, dataCoverage }`; `calculateRuinScore(context)`; `calculateImpactScore(context)`; `assessConclusionQuality(analysis)`; `buildRecommendations(analysis)`.

- [ ] **Step 1: Write failing score utility tests**

  Assert clamping, available-weight renormalization, `null` for no available components, exact coverage calculation, determinism, and no mutation.

- [ ] **Step 2: Verify RED, implement minimal utilities, and verify GREEN**

  Run before and after: `npm test -- tests/unit/score-utils.test.js`  
  Expected RED: missing exports. Expected GREEN: all normalization cases pass.

- [ ] **Step 3: Write failing five-position role tests**

  Cover authoritative lane roles, roaming/support evidence, hero-role evidence, farm fallback, contradictory evidence, and explicit `unknown`. Include the low-GPM carry case from the audit.

- [ ] **Step 4: Implement role inference and verify GREEN**

  Run: `npm test -- tests/unit/roles.test.js`  
  Expected: PASS with categorical certainty and inspectable evidence.

- [ ] **Step 5: Write failing Ruin and Impact v2 tests**

  Assert documented weights, separate models, 0–100 bounds, standard/Turbo/generic profiles, duration normalization, zero-kill participation unavailable, `null` ward data unpenalized, abandon deduplication, real-only late/throw evidence, support contribution, positive factors, stable ties, and exact model versions.

- [ ] **Step 6: Implement config-driven scoring and verify GREEN**

  Run: `npm test -- tests/unit/scoring.test.js`  
  Expected: PASS across Ranked, Turbo, partial, zero-kill, and abandon fixtures.

- [ ] **Step 7: Write failing conclusion-quality and recommendation tests**

  Assert verdict suppression below 50% coverage, low/medium/high/insufficient labels, ambiguous co-leaders, no probability wording, evidence-backed “what helped,” and no recommendations from unavailable metrics.

- [ ] **Step 8: Implement quality assessment and recommendations, then run the domain suite**

  Run: `npm test -- tests/unit/score-utils.test.js tests/unit/roles.test.js tests/unit/scoring.test.js tests/unit/confidence.test.js tests/unit/recommendations.test.js`  
  Expected: PASS with no snapshots hiding numeric assertions.

- [ ] **Step 9: Commit**

  ```bash
  git add src/data/scoring-config.js src/domain tests/unit/score-utils.test.js tests/unit/roles.test.js tests/unit/scoring.test.js tests/unit/confidence.test.js tests/unit/recommendations.test.js
  git commit -m "feat: add explainable scoring model v2"
  ```

### Task 4: API Client and Last-Request-Wins Coordination

**Files:**
- Create: `src/api/opendota.js`
- Create: `src/api/client.js`
- Create: `tests/unit/api-client.test.js`
- Create: `tests/unit/request-coordinator.test.js`

**Interfaces:**
- Consumes: validated Match IDs and an injected `fetch` implementation.
- Produces: `parseMatchInput(value) -> { ok, matchId, errorKey }`; `fetchMatch(matchId, options) -> Promise<raw>`; `createRequestCoordinator() -> { run(task), cancel(), isCurrent(token) }`; typed `ApiError` codes.

- [ ] **Step 1: Write failing input and API error tests**

  Cover exact 7–12 digit IDs, supported URLs with exactly one ID, rejected mixed/ambiguous input, localhost proxy-first routing, static public routing, timeouts, 404, 429, invalid JSON, partial response, and no browser API-key parameter.

- [ ] **Step 2: Implement parsing and fetch adapter, then verify GREEN**

  Run: `npm test -- tests/unit/api-client.test.js`  
  Expected: PASS; outbound browser URLs contain no `api_key`.

- [ ] **Step 3: Write failing overlapping-request tests**

  Resolve the second promise first and the first promise last; assert only the second callbacks can update results, status, hash, and persistence hooks.

- [ ] **Step 4: Implement AbortController/token coordination and verify GREEN**

  Run: `npm test -- tests/unit/request-coordinator.test.js`  
  Expected: PASS for abort-aware and abort-ignoring fetch implementations.

- [ ] **Step 5: Commit**

  ```bash
  git add src/api tests/unit/api-client.test.js tests/unit/request-coordinator.test.js
  git commit -m "feat: add reliable opendota client"
  ```

### Task 5: Hero Constants, Localization, and Accessible Application Shell

**Files:**
- Replace: `index.html`
- Create: `src/main.js`
- Create: `src/data/heroes.js`
- Create: `src/data/i18n.js`
- Create: `src/ui/states.js`
- Create: `src/ui/render.js`
- Create: `src/styles/main.css`
- Create: `public/icons/icon.svg`
- Create: `public/og-image.svg`
- Create: `tests/unit/heroes.test.js`
- Create: `tests/unit/i18n.test.js`
- Create: `tests/unit/render.test.js`

**Interfaces:**
- Consumes: Tasks 2–4 domain/API results and current OpenDota hero constants.
- Produces: `loadHeroConstants(options)`, `getHero(id)`, `isAllowedHeroImage(url)`; `createI18n(locale)`; safe DOM render functions; `renderIdle`, `renderLoading`, `renderError`, and `renderAnalysis` states.

- [ ] **Step 1: Write failing hero and localization tests**

  Cover live constants merge, bundled fallback including Ringmaster/Kez/Largo, unknown heroes, allowed Steam/OpenDota HTTPS portraits, rejected schemes/origins, RU/EN completeness, locale persistence, and `Intl` formatting.

- [ ] **Step 2: Implement hero/i18n modules and verify GREEN**

  Run: `npm test -- tests/unit/heroes.test.js tests/unit/i18n.test.js`  
  Expected: PASS without relying on network access.

- [ ] **Step 3: Write failing safe-render and accessibility structure tests**

  Assert hostile names render as text, no inline event handlers or untrusted `innerHTML`, form label association, landmarks/headings, skip link, live status, `aria-busy`, disabled/loading controls, coverage/warning text, explicit heuristic disclaimer, positive and negative factors, and persistent demo label.

- [ ] **Step 4: Build the shell and focused render/state modules**

  Replace the monolith with semantic HTML, module entrypoint, evidence-led verdict layout, skeleton state, mobile player cards, safe element construction, minimal critical shell CSS, font preconnect/preload, and the approved palette/type hierarchy. Keep all user-facing strings in i18n catalogs.

- [ ] **Step 5: Verify render GREEN and production build**

  Run: `npm test -- tests/unit/render.test.js` then `npm run build`  
  Expected: PASS and a static `dist` with no inline application script or stylesheet monolith.

- [ ] **Step 6: Commit**

  ```bash
  git add index.html src/main.js src/data/heroes.js src/data/i18n.js src/ui/states.js src/ui/render.js src/styles/main.css public/icons/icon.svg public/og-image.svg tests/unit/heroes.test.js tests/unit/i18n.test.js tests/unit/render.test.js
  git commit -m "feat: rebuild accessible modular interface"
  ```

### Task 6: Real Match Charts

**Files:**
- Create: `src/ui/chart.js`
- Create: `tests/unit/chart.test.js`
- Create: `tests/e2e/chart.spec.js`
- Modify: `src/ui/render.js`
- Modify: `src/styles/main.css`

**Interfaces:**
- Consumes: validated observed `gold_t`, `xp_t`, and compatible hero-damage series from normalized analyses.
- Produces: `getAvailableChartMetrics(match)`, `buildChartSeries(match, metric)`, and `createMatchChart(container, options)` with `render`, `resize`, and `destroy` methods.

- [ ] **Step 1: Write failing series-selection tests**

  Assert only real arrays create points, gaps stay gaps, unequal arrays clip safely, unavailable damage disables its tab, final totals never become timelines, and leader emphasis includes non-color stroke metadata.

- [ ] **Step 2: Implement chart data functions and verify GREEN**

  Run: `npm test -- tests/unit/chart.test.js`  
  Expected: PASS with no synthetic interpolation or `GPM × time` logic.

- [ ] **Step 3: Write failing browser chart tests**

  Verify Gold/XP switching, disabled unavailable tabs, pointer and keyboard tooltip values, accessible data table, ResizeObserver redraw, long-name legend, and the no-timeline fallback.

- [ ] **Step 4: Implement Canvas 2D chart and accessible table alternative**

  Render only `buildChartSeries` output, use CSS pixels with device-pixel scaling, expose focusable observation controls, and destroy observers/listeners between analyses.

- [ ] **Step 5: Verify chart browser flow**

  Run: `npm run test:e2e -- tests/e2e/chart.spec.js`  
  Expected: PASS at desktop and mobile projects.

- [ ] **Step 6: Commit**

  ```bash
  git add src/ui/chart.js src/ui/render.js src/styles/main.css tests/unit/chart.test.js tests/e2e/chart.spec.js
  git commit -m "feat: render observed match timelines"
  ```

### Task 7: History, Comparison, and PNG Sharing

**Files:**
- Create: `src/storage/history.js`
- Create: `src/ui/comparison.js`
- Create: `src/ui/share-card.js`
- Create: `tests/unit/history.test.js`
- Create: `tests/unit/comparison.test.js`
- Create: `tests/unit/share-card.test.js`
- Create: `tests/e2e/history-share.spec.js`
- Modify: `src/main.js`
- Modify: `src/ui/render.js`
- Modify: `src/styles/main.css`

**Interfaces:**
- Consumes: completed non-demo analysis view models and injected storage/canvas/share adapters.
- Produces: `createHistoryStore(storage)`, `toHistorySnapshot(analysis)`, `compareAnalyses(left, right)`, and `exportShareCard(analysis, options)`.

- [ ] **Step 1: Write failing history tests**

  Cover schema version, 15-entry eviction, compact/downsampled series, no raw response or secret fields, demo exclusion, duplicate Match ID replacement, corrupt JSON, incompatible records, quota errors, and estimated-size eviction.

- [ ] **Step 2: Implement bounded history and verify GREEN**

  Run: `npm test -- tests/unit/history.test.js`  
  Expected: PASS even when storage throws on read or write.

- [ ] **Step 3: Write failing comparison tests**

  Assert selection of previous/arbitrary matches, duration/mode/coverage/team/player comparisons, explicit non-comparability across major model versions, missing-player handling, and no misleading raw-score ranking.

- [ ] **Step 4: Implement comparison view model/UI and verify GREEN**

  Run: `npm test -- tests/unit/comparison.test.js`  
  Expected: PASS with localized labels supplied by the caller.

- [ ] **Step 5: Write failing PNG export tests**

  Assert real Match ID or `DEMO`, model versions, coverage, disclaimer, observed/derived factors, limited hostile text, deterministic dimensions, Web Share preference, and download fallback.

- [ ] **Step 6: Implement export and verify unit/browser GREEN**

  Run: `npm test -- tests/unit/share-card.test.js` then `npm run test:e2e -- tests/e2e/history-share.spec.js`  
  Expected: PASS for history reopen, comparison, locale persistence, PNG download, and hostile names.

- [ ] **Step 7: Commit**

  ```bash
  git add src/storage src/ui/comparison.js src/ui/share-card.js src/main.js src/ui/render.js src/styles/main.css tests/unit/history.test.js tests/unit/comparison.test.js tests/unit/share-card.test.js tests/e2e/history-share.spec.js
  git commit -m "feat: add match history comparison and sharing"
  ```

### Task 8: PWA and Offline Behavior

**Files:**
- Create: `public/manifest.webmanifest`
- Create: `public/service-worker.js`
- Create: `public/icons/icon-192.svg`
- Create: `public/icons/icon-512.svg`
- Create: `public/apple-touch-icon.svg`
- Create: `tests/e2e/pwa.spec.js`
- Modify: `index.html`
- Modify: `src/main.js`
- Modify: `vite.config.js`

**Interfaces:**
- Consumes: built application shell, immutable demo module, and Task 7 local history.
- Produces: install metadata, build-versioned shell cache, offline navigation fallback, explicit offline/demo state, and service-worker registration.

- [ ] **Step 1: Write failing PWA browser tests**

  Assert manifest/icon links, service-worker registration, shell reload offline, labeled demo offline, latest saved analysis reopening, no claim that uncached Match IDs are live, obsolete-cache cleanup, and startup with corrupt/blocked storage.

- [ ] **Step 2: Implement manifest, icons, and service worker**

  Precache hashed build assets plus demo support, use stale-while-revalidate only for same-origin static assets, never cache API errors as match data, and remove old named caches during activation.

- [ ] **Step 3: Verify PWA GREEN**

  Run: `npm run build` then `npm run test:e2e -- tests/e2e/pwa.spec.js`  
  Expected: PASS in Chromium with network disabled after initial installation.

- [ ] **Step 4: Commit**

  ```bash
  git add public/manifest.webmanifest public/service-worker.js public/icons public/apple-touch-icon.svg index.html src/main.js vite.config.js tests/e2e/pwa.spec.js
  git commit -m "feat: add explicit offline pwa support"
  ```

### Task 9: Secure Local Proxy Server

**Files:**
- Replace: `server.js`
- Create: `server/cache.js`
- Create: `server/limiter.js`
- Create: `server/logger.js`
- Create: `.env.example`
- Create: `tests/unit/server-cache.test.js`
- Create: `tests/unit/server-limiter.test.js`
- Create: `tests/unit/server.test.js`

**Interfaces:**
- Consumes: `PORT`, `HOST`, and optional `OPENDOTA_API_KEY` environment variables; built `dist` assets; injected upstream `fetch` and clock in tests.
- Produces: `createServer(options)`, bounded `TtlCache`, token-bucket `RateLimiter`, request coalescing/queue behavior, redacted structured logging, and `shutdown(signal)`.

- [ ] **Step 1: Write failing cache and limiter tests**

  Cover 10-minute TTL, bounded LRU-style eviction, no failed-response caching, per-client token refill, retry metadata, bounded queue, same-ID coalescing, and clock injection.

- [ ] **Step 2: Implement cache/limiter modules and verify GREEN**

  Run: `npm test -- tests/unit/server-cache.test.js tests/unit/server-limiter.test.js`  
  Expected: PASS without real timers or network.

- [ ] **Step 3: Write failing server integration tests**

  Cover `127.0.0.1` default binding, GET/HEAD only, full `^\d{7,12}$` path validation, localhost/same-origin CORS, public static confinement to `dist`, traversal/dotfile/source/`.env`/`.git` denial, async HEAD responses, upstream timeout/size limit/status mapping, server-only credential forwarding, log redaction, cache headers, and graceful shutdown.

- [ ] **Step 4: Implement the server and verify GREEN**

  Read the optional key once from the environment, keep it out of returned errors/logs, use an Authorization header where supported and a redacted server-only upstream query fallback where required. Do not accept browser-supplied keys.

  Run: `npm test -- tests/unit/server.test.js`  
  Expected: PASS using ephemeral loopback ports and injected upstream responses.

- [ ] **Step 5: Verify the production-like local flow**

  Run: `npm run build`, start `npm start`, request `/`, a valid mocked/API route when configured, `.env`, `.git/config`, traversal encodings, POST, and HEAD.  
  Expected: shell/HEAD succeed; sensitive paths, traversal, and unsupported methods are rejected; logs contain no secret.

- [ ] **Step 6: Commit**

  ```bash
  git add server.js server .env.example tests/unit/server-cache.test.js tests/unit/server-limiter.test.js tests/unit/server.test.js package.json
  git commit -m "feat: harden local opendota proxy"
  ```

### Task 10: End-to-End Behavior, Accessibility, CI, and Documentation

**Files:**
- Create: `tests/e2e/analysis.spec.js`
- Create: `tests/e2e/accessibility.spec.js`
- Create: `.github/workflows/ci.yml`
- Create: `.github/workflows/pages.yml`
- Create: `CONTRIBUTING.md`
- Create: `LICENSE`
- Create: `docs/screenshots/analysis-desktop.png`
- Create: `docs/screenshots/analysis-mobile.png`
- Replace: `README.md`
- Modify: any source file revealed by release verification failures

**Interfaces:**
- Consumes: the complete application and server from Tasks 1–9.
- Produces: reproducible release checks, GitHub Pages artifact, contributor guidance, and verified user journeys.

- [ ] **Step 1: Write failing critical-flow browser tests**

  Cover successful real fixture analysis, API failure without demo substitution, partial data warnings, insufficient-data verdict suppression, two rapid searches, unknown hero, anonymous player, 9/11-player matches, loading skeleton, RU/EN, responsive verdict cards, and final-value fallback without a timeline.

- [ ] **Step 2: Run the critical flow and verify RED**

  Run: `npm run test:e2e -- tests/e2e/analysis.spec.js`  
  Expected: at least the not-yet-integrated end-to-end behaviors fail for the intended reason.

- [ ] **Step 3: Complete main-entry integration and verify GREEN**

  Wire API, normalization, scoring, rendering, charts, history, comparison, export, locale, URL hash, and request coordinator. Fix integration defects without weakening assertions.

  Run: `npm run test:e2e -- tests/e2e/analysis.spec.js`  
  Expected: PASS in desktop and mobile projects.

- [ ] **Step 4: Add failing axe and keyboard assertions**

  Test idle, loading, error, real-analysis, demo, history, comparison, and chart states for serious/critical axe violations; exercise Tab/Enter/Space, visible focus, logical headings/landmarks, live-region updates, target size, and reduced-motion CSS.

- [ ] **Step 5: Fix accessibility findings and verify GREEN**

  Run: `npm run test:e2e -- tests/e2e/accessibility.spec.js`  
  Expected: no serious/critical automated violations and all keyboard assertions pass.

- [ ] **Step 6: Add CI and Pages workflows**

  CI uses `npm ci`, Playwright browser installation/cache, `npm run check`, and artifact upload on browser failure. Pages builds `dist` with the repository base path, includes `.nojekyll`, and deploys only on the configured main branch.

- [ ] **Step 7: Replace repository documentation**

  Capture deterministic desktop and mobile screenshots from the demo fixture with Playwright. Document architecture, scoring/model-version limits, coverage/quality semantics, OpenDota parsing limitations, Windows/macOS/Linux setup, environment variables, PWA/history behavior, scripts, Pages deployment, security boundary, screenshots, MIT badge/license, and contribution rules for tuning weights.

- [ ] **Step 8: Run the complete release gate**

  Run: `npm run check`  
  Expected: unit suite, production build, and all Playwright projects PASS with pristine output.

- [ ] **Step 9: Perform manual proportional checks**

  Verify keyboard navigation, 200% zoom, Windows high contrast, reduced motion, mobile widths, offline demo label, local server shutdown, and that no repository/build file contains a real API key. Record the results in README's verification section or a release checklist.

- [ ] **Step 10: Review the final diff against all 18 acceptance criteria**

  Run: `git diff 1a776d6 --check`, `git status --short`, and targeted `rg` searches for old synthetic-chart logic, automatic demo fallback, `innerHTML`, browser `api_key`, and numeric confidence copy.  
  Expected: no whitespace errors, no unintended files, and no prohibited legacy behavior.

- [ ] **Step 11: Commit**

  ```bash
  git add tests/e2e .github README.md CONTRIBUTING.md LICENSE docs/screenshots src index.html public server.js server package.json package-lock.json
  git commit -m "release: ship dota ruiner modernization"
  ```

## Execution Notes

- Execute tasks sequentially because the normalized model and scoring interfaces are dependencies for every later feature.
- Do not preserve the old inline implementation as a reference during coding; tests and the approved spec define the new behavior.
- If OpenDota does not expose a compatible observed hero-damage time series, keep that chart tab disabled as specified rather than approximating it.
- If a planned test reveals that an upstream field differs from the fixture assumptions, update the normalization adapter and fixture provenance notes, not the integrity constraints.
- Use native execution in the current session unless the user explicitly requests agent delegation.
