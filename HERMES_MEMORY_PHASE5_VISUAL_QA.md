# Hermes / Jarvis — Phase 5 Visual QA

## Scope

Phase 5 applies the two supplied visual references to the existing Hermes
dashboard shell and the existing Phase 4 Memory Universe. The PTY/xterm chat
remains the only chat implementation. Phase 3 APIs, authentication, profile
scoping and the metadata-only access model were retained.

## Reference assets

| Asset | Repository path | SHA-256 |
| --- | --- | --- |
| Dashboard reference | `docs/design/HERMES_DASHBOARD_REFERENCE.png` | `7c2b18108212e4cbcb8f17f61da66c7f48cb0a891abe45fcb5d0224792e426a0` |
| Memory Universe reference | `docs/design/HERMES_MEMORY_UNIVERSE_REFERENCE.png` | `ddf5aea6534288eae125d4eab5d92678325ef170eb32a300b172c248f7cac16d` |

The locally supplied reference images and captured local browser screenshots
are intentionally retained as local review artifacts. They contain visible
identifying/test-environment material and are not versioned or deployed with
the production feature source.

## Implemented visual work

- Added a visual-only premium Hermes shell: navy canvas, subtle technical grid,
  cyan energy state for active navigation, glass borders, keyboard focus rings
  and a framed real xterm terminal. Existing navigation, theme switching,
  routes and PTY behaviour are unchanged.
- Moved the existing Memory Universe before secondary Memory status cards, so
  its primary visual is visible in the initial desktop workspace.
- Strengthened the central holographic core with a larger wireframe nucleus,
  two independently animated orbit rings, cyan/violet emissive lighting,
  deeper radial canvas light and a darker glass inspector.
- Retained Phase 4 limits: 80 initially fetched nodes, at most 160 visible
  nodes and 240 visible edges. No graph navigation makes an LLM call.
- Stored four real browser screenshots and one explicitly synthetic interaction
  screenshot in `docs/design/`.

## Screenshots

| Screenshot | Context |
| --- | --- |
| `docs/design/HERMES_PHASE5_DASHBOARD_ACTUAL_1920x1080.png` | Actual isolated dashboard at 1920×1080. |
| `docs/design/HERMES_PHASE5_MEMORY_ACTUAL_1920x1080.png` | Actual isolated Memory workspace at 1920×1080. |
| `docs/design/HERMES_PHASE5_MEMORY_ACTUAL_TABLET.png` | Actual isolated Memory workspace at 768×1024. |
| `docs/design/HERMES_PHASE5_MEMORY_ACTUAL_MOBILE.png` | Actual isolated Memory workspace at 390×844. |
| `docs/design/HERMES_PHASE5_MEMORY_SYNTHETIC_INTERACTION.png` | Browser-only intercepted synthetic dataset; demonstrates selected-node inspector and explicit detail reveal. It contains no production data. |

## Reference comparison

### Dashboard

Implemented alignment: persistent dark left rail, cyan active state, navy/cyan
palette, controlled glow, glass-like panel borders and a large central real-chat
area with a supporting right tool rail. The actual PTY terminal was present in
the browser test.

Intentional differences: the reference contains a React-like welcome/composer
surface and illustrative status content. Hermes keeps its production PTY/xterm
conversation instead of copying that into a second chat architecture. The
isolated test profile had no active PTY session output, so the captured terminal
is blank rather than pretending to contain a conversation.

### Memory Universe

Implemented alignment: central holographic core, dark spatial canvas, cyan
neural materials, translucent inspector, hierarchy navigation, minimap/search,
focus controls and responsive layout. Actual graph nodes and edges still derive
only from Phase 3 responses.

Intentional differences: the reference depicts thousands of richly populated
memories and a fictional “thinking” panel. The temporary test profile was empty
(0 nodes/edges/clusters), and Phase 3 does not expose an authoritative runtime
event stream. The UI therefore says that the live source is unavailable and
does not invent nodes, thoughts or activity. The synthetic screenshot is
separately identified and was used solely to validate click, edge and protected
detail flows.

## Browser validation

Environment: local temporary, isolated `HERMES_HOME`, Chromium via Playwright,
dashboard `http://127.0.0.1:9119`.

| Check | Result |
| --- | --- |
| Dashboard opens; real PTY terminal is mounted | passed (`[aria-label="Chat terminal"]`: 1) |
| `/jarvis/memory` loads | passed (`.memory-universe`: 1) |
| WebGL renderer selected | passed (`.memory-universe-canvas`: 1; browser WebGL available) |
| Drag / wheel camera path | passed; executed against the canvas with no page or console errors |
| Profile-scoped clusters, stats and nodes API calls | passed; all observed responses were HTTP 200 |
| Search | passed; `/api/memory/universe/search?query=test&limit=12&profile=default` returned HTTP 200 |
| Jarvis Agents → Memory navigation | passed |
| Node selection, edge fetch and explicit protected detail | passed against browser-intercepted, clearly synthetic metadata; inspector and revealed content present |
| Tablet and mobile rendering | passed; screenshots captured at 768×1024 and 390×844 |
| JavaScript / console errors | none observed in either actual or synthetic interaction run |

## Performance observations

- Actual cold graph metadata requests in the isolated profile completed in
  approximately **184 ms** each (clusters, stats and first bounded node page).
- Subsequent requests during the same run completed in **4–5 ms** where the
  Phase 3 projection cache applied.
- The browser used WebGL. The node cloud remains one `InstancedMesh`; edge
  lines remain one bounded `BufferGeometry`; canvas DPR is capped at 1.5.
- No FPS claim is made: a meaningful frame-rate measurement needs an actual
  populated production-sized profile and representative GPU hardware.

## Automated validation

| Command | Result |
| --- | --- |
| `cd web && npm run typecheck` | passed |
| `cd web && npm run lint` | passed with 0 errors and existing repository warnings |
| `cd web && npm run test` | 65 files, 446 tests passed |
| `cd web && npm run build` | passed |
| Phase 3 graph/router regression selection | 33 tests passed |
| `scripts/run-in-hermes-env python scripts/check` | passed; all 11 checks |
| `git diff --check` | passed |

## Remaining limitations

- The local isolated profile intentionally contains no memories, so it cannot
  be used to assert real large-graph density or an authorised production memory
  detail. The browser synthetic route was used only for UI interaction coverage.
- The reference’s dense image-style clusters cannot be reproduced from an empty
  source without fabricating data. A populated, authorised profile is needed
  for final perceptual comparison and GPU profiling.
- The existing production build warns about large vendor chunks; Three remains
  in its own lazily route-loaded vendor chunk, and no new dependency was added.
