# Forge Roadmap

Source of truth for progress. Tick boxes as work lands. Only the current phase is worked on.

**Current phase: 0 — Foundation** (plan written; awaiting approval)

---

## Phase 0 — Foundation

### 0.1 Repo basics

- [ ] `git init`, `.gitignore` (node, python, electron, `.env`, `out/`, `dist/`, userData artifacts)
- [ ] `.editorconfig` (tabs everywhere, spaces for YAML), `.env.example`, short `README.md`

**Acceptance:** `git status` is clean after the first commit; no `.env`, `node_modules`, `out/` or `.venv` is tracked.

### 0.2 Scaffold

- [ ] Scaffold from the electron-vite React + TS template
- [ ] Restructure to `src/main`, `src/preload`, `src/renderer`, `src/shared`
- [ ] Path aliases `@main`, `@renderer`, `@shared` (tsconfig + electron-vite config)

**Acceptance:** `npm run dev` opens a window; an import via each alias compiles in its process.

### 0.3 Tooling

- [ ] Strict TS config per process (`strict`, `noUncheckedIndexedAccess`)
- [ ] ESLint flat config (TS, React, React Hooks, import order)
- [ ] Prettier (tabs, single quotes, `jsxSingleQuote`)
- [ ] Vitest; Playwright Electron smoke test (app launches, title is "Forge")
- [ ] `simple-git-hooks` + `lint-staged`
- [ ] All npm scripts from CLAUDE.md §5

**Acceptance:** `npm run lint`, `typecheck`, `test`, `test:e2e` all pass; a pre-commit hook runs lint-staged.

### 0.4 Security baseline

- [ ] BrowserWindow: `contextIsolation`, `sandbox`, no `nodeIntegration`, `webSecurity`
- [ ] Strict CSP (dev variant allows Vite HMR only on localhost)
- [ ] Block `will-navigate`; `setWindowOpenHandler` → `https:` only, via `shell.openExternal`

**Acceptance:** e2e asserts `window.require` and `window.process` are `undefined`; navigating to an external URL leaves the window on the app URL.

### 0.5 Design system

- [ ] `tokens.css` with every §6 token, mapped into Tailwind v4 `@theme`
- [ ] Per-room accent via `<html data-room>`
- [ ] Local fonts: Geist Sans + JetBrains Mono (`@fontsource` packages)
- [ ] Primitives in `src/renderer/ui/`: Button, IconButton, Input, Select, Tabs, Tooltip (shortcut hint), Kbd, Badge, Spinner, Panel, EmptyState, ErrorState, Dialog, Toast
- [ ] Design Playground view (palette: `Dev: Open Design Playground`)

**Acceptance:** playground renders every component in every state and all 4 accents; a lint/test check finds no hex/rgb colors outside `tokens.css`.

### 0.6 App shell

- [ ] Frameless window + `titleBarOverlay` in `--bg-0`
- [ ] TitleBar: drag region, app mark, room name, centered search pill → palette
- [ ] RoomRail: 4 rooms, accent indicator, Ctrl+1…4 (updates `data-room`)
- [ ] StatusBar: sidecar dot, git branch placeholder, notification count, clock
- [ ] RoomLayout: dockview per room, saved to DB on change, restored on launch; "Reset layout" command
- [ ] CommandPalette (`cmdk`): Ctrl+K / Ctrl+Shift+P, registry fed by modules, fuzzy search, grouped by room, shortcut display
- [ ] Built-in commands: switch room, reset layout, open settings, reload window, toggle design playground

**Acceptance:** all shortcuts work; a rearranged layout survives restart; the palette lists commands from all 4 rooms.

### 0.7 Typed IPC

- [ ] `src/shared/ipc/contract.ts`: channels with zod input/output schemas
- [ ] Main router validates input, returns `Result<T>`
- [ ] Preload exposes typed `window.forge.invoke(channel, input)` and `window.forge.on(event, handler)` → unsubscribe
- [ ] Example channels `app:getVersion`, `app:getPlatform`

**Acceptance:** router unit tests cover valid input, invalid input (handler never called), and handler error → `{ ok: false }`.

### 0.8 Module registry

- [ ] Manifest types (CLAUDE.md §3); main + renderer registries
- [ ] Platform filtering
- [ ] Enable/disable per module, stored in settings
- [ ] `build-core`, `trade-core`, `lab-core`, `hub-core`: one Welcome panel + one command each

**Acceptance:** disabling a module removes its panels and commands live, without restart (unit test + manual).

### 0.9 Database

- [ ] `better-sqlite3` + Drizzle at `userData/forge.db`, with migrations
- [ ] Tables: `settings`, `layouts`, `notifications`
- [ ] Native rebuild for Electron, documented in README

**Acceptance:** unit tests use an in-memory DB; settings persist across restarts.

### 0.10 Secrets and Settings

- [ ] `SecretsService` (safeStorage) in its own encrypted file under userData
- [ ] IPC: `secrets:has`, `secrets:set`, `secrets:delete` only — no `get`
- [ ] Settings screen: General (font size, reduce motion), Secrets (keys from manifests, masked input, Saved badge, delete), Modules (toggles + platform note)

**Acceptance:** a saved secret survives restart; a test greps log output, DB file and IPC responses and never finds the secret value.

### 0.11 Python sidecar

- [ ] `sidecar/` uv project (Python 3.12 pinned): FastAPI, uvicorn, pydantic, httpx; dev: pytest, ruff
- [ ] Ruff per CLAUDE.md §8
- [ ] `GET /health` → `{status, version, python}`; bearer token required on every route, including health
- [ ] `SidecarManager`: free port, 32-byte token, spawn `uv run uvicorn`, poll health with timeout, backoff restart (max 5 then error + notification), tree-kill on quit, status events, typed `sidecar.request(method, path, body)`

**Acceptance:** StatusBar goes green; killing python.exe turns it amber then green; pytest covers missing/wrong token → 401.

### 0.12 Webview manager (PoC)

- [ ] `WebviewService` with `WebContentsView`, `persist:svc-<id>` partition, no preload
- [ ] Bounds synced via `ResizeObserver` → IPC
- [ ] Hidden when the panel is hidden, on room switch, and while any overlay is open
- [ ] Popups → system browser (same-site OAuth allowed)
- [ ] TradingView panel in Trade

**Acceptance:** TradingView login survives restart; palette never hidden behind the view; resize/dock keeps alignment.

### 0.13 CI

- [ ] GitHub Actions on `windows-latest`: `npm ci`, lint, typecheck, unit tests; `uv sync`, `ruff check`, `ruff format --check`, pytest
- [ ] Cache npm and uv

**Acceptance:** workflow green on push.

### 0.14 Wrap-up

- [ ] Tick this file, update ARCHITECTURE.md and README
- [ ] Final report: what was built, 10-step manual checklist, limitations, Phase 1 plan

---

## Phase 1 — Vertical slice of all four rooms

- [ ] **Build:** file tree (open folder, recents, chokidar watcher, create/rename/delete)
- [ ] **Build:** Monaco (local), tabs, dirty state, Ctrl+S, theme from tokens
- [ ] **Build:** terminals (xterm.js + node-pty), tabs, presets: PowerShell, Python venv, Claude Code, Codex, Gemini CLI
- [ ] **Build:** Git panel (branch, changes, diff, stage, commit, pull/push); branch in StatusBar
- [ ] **Trade:** economic calendar (Forex Factory feed, impact/currency filter, countdown)
- [ ] **Trade:** DexScreener watchlist + token detail, price flashes
- [ ] **Trade:** chart panel (data source to be agreed)
- [ ] **Trade:** webview tabs: TradingView, Axiom, Fomo, Forex Factory
- [ ] **Lab:** `forge-probe` package + Run Monitor (ECharts)
- [ ] **Lab:** GPU monitor (pynvml, graceful fallback)
- [ ] **Lab:** `examples/train_mnist_probe.py`
- [ ] **Hub:** Obsidian vault (tree, editor/preview, wikilinks, tags, search, quick note)
- [ ] **Hub:** notification inbox + Windows toasts for warn/error

## Phase 2 — Build depth

- [ ] LSP: basedpyright + typescript-language-server
- [ ] Workspace search (ripgrep)
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

- [ ] PyInstaller sidecar bundled via electron-builder (NSIS)
- [ ] Auto-update (electron-updater, GitHub Releases)
- [ ] Performance pass (measured before/after)
- [ ] Settings backup/export (no secrets); first-launch onboarding

## Parking lot (not scheduled — discuss before adding)

- Slack, Cursor, Uniswap, Phantom (read-only), OpenClaw, Hermes, news/analysis feeds
