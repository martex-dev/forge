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

### Probe ingest (Lab)

Training scripts use `packages/forge-probe` to stream metrics. They never see the main token:

```
train.py ──forge_probe──► ws://127.0.0.1:<port>/probe/ws   (probe token, only valid on this path)
                              │  sidecar: RunsStore (SQLite, userData/sidecar/lab/runs.db)
renderer ◄── IPC runs:* ◄── main ◄── GET /runs… (main token)
```

The sidecar writes `userData/sidecar/probe.json` (`url`, probe token, pid) on startup and deletes
it on shutdown; the probe reads it (or `FORGE_PROBE_FILE`). See ADR-012.

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

## Code map (Phase 0)

| Concern            | Main                                                | Shared                                      | Renderer                                                         |
| ------------------ | --------------------------------------------------- | ------------------------------------------- | ---------------------------------------------------------------- |
| Startup / shutdown | `src/main/index.ts`                                 |                                             | `src/renderer/main.tsx`, `app/App.tsx`                           |
| Window + security  | `core/window.ts`, `core/security.ts`, `core/csp.ts` | `constants.ts`                              |                                                                  |
| IPC                | `core/ipc.ts`, `core/ipc-router.ts`                 | `ipc/contract.ts`, `ipc/channels/*`         | `lib/ipc.ts` (`call()`), `lib/use-forge-event.ts`                |
| Preload bridge     |                                                     | `ipc/api.ts` (`ForgeApi`)                   | `src/preload/index.ts`                                           |
| DB                 | `core/db/*` (client, migrate, repos)                | `settings.ts`, `notifications.ts`           | hooks in `app/hooks/*`                                           |
| Secrets            | `core/secrets/*`                                    | `ipc/channels/secrets.ts`                   | `app/settings/Secret*.tsx`                                       |
| Modules            | `core/modules/*`                                    | `modules/*.manifest.ts`, `modules/types.ts` | `modules/registry.ts`, `modules/<id>/`                           |
| Sidecar            | `core/sidecar/*`                                    | `ipc/channels/sidecar.ts`                   | `app/SidecarIndicator.tsx`                                       |
| Webviews           | `core/webviews/*`                                   | `webviews.ts`, `ipc/channels/webview.ts`    | `app/webview/*`                                                  |
| Shell UI           |                                                     | `rooms.ts`                                  | `app/*` (TitleBar, RoomRail, StatusBar, CommandPalette, layout/) |
| Design system      |                                                     |                                             | `styles/tokens.css`, `styles/globals.css`, `ui/*`                |

### Request flow example

`Settings → General → font size 14`:

1. `GeneralSettingsTab` calls `call('settings:updateGeneral', { fontSize: 14 })`.
2. Preload forwards `{ channel, input }` over the single `forge:invoke` transport.
3. Main checks the sender is Forge's own renderer, then the router validates the input with the
   channel's zod schema.
4. The handler writes through `SettingsRepo` (zod-validated JSON in SQLite), emits
   `settings:generalChanged` and returns the new value.
5. The router validates the output and returns `{ ok: true, data }`. `call()` unwraps it, and
   TanStack Query updates the cache.

### Testing layers

- **Vitest** (`npm test`): pure logic in main/shared/renderer: router, repos (in-memory SQLite),
  registries, secrets service (fake encryptor), sidecar manager (fake process), shortcuts, CSP, and
  a scan that fails on hardcoded colors outside `tokens.css`.
- **Playwright + Electron** (`npm run test:e2e`): the real app with a throwaway `--user-data-dir`:
  security, IPC, restart persistence (settings, layouts, secrets), secret-leak scan of every file,
  shortcuts/palette/module toggling, webview visibility, sidecar crash recovery and orphan check.
- **pytest** (`cd sidecar; uv run pytest`): sidecar auth and config.
