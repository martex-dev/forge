# Forge Modules

One section per module. Copy the template at the bottom when adding a module.

A module is up to four files/folders (see CLAUDE.md §3) and is **auto-discovered** — adding one
never requires editing another module or the shell:

| Part                 | Path                                                            | Discovered by                                       |
| -------------------- | --------------------------------------------------------------- | --------------------------------------------------- |
| Manifest             | `src/shared/modules/<id>.manifest.ts` exporting `manifest`      | `import.meta.glob` in `src/shared/modules/index.ts` |
| Main side (optional) | `src/main/modules/<id>/index.ts` exporting `mainModule`         | `src/main/core/modules/bootstrap.ts`                |
| Renderer side        | `src/renderer/modules/<id>/index.ts` exporting `rendererModule` | `src/renderer/modules/registry.ts`                  |
| Sidecar (optional)   | `sidecar/forge_sidecar/routers/<id>.py`                         | included in `forge_sidecar/main.py`                 |

A main module's `activate(ctx)` gets `ctx.ipc.handle`, `ctx.emit`, `ctx.notify`, `ctx.getSecret`
(only keys it declared), `ctx.sidecar(method, path, body)` and `ctx.onDispose`. Everything
registered through the context is torn down when the module is disabled.

---

### `build-core` — Build Core

- **Room:** build · **Platforms:** all · **Enabled by default:** yes
- **What it does:** Welcome panel describing the Build room until its real panels land.
- **Panels:** `build-core.welcome` — Welcome (default open).
- **Commands:** `Build: Show Welcome`.
- **Secrets / settings / sidecar:** none.

### `trade-core` — Trade Core

- **Room:** trade · **Platforms:** all · **Enabled by default:** yes
- **What it does:** Welcome panel for the Trade room.
- **Panels:** `trade-core.welcome` — Welcome (default open).
- **Commands:** `Trade: Show Welcome`.
- **Secrets / settings / sidecar:** none.

### `lab-core` — Lab Core

- **Room:** lab · **Platforms:** all · **Enabled by default:** yes
- **What it does:** Welcome panel for the Lab room.
- **Panels:** `lab-core.welcome` — Welcome (default open).
- **Commands:** `Lab: Show Welcome`.
- **Secrets / settings / sidecar:** none.

### `hub-core` — Hub Core

- **Room:** hub · **Platforms:** all · **Enabled by default:** yes
- **What it does:** Welcome panel for the Hub room.
- **Panels:** `hub-core.welcome` — Welcome (default open).
- **Commands:** `Hub: Show Welcome`.
- **Secrets / settings / sidecar:** none.

### `tradingview` — TradingView

- **Room:** trade · **Platforms:** all · **Enabled by default:** yes
- **What it does:** TradingView in a `WebContentsView` with its own persistent partition
  (`persist:svc-tradingview`), so the login survives restarts and is isolated from other sites.
- **Panels:** `tradingview.chart` — TradingView (default open, kept mounted when its tab is hidden).
- **Commands:** `Trade: Open TradingView`.
- **Secrets:** none. You log in inside the webview; Forge never sees the credentials.
- **External services:** tradingview.com. Links and popups to other sites open in the system
  browser. Only `*.tradingview.com` stays in-app.
- **Known limitations:** "Sign in with Google/Apple" opens off-site and therefore lands in the
  system browser, where the session doesn't reach Forge. Use email/password sign-in, or ask to
  allowlist a specific OAuth host.

### `explorer` — Explorer

- **Room:** build · **Platforms:** all · **Enabled by default:** yes
- **What it does:** File tree for the open folder (workspace). Lazy-loads folders, follows the
  editor's active file, and updates live from the workspace watcher.
- **Panels:** `explorer.tree` — Explorer (default open, docked left, 260 px).
- **Commands:** `Build: Open Folder…` (Ctrl+O), `Build: Close Folder`, `Build: Show Explorer`
  (Ctrl+Shift+E).
- **Keyboard:** ↑/↓/Home/End move, → expand / into folder, ← collapse / to parent, Enter open,
  F2 rename, Delete → confirm → Recycle Bin. Right-click for the context menu.
- **Secrets / settings / sidecar:** none. Recent folders live in the `workspace.recent` setting.
- **Core services used:** `workspace:*` and `fs:*` IPC (main `core/workspace`). Every path is
  workspace-relative and checked in main (`..`, other drives, and junctions pointing outside are
  refused). Delete is always "move to Recycle Bin", never permanent.
- **Known limitations:** no drag-and-drop move yet; very large folders (10k+ entries in one
  directory) render without virtualization.

### `editor` — Editor

- **Room:** build · **Platforms:** all · **Enabled by default:** yes
- **What it does:** Monaco on the VS Code service layer (ADR-009) with TextMate grammars (TS/JS,
  Python, JSON, CSS, HTML, Markdown, YAML, PowerShell, shell, bat, SQL, XML, INI, Rust, Go,
  Dockerfile) and "Default Dark Modern" recoloured from Forge tokens at runtime (accent follows
  the room). Loaded lazily the first time a file opens.
- **Panels:** `editor.main` — one editor with its own tab strip (stays mounted).
- **Commands:** `Build: Save` (Ctrl+S), `Build: Save All` (Ctrl+Alt+S), `Build: Close Editor Tab`
  (Ctrl+W), `Build: Show Editor`.
- **Status bar:** `Ln x, Col y · language · LF/CRLF`.
- **Behaviour:** dirty dot per tab; close asks Save / Don't Save / Cancel; save checks the disk
  mtime and shows _Load Disk Version / Overwrite With Mine_ on conflict; clean files follow
  external changes (undoable), dirty ones are flagged. Per-folder tab sessions restore on reopen.
  Switching or closing the folder is blocked while files are unsaved.
- **Secrets / settings / sidecar:** none (font size and reduce-motion come from General settings).
- **Known limitations:** no split editors or diff view yet (diff arrives with the Git panel); LSP
  features (hover, go-to-definition, diagnostics) are Phase 2; binary and >5 MB files show a
  notice instead of content.

### `terminal` — Terminals

- **Room:** build · **Platforms:** all (presets tuned for Windows) · **Enabled by default:** yes
- **What it does:** Real terminals via node-pty (ConPTY) in main and xterm.js (WebGL renderer,
  DOM fallback) in the renderer. Each terminal is a dock tab; open as many as you like.
- **Presets:** PowerShell (pwsh if installed, else Windows PowerShell), Python (venv) — activated by
  environment (`VIRTUAL_ENV`, `PATH`) so execution policy never needs relaxing — Claude Code,
  Codex CLI, Gemini CLI (run inside PowerShell, so you land at a prompt when they exit). Missing
  CLIs show the npm install command with a Copy button.
- **Panels:** `terminal.session#<n>` — multi-instance, docked below the editor (260 px).
- **Commands:** `Build: New Terminal` (Ctrl+Shift+\`), `Build: New Python Terminal`,
  `Build: New Claude Code Terminal`, `Build: New Codex Terminal`, `Build: New Gemini Terminal`.
- **Behaviour:** starts in the open folder (else home). Ctrl+C copies when text is selected,
  otherwise interrupts; Ctrl+V pastes; links open in the browser. Output is batched in main
  (~8 ms) and the last 256 KB is kept per session, so a window reload reattaches with history.
  Closing the tab kills the shell; exited shells restart on Enter. Disabling the module kills all.
- **Security:** the renderer can only launch these fixed presets; it never passes a command line.
- **Known limitations:** Windows PowerShell 5.1 takes a few seconds to start when the profile
  loads PSReadLine/modules; shells don't survive an app restart (only a window reload).

### `git` — Git

- **Room:** build · **Platforms:** all · **Enabled by default:** yes
- **What it does:** Source Control for the open folder via the system git (simple-git). Works when
  the folder is a subfolder of a repo. Lists staged and unstaged changes (untracked files shown
  individually), opens side-by-side Monaco diffs (HEAD ↔ staged, staged ↔ working tree; staged
  renames diff against the old path), stages/unstages, commits (Ctrl+Enter), pulls and pushes
  (first push publishes the branch with upstream).
- **Panels:** `git.changes` — Source Control (tab next to Explorer); `git.diff` — Diff (tab next to
  the editor, reused for each file).
- **Commands:** `Build: Show Source Control` (Ctrl+Shift+G), `Git: Pull`, `Git: Push`.
- **Status bar:** branch, `*N` pending changes, ↓behind ↑ahead; click opens Source Control.
- **Secrets:** none. Credentials come from Git Credential Manager (its own window);
  `GIT_TERMINAL_PROMPT=0` so git never hangs on an invisible prompt.
- **Environment:** git runs with an allowlisted environment (PATH, home, temp, proxy, `GCM_*`), so
  helpers inherited from other tools (VS Code's `GIT_ASKPASS`, `EDITOR`…) never leak in.
- **Known limitations:** no discard, branch switching, stash or history view yet; status refreshes
  every 5 s plus after Forge's own operations and file changes (commits made in a terminal show
  up within 5 s).

### `calendar` — Economic Calendar

- **Room:** trade · **Platforms:** all · **Enabled by default:** yes
- **What it does:** This week's macro events from the public Forex Factory feed
  (`nfs.faireconomy.media/ff_calendar_thisweek.json`), normalized in the sidecar (UTC times,
  impact levels, stable ids). Countdown to the next high-impact event; events in the next 30 min
  highlighted; past events dimmed; impact and currency filters (remembered per machine).
- **Panels:** `calendar.week` — Economic Calendar (default open, docked right).
- **Commands:** `Trade: Show Economic Calendar`.
- **Sidecar endpoints:** `GET /calendar/week`.
- **External services / rate limits:** Forex Factory rate-limits hard (HTTP 429). The sidecar
  caches for 30 min in memory **and on disk** (`userData/sidecar/cache`), serves the last good copy
  (marked _Stale_) for 24 h if a refresh fails, and after a failure waits 5 min (or `Retry-After`)
  before trying again, explaining that in the error. The panel refetches every 10 min (every
  minute while in an error state) and automatically when the sidecar becomes ready.
- **Known limitations:** no official API, so the feed can change or disappear; the source is kept
  swappable (e.g. Marto's Market Calendar project). No alerts yet (Phase 3).

### `trade-web` — Trading Sites

- **Room:** trade · **Platforms:** all · **Enabled by default:** yes
- **What it does:** Axiom (`axiom.trade`), Fomo (`fomo.family`) and Forex Factory
  (`forexfactory.com/calendar`) as webview tabs next to TradingView, each in its own persistent
  partition (`persist:svc-<id>`) — log in once, stays logged in, isolated from each other.
- **Commands:** `Trade: Open Axiom`, `Trade: Open Fomo`, `Trade: Open Forex Factory`.
- **Security:** wallet connections happen inside the sites; Forge never sees keys or signs
  anything. Links leaving each site's own domain open in the system browser.

### `dexscreener` — DexScreener

- **Room:** trade · **Platforms:** all · **Enabled by default:** yes
- **What it does:** Watchlist of DEX pairs on any chain DexScreener covers (Solana, Base, ETH,
  BSC…). Search by name, symbol, token or pair address; live price (flashes on change),
  5m/1h/24h change, liquidity, 24h volume and FDV, polled every 10 s. Click a row for the
  Token panel: all change windows, liquidity/volume/FDV/market cap, 24h buy/sell ratio,
  copyable contract address, project links (opened in the browser).
- **Panels:** `dexscreener.watchlist` — Watchlist (docked below, stays mounted so prices keep
  updating); `dexscreener.detail` — Token (tab next to the calendar, reused per pair).
- **Commands:** `Trade: Show DexScreener Watchlist`.
- **Settings:** `dexscreener:watchlist` (max 200 pairs).
- **Sidecar endpoints:** `GET /dex/search?q=`, `GET /dex/pairs?ids=chain:pair,…`.
- **External services / rate limits:** DexScreener public API (~300 req/min). The sidecar uses a
  token bucket (20 burst, 4/s), batches up to 30 pairs per call and caches each pair for 10 s.
  Search results rank pools with ≥ $10K liquidity _and_ trading first, then by volume, so
  wash-traded knockoffs and dead pools don't win.
- **Security:** read-only market data; no wallets or keys involved. Only `https:` images/links
  are passed to the UI.
- **Known limitations:** no price alerts yet (Phase 3); no sparkline in the table.

---

### `chart` — Charts

- **Room:** trade · **Platforms:** all · **Enabled by default:** yes
- **What it does:** Candlestick + volume chart (lightweight-charts) for a Binance spot symbol
  (e.g. `BTCUSDT`) or a DEX pool from the watchlist (via GeckoTerminal). Intervals 1m, 5m, 15m,
  1h, 4h, 1D; 500 bars; OHLCV legend follows the crosshair; local-time axis; memecoin prices use
  the same `0.0₅3688` notation as the watchlist. Polls every 5 s (Binance) or 30 s (pools) and
  only updates the moving bars, so zoom/scroll survive refreshes. The Token panel's **Chart**
  button opens its pool here. Source, symbol and interval are saved with the layout.
- **Panels:** `chart.main` — Chart (tab next to TradingView).
- **Commands:** `Trade: Show Chart`.
- **Settings:** none (state lives in the panel's layout params).
- **Sidecar endpoints:** `GET /chart/binance?symbol=&interval=&limit=`,
  `GET /chart/gecko?chain=&pool=&interval=&limit=` → `{ candles, stale }`.
- **External services / rate limits:** Binance `data-api.binance.vision` (market-data-only
  host, no keys; bucket 10 burst, 5/s, 5 s cache). GeckoTerminal free API (~30 req/min; bucket
  5 burst, 0.4/s, 30 s cache). Failed refreshes serve the last good copy for up to 10 min, marked
  _stale_. DexScreener chain ids are mapped to GeckoTerminal network ids (`ethereum` → `eth`, …).
- **Security:** read-only public market data; no exchange account, keys or order endpoints.
- **Known limitations:** no drawing tools or indicators (TradingView tab covers that); no
  history paging beyond 500 bars; one chart per panel (multi-chart layouts are Phase 3). The
  pool picker is the DexScreener watchlist, so it needs that module enabled.

### `runs` — Run Monitor

- **Room:** lab · **Platforms:** all · **Enabled by default:** yes
- **What it does:** Live view of training runs streamed by `forge-probe`
  (`packages/forge-probe`). Run list (status: running / finished / failed / interrupted, age,
  duration, last step; ↑/↓ to move, Delete to remove) and, per run: header (start, duration,
  step, host/pid, script), the error for failed runs, one ECharts line chart per metric
  (`train/loss` and `val/loss` share a "loss" chart; wheel to zoom; LTTB sampling for long runs)
  and the flattened config. Follows the newest run unless you pin another one (saved with the
  layout). The empty state shows the exact `pip install -e` command for this checkout.
- **Panels:** `runs.monitor` — Run Monitor (centre, in front of Welcome).
- **Commands:** `Lab: Show Run Monitor`, `Lab: Copy forge-probe Install Command`.
- **Settings:** none.
- **Sidecar endpoints:** `WS /probe/ws` (probe → sidecar, JSON-array batches of
  `start` / `log` / `finish`), `GET /runs`, `GET /runs/{id}`, `GET /runs/{id}/metrics?after=`
  (incremental by cursor, 50k points per page), `DELETE /runs/{id}`. Runs live in
  `userData/sidecar/lab/runs.db` (SQLite).
- **External services / rate limits:** none (local only).
- **Security:** the probe authenticates with a per-launch **probe token** that opens only
  `/probe/ws`; it reads it from `userData/sidecar/probe.json` and only connects to `127.0.0.1`.
  The renderer reads runs through main like every other module.
- **Known limitations:** one run at a time (side-by-side comparison is Phase 4). Metrics are
  polled every 1 s while a run is live rather than pushed. No per-run GPU attribution yet.

---

### `gpu` — GPU Monitor

- **Room:** lab · **Platforms:** all (needs an NVIDIA driver) · **Enabled by default:** yes
- **What it does:** Per-GPU utilization, VRAM used/total, temperature (amber ≥ 80 °C, red ≥ 87 °C)
  and power vs. limit, polled every 2 s, with a 3-minute utilization/VRAM history chart. A
  status-bar item (`44% 61°C`) is visible from every room; clicking it opens the panel. Without
  an NVIDIA GPU or driver the panel says so instead of erroring.
- **Panels:** `gpu.monitor` — GPU (docked right).
- **Commands:** `Lab: Show GPU Monitor`.
- **Settings:** none.
- **Sidecar endpoints:** `GET /gpu` (NVML via `nvidia-ml-py`, initialised once, run off the event
  loop).
- **External services / rate limits:** none.
- **Security:** read-only hardware counters.
- **Known limitations:** NVIDIA only; no per-process VRAM list yet.

---

### `inbox` — Inbox

- **Room:** hub · **Platforms:** all · **Enabled by default:** yes
- **What it does:** Every notification any module raised (`ctx.notify`), newest first, grouped
  by day. Filter by level (error / warning / success / info), module and unread; mark all read;
  clear read ones. Clicking a notification marks it read and jumps to its target panel (switching
  rooms), e.g. a finished training run opens that run in the Run Monitor. The status-bar bell
  shows the unread count and opens the inbox.
- **Toasts:** warn/error notifications show an in-app toast while Forge is focused and a Windows
  toast when it isn't; clicking the Windows toast brings Forge forward and opens the target.
- **Panels:** `inbox.main` — Inbox (docked right).
- **Commands:** `Hub: Show Inbox`, `Hub: Mark All Notifications Read`.
- **Settings:** none. Notifications live in the app DB (`notifications` table, `target` column).
- **Producers so far:** sidecar crashes/restarts (core) and `runs` (run finished / failed /
  interrupted, polled by main every 5 s so it works with the Lab room closed).
- **Known limitations:** no per-module mute yet; GitHub/Vercel/alerts join in Phases 2–5.

---

### `vault` — Obsidian Vault

- **Room:** hub · **Platforms:** all · **Enabled by default:** yes
- **What it does:** Works directly on the vault's Markdown files; Obsidian can stay open next to
  it. Pick the vault folder once (remembered). Sidebar: file tree (folders first, natural sort,
  reveals the open note), full-text search (all words, title hits first, line snippets) and tags
  (frontmatter + inline `#tags`, counts, notes per tag). Note panel: Monaco Markdown editor with
  autosave (800 ms) and Ctrl+S, or preview (Ctrl+E) with clickable `[[wikilinks]]`
  (aliases/headings; unresolved links create the note, like Obsidian), `#tags`, task lists,
  tables, https images, and a "Linked mentions" backlinks list. Changes made on disk
  (Obsidian, sync) are followed live; with unsaved edits you get a "Use disk version / Keep mine"
  choice instead of a silent overwrite.
- **Quick note:** `Hub: Quick Note` (Ctrl+Alt+N, from any room) appends `- HH:mm text` to today's
  daily note, using Obsidian's daily-notes folder and date format when configured.
- **Panels:** `vault.sidebar` — Vault (docked left), `vault.note` — Note (centre, reused).
- **Commands:** `Hub: Quick Note`, `Hub: New Note`, `Hub: Search Notes`,
  `Hub: Open Obsidian Vault…`.
- **Settings:** `vault:root` (the vault folder).
- **Main services:** `VaultService` (path guard shared with the workspace, chokidar watcher,
  conflict-checked writes) and `VaultIndex` (titles, tags, links, text; up to 20k notes).
- **Security:** every path is resolved inside the vault (no `..`, no junction escapes). The
  preview is rendered by markdown-it with raw HTML disabled and unsafe link schemes refused;
  links open in the system browser, never inside Forge.
- **Known limitations:** embeds (`![[...]]`) and local images show as chips, not inline; no
  rename/move/delete from Forge yet; no graph view; Obsidian plugin syntax (Dataview…) renders
  as plain text.

---

### `search` — Search

- **Room:** build · **Platforms:** all · **Enabled by default:** yes
- **What it does:** Find in files across the open folder with ripgrep: literal or regex,
  match case, whole word, include/exclude globs (comma-separated). Results are grouped by file
  with highlighted matches; click one to open the file at that line. `.gitignore` is honoured and
  heavy folders (node_modules, .venv, dist…) are always skipped. Each file contributes at most
  200 matches and a search stops at 2 000 (it says so). Typing cancels the previous search.
  Query and options are saved with the layout.
- **Panels:** `search.files` — Search (tab next to Explorer).
- **Commands:** `Build: Search in Files` (Ctrl+Shift+F, focuses the input).
- **Settings:** none.
- **Main:** `Ripgrep` runs the bundled `rg` (`@vscode/ripgrep`, per-platform binary package, no
  install script) with `--json`; the parser converts rg's UTF-8 byte offsets to string indices.
- **Known limitations:** no replace yet; files over 2 MB are skipped.

---

### `lsp` — Language Servers

- **Room:** build · **Platforms:** all · **Enabled by default:** yes
- **What it does:** Real language intelligence in the editor. Python via basedpyright
  (diagnostics, hover, completion, go to definition, rename, inlay type hints), using the
  folder's `.venv`/`venv` when present. TypeScript/JavaScript via typescript-language-server,
  using the project's own `typescript` if installed. A server starts the first time a file of its
  language is opened and stops when the folder closes. Go to definition across files opens the
  target in Forge's editor at the right line.
- **Status bar:** `{} Python TS/JS` with a dot per server (starting / ready / error); click to
  restart.
- **Commands:** `Build: Restart Language Servers`.
- **Main:** each server is a child process run with Electron's own Node
  (`ELECTRON_RUN_AS_NODE`), framed LSP over stdio; the process tree is killed on stop.
- **Renderer:** `monaco-languageclient` with an IPC transport (`lsp:send` / `lsp:message`). Monaco
  gained the log, model, extensions and editor service overrides it needs, plus a read-only file
  provider for the open folder (so other files can be loaded for definitions).
- **Security:** renderer reads other files only through main's path-guarded `fs:` channels;
  nothing outside the open folder is visible to the editor.
- **Known limitations:** definitions in libraries outside the folder (site-packages, typeshed,
  node_modules types) don't open yet; no Problems panel (diagnostics show inline); no
  per-project server settings UI.

---

### `github` — GitHub

- **Room:** build · **Platforms:** all · **Enabled by default:** yes
- **What it does:** For the open folder's GitHub repo (from the `origin`/`upstream` remote):
  pull requests (open/closed/all, "review" badge when you're a requested reviewer), issues and
  Actions runs, refreshed every couple of minutes while the Build room is visible (runs every 15 s
  while CI is going). Click a PR for its detail: state, head → base, size, checks (Actions check
  runs + legacy commit statuses, failing ones counted), the description rendered as Markdown, and
  every changed file as a numbered unified diff (large files start collapsed). Issues and runs
  open on github.com.
- **Notifications (inbox):** main polls every 90 s: a CI run that fails while you're watching it
  (error → Windows toast when Forge is in the background), your own runs passing (success), and
  new review requests (click opens that PR). The first poll only records a baseline.
- **Panels:** `github.panel` — GitHub (tab next to Source Control), `github.pr` — Pull request
  (centre, next to the editor).
- **Commands:** `Build: Show GitHub Pull Requests`, `Build: Show GitHub Actions`.
- **Secrets:** `github.token` — a fine-grained personal access token with read access to
  Metadata, Contents, Pull requests, Issues, Actions and Commit statuses. Settings → Secrets; the
  panel shows a connect button until it's set and refreshes as soon as it's saved.
- **External services / rate limits:** GitHub REST via `@octokit/rest` (5 000 requests/h per
  token; Forge uses well under 200/h). 401 / rate limit / no access are explained in the panel.
- **Security:** read-only. The token lives in SecretsService; the renderer only learns whether it
  exists. The remote is read with `git remote -v` without credential helpers.
- **Known limitations:** no commenting, reviewing, merging or issue editing yet (write actions
  will need confirmation dialogs); PR files capped at 300; GitHub Enterprise hosts not supported.

---

## Template

### `<module-id>` — <Name>

- **Room:** build | trade | lab | hub | global · **Platforms:** all | win32 | … · **Enabled by default:** yes | no
- **What it does:** one or two sentences.
- **Panels:** list with one line each.
- **Commands:** `Room: Command name` (shortcut) — what it does.
- **Secrets:** `secret.key` — what it is and where to get it (entered in Settings → Secrets).
- **Settings:** key — meaning, default.
- **Sidecar endpoints:** `GET /<id>/…` — purpose.
- **External services / rate limits:** …
- **Known limitations:** …
