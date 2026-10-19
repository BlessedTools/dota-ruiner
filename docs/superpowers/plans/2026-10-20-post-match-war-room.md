# Post-Match War Room Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a data-rich Russian-language Dota 2 post-match analysis that uses only observed OpenDota data and presents it through a distinctive broadcast-style interface.

**Architecture:** Extend the existing normalization boundary, then derive availability, team summaries, structured insights, narrative, and versioned scores as pure domain modules. `main.js` composes those outputs into a view model consumed by focused DOM renderers; charts, persistence, sharing, and PWA remain adapters around that model.

**Tech Stack:** Vanilla JavaScript ES modules, Vite, Vitest/jsdom, Playwright, Canvas 2D, OpenDota public API.

**Spec:** `docs/superpowers/specs/2026-10-20-post-match-war-room-design.md`

## Global Constraints

- Never synthesize unavailable match timelines, confidence percentages, player behavior, or intent.
- GitHub Pages uses only the public OpenDota API; `OPENDOTA_API_KEY` stays server-side in local Node deployments.
- Ruin Score and Impact Score are versioned heuristic indices, never probabilities.
- Missing scoring factors provide neither penalty nor reward.
- All user-controlled strings render through `textContent` or safe attributes, never `innerHTML`.
- Store only compact normalized history snapshots, with a maximum of 15 entries and a 2.5 MB budget.
- Preserve RU/EN operation, explicit fictional demo labeling, abortable requests, keyboard access, reduced motion, forced colors, and 200% reflow.
- Keep first-party production JavaScript and CSS below 120 KB gzip, excluding images.
- Do not track generated `dist`; GitHub Actions builds it for Pages.

## Review Focus

- A valid but unparsed match must still show a rich basic scoreboard while every timeline/event claim stays absent; Task 1 and Task 8 pin this behavior.
- A malicious persona name such as `<img onerror=alert(1)>` must appear as text and execute nothing; Task 7 owns the DOM test.
- A match with nulls, zero team kills, fewer or more than ten players, and partial benchmarks must not emit `NaN`, `Infinity`, or fabricated prose; Tasks 1–3 own these tests.
- A slow first request followed by a fast second request must never replace the current analysis; Task 5 preserves the race E2E test.
- A saved schema-v2 history entry must migrate or degrade safely after the richer schema is introduced; Task 10 owns the migration test.

---

### Task 1: Rich OpenDota normalization and availability

**Files:**
- Modify: `src/domain/normalize-match.js`
- Create: `src/domain/data-availability.js`
- Modify: `tests/fixtures/ranked.json`
- Create: `tests/fixtures/unparsed-rich.json`
- Modify: `tests/unit/normalize-match.test.js`
- Create: `tests/unit/data-availability.test.js`

**Interfaces:**
- Consumes: raw `GET /matches/{match_id}` JSON.
- Produces: `normalizeMatch(raw, options) -> { ok, match, warnings, errors }` with bounded rich fields; `buildDataAvailability(match) -> { overall, categories }` where category status is `available | partial | missing`.

- [ ] **Step 1: Write failing normalization tests**

Add tests asserting match metadata, backpack/neutral/Aghanim state, combat/support metrics, bounded logs, team advantage arrays, objectives, teamfights, and sanitized finite values. Add a test proving an unparsed match retains basic fields without gaining parsed timelines.

- [ ] **Step 2: Run the normalization tests and verify RED**

Run: `npm test -- tests/unit/normalize-match.test.js`

Expected: FAIL because the new normalized properties do not exist.

- [ ] **Step 3: Implement the bounded normalized schema**

Add explicit normalizers for numeric series, item slots, event logs, objectives, and teamfights. Cap each event list at 256 entries and each player timeline at match duration plus two samples; discard unknown object properties.

- [ ] **Step 4: Write failing availability tests**

Cover basic-only, benchmark, fully parsed, mixed-player partial, zero-kill, and unusual-player-count matches. Assert exact category statuses and Russian-neutral reason identifiers.

- [ ] **Step 5: Run availability tests and verify RED**

Run: `npm test -- tests/unit/data-availability.test.js`

Expected: FAIL because `buildDataAvailability` is missing.

- [ ] **Step 6: Implement `buildDataAvailability(match)`**

Categories: `summary`, `benchmarks`, `economyTimeline`, `combatTimeline`, `teamfights`, `objectives`, `support`, `purchases`. Return identifiers rather than rendered copy.

- [ ] **Step 7: Run Task 1 tests and commit**

Run: `npm test -- tests/unit/normalize-match.test.js tests/unit/data-availability.test.js`

Expected: PASS.

Commit: `feat: normalize rich OpenDota match data`

### Task 2: Team summaries and factual comparisons

**Files:**
- Create: `src/domain/team-summary.js`
- Create: `tests/unit/team-summary.test.js`

**Interfaces:**
- Consumes: normalized `match.players`.
- Produces: `buildTeamSummaries(match) -> [{ id, totals, averages, observed }]`; `compareTeams(summaries) -> Comparison[]` with `{ metric, radiant, dire, leader, delta, ratio }`.

- [ ] **Step 1: Write failing aggregation tests**

Assert exact totals for kills, deaths, assists, net worth, GPM, XPM, hero damage, tower damage, healing, last hits, and denies. Assert null metrics remain unavailable rather than becoming zero.

- [ ] **Step 2: Run and verify RED**

Run: `npm test -- tests/unit/team-summary.test.js`

Expected: FAIL because the module is missing.

- [ ] **Step 3: Implement team aggregation and comparison**

Use only finite observed values. Include observed player count per metric so partial sums can be labeled and avoid percentage comparisons when one side is zero or incomplete.

- [ ] **Step 4: Add the Review Focus edge test**

Assert zero kills, partial nulls, and a 4v5 fixture never return `NaN`, `Infinity`, or a full-data comparison label.

- [ ] **Step 5: Run and commit**

Run: `npm test -- tests/unit/team-summary.test.js`

Expected: PASS.

Commit: `feat: derive observed team summaries`

### Task 3: Structured insights and Russian narrative

**Files:**
- Create: `src/domain/insights.js`
- Create: `src/domain/narrative.js`
- Create: `tests/unit/insights.test.js`
- Create: `tests/unit/narrative.test.js`
- Modify: `src/data/i18n.js`
- Modify: `tests/unit/i18n.test.js`

**Interfaces:**
- Consumes: normalized player, match, score components, availability, and team comparisons.
- Produces: `buildPlayerInsights(context) -> Insight[]`; `buildMatchNarrative(context, locale) -> { lead, paragraphs, limitations }`.

- [ ] **Step 1: Write failing insight tests**

Assert insight objects contain `id`, `tone`, `metric`, `evidence`, and `availability`; cover economy, combat, survival, objectives, healing, vision, late observed throws, strong percentiles, and abandon.

- [ ] **Step 2: Run and verify RED**

Run: `npm test -- tests/unit/insights.test.js`

Expected: FAIL because the module is missing.

- [ ] **Step 3: Implement structured insights**

Generate an insight only when its required observed fields exist. Keep thresholds in a frozen exported config and never infer intent.

- [ ] **Step 4: Write failing narrative and localization tests**

Assert Russian prose names exact observed values, identifies partial categories, and never contains unsupported phrases such as `афк`, `тильт`, `специально`, or a confidence percentage. Verify partial/null fixtures contain no `NaN` or `Infinity`.

- [ ] **Step 5: Run and verify RED**

Run: `npm test -- tests/unit/narrative.test.js tests/unit/i18n.test.js`

Expected: FAIL because narrative functions and keys are missing.

- [ ] **Step 6: Implement narrative templates and RU/EN keys**

Use sentence templates keyed by insight IDs and comparison metrics. Limit the match lead to three observations and player verdicts to four strengths plus four weaknesses.

- [ ] **Step 7: Run and commit**

Run: `npm test -- tests/unit/insights.test.js tests/unit/narrative.test.js tests/unit/i18n.test.js`

Expected: PASS.

Commit: `feat: explain match insights in Russian`

### Task 4: Scoring v4 evidence contract

**Files:**
- Modify: `src/data/scoring-config.js`
- Modify: `src/domain/ruin-score.js`
- Modify: `src/domain/impact-score.js`
- Modify: `src/domain/recommendations.js`
- Modify: `tests/unit/scoring.test.js`
- Modify: `tests/unit/recommendations.test.js`

**Interfaces:**
- Consumes: normalized player/team/match and role.
- Produces: `calculateRuinScore(context)` and `calculateImpactScore(context)` using model versions `ruin-v4.0.0` and `impact-v4.0.0`; every component exposes structured evidence and `source`.

- [ ] **Step 1: Write failing v4 contract tests**

Assert exact model versions, source identifiers, structured evidence, unavailable-factor normalization, death-percentile direction, role-uncertainty behavior, and no score changes from narrative-only insights.

- [ ] **Step 2: Run and verify RED**

Run: `npm test -- tests/unit/scoring.test.js tests/unit/recommendations.test.js`

Expected: FAIL on v3 versions and string evidence.

- [ ] **Step 3: Implement scoring v4**

Retain documented weights unless a failing fixture exposes an invalid calculation. Replace presentation strings with evidence data and translate them only in the UI/narrative boundary.

- [ ] **Step 4: Run and commit**

Run: `npm test -- tests/unit/scoring.test.js tests/unit/recommendations.test.js`

Expected: PASS.

Commit: `feat: version scoring evidence as v4`

### Task 5: Constants, assets, and application view model

**Files:**
- Modify: `src/api/opendota.js`
- Modify: `src/api/client.js`
- Create: `src/data/match-constants.js`
- Modify: `src/data/heroes.js`
- Modify: `src/main.js`
- Modify: `tests/unit/api-client.test.js`
- Create: `tests/unit/match-constants.test.js`
- Modify: `tests/unit/request-coordinator.test.js`
- Modify: `tests/unit/smoke.test.js`

**Interfaces:**
- Consumes: OpenDota match and constants endpoints plus Tasks 1–4 domain outputs.
- Produces: cached `fetchConstants()` lookup maps and `buildAnalysis(match, constants, locale)` with metadata, availability, summaries, comparisons, narrative, leaders, teams, items, scores, and insights.

- [ ] **Step 1: Write failing constants tests**

Assert safe lookup and fallback behavior for heroes, items, game modes, lobby types, regions, and patches; reject non-OpenDota/Steam image schemes.

- [ ] **Step 2: Run and verify RED**

Run: `npm test -- tests/unit/match-constants.test.js tests/unit/api-client.test.js`

Expected: FAIL because constants aggregation is missing.

- [ ] **Step 3: Implement cached constants loading**

Fetch independent maps concurrently, tolerate an individual constants failure, and cache the normalized result in memory. Keep match fetching abortable.

- [ ] **Step 4: Write failing view-model tests**

Assert `buildAnalysis` exposes the complete Task 1–4 contract and preserves all existing partial/demo warnings. Extend the coordinator test so a stale response cannot update the enriched model.

- [ ] **Step 5: Run and verify RED**

Run: `npm test -- tests/unit/smoke.test.js tests/unit/request-coordinator.test.js`

Expected: FAIL on absent view-model sections.

- [ ] **Step 6: Compose the enriched analysis in `main.js`**

Keep domain calculations pure; `main.js` coordinates loading, model creation, history, chart binding, and render callbacks.

- [ ] **Step 7: Run and commit**

Run: `npm test -- tests/unit/api-client.test.js tests/unit/match-constants.test.js tests/unit/request-coordinator.test.js tests/unit/smoke.test.js`

Expected: PASS.

Commit: `feat: compose enriched match analysis`

### Task 6: Match Arena, Duel, and Match Story renderers

**Files:**
- Create: `src/ui/dom.js`
- Create: `src/ui/match-arena.js`
- Create: `src/ui/duel.js`
- Create: `src/ui/match-story.js`
- Modify: `src/ui/render.js`
- Modify: `tests/unit/render.test.js`

**Interfaces:**
- Consumes: Task 5 analysis view model and i18n object.
- Produces: `el(tag, options, children)` safe DOM helper plus DOM nodes through `renderMatchArena`, `renderDuel`, and `renderMatchStory`; `renderAnalysis` composes them.

- [ ] **Step 1: Write failing DOM tests**

Assert result, score, metadata, category availability, hero art, items, versioned scores, Russian verdicts, exact evidence values, comparative team bars, and visible partial-data labels.

- [ ] **Step 2: Run and verify RED**

Run: `npm test -- tests/unit/render.test.js`

Expected: FAIL because the new sections and selectors are absent.

- [ ] **Step 3: Implement focused safe renderers**

Move the generic DOM helper to `src/ui/dom.js` and import it from every renderer. Hero art is eager only for Duel; item images have accessible names or decorative empty alt depending on adjacent text.

- [ ] **Step 4: Run and commit**

Run: `npm test -- tests/unit/render.test.js`

Expected: PASS.

Commit: `feat: render the post-match arena and duel`

### Task 7: Team Scoreboard and Player Inspector

**Files:**
- Create: `src/ui/scoreboard.js`
- Create: `src/ui/player-inspector.js`
- Modify: `src/ui/render.js`
- Create: `tests/unit/player-inspector.test.js`
- Modify: `tests/unit/render.test.js`
- Modify: `tests/e2e/analysis.spec.js`
- Modify: `tests/e2e/accessibility.spec.js`

**Interfaces:**
- Consumes: `analysis.teams[].players[]` enriched view models.
- Produces: `renderScoreboard(analysis, i18n, onSelect)` and `renderPlayerInspector(player, i18n)`; selected player state is represented by `aria-expanded` and an in-flow detail region.

- [ ] **Step 1: Write failing scoreboard and inspector tests**

Assert visible KDA, level, role, economy, damage, scores, six items, neutral item, and tabs for overview/economy/combat/support/scoring. Assert unavailable categories explain why.

- [ ] **Step 2: Add the XSS and keyboard tests**

Render persona name `<img src=x onerror=alert(1)>`; assert it remains text, no image is created from the name, and no handler executes. Assert Enter/Space expands a row and focus order remains logical.

- [ ] **Step 3: Run and verify RED**

Run: `npm test -- tests/unit/player-inspector.test.js tests/unit/render.test.js`

Expected: FAIL because the components are missing.

- [ ] **Step 4: Implement scoreboard and in-flow inspector**

Use native buttons for player rows and tab controls following WAI-ARIA tabs behavior only where all keyboard interactions are implemented. On mobile, keep primary row metrics and move secondary values into the inspector.

- [ ] **Step 5: Update E2E selectors and interactions**

Test selection, keyboard expansion, mobile readability, and axe states for both teams and every inspector tab.

- [ ] **Step 6: Run and commit**

Run: `npm test -- tests/unit/player-inspector.test.js tests/unit/render.test.js && npx playwright test tests/e2e/analysis.spec.js tests/e2e/accessibility.spec.js`

Expected: PASS.

Commit: `feat: add detailed player inspection`

### Task 8: Real timelines and observed events

**Files:**
- Modify: `src/ui/chart.js`
- Create: `src/domain/timeline.js`
- Modify: `tests/unit/chart.test.js`
- Create: `tests/unit/timeline.test.js`
- Modify: `tests/e2e/chart.spec.js`

**Interfaces:**
- Consumes: normalized real series, advantages, and bounded logs.
- Produces: `buildTimeline(match) -> { metrics, events, source }`; chart renders only entries in `metrics` and a text table equivalent.

- [ ] **Step 1: Write failing timeline tests**

Assert team net worth is summed from every observed `networth_t`; advantage series retains its OpenDota source label; events include only observed deaths, buybacks, objectives, and teamfights.

- [ ] **Step 2: Add the unparsed-match negative test**

For `unparsed-rich.json`, assert `metrics` and `events` are empty and no GPM approximation is produced.

- [ ] **Step 3: Run and verify RED**

Run: `npm test -- tests/unit/timeline.test.js tests/unit/chart.test.js`

Expected: FAIL because the timeline model is absent.

- [ ] **Step 4: Implement timeline model and chart binding**

Available metric order: Net worth, Gold earned, XP, Hero Damage. Preserve hover/focus tooltips, highlighted leaders, and accessible technical table.

- [ ] **Step 5: Update E2E chart expectations**

Test parsed metric switching and unparsed explanatory empty state.

- [ ] **Step 6: Run and commit**

Run: `npm test -- tests/unit/timeline.test.js tests/unit/chart.test.js && npx playwright test tests/e2e/chart.spec.js`

Expected: PASS.

Commit: `feat: visualize observed match timelines`

### Task 9: Broadcast visual system and responsive composition

**Files:**
- Modify: `index.html`
- Modify: `src/styles/main.css`
- Modify: `src/styles/accessibility.css`
- Modify: `tests/e2e/accessibility.spec.js`
- Modify: `tests/e2e/analysis.spec.js`

**Interfaces:**
- Consumes: semantic DOM from Tasks 6–8.
- Produces: the Obsidian/Iron/Steel/Parchment/Radiant/Dire/Aegis token system, 12-column desktop composition, mobile hierarchy, visible focus, reduced motion, and forced-colors support.

- [ ] **Step 1: Add failing visual-structure E2E assertions**

Assert desktop Duel occupies two balanced fronts, scoreboard columns align, primary text does not overlap at 1440×1000, and mobile at 390×844 has no horizontal overflow. Preserve 200% reflow and minimum target-size assertions.

- [ ] **Step 2: Run and verify RED**

Run: `npx playwright test tests/e2e/analysis.spec.js tests/e2e/accessibility.spec.js`

Expected: FAIL on the new layout contract.

- [ ] **Step 3: Implement the token and layout system**

Use Duel as the single visually loud area. Blend art into panels through one directional mask/gradient; avoid generic card repetition, decorative all-caps labels, and motion unrelated to user actions.

- [ ] **Step 4: Verify rendered screenshots manually**

Run the local Vite server, load `9048925949` plus parsed fixture routes at 1440×1000 and 390×844, and inspect hierarchy, clipping, hero assets, items, Russian line breaks, and empty states.

- [ ] **Step 5: Run and commit**

Run: `npx playwright test tests/e2e/analysis.spec.js tests/e2e/accessibility.spec.js`

Expected: PASS with no serious or critical axe violations.

Commit: `feat: introduce the war room visual system`

### Task 10: History, share image, PWA, documentation, and release verification

**Files:**
- Modify: `src/storage/history.js`
- Modify: `src/ui/share-card.js`
- Modify: `public/service-worker.js`
- Modify: `tests/unit/history.test.js`
- Modify: `tests/unit/share-card.test.js`
- Modify: `tests/e2e/history-share.spec.js`
- Modify: `tests/e2e/pwa.spec.js`
- Modify: `scripts/capture-screenshots.mjs`
- Modify: `docs/screenshots/analysis-desktop.png`
- Modify: `docs/screenshots/analysis-mobile.png`
- Modify: `README.md`

**Interfaces:**
- Consumes: enriched analysis snapshot.
- Produces: compact schema-v3 history, upgraded PNG card, offline shell/demo/latest saved analysis, current screenshots, and user-facing documentation.

- [ ] **Step 1: Write failing history migration tests**

Assert schema-v2 entries load without throwing and degrade missing rich sections to unavailable; schema-v3 stores metadata, leaders, summaries, availability, and a bounded real timeline while staying under the 2.5 MB budget.

- [ ] **Step 2: Run and verify RED**

Run: `npm test -- tests/unit/history.test.js`

Expected: FAIL on schema-v3 expectations.

- [ ] **Step 3: Implement compact schema-v3 persistence**

Keep maximum 15 entries, remove raw event logs from storage, and retain only the data required to render the history card and latest offline analysis.

- [ ] **Step 4: Write failing share-card and PWA tests**

Assert PNG includes result, score, two hero identities, model version, and factual summary; offline demo remains explicitly fictional and latest saved analysis remains labeled cached.

- [ ] **Step 5: Implement share and cache updates**

Version the service-worker cache, preserve network-first match requests, and never cache private keys or request URLs containing `api_key`.

- [ ] **Step 6: Update README and screenshots**

Document scoring v4, availability tiers, data sources, local proxy secrets, GitHub Pages limitations, and real-versus-demo behavior. Capture refreshed desktop and mobile fixtures.

- [ ] **Step 7: Run the complete verification suite**

Run: `npm run check`

Expected: all Vitest, build, server-browser, and Playwright checks PASS.

- [ ] **Step 8: Verify the real comparison match**

Load `http://127.0.0.1:<port>/#9048925949` in a real browser. Confirm the page contains richer observed data and Russian explanations than the comparison site, while timelines/events stay absent because this match is unparsed.

- [ ] **Step 9: Check release diff and bundle budget**

Run: `git diff --check` and inspect Vite gzip output.

Expected: no whitespace errors; first-party JS plus CSS remains below 120 KB gzip.

- [ ] **Step 10: Commit**

Commit: `release: ship post-match war room`
