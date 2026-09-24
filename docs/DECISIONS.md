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
