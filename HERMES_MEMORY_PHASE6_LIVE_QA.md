# Hermes Infinite Memory Universe — Phase 6 Live QA

## Scope

Phase 6 validates the existing Phase 3 graph projection and Phase 4/5 browser
integration. It makes no production deployment, data migration, memory write,
new LLM call, or new event-stream architecture.

## Authorised live-memory check

The currently selected Hermes profile was queried read-only through the
existing projection. No memory body, label, identifier, category, or path was
printed, captured, or stored in this report.

| Check | Result |
| --- | --- |
| Profile-scoped projection initialises | passed |
| Nodes / edges / clusters available | `0 / 0 / 0` |
| Metadata page, selected-node detail and edge check | not applicable: no node exists |
| Live content exposure | none |

The authorised profile has no usable memories for a real-content or
real-relationship test. This is **not** reported as a live populated-graph
success. All remaining interaction and scale tests used only isolated,
in-memory synthetic metadata.

## Browser QA

The dashboard was rebuilt from the current source, launched locally with its
normal authentication, and exercised with Chromium/Playwright. No screenshot
of the authorised profile was created, so no user data could be disclosed.

| Check | Result |
| --- | --- |
| `/jarvis/memory` opens in the authenticated dashboard | passed |
| Clusters, stats, first node page and search endpoints | HTTP 200 |
| Empty authorised profile state | passed; no fake nodes or activity shown |
| Canvas / WebGL scene host | present (SwiftShader WebGL in headless test) |
| Search request | passed; returns the safe empty state |
| Wheel/drag camera control path | executed without browser error |
| Agents → Memory back navigation | passed |
| Mobile 390×844 | passed; no horizontal overflow |
| JavaScript and console errors | none observed |

An intercepted synthetic browser run additionally verified: bounded cursor
loading, search, node selection, edge loading, and the explicit protected
detail action. The synthetic content was never persisted or captured.

## Security and profile isolation

- The raw, unauthenticated local API request returned HTTP 401.
- The projection remains bound to `get_hermes_home()` and uses opaque public
  node identifiers; overview labels do not contain memory bodies.
- The detail API is a separate selected-node request. It was not called for
  the empty live profile.
- Existing automated graph/router coverage passed: **8 tests** in
  `tests/agent/test_memory_graph_projection.py` and
  `tests/hermes_cli/test_memory_universe_routes.py`.

## Activity / “thought” event investigation

No new live-activity bridge was added. Hermes has authoritative session-local
callbacks (`tool_progress_callback`, tool start/complete callbacks and
`event_callback`) and an authenticated gateway run SSE endpoint. The TUI
contracts also contain reasoning-delta events. None is currently a
profile-scoped, dashboard-owned, privacy-reviewed event source for the web
Memory Universe; exposing the reasoning events would be inappropriate.

Consequently the existing UI continues to state plainly that its ambient mode
is decorative and that no live activity source is connected. It does not
simulate agent thoughts or claim model reasoning as telemetry. A future bridge
must subscribe only to lifecycle events (agent start, memory retrieval, tool
start/finish, task outcome), bind them to the authenticated dashboard profile,
redact tool arguments/results, enforce bounded replay, and have dedicated
security tests.

## Synthetic scale measurements

Measurements ran locally against an in-memory metadata-only logical graph.
Each API call returned at most 100 nodes; no benchmark sends all nodes to the
browser. `peak_mib` is Python allocation peak for the synthetic dataset, not a
production server RAM claim.

| Logical nodes | Synthetic source build | First 100-node page | Cursor page | Peak allocation |
| ---: | ---: | ---: | ---: | ---: |
| 1,000 | 2.5 ms | 0.6 ms | 0.6 ms | 0.6 MiB |
| 10,000 | 24.7 ms | 4.3 ms | 5.2 ms | 5.8 MiB |
| 100,000 | 257.1 ms | 57.2 ms | 54.8 ms | 58.1 MiB |

The browser renderer remains bounded by the already implemented limits: 80
initially fetched nodes, 160 visible nodes, 240 visible edges and DPR at most
1.5. This validates lazy navigation at a logical 100k-node size but does not
claim representative production GPU FPS; that requires a populated,
authorised profile and target hardware.

## Visual QA

The Phase 5 reference assets remain the comparison authority. The rebuilt
application preserves the Phase 5 visual work: holographic core and orbit
rings, a dark spatial canvas, cyan glass inspector, search/minimap hierarchy,
and responsive layout. No cosmetic source change was justified by the empty
live dataset; fabricating the reference image's density would violate the
metadata-only and no-fake-status requirements.

## Validation run

| Command / check | Result |
| --- | --- |
| `scripts/run_tests.sh tests/agent/test_memory_graph_projection.py tests/hermes_cli/test_memory_universe_routes.py` | passed: 8 tests |
| `cd web && npm run build` | passed |
| Authenticated Chromium live check | passed as described above |
| Synthetic Chromium interaction check | passed as described above |

## Remaining risks and Phase 7 entry criteria

1. There is no suitable live memory dataset in the currently selected profile;
   populated-profile visual density, real detail retrieval and production GPU
   frame-rate remain unverified.
2. There is no approved dashboard event adapter for truthful live activity.
3. The 100k test is synthetic and in-process; a production load test should
   use an authorised, non-sensitive fixture with the deployment's hardware and
   cache configuration.

No production deployment was performed.
