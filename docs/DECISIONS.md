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

---

## ADR-013: Obsidian vault as plain files; notification click-through and toasts

**Status:** Accepted (2026-09-25)

**Context:** Marto's notes live in an Obsidian vault that Obsidian (and possibly a sync service)
keeps editing. Obsidian has no local API for other apps. Notifications need to lead somewhere and
reach him when Forge isn't in front.

**Decision:**

- The `vault` module reads and writes the vault's Markdown files directly and keeps an in-memory
  index in main (titles, tags, wikilinks, text), refreshed by a chokidar watcher. Link resolution
  follows Obsidian's rules. Writes carry the mtime the editor loaded; a different mtime on disk
  is a conflict the user resolves, never a silent overwrite.
- The preview uses `markdown-it` (renderer-only devDependency, 6 small deps) with `html: false`,
  plus small inline rules for wikilinks, tags and tasks. That keeps the output safe to inject
  without a sanitizer dependency, unlike `marked` + DOMPurify or the ~50-package
  `react-markdown`/unified stack.
- The editor is the same Monaco build as the Build room (Markdown grammar already bundled).
- Notifications gain an optional `target` (`panelId` + params, a DB migration). warn/error raise
  an in-app toast when Forge is focused and a Windows toast otherwise; the Windows toast click
  focuses Forge and opens the target. `app.setAppUserModelId('dev.marto.forge')` makes Windows
  attribute toasts to Forge (electron-builder's `appId` must match in Phase 6).
- Modules can contribute `overlays` (components mounted once while enabled), so commands like
  Quick Note can open a dialog from any room without touching the shell.

**Consequences:** No Obsidian plugin to install and nothing proprietary to break; Obsidian and
Forge can edit side by side. Plugin-specific syntax (Dataview, Excalidraw) isn't rendered.

---

## ADR-014: Language servers in main, relayed over the typed IPC contract

**Status:** Accepted (2026-09-25)

**Context:** Monaco needs Python and TypeScript language features. Language servers are separate
programs speaking JSON-RPC over stdio. The renderer must not spawn processes or read files.

**Decision:**

- Main spawns `basedpyright` and `typescript-language-server` (runtime npm dependencies, no
  install scripts) with `process.execPath` + `ELECTRON_RUN_AS_NODE`, so no system Node is needed.
  A small `Content-Length` framer (unit tested) replaces a JSON-RPC runtime dependency.
- Messages travel as `lsp:send` (renderer → main) and `lsp:message` events (main → renderer) on the
  existing typed contract, not a separate MessagePort channel. Latency is well under a
  millisecond per message and it keeps one audited IPC path.
- The renderer runs `monaco-languageclient` 11 (matches the pinned monaco-vscode-api 37.1.0,
  ADR-009). Monaco's `initialize()` gains the log, model, extensions, and editor service overrides
  plus `vscode/localExtensionHost`, which the client needs.
- A read-only file-system overlay backed by `fs:readFile`/`fs:list` lets VS Code's services load
  other workspace files; an editor open handler routes cross-file navigation to Forge's editor.
- One server per language per folder, started lazily on the first file of that language; a
  renderer reload restarts it (an initialized server can't be re-initialized).

**Consequences:** Real IntelliSense with no system Python/Node requirements beyond the project's
own venv. basedpyright adds ~27 MB to node_modules. Packaging (Phase 6) must keep the server
scripts and `typescript` available at runtime.

---

## ADR-015: AI providers over plain HTTP from main; apply only through a diff preview

**Status:** Accepted (2026-09-25)

**Context:** The AI chat must support Claude, OpenAI and Gemini, keep API keys out of the renderer,
stream replies, and must never overwrite code blindly.

**Decision:**

- Main calls the three streaming HTTP APIs directly with `fetch` and one SSE parser instead of
  three vendor SDKs (their streaming formats are small and stable; fewer dependencies to audit).
  Keys come from SecretsService per request.
- Replies stream to the renderer as events keyed by a request id; cancellation aborts the fetch.
- Context (file, selection, git diff) is attached explicitly by the user and embedded in the
  system prompt with labels. Nothing is sent implicitly.
- Code from replies reaches files only via the Apply preview (Monaco diff). Accept edits the open
  buffer as one undoable change and leaves saving to the user.
- The default model is `claude-opus-5-5`; model ids are editable because provider catalogues
  change faster than releases.

**Consequences:** No new dependencies. Provider API changes affect one adapter file
(`providers.ts`, unit tested).

---

## ADR-016: Trade journal in its own folder (SQLite documents + image files)

**Status:** Accepted (2026-09-25)

**Context:** Journal entries carry screenshots and will gain fields (imports, more metrics). Trade
records are the data Marto most needs to keep, so they should be easy to back up and survive app
state resets.

**Decision:**

- Main owns `userData/journal/`: `journal.db` (better-sqlite3, WAL) with one row per entry that
  holds the zod-validated entry as JSON, plus `images/<entry id>/<uuid>.<ext>` files.
- It's not the Drizzle app DB: the shape is validated by zod on every read and write, so new
  optional fields need no migrations, and the folder can be copied or restored as a unit.
- Image names are generated by main and checked by a strict regex at the IPC boundary. The
  renderer gets images as `data:` URLs through IPC, never file paths. `journal:save` can't add or
  remove image names, so a stale editor copy can't orphan files.

**Consequences:** No new dependencies. Querying across entries happens in the renderer (hundreds to
a few thousand entries is fine). Phase 6 backup/export includes the folder as is.

---

## ADR-017: Earnings calendar with three switchable sources

**Status:** Accepted (2026-09-25)

**Context:** Marto asked for all three options: NASDAQ as in his market-calendar project, his
Market Calendar deployment, and Finnhub.

**Decision:**

- The sidecar parses each source into one `EarningsEvent`; a setting picks the source.
- NASDAQ is the default: no key, same data and conventions as market-calendar (logic ported, not
  shared). One request per weekday (four in flight), per-day disk cache with stale fallback.
- Finnhub's key is a secret. Main passes it to the sidecar in a header, which sends it to Finnhub
  as `X-Finnhub-Token`, never in a URL.
- Market Calendar has no JSON events endpoint today. Forge expects
  `GET /api/events?kind=earnings&start=YYYY-MM-DD&end=YYYY-MM-DD` → `MarketEvent[]`. Adding that
  route to market-calendar is a separate change in that repo.
- Wikipedia (S&P 500 list) gets an identifying User-Agent with a contact URL, per its robot
  policy (a bare product token is refused with 403).

**Consequences:** No new dependencies (stdlib `html.parser` instead of an HTML library). The
NASDAQ endpoint is unofficial and may break; the cache keeps the last good week and the source
is one setting away.

---

## ADR-018: DataFrame viewer on DuckDB, read-only SQL

**Status:** Accepted (2026-09-25)

**Context:** Lab needs to open training outputs (CSV, Parquet, Feather) of any size, sort,
filter, run SQL and see column statistics, without loading whole files into the renderer.

**Decision:**

- Sidecar dependencies: `duckdb` (queries files in place, `SUMMARIZE`, fast CSV sniffing) and
  `polars` (reads Feather/Arrow IPC, which DuckDB only reads through an extension it would
  download at runtime). Both were already in the stack list.
- Each file gets its own in-memory DuckDB database with a view `t` over the file, so queries
  always see the current file and SQL can say `FROM t`.
- Read-only policy: every query must parse as exactly one `SELECT`. The user's SQL is checked
  alone and again after wrapping (for paging, WHERE and sort). Extension auto-install/load,
  community extensions and Python replacement scans are off and `lock_configuration` is on.
  30 s timeout with interrupt. Ruff's S608 is ignored for `frames.py` only, with this rationale.
- The renderer knows files by path; main maps paths to sidecar frame ids and re-opens on
  `FRAME_NOT_FOUND` (sidecar restart or eviction).
- The grid is virtualized in-house (fixed 24 px rows, 200-row blocks via TanStack Query) rather
  than adding a grid library.

**Consequences:** About 60 MB more in the sidecar environment (duckdb + polars wheels), which
matters for Phase 6 packaging. Arrow files cost one conversion per version of the file.

---

## ADR-019: CV folds and calibration as probe artifacts, computed by Marto's libraries

**Status:** Accepted (2026-09-25)

**Context:** Marto asked for cv-visualizer and calibrate panels, both as probe hooks and as
standalone tools. purged-cv states that its boundary arithmetic "would drift if copied", and
calibrate's metrics are its product. So Forge must call those libraries, not reimplement them.

**Decision:**

- Probe hooks run in the training environment, where the libraries already are:
  `log_cv` calls the splitter's `split_detail()` (or `split()`) and only run-length encodes the
  result, mirroring cv-visualizer's `fold_masks` rules (disjoint categories, remainder =
  unused). `log_calibration` calls `calibrate.calibration_report` and ships its numbers.
  forge-probe gains no dependency: calibrate is imported lazily with an install hint.
- The sidecar stores them as run artifacts (upsert by run, kind, name; 2 MB cap; NaN
  refused) and the Run Monitor renders fold bands (SVG, design tokens) and a reliability
  diagram (ECharts).
- The standalone modes needed scikit-learn, SciPy, purged-cv and calibrate. Marto approved
  them on 2026-09-25; see ADR-021.

**Consequences:** No new dependencies now. The e2e test stubs a detailed splitter and the
calibrate module; the real libraries were checked locally.

---

## ADR-020: Notebook runner: kernels in the sidecar, files in main, outputs polled

**Status:** Accepted (2026-09-25)

**Context:** Lab should run `.ipynb` notebooks with Marto's real environments (his CUDA/torch
envs), not with Forge's own Python.

**Decision:**

- The sidecar gains `jupyter_client` (named in the roadmap for this feature) and starts
  kernels from registered kernelspecs, or from any interpreter via
  `python -m ipykernel_launcher`. `ipykernel` is a dev-only dependency, for tests.
- Main reads and writes the `.ipynb` files (atomic, Jupyter formatting). The renderer never
  touches the file system.
- Outputs are kept per execution in the sidecar and polled (150 ms) by the panel, the same
  pattern as the Run Monitor. No new streaming channel is needed, and a window reload
  reattaches to the kernel (the session id is saved in the panel's params).
- Reliability: every (re)start waits until iopub has echoed a `kernel_info` probe (ZMQ's
  slow-joiner problem otherwise loses a fast cell's first output). The shell `execute_reply`
  also settles an execution if its idle status was missed.
- `stop_on_error=False` in the kernel. The panel's Run All stops at the first error instead,
  so a single failing cell never silently aborts cells run on their own.

**Consequences:** Adds jupyter_client, pyzmq, tornado and traitlets to the sidecar. Kernels
are child processes: the sidecar shuts them all down on exit, and closing a tab shuts its own.

---

## ADR-021: Standalone CV/calibration tools with two engines

**Status:** Accepted (2026-09-25)

**Context:** Marto chose to run the standalone tools both inside Forge and in his own
environments.

**Decision:**

- Sidecar dependencies (approved): `scikit-learn`, `purged-cv` and `calibrate` from
  github.com/martex-dev (git sources, pinned by `uv.lock`; calibrate brings matplotlib), plus
  `forge-probe` as an editable path dependency, so `forge_probe.artifacts` builds identical
  payloads for the probe hooks and the tools.
- The job functions live once in `mltool_jobs.py`, importing their libraries lazily. The
  bundled engine calls them directly. The environment engine sends their source (with the
  artifacts module) into a kernel from the notebook service; parameters travel as a JSON string
  literal, never as code. The result is one marked JSON line on stdout.
- One warm kernel per environment is reused for 10 minutes, so a playground slider doesn't pay
  for Python startup each time.

**Consequences:** The sidecar environment grows by about 150 MB (SciPy is the bulk), which
matters for Phase 6 packaging. The ML views (`CvFoldsView`, `CalibrationView`) moved to
`src/renderer/ui/ml/` because two modules render them.
