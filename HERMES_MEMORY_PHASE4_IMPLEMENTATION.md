# Hermes Infinite Memory Universe — Phase 4 Implementation

## Scope

Phase 4 adds the interactive, profile-scoped Memory Universe to the existing
Jarvis Memory workspace at `/jarvis/memory`. It consumes the metadata-only
Phase 3 APIs and does not add a memory database, a chat implementation, model
calls, or a backend route.

## Changed files

- `web/src/pages/jarvis/JarvisShell.tsx` — installs `MemoryUniverse` in the
  existing Memory workspace; the legacy decorative `MemoryGraph` is no longer
  rendered there.
- `web/src/pages/jarvis/components/memory-universe/MemoryUniverse.tsx` —
  workspace controller, safe search, inspector, hierarchical navigation,
  WebGL detection, fallback and explicit content reveal.
- `web/src/pages/jarvis/components/memory-universe/MemoryUniverseScene.tsx`
  — React Three Fiber renderer with an instanced node cloud, API-backed edges,
  camera drag/zoom and reduced-motion support.
- `web/src/pages/jarvis/components/memory-universe/memory-universe-model.ts`
  — deterministic layout, semantic levels, colour and strict display limits.
- `web/src/lib/api-memory-universe.ts`, `web/src/lib/api-jarvis.ts`,
  `web/src/lib/api-plugin-path.ts` and `web/src/lib/api.ts` — typed,
  management-profile-scoped Phase 3 API client, including `AbortSignal`
  forwarding for node/search/edge calls. The facade remains within its
  code-health line budget by composing the dashboard extension in a sibling.
- `web/src/pages/jarvis/jarvis-cinematic.css` — cinematic panel, minimap,
  inspector and responsive fallback styling.
- `web/src/types/three.d.ts` — local minimal declaration surface for the
  already installed `three` package; no dependency was added.
- Tests: `web/src/lib/api-memory-universe.test.ts` and
  `web/src/pages/jarvis/components/memory-universe/memory-universe-model.test.ts`.

## Interaction model

- **Universe → cluster → node → authorised detail** is reflected by a
  semantic breadcrumb and inspector.
- Cluster selection loads a bounded first page from
  `GET /api/memory/universe/nodes`; `Mehr laden` follows the server cursor.
- Search calls `GET /api/memory/universe/search` after a 250 ms debounce.
  Node/search/edge requests use `AbortController`, so superseded requests do
  not update UI state.
- Edges are fetched only after node selection. Memory content is fetched only
  after the user selects **Geschützte Details öffnen**. No content is present
  in the initial graph or search response.
- The inspector exposes only the Phase 3 metadata (category, type, project,
  timestamp and authorised connection count) until that explicit reveal.
- If WebGL is unavailable, the same cluster and node navigation remains usable
  as an accessible list view. Reduced-motion disables scene animation.

## Rendering and performance

- The visible scene caps initial loading at **80 nodes**, display at **160
  nodes**, edges at **240**, and labels are not materialised for every node.
- Nodes render through one `InstancedMesh`; lines use one bounded
  `BufferGeometry`. The canvas is capped at device-pixel-ratio 1.5.
- Camera zoom/pan changes only client rendering. Graph browsing makes no LLM,
  embedding or memory-write request.
- The Phase 3 API remains the authority for cursor validity, stable ordering,
  profile isolation and response limits.
- The production build emits Three as a separate 849.79 kB (225.24 kB gzip)
  asset. It is an existing dependency; no new package was installed.

## Live activity

No authoritative Hermes event stream is exposed by Phase 3. The Activity
panel therefore says **“Keine Live-Aktivitätsquelle verbunden”**. Ambient
motion is visual-only and is not presented as agents thinking or working.

## Security and privacy

- All client calls use the existing authenticated `fetchJSON` path and the
  existing management-profile scoping rule.
- The browser does not derive or cache private memory bodies during normal
  navigation. Explicitly revealed content remains only in component state for
  the active view.
- Node IDs are URL encoded. Error messages use the existing dashboard error
  contract; access control remains enforced by the Phase 3 server routes.

## Validation performed

| Command | Result |
| --- | --- |
| `cd web && npm run typecheck` | passed |
| `cd web && npm run lint` | passed with existing repository warnings; 0 errors |
| `cd web && npm run test` | 65 files, 446 tests passed |
| `cd web && npm run build` | passed |
| `scripts/run_tests.sh tests/agent/test_memory_graph_projection.py tests/hermes_cli/test_memory_universe_routes.py tests/agent/test_learning_graph.py tests/agent/test_learning_mutations.py tests/hermes_cli/test_web_unknown_profile_404.py` | 33 tests passed |
| `scripts/run-in-hermes-env python scripts/check` | passed; all 11 checks, 0 blocking health findings |
| `git diff --check` | passed |

The test runner reports jsdom canvas/window-not-implemented diagnostics from
existing UI tests; they did not fail any test. No browser server was available
in this environment, so no manual screenshots or interactive browser run was
claimed.

## Known limitations and Phase 5 preparation

- The supplied reference path `docs/design/HERMES_MEMORY_UNIVERSE_REFERENCE.png`
  was absent in this checkout, so this implementation follows the documented
  Jarvis cinematic system rather than claiming a pixel comparison.
- Current Phase 3 clusters are metadata categories. Project/sub-area levels
  become richer automatically when the backend projection exposes those actual
  hierarchy fields; the UI already preserves project metadata in the inspector.
- The Phase 3 API intentionally has no event stream. Phase 5 can add one only
  from verified Hermes agent/tool events, without fabricating model thoughts.
- A production browser performance profile (FPS, GPU memory and a real large
  profile) still requires a deployed authenticated Hermes instance with its
  actual memory graph.
