# Architecture Decision Records

Format: Context → Decision → Consequences. Newest at the bottom.

---

## ADR-001: Electron over Tauri

**Status:** Accepted (2026-09-24)

**Context:**

- Marto has no Rust experience; Tauri's backend is Rust, so every privileged feature would be written in a language he can't yet maintain.
- Forge needs many logged-in embedded sites (TradingView, Axiom, Fomo, Discord, LinkedIn, X). Electron's `WebContentsView` with persistent partitions is mature; Tauri's multi-webview support uses the OS webview (WebView2 on Windows) and is less proven for this.
- Key ecosystem pieces are Node-first: `node-pty` for terminals, Monaco and its LSP tooling, `simple-git`, `@octokit/rest`.

**Decision:** Use Electron (via electron-vite) with a React renderer.

**Consequences:**

- Higher RAM use (bundled Chromium, plus one renderer process per webview) and a bigger installer (~100 MB+).
- Native modules (`node-pty`, `better-sqlite3`) must be rebuilt or matched to Electron's ABI on every Electron upgrade. Electron is pinned to an exact version.
- One language (TypeScript) across main, preload and renderer.

---

## ADR-002: Python sidecar over localhost HTTP/WebSocket with a per-launch token

**Status:** Accepted (2026-09-24)

**Context:** ML, trading and data tooling (PyTorch ecosystem, `MetaTrader5`, polars/pandas, DuckDB, `pynvml`) live in Python. Porting them to Node is either impossible (MT5) or much worse.

**Decision:** Run a FastAPI sidecar spawned by main. Main picks a free port and generates a random token each launch, passed via `FORGE_PORT` / `FORGE_TOKEN`. The sidecar binds to `127.0.0.1` only and rejects requests without the bearer token. The renderer never talks to it directly; main proxies HTTP and relays WebSocket streams over IPC.

**Consequences:**

- Other local processes can't use the API without the token, and nothing off-machine can reach it.
- Extra moving part: lifecycle management (health polling, backoff restart, process-tree kill on Windows).
- Packaging later needs PyInstaller (Phase 6). In dev, `uv` must be installed.

---

## ADR-003: Module system

**Status:** Accepted (2026-09-24)

**Context:** Forge will integrate 15+ services. Without boundaries, each integration would leak into shared code and every addition would risk breaking others.

**Decision:** Every integration is a self-contained module: a manifest in `src/shared/modules/`, main-side services/handlers in `src/main/modules/<id>/`, renderer panels/commands in `src/renderer/modules/<id>/`, and optional sidecar routers. Registries discover modules; adding one never requires editing another. Modules can be platform-filtered and enabled/disabled at runtime.

**Consequences:**

- Some boilerplate per module (manifest + two registrations).
- Features can be switched off when broken (e.g. Forex Factory feed changes) without touching the rest of the app.
- Core shell code must stay module-agnostic.

---

## ADR-004: Toolchain version pins

**Status:** Accepted (2026-09-24)

**Context:** Several "latest" packages don't work together yet: electron-vite 5 supports Vite ≤ 7;
typescript-eslint supports TypeScript < 6.1 (TS 7 is the new native compiler); eslint-plugin-react
supports ESLint ≤ 9; Drizzle 1.0 is still a release candidate.

**Decision:** Pin exact versions: Electron 44.4.5, electron-vite 5.0.0, Vite 7.3, @vitejs/plugin-react
5.2, TypeScript 6.0.3, ESLint 9.39, Drizzle ORM 0.45.3, Vitest 5. Use `@xterm/xterm` (the unscoped
`xterm` package is deprecated).

**Consequences:** Upgrades are deliberate, one family at a time, with the full test suite. Revisit
when electron-vite supports Vite 8 and typescript-eslint supports TS 7.

---

## ADR-005: Renderer-only packages are devDependencies

**Status:** Accepted (2026-09-24)

**Context:** electron-builder packs `dependencies` into the app. Renderer code (React, Radix,
dockview, Tailwind…) is bundled by Vite, so shipping those packages again is dead weight.

**Decision:** `dependencies` holds only what the main process loads at runtime (better-sqlite3,
drizzle-orm, zod, electron-log). Everything the renderer uses is a devDependency.

**Consequences:** Smaller installer. A package used by main must be moved to `dependencies`, or it
will be missing in the packaged app (caught by the Phase 6 smoke test).

---

## ADR-006: Migrations bundled into the main build

**Status:** Accepted (2026-09-24)

**Context:** Drizzle's runtime migrator reads a migrations folder from disk, which then has to be
shipped and located correctly in packaged builds.

**Decision:** Keep `drizzle-kit generate` for writing SQL, but inline the `.sql` files into the main
bundle via `import.meta.glob` and apply them with a ~40-line migrator that records applied names in
`__forge_migrations`.

**Consequences:** Migrations can't go missing in a packaged app. Only forward migrations are
supported (no down-migrations), which is fine for a single-user local DB.

---

## ADR-007: Webview visibility is owned by the renderer

**Status:** Accepted (2026-09-24)

**Context:** WebContentsViews paint above all HTML. Whether a view may show depends on renderer-only
facts: its dockview tab is visible, its room is active, no overlay (palette, dialog, select, dock
drag) is open.

**Decision:** The panel computes `visible` and sends it with its bounds (`webview:setBounds`). Every
overlay component registers itself in a shared overlay store. Main just applies what it's told.

**Consequences:** A new overlay component must call `useRegisterOverlay(open)`, or a webview can
cover it. Radix tooltips and toasts are deliberately _not_ overlays, since hiding a chart for a
tooltip would be worse than a clipped tooltip.

---

## ADR-008: No tree-kill dependency

**Status:** Accepted (2026-09-24)

**Context:** The sidecar runs as `uv → python (venv shim) → python`. Killing only the direct child
orphans the interpreter.

**Decision:** Implement `killTree` directly: `taskkill /PID <pid> /T /F` on Windows, process-group
kill elsewhere. As a second safety net, the sidecar watches `FORGE_PARENT_PID` and exits if Forge
dies.

**Consequences:** One less dependency. An e2e test checks that no process from the sidecar tree
survives quitting.

---

## ADR-009: VS Code-compatible Monaco as the editor base

**Status:** Accepted (2026-09-25, chosen by Marto)

**Context:** Phase 2 needs LSP (hover, completion, diagnostics, go-to-definition) via
`monaco-languageclient`. Since v9 it is built on `@codingame/monaco-vscode-api`, a fork that
exposes VS Code's services on top of Monaco; it does not work with plain `monaco-editor`.

**Decision:** Install `@codingame/monaco-vscode-editor-api` under the package name `monaco-editor`
(npm alias) from day one, pinned to the version `monaco-languageclient` expects (37.1.0).

**Consequences:** Phase 2 LSP plugs in without an editor rewrite. The bundle is larger, and setup
goes through `initialize()` with service overrides and extension packages instead of a plain
`monaco.editor.create`. `@monaco-editor/react` is not used (it loads from a CDN by default).

---

## ADR-010: Workspace and filesystem are core services, not modules

**Status:** Accepted (2026-09-25)

**Context:** The explorer, editor, terminals, Git and search all need "the open folder" and safe
file access. Putting that in one module would force the others to depend on it.

**Decision:** `core/workspace` in main owns the open folder, the recent list, a path-guarded
`FsService` and a debounced chokidar watcher. Modules use the `workspace:*` and `fs:*` channels
(renderer) or `ctx.workspace` (main). Cross-module "open this file" goes through a tiny renderer
bus (`requestOpenFile`) that the editor module registers with.

**Consequences:** Modules stay independent. Disabling the editor just makes "open file" show a
toast instead of breaking the explorer.

---

## ADR-011: Chart data from Binance's market-data host and GeckoTerminal

**Status:** Accepted (2026-09-25)

**Context:** The Trade chart needs OHLCV for both CEX markets and DEX pools, without API keys.
DexScreener has no public candles endpoint. Marto chose "Gecko + Binance".

**Decision:** The sidecar fetches Binance spot klines from `data-api.binance.vision` (the
public market-data-only host: no keys, no account or order endpoints) and DEX pool OHLCV from
GeckoTerminal's free API, each behind its own token bucket and a short `TtlCache` with stale
fallback. The renderer draws with `lightweight-charts` (already in the stack; Apache-2.0, its
TradingView attribution logo stays on). Chart state is kept in dockview panel params, which are
now saved with the layout (`PanelProps.setParams`).

**Consequences:** No secrets needed and nothing can place orders. GeckoTerminal's ~30 req/min
limit means pool charts refresh every 30 s at best. Swapping a source means touching only
`sidecar/forge_sidecar/services/charts.py`.

---

## ADR-012: forge-probe transport, auth and run storage

**Status:** Accepted (2026-09-25)

**Context:** Training scripts run in their own environments (often older Pythons with CUDA
wheels), in any terminal, and must not slow down or crash when Forge is closed. The sidecar's
main token must never leave main.

**Decision:**

- `forge-probe` is a separate, tiny package (`packages/forge-probe`, Python ≥ 3.10, only
  dependency `websockets`). A background thread batches messages to `ws://127.0.0.1:<port>/probe/ws`
  every 250 ms, re-announces the run on reconnect, keeps a bounded buffer (10k messages) and gives
  up silently when Forge isn't running.
- On startup the sidecar generates a **probe token** that its auth middleware accepts on
  `/probe/ws` only, and writes `{url, token, pid}` to `userData/sidecar/probe.json` (readable only by
  this Windows user). It removes the file on shutdown. The sidecar gained `websockets` because
  uvicorn needs it to serve WebSockets at all.
- Runs are stored by the sidecar in SQLite (stdlib `sqlite3`, WAL) rather than DuckDB: many small
  appends, point lookups and no analytics yet.
- The renderer gets metrics through main with incremental polling (`after` cursor, 1 s while
  live), not a WebSocket relay: simpler, survives sidecar restarts for free, and 1 s latency is
  plenty for training curves.
- Charts use ECharts (tree-shaken core: line, grid, tooltip, legend, dataZoom, canvas).
- GPU stats come from NVIDIA's official `nvidia-ml-py` bindings (pure ctypes, no dependencies).

**Consequences:** Any process running as Marto can read `probe.json` and push fake runs. It
cannot call any other sidecar endpoint, which is acceptable for a single-user machine. A future
push channel (MessagePort relay) can replace polling without touching the probe.
