# Hermes / Jarvis — Phase 7 Real Memory Integration

## Result

The Phase 6 empty graph has been traced to an actually empty **local** Hermes
profile. No adapter or storage correction is warranted: the existing graph
projection is querying the correct built-in sources under the correct active
profile. No memory data was written, migrated, copied, or deleted.

## Environment and access boundary

| Item | Verified result |
| --- | --- |
| Checked installation | Local development checkout on macOS (Darwin) |
| Active profile | `default` |
| Available local profiles | one: `default` |
| Authorised connection to the stated Ubuntu/Docker/Ollama server | not available in this environment |
| Remote host, credentials, or secrets | not inspected or emitted |

This phase did not inspect the production server because no authorised remote
connection was configured or supplied. Therefore it makes no claim about that
server's memory contents, profile selection, Docker volume, or dashboard
deployment.

## Read-only local diagnosis

Only aggregate metadata was inspected. Memory text, node labels, raw IDs,
paths and configuration values were not included in terminal output or this
report.

| Source / check | Result |
| --- | --- |
| Built-in memory directory | exists |
| `MEMORY.md` | absent; 0 entries |
| `USER.md` | absent; 0 entries |
| Configured external memory provider | none |
| Learning-graph memory nodes | 0 |
| Learning-graph learned-skill nodes | 0 |
| Learning-graph edges and clusters | 0 / 0 |
| Memory Universe projection | 0 nodes, 0 edges, 0 clusters |

### Cause classification

**A — actually empty memory** is proven for the active local profile.

The following alternatives are not supported by the evidence for this local
installation:

- **B (wrong profile):** only `default` is present and is the active profile.
- **D (wrong path):** the canonical built-in memory directory exists; its two
  supported files are absent.
- **E (missing graph mapping):** the projection calls
  `agent.learning_graph.build_learning_graph()` and its output is equally
  empty. Existing synthetic mapping and profile-isolation tests pass.
- **F (auth/permission issue):** the authenticated dashboard endpoints return
  200, while an unauthenticated request is rejected with 401.
- **G (unsupported configured format):** no external provider is configured.

**C (different production environment)** remains a documented blocker rather
than a conclusion: the Ubuntu server was not reachable through an authorised
connection from this workspace.

## Existing integration verified

No production code changes were necessary. The active integration remains:

```text
active Hermes profile
  -> built-in MEMORY.md / USER.md and learned profile skills
  -> agent.learning_graph.build_learning_graph()
  -> profile-scoped, metadata-only Memory Universe projection
  -> authenticated /api/memory/universe/* endpoints
  -> /jarvis/memory
```

The projection keeps memory bodies out of overview, cluster, search, cursor
and edge responses. A body is only available through the pre-existing explicit
detail route after a selected memory node. The local profile had no node for
which that route could be meaningfully exercised with real data.

## Browser and API validation

The current frontend build was served locally with normal dashboard
authentication and checked through Chromium/Playwright. No screenshot of the
authorised profile was captured.

| Check | Result |
| --- | --- |
| `/jarvis/memory` opens | passed |
| Empty state is honest; no fabricated nodes/activity | passed |
| Authenticated `stats`, `nodes`, `clusters`, `search` calls | HTTP 200 |
| Search with empty source | passed; safe empty result |
| Agents → Memory back navigation | passed |
| Browser/page console errors | none observed |
| Cluster/node/edge/detail on real data | not applicable: the profile has no nodes |
| Cursor and cross-profile contracts | covered by automated synthetic tests |

Phase 6's isolated synthetic browser coverage remains the evidence for
pagination, selected-node edges and explicit protected detail reveal. It is
not represented as real-profile data.

## Agent activity / thought animation

No bridge was added. Hermes exposes session-local lifecycle callbacks and a
gateway run SSE channel, but neither is currently a privacy-reviewed,
profile-bound dashboard event feed. Reasoning-delta events are explicitly
unsuitable for dashboard telemetry. The UI therefore retains its truthful
Ambient Mode and does not portray simulated thoughts as agent activity.

## Productive-server hand-off

An authorised server operator can run these read-only checks on the Ubuntu
Hermes host, from the intended Hermes installation, without printing memory
contents:

```sh
hermes profile list
hermes memory status
hermes dashboard --status
python - <<'PY'
from agent.learning_graph import build_learning_graph
from hermes_constants import get_hermes_home, profile_name_for_home

graph = build_learning_graph()
print({
    "profile": profile_name_for_home(get_hermes_home()) or "default",
    "memory_nodes": graph["stats"]["memory_nodes"],
    "learned_skills": graph["stats"]["learned_skills"],
    "edges": len(graph["edges"]),
    "clusters": len(graph["clusters"]),
})
PY
```

The operator should then open the authenticated dashboard with that same
profile and inspect only the aggregate `/api/memory/universe/stats` result.
If a container is used, the commands must run inside the Hermes container or
against the exact persisted Hermes-home volume; inspecting an arbitrary host
directory can produce the same empty result without proving anything about the
running profile. Do not copy, migrate, or create memory files as part of this
diagnostic.

## Validation

| Check | Result |
| --- | --- |
| Read-only profile/store/graph diagnosis | completed |
| Authenticated local browser validation | passed |
| `scripts/run_tests.sh tests/agent/test_memory_graph_projection.py tests/hermes_cli/test_memory_universe_routes.py` | passed: 8 tests |
| Phase 6 frontend validation | remains green: typecheck, build, 446 tests; lint 0 errors |
| `scripts/run-in-hermes-env python scripts/check` | remains green: 11 checks |

## Production-readiness decision

The implementation is ready to project actual authorised built-in memory as
soon as the relevant server profile is identified and has supported data. It
is **not** ready to claim production graph population or a production visual
acceptance result until an authorised operator runs the hand-off checks on the
Ubuntu deployment and validates the corresponding authenticated dashboard.

No deployment was performed.
