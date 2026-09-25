# Forge Roadmap

Source of truth for progress. Tick boxes as work lands. Only the current phase is worked on.

**Current phase: 2 — Build depth.** Phase 1 (all four rooms) is done.

---

## Phase 0 — Foundation

### 0.1 Repo basics

- [x] `git init`, `.gitignore` (node, python, electron, `.env`, `out/`, `dist/`, userData artifacts)
- [x] `.editorconfig` (tabs everywhere, spaces for YAML), `.env.example`, short `README.md`

**Acceptance:** `git status` is clean after the first commit; no `.env`, `node_modules`, `out/` or `.venv` is tracked.

### 0.2 Scaffold

- [x] Scaffold from the electron-vite React + TS template
- [x] Restructure to `src/main`, `src/preload`, `src/renderer`, `src/shared`
- [x] Path aliases `@main`, `@renderer`, `@shared` (tsconfig + electron-vite config)

**Acceptance:** `npm run dev` opens a window; an import via each alias compiles in its process.

### 0.3 Tooling

- [x] Strict TS config per process (`strict`, `noUncheckedIndexedAccess`)
- [x] ESLint flat config (TS, React, React Hooks, import order)
- [x] Prettier (tabs, single quotes, `jsxSingleQuote`)
- [x] Vitest; Playwright Electron smoke test (app launches, title is "Forge")
- [x] `simple-git-hooks` + `lint-staged`
- [x] All npm scripts from CLAUDE.md §5

**Acceptance:** `npm run lint`, `typecheck`, `test`, `test:e2e` all pass; a pre-commit hook runs lint-staged.

### 0.4 Security baseline

- [x] BrowserWindow: `contextIsolation`, `sandbox`, no `nodeIntegration`, `webSecurity`
- [x] Strict CSP (dev variant allows Vite HMR only on localhost)
- [x] Block `will-navigate`; `setWindowOpenHandler` → `https:` only, via `shell.openExternal`

**Acceptance:** e2e asserts `window.require` and `window.process` are `undefined`; navigating to an external URL leaves the window on the app URL.

### 0.5 Design system

- [x] `tokens.css` with every §6 token, mapped into Tailwind v4 `@theme`
- [x] Per-room accent via `<html data-room>`
- [x] Local fonts: Geist Sans + JetBrains Mono (`@fontsource` packages)
- [x] Primitives in `src/renderer/ui/`: Button, IconButton, Input, Select, Tabs, Tooltip (shortcut hint), Kbd, Badge, Spinner, Panel, EmptyState, ErrorState, Dialog, Toast
- [x] Design Playground view (palette: `Dev: Open Design Playground`)

**Acceptance:** playground renders every component in every state and all 4 accents; a lint/test check finds no hex/rgb colors outside `tokens.css`.

### 0.6 App shell

- [x] Frameless window + `titleBarOverlay` in `--bg-0`
- [x] TitleBar: drag region, app mark, room name, centered search pill → palette
- [x] RoomRail: 4 rooms, accent indicator, Ctrl+1…4 (updates `data-room`)
- [x] StatusBar: sidecar dot, git branch placeholder, notification count, clock
- [x] RoomLayout: dockview per room, saved to DB on change, restored on launch; "Reset layout" command
- [x] CommandPalette (`cmdk`): Ctrl+K / Ctrl+Shift+P, registry fed by modules, fuzzy search, grouped by room, shortcut display
- [x] Built-in commands: switch room, reset layout, open settings, reload window, toggle design playground

**Acceptance:** all shortcuts work; a rearranged layout survives restart; the palette lists commands from all 4 rooms.

> Built in the order 0.7 → 0.9 → 0.8 → 0.6 → 0.10, because the shell needs IPC, the DB and the
> module registry to persist layouts and list module commands.

### 0.7 Typed IPC

- [x] `src/shared/ipc/contract.ts`: channels with zod input/output schemas
- [x] Main router validates input, returns `Result<T>`
- [x] Preload exposes typed `window.forge.invoke(channel, input)` and `window.forge.on(event, handler)` → unsubscribe
- [x] Example channels `app:getVersion`, `app:getPlatform`

**Acceptance:** router unit tests cover valid input, invalid input (handler never called), and handler error → `{ ok: false }`.

### 0.8 Module registry

- [x] Manifest types (CLAUDE.md §3); main + renderer registries
- [x] Platform filtering
- [x] Enable/disable per module, stored in settings
- [x] `build-core`, `trade-core`, `lab-core`, `hub-core`: one Welcome panel + one command each

**Acceptance:** disabling a module removes its panels and commands live, without restart (unit test + manual).

### 0.9 Database

- [x] `better-sqlite3` + Drizzle at `userData/forge.db`, with migrations
- [x] Tables: `settings`, `layouts`, `notifications`
- [x] Native rebuild for Electron, documented in README

**Acceptance:** unit tests use an in-memory DB; settings persist across restarts.

### 0.10 Secrets and Settings

- [x] `SecretsService` (safeStorage) in its own encrypted file under userData
- [x] IPC: `secrets:has`, `secrets:set`, `secrets:delete` only — no `get`
- [x] Settings screen: General (font size, reduce motion), Secrets (keys from manifests, masked input, Saved badge, delete), Modules (toggles + platform note)

**Acceptance:** a saved secret survives restart; a test greps log output, DB file and IPC responses and never finds the secret value.

### 0.11 Python sidecar

- [x] `sidecar/` uv project (Python 3.12 pinned): FastAPI, uvicorn, pydantic, httpx; dev: pytest, ruff
- [x] Ruff per CLAUDE.md §8
- [x] `GET /health` → `{status, version, python}`; bearer token required on every route, including health
- [x] `SidecarManager`: free port, 32-byte token, spawn `uv run uvicorn`, poll health with timeout, backoff restart (max 5 then error + notification), tree-kill on quit, status events, typed `sidecar.request(method, path, body)`

**Acceptance:** StatusBar goes green; killing python.exe turns it amber then green; pytest covers missing/wrong token → 401.

### 0.12 Webview manager (PoC)

- [x] `WebviewService` with `WebContentsView`, `persist:svc-<id>` partition, no preload
- [x] Bounds synced via `ResizeObserver` → IPC
- [x] Hidden when the panel is hidden, on room switch, and while any overlay is open
- [x] Popups → system browser (same-site OAuth allowed)
- [x] TradingView panel in Trade

**Acceptance:** TradingView login survives restart; palette never hidden behind the view; resize/dock keeps alignment.

> Verified by e2e: own partition, alignment (incl. window resize), hidden under palette/settings/other rooms.
> **Needs Marto:** log into TradingView once and confirm it survives a restart (can't be automated without credentials).

### 0.13 CI

- [x] GitHub Actions on `windows-latest`: `npm ci`, lint, typecheck, unit tests; `uv sync`, `ruff check`, `ruff format --check`, pytest
- [x] Cache npm and uv

**Acceptance:** workflow green on push.

> CI green on GitHub (private repo martex-dev/forge).

### 0.14 Wrap-up

- [x] Tick this file, update ARCHITECTURE.md and README
- [x] Final report: what was built, 10-step manual checklist, limitations, Phase 1 plan

---

## Phase 1 — Vertical slice of all four rooms

- [x] **Build:** file tree (open folder, recents, chokidar watcher, create/rename/delete)
- [x] **Build:** Monaco (local), tabs, dirty state, Ctrl+S, theme from tokens
- [x] **Build:** terminals (xterm.js + node-pty), tabs, presets: PowerShell, Python venv, Claude Code, Codex, Gemini CLI
- [x] **Build:** Git panel (branch, changes, diff, stage, commit, pull/push); branch in StatusBar
- [x] **Trade:** economic calendar (Forex Factory feed, impact/currency filter, countdown)
- [x] **Trade:** DexScreener watchlist + token detail, price flashes
- [x] **Trade:** chart panel (lightweight-charts; Binance spot + GeckoTerminal DEX pools)
- [x] **Trade:** webview tabs: TradingView, Axiom, Fomo, Forex Factory
- [x] **Lab:** `forge-probe` package + Run Monitor (ECharts)
- [x] **Lab:** GPU monitor (pynvml, graceful fallback)
- [x] **Lab:** `examples/train_mnist_probe.py`
- [x] **Hub:** Obsidian vault (tree, editor/preview, wikilinks, tags, search, quick note)
- [x] **Hub:** notification inbox + Windows toasts for warn/error

## Phase 2 — Build depth

- [x] LSP: basedpyright + typescript-language-server
- [x] Workspace search (ripgrep)
- [ ] GitHub: PRs, issues, Actions, diff review, inbox notifications
- [ ] Vercel: projects, deployments, logs, promote/rollback with confirmation
- [ ] AI chat (Claude / OpenAI / Gemini) from main, file/selection/diff context, streaming, diff-preview apply

## Phase 3 — Trade depth

- [ ] MT5 read-only: account, positions with live P/L, history
- [ ] Solana wallet watch (public address only)
- [ ] Alerts: price thresholds and calendar events → inbox + toasts
- [ ] Earnings calendar (source to be agreed; possibly Market Calendar project)
- [ ] Multi-chart layouts
- [ ] Trade journal (entries, screenshots, tags, notes, stats)

## Phase 4 — Lab depth

- [ ] DataFrame viewer (CSV/Parquet/Feather via DuckDB): virtualized, stats, filter/sort, SQL
- [ ] Notebook runner (jupyter_client)
- [ ] Experiment history + side-by-side comparison
- [ ] cv-visualizer and calibrate panels

## Phase 5 — Hub depth

- [ ] Notion module
- [ ] Discord: webhooks + webview
- [ ] Social webview tabs (LinkedIn, X, …)
- [ ] Unified inbox (GitHub, Vercel, alerts, calendar)
- [ ] "Today" dashboard

## Phase 6 — Ship

- [ ] Packaging note: language servers run from `node_modules` with Electron-as-Node; `typescript` (fallback tsserver) must ship as a runtime dependency
- [ ] Packaging note: `asarUnpack` the ripgrep binary (`node_modules/@vscode/ripgrep-*/**`); `rgPath()` already maps `.asar` → `.asar.unpacked`.
- [ ] PyInstaller sidecar bundled via electron-builder (NSIS)
- [ ] Auto-update (electron-updater, GitHub Releases)
- [ ] Performance pass (measured before/after)
- [ ] Settings backup/export (no secrets); first-launch onboarding

## Parking lot (not scheduled — discuss before adding)

- Slack, Cursor, Uniswap, Phantom (read-only), OpenClaw, Hermes, news/analysis feeds
