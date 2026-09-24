# Forge Architecture

## Processes

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

| Process      | Trust level                         | Can do                                                                                           |
| ------------ | ----------------------------------- | ------------------------------------------------------------------------------------------------ |
| **Renderer** | Untrusted (treated like a web page) | Draw UI, call `window.forge.*`. No Node, no filesystem, no secrets, no network to third parties. |
| **Preload**  | Bridge                              | Exposes a small typed API with `contextBridge`. Contains no business logic.                      |
| **Main**     | Trusted                             | Owns windows, filesystem, DB, secrets, PTYs, git, outbound API calls, webviews, the sidecar.     |
| **Sidecar**  | Trusted, local only                 | Python-only work: data, ML, MT5, market feeds. Reachable only by main, with a token.             |
| **Webviews** | Untrusted third-party               | One `WebContentsView` per service, own persistent partition, no preload, no Node.                |

## IPC

- Every channel is declared once in `src/shared/ipc/contract.ts` with a zod input and output schema.
- Renderer calls `window.forge.invoke(channel, input)`. Preload forwards it with `ipcRenderer.invoke`.
- Main's router looks up the handler, validates input with zod (invalid input never reaches the handler), runs it, and returns `Result<T> = { ok: true, data } | { ok: false, error: { code, message } }`. Errors are logged in main with context.
- Push events (sidecar status, notifications) go main → renderer and are subscribed with `window.forge.on(event, handler)`, which returns an unsubscribe function.
- Streams from the sidecar (for example live training metrics) are relayed over a `MessagePort`.

## Sidecar lifecycle

1. Main finds a free port and generates a 32-byte random token.
2. Spawns `uv run uvicorn forge_sidecar.main:app` with `FORGE_PORT` and `FORGE_TOKEN` in env.
3. Polls `GET /health` (with token) until ready or timeout.
4. On crash: restarts with exponential backoff, up to 5 attempts, then reports an error state and a notification.
5. On quit: kills the whole process tree (`uv` → `python`) so nothing is orphaned on Windows.
6. Status (`starting | ready | restarting | error`) is pushed to the StatusBar.

## Module system

```
src/shared/modules/<id>.manifest.ts   id, name, room, platforms, requiredSecrets, settings schema
src/main/modules/<id>/                 activate(ctx): registers IPC handlers, starts services
src/renderer/modules/<id>/             panels (dockview) + commands (palette)
sidecar/forge_sidecar/routers/<id>.py  optional Python endpoints
```

- Registries in main and renderer collect modules; platform-incompatible modules are skipped.
- Enabled state lives in settings. Toggling a module adds or removes its panels and commands live.
- Secrets a module needs are declared in its manifest, so the Settings → Secrets tab lists them automatically.

## Webviews

- `WebviewService` in main creates a `WebContentsView` per service with partition `persist:svc-<id>`, so logins survive restarts and stay isolated from each other.
- A renderer panel reserves the space and reports its rectangle with `ResizeObserver` → IPC; main positions the native view over it.
- Native views always render above HTML. So main hides them whenever the panel is hidden, the room changes, or any overlay (palette, dialog, menu) is open.
- `window.open` from a webview goes to the system browser, except same-site OAuth flows.

## Data

- App DB: SQLite at `userData/forge.db`, via `better-sqlite3` + Drizzle, with migrations. Owned by main only.
- Secrets: a separate file under `userData`, encrypted with Electron `safeStorage` (DPAPI on Windows). Never stored in SQLite, logs or renderer state.
