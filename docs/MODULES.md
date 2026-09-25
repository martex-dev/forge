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
- **Multi-chart:** `Trade: New Chart` opens another chart beside the active one; `Trade: Chart
Grid (2×2)` lays out BTC / ETH / SOL / BNB (each then changeable). Every chart keeps its own
  source and interval, its tab reads e.g. `ETHUSDT · 4h`, and the arrangement is saved with the
  layout (drag tabs to rearrange like any panel).
- **Panels:** `chart.main` — Chart (tab next to TradingView; extra instances `chart.main#n`).
- **Commands:** `Trade: Show Chart`, `Trade: New Chart`, `Trade: Chart Grid (2×2)`.
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
- **Compare runs:** the compare button in the run list opens the selected run next to the
  closest earlier run of the same project; add up to 8 runs.
    - **Summary:** final value of every metric (min … max below). The best run is highlighted
      when the name says which way is better (`loss`, `err`, `rmse`… lower; `acc`, `f1`, `auc`…
      higher; ties have no winner).
    - **Config:** flattened config diff, only the differing keys by default.
    - **Charts:** one overlay chart per metric, a colour per run, TensorBoard-style debiased
      EMA smoothing (slider, raw curve faint behind it). Series are thinned to about 1,500
      points per metric; live runs refresh every 5 s.
- **CV folds and calibration:** `probe.log_cv(splitter, X)` and
  `probe.log_calibration(y, p, variants=…)` add views under the charts: fold bands (train / test
  / purged / embargoed / unused, from the splitter's own `split_detail()` or `split()`), and a
  reliability diagram with bin counts, ECE / MCE / Brier and calibrate's flag per variant.
  Stored as run artifacts (`artifacts` table, 2 MB cap, replaced by name).
- **Panels:** `runs.monitor` — Run Monitor (centre, in front of Welcome); `runs.compare` —
  Compare Runs (params: run ids and smoothing, saved with the layout).
- **Commands:** `Lab: Show Run Monitor`, `Lab: Compare Runs`,
  `Lab: Copy forge-probe Install Command`.
- **Settings:** none.
- **Sidecar endpoints:** `WS /probe/ws` (probe → sidecar, JSON-array batches of
  `start` / `log` / `finish`), `GET /runs`, `GET /runs/{id}`, `GET /runs/{id}/metrics?after=`
  (incremental by cursor, 50k points per page), `POST /runs/summary` (last/min/max per metric),
  `GET /runs/{id}/series?max_points=` (every n-th point plus the last),
  `GET /runs/{id}/artifacts/{kind}/{name}`, `DELETE /runs/{id}`. Runs live in
  `userData/sidecar/lab/runs.db` (SQLite).
- **External services / rate limits:** none (local only).
- **Security:** the probe authenticates with a per-launch **probe token** that opens only
  `/probe/ws`; it reads it from `userData/sidecar/probe.json` and only connects to `127.0.0.1`.
  The renderer reads runs through main like every other module.
- **Known limitations:** metrics are polled every 1 s while a run is live rather than pushed.
  No per-run GPU attribution yet. The comparison's thinning keeps every n-th point, so a
  one-step spike can fall between samples (the Run Monitor shows every point).

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

### `vercel` — Vercel

- **Room:** build · **Platforms:** all · **Enabled by default:** yes
- **What it does:** Projects for your account or a team (scope picker), each with its production
  URL and status. Pick a project for its last 30 deployments (state dot, production / preview /
  **current** badge, commit, branch, author). A deployment opens in the centre: details, Visit /
  Inspect links, build logs (live while building) and a sample of runtime logs (the API streams,
  so Forge reads ~2.5 s / 300 lines per refresh).
- **Write actions:** _Promote to production_ (ready previews) and _Roll back to this_ (older
  ready production deployments). Both open a confirmation dialog showing project, deployment,
  commit, branch and time. Nothing is sent until you confirm (e2e-tested).
- **Notifications (inbox):** every 60 s main checks recent deployments across projects: build
  failures (error, Windows toast when Forge is in the background) and production going live
  (success). The first poll is a baseline.
- **Panels:** `vercel.panel` — Vercel (tab next to GitHub), `vercel.deployment` — Deployment
  (centre).
- **Commands:** `Build: Show Vercel Deployments`.
- **Settings:** `vercel:teamId` (chosen scope). **Secrets:** `vercel.token` (vercel.com → Account
  Settings → Tokens).
- **External services / rate limits:** Vercel REST API with plain `fetch` from main (no SDK).
  Deployment lists poll every 5 s only while something is building and the Build room is visible.
- **Security:** token in SecretsService only; write calls are separate IPC channels invoked only
  from the confirmation dialog, and logged in main.
- **Known limitations:** no redeploy/cancel yet; runtime logs are a sample, not a live tail;
  environment variables and domains aren't shown.

---

### `ai` — AI Chat

- **Room:** build · **Platforms:** all · **Enabled by default:** yes
- **What it does:** A chat column (right side of Build) for Claude, OpenAI or Gemini — provider
  picker plus an editable model id (suggestions: `claude-opus-5-5` default, Sonnet 5, Haiku 4.5,
  Fable 5.1; `gpt-5`; `gemini-2.5-pro`). Attach the open **file**, the **selection** or the
  **git diff** (working tree vs HEAD, computed in main) as context chips. Replies stream in with
  Markdown and code blocks; each block has **Copy** and **Apply…**.
- **Apply:** opens a diff preview of the open file (Monaco diff editor) — replacing the selected
  lines, or the whole file (toggle). **Accept** applies one undoable edit; the file stays unsaved
  until Ctrl+S. Nothing is ever written without the preview.
- **Panels:** `ai.chat` — AI (docked right), `ai.apply` — Apply preview (centre).
- **Commands:** `Build: Ask AI` (Ctrl+L), `Build: Ask AI About Selection` (Ctrl+Shift+L).
- **Settings:** `ai:settings` (provider + model per provider). **Secrets:** `anthropic.key`,
  `openai.key`, `gemini.key`.
- **Main:** calls each provider's streaming HTTP API with `fetch` and a small SSE parser (no
  SDKs); keys go in headers, never URLs or logs. Streams arrive as `ai:delta` / `ai:done` /
  `ai:error` events; a headless overlay collects them even while the chat tab is hidden. Stop
  cancels the request.
- **Known limitations:** conversations live in memory (cleared on restart); no tool use / agent
  mode; the last 30 turns are sent as history; code blocks aren't syntax-highlighted yet.

---

### `mt5` — MetaTrader 5

- **Room:** trade · **Platforms:** win32 only · **Enabled by default:** yes
- **What it does:** Read-only view of the running MetaTrader 5 terminal: account strip (login,
  demo/real badge, server, leverage, balance, equity, floating P/L, free margin, margin level),
  open positions with live P/L (refreshed every 2 s while the Trade room is visible) and the last
  30 days of deals with net P/L (deposits excluded), closed trades and win rate.
- **Panels:** `mt5.panel` — MT5 (tab next to the Watchlist).
- **Commands:** `Trade: Show MetaTrader 5 Account`.
- **Sidecar endpoints:** `GET /mt5/status`, `/mt5/positions`, `/mt5/history?days=` via the
  official `MetaTrader5` Python package (Windows-only dependency marker).
- **Security / trading rules (CLAUDE.md §7):** strictly read-only. There is no code path to
  `order_send` or any account-changing call, and no IPC channel for it. Forge only _attaches_ to
  a terminal that is already running (checked with `tasklist`), so it never launches MT5 or logs
  in by itself; credentials stay in the terminal.
- **Known limitations:** needs MT5 open and logged in; times are the broker server's; one
  terminal (the default installation) at a time.

---

### `solana` — Solana Wallets

- **Room:** trade · **Platforms:** all · **Enabled by default:** yes
- **What it does:** Watch up to 50 Solana wallets by **public address** (with labels). Per wallet:
  total USD value, SOL balance and price, token holdings (SPL + Token-2022) priced via
  DexScreener (most liquid pair per token; unpriced dust last; up to 300 tokens), and the last
  transactions with status, opening on Solscan. Refreshes every 60 s while the Trade room is
  visible, or on demand.
- **Panels:** `solana.wallets` — Wallets (tab next to the Economic Calendar).
- **Commands:** `Trade: Show Solana Wallets`.
- **Settings:** `solana:wallets`. **Secrets:** `solana.rpc` (optional private RPC URL such as
  Helius; the public mainnet RPC is used otherwise).
- **Sidecar endpoint:** `GET /solana/wallet?address=&refresh=` with the RPC URL in an
  `X-Solana-Rpc` header (it usually embeds an API key; never in URLs or logs, https only). 30 s
  cache, throttled RPC and price calls.
- **Security (CLAUDE.md §7):** read-only by public address. Input that looks like a secret key
  (long base58 or a JSON byte array) is refused with an explicit warning and never stored; there
  is no signing, no key handling and no transaction submission anywhere.
- **Known limitations:** the public RPC is rate-limited (add a private RPC for many wallets); no
  NFT view; transaction details (amounts, counterparties) are on Solscan, not parsed in Forge.

---

### `alerts` — Alerts

- **Room:** trade · **Platforms:** all · **Enabled by default:** yes
- **What it does:** Two kinds of alerts, evaluated by main every 15 s in any room:
    - **Price** — a Binance symbol or a watched DEX pair _crosses above/below_ a value (crossing
      semantics like TradingView: an alert created while the price is already past the value waits
      for the next cross). Once, or every cross. Optional note.
    - **Calendar** — "N minutes before" high/medium/low-impact events, optionally only for chosen
      currencies; each event is announced once per alert (remembered across restarts for 8 days).
      Fired alerts are `warn` notifications: in-app toast when Forge is focused, Windows toast when
      not, and in the inbox; clicking opens the chart (price) or the calendar.
- **Quick create:** the Chart toolbar's bell and the Token panel's **Alert…** prefill the source
  and current price.
- **Panels:** `alerts.panel` — Alerts (tab next to the Economic Calendar): rules with live price,
  armed / fired / off state, enable switch, edit, delete.
- **Commands:** `Trade: New Price Alert`, `Trade: New Calendar Alert`.
- **Settings:** `alerts:rules`, `alerts:firedCalendar`.
- **Data:** prices through the sidecar's existing chart (Binance) and DexScreener endpoints (DEX
  pairs batched into one call); events from the cached Forex Factory week.
- **Known limitations:** 15 s granularity (a spike that reverts within a check can be missed);
  no percent-move or volume alerts yet; alerts run only while Forge is open.

---

### `journal` — Trade Journal

- **Room:** trade · **Platforms:** all · **Enabled by default:** yes
- **What it does:** Logs trades and ideas: symbol, market, side, status (idea / open / closed),
  entry, stop, target, exit, size, fees, optional P/L override, open/close times, setup, tags,
  Markdown notes and screenshots. Live metrics while editing: P/L (from prices × size, or the
  override, net of fees), result in R (from the stop distance) and planned R:R.
- **Stats:** net P/L, win rate, profit factor, expectancy, average R, average win/loss, best,
  worst, max drawdown, equity curve (ECharts), and breakdowns by setup and by symbol. Stats follow
  the current filter (text, status, tag), so "only #london" or "only breakouts" is one click.
- **Screenshots:** paste with Ctrl+V anywhere in the entry, or **Add images** (file picker). PNG,
  JPEG, WebP, up to 10 MB each. Pasting into a new entry saves it first.
- **From MT5:** the book icon on a closed deal in MT5 → History opens a new entry prefilled with the
  whole position (averaged prices, lots, net of commission and swap). Read-only: nothing is sent
  to MT5.
- **Panels:** `journal.panel` — Journal (tab next to the Economic Calendar): Entries / Stats,
  filter, editor.
- **Commands:** `Trade: Trade Journal`, `Trade: New Journal Entry` (Ctrl+Alt+J, from anywhere),
  `Trade: Journal Stats`. In the editor, Ctrl+Enter saves.
- **Settings / secrets:** none.
- **Data:** `%APPDATA%/forge/journal/` — `journal.db` (SQLite, one JSON document per entry) and
  `images/<entry id>/`. Copy the folder to back it up (see ADR-016).
- **Known limitations:** no import from exchanges/CSV yet; P/L is in one account currency (no FX
  conversion); prices × size assumes a linear contract, so use the P/L override for lots,
  futures multipliers or inverse contracts.

---

### `earnings` — Earnings Calendar

- **Room:** trade · **Platforms:** all · **Enabled by default:** yes
- **What it does:** Earnings for a Monday–Friday week (US Eastern dates), grouped by day. Each row
  shows the session (BMO before the open, AMC after the close, DMH during hours, — unannounced),
  ticker, impact, company, EPS estimate, then the reported EPS (green beat / red miss) or the
  year-ago EPS, and market cap. Filter by impact and ticker/company; browse weeks with ‹ ›.
  **Journal idea** on a row opens a Trade Journal idea prefilled with the ticker and the date.
- **Sources** (Earnings source… in the panel or the palette):
    - **NASDAQ** (default, no key): NASDAQ's public calendar API, one request per weekday, same
      conventions as Marto's market-calendar: impact from market cap (≥ $500B high, ≥ $50B
      medium). Unofficial endpoint; it needs a browser User-Agent.
    - **Finnhub** (key `finnhub.key` in Settings → Secrets): official API with reported EPS. No
      names or market caps, so impact is index membership only (constituent = medium).
    - **Market Calendar**: Marto's deployment, `GET <url>/api/events?kind=earnings&start&end`
      returning market-calendar `MarketEvent` rows (or `{ events: [...] }`). The deployment must
      not be behind Vercel Authentication. That repo doesn't have this route yet (see ADR-017).
- **Index filter:** S&P 500 (Wikipedia table) + Nasdaq-100 (NASDAQ list), cached 7 days. If the
  lists can't load, the panel says so and shows everything.
- **Panels:** `earnings.panel` — Earnings (tab next to the Economic Calendar).
- **Commands:** `Trade: Earnings Calendar`, `Trade: Earnings Source…`.
- **Settings:** `earnings:config` (source, Market Calendar URL, index only).
- **Caching (sidecar):** upcoming days 6 h, past days 30 days, Finnhub/Market Calendar ranges
  1 h; the last good copy is served (marked stale) when a source fails.
- **Known limitations:** NASDAQ gives no exact times, only sessions, and none for past dates;
  earnings alerts are not wired into Alerts yet.

---

### `frames` — DataFrame Viewer

- **Room:** lab · **Platforms:** all · **Enabled by default:** yes
- **What it does:** Opens CSV/TSV, Parquet, JSON/JSONL and Feather/Arrow files in place with
  DuckDB in the sidecar, never loading them whole. One tab per file.
    - **Data:** a virtualized grid that loads 200-row blocks as you scroll (millions of rows
      stay smooth). Click a header to sort (Shift+click adds keys). The **WHERE** box takes a
      DuckDB expression, e.g. `loss < 0.1 AND split = 'val'`. Arrow keys, PgUp/PgDn, Home/End
      move the selection; Ctrl+C copies a cell.
    - **SQL:** any single `SELECT` over `t` (the file): aggregates, window functions, joins
      against other files with `read_parquet('…')`. Ctrl+Enter runs it; results are paged and
      sortable.
    - **Stats:** DuckDB `SUMMARIZE` (type, count, null %, ≈ unique, min/quartiles/max, mean,
      std). Click a column for its histogram (numeric) or top 20 values.
- **Read-only by design:** the sidecar runs one `SELECT` only (no `COPY`, `ATTACH`, `INSTALL`,
  `SET` or a second statement), with extension auto-install off and configuration locked.
  Queries time out after 30 s. See ADR-018.
- **Panels:** `frames.viewer` (multi-instance, tab next to the Run Monitor; empty state lists
  recent files).
- **Commands:** `Lab: Open Data File…` (Ctrl+Alt+O), `Lab: DataFrame Viewer`.
- **Settings:** `frames:recent` (last 12 files).
- **Known limitations:** Feather/Arrow files are converted once to a cached Parquet copy
  (`<sidecar data>/cache/frames/`); editing cells isn't supported; very wide text is cut at
  2,000 characters per cell.

---

### `notebooks` — Notebooks

- **Room:** lab · **Platforms:** all · **Enabled by default:** yes
- **What it does:** Opens and runs Jupyter notebooks (`.ipynb`, nbformat 4) with kernels from
  Marto's own environments. One tab per notebook; closing the tab shuts its kernel down.
    - **Kernels:** any registered kernelspec (`python -m ipykernel install --user --name env`),
      or pick a `python.exe` directly (needs `ipykernel` in that environment). The choice is
      stored in the notebook's metadata, and the kernel starts by itself the next time. Kernels
      run with the notebook's folder as cwd.
    - **Cells:** code, Markdown (rendered; double-click or Enter to edit) and raw. Shift+Enter
      runs and moves on (adding a cell at the end), Ctrl+Enter runs in place, Alt+Enter runs and
      inserts below, Tab indents four spaces, Esc leaves the cell. Move, delete and change type
      from the cell's toolbar. **Run all** stops at the first error, like Jupyter.
    - **Outputs:** stdout/stderr (with `
` progress bars like tqdm collapsed, ANSI colours
      stripped), results, errors with tracebacks, PNG/JPEG/SVG images, Markdown. HTML-only
      output isn't rendered (pandas and most libraries also send text).
    - **Autosave** 1.5 s after the last change, written the way Jupyter writes it (1-space
      indent, line lists), atomically.
- **Panels:** `notebooks.panel` (multi-instance, tab next to the Run Monitor; empty state has
  Open / New and recent notebooks).
- **Commands:** `Lab: Open Notebook…`, `Lab: New Notebook…`, `Lab: Notebooks`.
- **Settings:** `notebooks:recent`.
- **Sidecar endpoints:** `GET /nb/kernelspecs`, `POST /nb/sessions`,
  `POST /nb/sessions/{id}/execute`, `GET /nb/sessions/{id}/executions/{exec}?after=`,
  `POST …/interrupt`, `POST …/restart`, `DELETE /nb/sessions/{id}`. Outputs are polled every
  150 ms while a cell runs.
- **Known limitations:** no `input()` (stdin is off, so it fails instead of hanging). On
  Windows, Interrupt stops Python code but not a blocking C call such as `time.sleep`; use
  Restart. No widgets (ipywidgets) and no HTML rendering. Cells are plain text areas, without
  LSP or completion (yet). Outputs over 8 MB per cell are truncated.

---

### `mltools` — CV & Calibration

- **Room:** lab · **Platforms:** all · **Enabled by default:** yes
- **What it does:** cv-visualizer and calibrate as interactive tools (the probe hooks in the Run
  Monitor cover training scripts).
    - **CV folds:** PurgedKFold (purged-cv; label horizon + embargo %), KFold (shuffle) or
      TimeSeriesSplit (gap) over N samples. The fold bands redraw as you change a setting.
    - **Calibration:** a CSV/Parquet predictions file, a 0/1 label column and a probability
      column (guessed from the usual names), and up to 4 comparison columns (e.g. isotonic
      output). Gives the reliability diagram, ECE / MCE / Brier and calibrate's flag. Rows with
      missing values are skipped and counted.
- **Engines ("Run with"):** **Forge (bundled)** uses the sidecar's scikit-learn, purged-cv and
  calibrate. A **kernel** or **Python interpreter** runs the same job source in one of Marto's
  environments (a warm kernel is reused for 10 minutes), so results match his installed
  versions. A missing library is reported with an install hint.
- **Panels:** `mltools.panel` — CV & Calibration (tab next to the Run Monitor; settings saved
  with the layout).
- **Commands:** `Lab: CV Folds Playground`, `Lab: Calibration Report from File…`.
- **Sidecar endpoints:** `POST /mltools/cv`, `POST /mltools/calibration`, `POST /mltools/columns`.
- **Known limitations:** synthetic label windows (row i resolves at i + horizon) in the
  playground; real `label_end_times` belong in a script with `probe.log_cv`. Binary
  calibration only, as in calibrate.

---

### `hub-web` — Comms & Socials

- **Room:** hub · **Platforms:** all · **Enabled by default:** yes
- **What it does:** Discord, LinkedIn, X and Notion as webview tabs (`WebContentsView`), each
  with its own persistent partition (`persist:svc-discord`, …): log in once, stay logged in.
  No preload, no Node; navigation stays in-app only on each site's own hosts, everything else
  opens in the system browser. Per CLAUDE.md there are no user tokens or scraping; Discord
  automation uses webhooks (the `discord` module).
- **Panels:** `hub-web.discord`, `hub-web.linkedin`, `hub-web.x`, `hub-web.notion-web` (not in
  the default layout, so nothing loads until you open one).
- **Commands:** `Hub: Open Discord`, `Hub: Open LinkedIn`, `Hub: Open X`, `Hub: Open Notion`.
- **Known limitations:** "Sign in with Google/Apple" pops out to the system browser (a
  different site), so use the site's own email login inside the tab.

---

### `discord` — Discord

- **Room:** hub · **Platforms:** all · **Enabled by default:** yes
- **What it does:** Discord through **webhooks** only (no user tokens, no self-bots, per
  CLAUDE.md §7).
    - **Webhooks:** add one with a name and its URL (Channel settings → Integrations → Webhooks →
      Copy URL). Forge checks it with Discord first, then stores all webhook URLs in one secret
      (`discord.webhooks`, DPAPI). The renderer only ever sees names.
    - **Post:** Markdown to any webhook as "Forge" (Ctrl+Enter). Mentions are never pinged
      (`allowed_mentions: []`).
    - **Forward:** per webhook, forward Forge notifications by level (default warn + error) and
      source module (default: everything), as coloured embeds. Useful for getting alerts, finished
      training runs and failed deploys on your phone. Discord's own notices are never forwarded.
      Per-webhook ordered queue; a 429 is waited out once. The last failure is shown on the card.
- **Panels:** `discord.panel` — Discord (right side of the Hub).
- **Commands:** `Hub: Discord Webhooks & Forwarding`.
- **Secrets:** `discord.webhooks` (managed from the panel; deleting it in Settings forgets all).
- **Settings:** `discord:hooks` (names, Discord's webhook name/channel id, forward rules; no
  URLs).
- **Known limitations:** posting only; reading channels needs the Discord webview tab
  (`hub-web`).

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
