# CLAUDE.md — Forge

> Personal command center: code editor + trading desk + ML lab + knowledge/comms hub, in one desktop app.
> Owner: Marto. Single user. Windows 11. Built with Claude Code.

---

## 1. What this project is

Forge replaces the daily juggling of VS Code/PyCharm, GitHub, Vercel, TradingView, DexScreener, MetaTrader 5, Obsidian, Notion, Discord and AI assistants. It is organized into four **Rooms**. Each room has its own dockable layout and accent color.

| Room | Purpose | Core panels |
|---|---|---|
| **Build** | Write, run, ship code | Monaco editor, file tree, terminals (PowerShell + Claude Code / Codex / Gemini CLI presets), Git, GitHub (PRs, issues, Actions), Vercel deployments, AI chat |
| **Trade** | Market awareness and monitoring | Charts (lightweight-charts), economic + earnings calendar, DexScreener watchlist, Solana wallet watch (read-only), MT5 account/positions (read-only), webview tabs (TradingView, Axiom, Fomo, Forex Factory) |
| **Lab** | Research / ML | Run Monitor (live metrics streamed from training scripts), DataFrame/Parquet viewer, GPU monitor, notebook runner, experiment history |
| **Hub** | Knowledge and comms | Obsidian vault browser/editor, Notion pages, unified notification inbox, Discord/LinkedIn/X webview tabs, "Today" dashboard |

Cross-cutting features: global command palette (Ctrl+K), dockable panels with layouts persisted per room, notifications, settings, secrets vault.

**Guiding principle:** every feature must directly speed up Marto's actual work. Never add generic features for completeness. When a requirement is unclear, ask before building.

---

## 2. Tech stack

Do not change the stack without asking. Record every stack decision in `docs/DECISIONS.md`.

- **Shell:** Electron (latest stable) via `electron-vite`; packaging via `electron-builder` (Windows NSIS)
- **Renderer:** React 19 + TypeScript (strict) + Vite
- **Styling:** Tailwind CSS v4 + CSS-variable design tokens (§6); Radix UI primitives; `lucide-react` icons; `motion` for animation
- **Layout:** `dockview` (dockable panels, layouts persisted per room)
- **Command palette:** `cmdk`
- **State:** Zustand (UI state) + TanStack Query (async/server state)
- **Editor:** Monaco (`monaco-editor`, bundled locally, never from a CDN); LSP via `monaco-languageclient`, using `basedpyright` (Python) and `typescript-language-server` (TS/JS)
- **Terminal:** `xterm.js` + `node-pty`
- **Charts:** `lightweight-charts` for financial charts; ECharts for ML metrics and everything else
- **Git/GitHub:** `simple-git` (uses the system git) + `@octokit/rest`
- **App DB:** SQLite via `better-sqlite3` + Drizzle ORM, owned by the main process
- **Validation:** `zod` for all IPC payloads and settings
- **Python sidecar:** Python 3.12, `uv`, FastAPI + uvicorn, WebSockets, `httpx`, `polars`/`pandas`, DuckDB, `pynvml`, `MetaTrader5` (Windows only)
- **Testing:** Vitest (unit), Playwright for Electron (e2e smoke), pytest (sidecar)
- **Lint/format:** ESLint (flat config) + Prettier; Ruff (lint + format) for Python
- **CI:** GitHub Actions on `windows-latest`

---

## 3. Architecture

```
┌──────────────────── Renderer (React, sandboxed, no Node) ────────────────────┐
│  Rooms → Panels → UI components │ Command palette │ Zustand + TanStack Query  │
└──────────────── window.forge  (typed API exposed by preload) ────────────────┘
                                   │  IPC — typed contract, zod-validated
┌──────────────────────────── Main process (Node) ─────────────────────────────┐
│  Module registry │ Services: fs, pty, git, github, vercel, ai, lsp, db,      │
│  secrets (safeStorage), webviews (WebContentsView), notifications, sidecar   │
└──────────────────────────────────┬───────────────────────────────────────────┘
                                   │  HTTP + WebSocket on 127.0.0.1:<random port>, bearer token
┌────────────────────────── Python sidecar (FastAPI) ──────────────────────────┐
│  market data, calendars, MT5, Solana RPC, DuckDB/dataframes, GPU, run monitor │
└───────────────────────────────────────────────────────────────────────────────┘
```

### Hard rules
- The **renderer never touches** Node, the filesystem, secrets or third-party APIs directly. Everything privileged goes through main.
- The renderer talks to the sidecar **only through main**. Main proxies HTTP and relays WebSocket streams over IPC (MessagePort).
- Every IPC channel is declared once in `src/shared/ipc/contract.ts`, with zod schemas for input and output. Handlers validate input. Calls return `Result<T> = { ok: true, data: T } | { ok: false, error: { code: string, message: string } }`.
- **Sidecar lifecycle:**
  - Main picks a free port and generates a random token per launch, then spawns the sidecar with both passed via env (`FORGE_PORT`, `FORGE_TOKEN`).
  - Main polls `/health` until ready, restarts with exponential backoff on crash, and kills the whole process tree on quit.
  - The sidecar binds to `127.0.0.1` only and rejects any request without the token.
  - Exception, by design: the sidecar also generates a **probe token** that opens only `/probe/ws` (metrics from `forge-probe`). It is advertised in `userData/sidecar/probe.json` and removed on shutdown (ADR-012).
- Secrets live only in main (§7). The renderer can ask whether a secret exists, never for its value.

### Module system
Every integration (github, dexscreener, obsidian, mt5, …) is a module. Adding a module must never require editing other modules.

```
src/shared/modules/<id>.manifest.ts   # id, name, room, platforms, required secrets, settings schema
src/main/modules/<id>/                # services + IPC handlers
src/renderer/modules/<id>/            # panels + commands
sidecar/forge_sidecar/routers/<id>.py # optional Python endpoints
```

```ts
export interface ModuleManifest {
	id: string
	name: string
	room: RoomId | 'global'
	platforms?: NodeJS.Platform[]      // e.g. ['win32'] for mt5
	requiredSecrets?: SecretKey[]
	settings?: z.ZodTypeAny
	defaultEnabled: boolean
}

export interface RendererModule {
	manifest: ModuleManifest
	panels?: PanelDefinition[]         // registered into dockview for its room
	commands?: CommandDefinition[]     // registered into the command palette
	statusItems?: StatusItemDefinition[]  // small components in the status bar
	overlays?: ComponentType[]         // mounted once while enabled (dialogs its commands open)
}

export interface MainModule {
	manifest: ModuleManifest
	activate(ctx: MainModuleContext): Promise<void> | void   // register IPC handlers, start services
	deactivate?(): Promise<void> | void
}
```

---

## 4. Directory structure

```
forge/
├─ CLAUDE.md
├─ docs/
│  ├─ ARCHITECTURE.md
│  ├─ ROADMAP.md          # source of truth for progress (checkboxes)
│  ├─ DECISIONS.md        # ADR log
│  └─ MODULES.md          # one section per module: what it does, secrets, commands
├─ src/
│  ├─ main/
│  │  ├─ index.ts
│  │  ├─ core/            # window, ipc router, module registry, sidecar manager,
│  │  │                   # secrets, db, webviews, notifications, logger
│  │  └─ modules/<id>/
│  ├─ preload/index.ts    # exposes typed window.forge
│  ├─ renderer/
│  │  ├─ app/             # TitleBar, RoomRail, StatusBar, CommandPalette, RoomLayout, Settings
│  │  ├─ rooms/           # build/, trade/, lab/, hub/
│  │  ├─ modules/<id>/
│  │  ├─ ui/              # design-system components
│  │  ├─ styles/          # tokens.css, globals.css
│  │  ├─ stores/
│  │  └─ lib/
│  └─ shared/             # types, ipc contract, zod schemas, manifests (no Node/DOM imports)
├─ sidecar/               # Python uv project
│  ├─ pyproject.toml
│  ├─ forge_sidecar/      # main.py, auth.py, routers/, services/
│  └─ tests/
├─ packages/forge-probe/  # tiny Python lib that training scripts import to stream metrics to Lab
├─ e2e/
├─ resources/fonts/
└─ .github/workflows/ci.yml
```

---

## 5. Commands

```
npm install
npm run dev            # Electron + Vite dev; main auto-starts the sidecar
npm run lint           # eslint
npm run format         # prettier --write
npm run typecheck      # tsc for main, preload, renderer
npm run test           # vitest
npm run test:e2e       # playwright (electron)
npm run build          # production build
npm run dist           # electron-builder installer

cd sidecar
uv sync
uv run pytest
uv run ruff check .
uv run ruff format --check .
```

Run lint, typecheck and tests (both TS and Python) before every commit.

---

## 6. Design system: "precision terminal"

The feel: dark-first, dense, sharp, and quiet until something matters. Think Bloomberg terminal meets Linear. Edgy through precision and a single strong accent per room, **not** gamer RGB, heavy glassmorphism or gradients everywhere.

### Tokens (`src/renderer/styles/tokens.css`, mapped into Tailwind v4 `@theme`)

```
--bg-0: #07080A      app background
--bg-1: #0D0F12      panels
--bg-2: #14171C      raised surfaces, inputs
--bg-3: #1C2027      hover
--border: #232830
--border-strong: #2F3540
--text-0: #E8EAED    primary
--text-1: #A3A9B4    secondary
--text-2: #6B7280    muted
--up: #22C55E        --down: #EF4444      --warn: #F59E0B     --info: #60A5FA

Room accents (used for active indicators, focus rings, key numbers, the thin top border of the active panel):
--accent-build: #6EE7F9   electric cyan
--accent-trade: #A3FF12   acid lime
--accent-lab:   #A78BFA   violet
--accent-hub:   #FBBF24   amber
--accent: var(--accent-<current room>)   set on <html data-room="...">
```

### Rules
- **Typography:**
  - Geist Sans for UI; JetBrains Mono for code, prices and numbers, with `font-variant-numeric: tabular-nums` everywhere numbers update.
  - Fonts are bundled locally in `resources/fonts`.
  - UI base size is 13px (IDE density). Scale: 11 / 12 / 13 / 14 / 16 / 20.
- **Spacing and radius:** 4px spacing grid. Radius 4px (6px for dialogs). 1px borders.
- **Motion:** 120–180ms ease-out. No bounces. Respect `prefers-reduced-motion`. Price flashes are a 400ms background fade in `--up`/`--down` at low opacity.
- **Glow:** only on the focused or active element, as a subtle accent-colored box-shadow.
- **Window:** frameless with a custom title bar (drag region); Windows controls via `titleBarOverlay` colored to match `--bg-0`.
- **Panel states:** every panel has a header (title, actions) and designed **loading / empty / error** states. Never render a blank panel.
- **Keyboard first:**
  - Every action is reachable from the command palette.
  - Every panel is keyboard navigable.
  - Shortcuts are shown in tooltips and in the palette.
- **Accessibility:** contrast AA minimum on text; visible focus rings.

---

## 7. Security rules (non-negotiable)

- `BrowserWindow`: `contextIsolation: true`, `sandbox: true`, `nodeIntegration: false`, `webSecurity: true`. Strict CSP on the renderer. Block `will-navigate`. `setWindowOpenHandler` opens only `https:` URLs in the system browser.
- **Secrets:**
  - All API keys and tokens are stored through `SecretsService`, which uses Electron `safeStorage` (DPAPI on Windows).
  - Never put them in code, committed `.env` files, logs, SQLite plaintext, renderer state or error messages. Only `.env.example` is committed.
  - Never ask Marto to paste a secret into chat. Point him to Settings → Secrets.
- **Third-party webviews:**
  - Use `WebContentsView`, never `<iframe>` or `<webview>`.
  - Each service gets its own persistent partition (`persist:svc-<id>`), no preload script, and no Node.
  - Popups open in the system browser, except OAuth flows on the same site.
- **Crypto:** wallet features are **read-only by public address**. Never request, store or handle private keys or seed phrases. No transaction signing inside Forge.
- **Trading:**
  - MT5 and any exchange integration are **read-only by default**.
  - Any order-placing feature must sit behind a settings flag (off by default) and a confirmation dialog showing symbol, side, size, SL and TP.
  - No automated trading from Forge.
- **Terms of service:**
  - No Discord self-bots or user tokens (use webhooks, bots, or a webview).
  - No scraping behind logins.
  - LinkedIn, Axiom, Fomo and Lovable are webview tabs only.
- **Sidecar:** binds to `127.0.0.1` only, with a bearer token on every request.
- **Dependencies:** justify every new dependency in the PR/commit message. Prefer well-maintained packages with few transitive deps.

---

## 8. Code style

- **Indentation: tabs. Quotes: single.** This applies to TS, JS, JSX attributes (`jsxSingleQuote`) and Python.
- **Prettier:** `useTabs: true`, `singleQuote: true`, `jsxSingleQuote: true`, `semi: true`, `trailingComma: 'all'`, `printWidth: 100`.
- **`.editorconfig`:** `indent_style = tab` for all files, except YAML (spaces, required by the spec).
- **Ruff:** `line-length = 100`; `[tool.ruff.format] indent-style = 'tab'`, `quote-style = 'single'`. Ignore `W191` and `E101`, which conflict with tabs.
- **TypeScript:** `strict`, `noUncheckedIndexedAccess`, no `any` (use `unknown` and narrow). Prefer explicit return types on exported functions.
- **Python:** type hints everywhere, Pydantic models for every API request and response, `async` endpoints, no bare `except`.
- **Naming:**
  - React components: `PascalCase.tsx`, one component per file.
  - Other TS files: `kebab-case.ts`.
  - Python: `snake_case`.
- **Size:** keep files under ~300 lines. Split when they grow.
- **Comments:** comments explain *why*, not *what*. Mark phased work with `// TODO(phase-N): ...`, and nothing else left unfinished.
- **Errors:** never swallow them. Log with context in main (`electron-log`) and the sidecar (stdlib `logging`), and surface user-relevant errors as notifications or panel error states.

---

## 9. How Claude Code works in this repo

1. **Start of every session:** read this file and `docs/ROADMAP.md`, then work on the current phase only.
2. **Plan first:** for anything beyond a small change (~50+ lines, new module, architecture), write a short plan (goal, files, steps, risks) and wait for approval.
3. **Explain concepts before code:** Marto is learning. When introducing a concept (IPC, preload, LSP, PTY, WebContentsView, safeStorage, WebSockets, etc.), give a 3–6 line explanation with an analogy, then implement.
4. **Complete solutions:** no placeholder logic, except explicitly phased `TODO(phase-N)` markers.
5. **Be direct:** challenge bad ideas, point out trade-offs and risks, and don't agree automatically.
6. **Ask when unclear:** ask before guessing on requirements, UX, or which data source to use.
7. **Commits:**
   - Small, reviewable, Conventional Commits (`feat(trade): add dexscreener watchlist`).
   - All checks green before committing.
   - One feature per branch: `phase-N/<feature>`.
8. **No silent changes:** don't add dependencies, change the stack or restructure folders without asking. Log decisions in `docs/DECISIONS.md` (ADR format: context, decision, consequences).
9. **Keep docs alive:** tick `docs/ROADMAP.md`, update `docs/MODULES.md` for every module, and update this file when conventions change.
10. **Windows first:**
    - Use `path.join`, never hardcoded `/`.
    - Give shell commands for PowerShell.
    - Native modules (`node-pty`, `better-sqlite3`) must be rebuilt for Electron's ABI (`@electron/rebuild` or `electron-builder install-app-deps`).
11. **End-of-task report:** what changed, how to verify (exact steps), known limitations, and what's next.

### Definition of done (every feature)
- Typed end to end, zod-validated at IPC boundaries
- Lint, typecheck and tests pass; unit tests cover logic (parsers, transforms, services)
- Loading, empty and error states designed
- Keyboard accessible, with a command palette entry
- Documented in `docs/MODULES.md`

---

## 10. Roadmap (summary; details in `docs/ROADMAP.md`)

- **Phase 0 — Foundation:**
  - Tooling, CI, security baseline
  - Design system
  - Shell (title bar, room rail, status bar, dockview, command palette)
  - Typed IPC, module registry, SQLite, secrets, settings
  - Python sidecar and its lifecycle
  - Webview manager, proven with one TradingView tab
- **Phase 1 — Vertical slice of all four rooms:**
  - Build: file tree, Monaco, terminals with AI CLI presets, Git
  - Trade: economic calendar, DexScreener watchlist, chart, webview tabs
  - Lab: `forge-probe` and Run Monitor, GPU monitor
  - Hub: Obsidian vault, notification inbox
- **Phase 2 — Build depth:** LSP, file search (ripgrep), GitHub (PRs, issues, Actions), Vercel deployments and logs, AI chat panel with file context.
- **Phase 3 — Trade depth:** MT5 read-only, Solana wallet watch, alerts (price and calendar events), earnings calendar, multi-chart layouts, trade journal.
- **Phase 4 — Lab depth:** DataFrame/Parquet/CSV viewer (DuckDB), notebook runner (jupyter_client), experiment history and comparison, panels for cv-visualizer and calibrate.
- **Phase 5 — Hub depth:** Notion, Discord (webhooks + webview), unified inbox across GitHub, Vercel and socials, "Today" dashboard.
- **Phase 6 — Ship:** packaging (electron-builder + PyInstaller sidecar), auto-update, performance pass, backup/export of settings.

---

## 11. Known constraints and gotchas

- **Monaco:** `@monaco-editor/react` loads from a CDN by default. Call `loader.config({ monaco })` with the local package, and set up workers via Vite `?worker` imports. A CDN load would violate the CSP.
- **WebContentsView z-order:** native views render **above** all HTML, so the command palette, dialogs and menus get hidden behind them. `WebviewService` must hide or detach views while any overlay is open, and keep bounds synced to their panel via `ResizeObserver` → IPC.
- **MT5:** the `MetaTrader5` Python package is Windows-only and needs the MT5 terminal installed and logged in. The module must disable itself gracefully elsewhere.
- **Forex Factory:** no official API. Use the public weekly calendar feed, cache aggressively and expect breakage. Keep the data source swappable (for example with Marto's Market Calendar project).
- **DexScreener and public RPCs** are rate-limited. Cache, throttle and batch requests in the sidecar.
- **Lovable, Axiom, Fomo, LinkedIn:** no usable public API, so they are webview tabs only.
- **Native modules** break on Electron upgrades until they are rebuilt. Pin the Electron version and rebuild deliberately.
