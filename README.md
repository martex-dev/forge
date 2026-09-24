# Forge

Personal command center: code editor + trading desk + ML lab + knowledge/comms hub, in one Electron app.

See [CLAUDE.md](CLAUDE.md) for conventions, [docs/ROADMAP.md](docs/ROADMAP.md) for progress and
[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for how it fits together.

## Requirements (Windows 11)

- Node ≥ 22, npm
- Python 3.12 + [uv](https://docs.astral.sh/uv/)
- Git
- Visual Studio 2022 Build Tools (C++ workload) — only needed if a native module has no prebuilt binary

## Getting started

```powershell
npm install
node node_modules/electron/install.js   # Electron 44 downloads its binary lazily; do it up front
npm run dev
```

The first launch runs `uv sync` for the Python sidecar (a minute or so); the status-bar dot turns
green when it's ready.

## Everyday commands

```powershell
npm run dev          # app + sidecar with hot reload (F12 = devtools)
npm run lint         # eslint
npm run typecheck    # tsc for main/preload, renderer and e2e
npm test             # vitest unit tests
npm run test:e2e     # builds, then drives the real Electron app with Playwright
npm run format       # prettier --write

cd sidecar
uv run pytest
uv run ruff check .
uv run ruff format .
```

| Shortcut                  | Action                    |
| ------------------------- | ------------------------- |
| `Ctrl+K` / `Ctrl+Shift+P` | Command palette           |
| `Ctrl+1` … `Ctrl+4`       | Build / Trade / Lab / Hub |
| `Ctrl+,`                  | Settings                  |
| `F12` (dev only)          | Devtools                  |

Set `FORGE_NO_SIDECAR=1` to start without the Python sidecar. Logs are in
`%APPDATA%\forge\logs\main.log`.

## Native modules

`better-sqlite3` (and later `node-pty`) are compiled C++ addons. Electron embeds its own Node with
a different ABI than your system Node, so an addon built for one won't load in the other.

- `better-sqlite3` 13 ships **N-API** prebuilt binaries (`prebuilds/win32-x64.node`). N-API is
  ABI-stable, so the same binary works in plain Node (Vitest) and in Electron — no rebuild needed.
- `npm install` runs `electron-builder install-app-deps` (postinstall), which rebuilds any
  non-N-API addon for the pinned Electron version. Run it manually after upgrading Electron:

    ```powershell
    npx electron-builder install-app-deps
    ```

- npm 11 blocks dependency install scripts unless approved. Approved packages are listed under
  `allowScripts` in `package.json`; approve new ones with `npm approve-scripts <pkg>`.
- If a module has no prebuilt binary it compiles from source, which needs the Visual Studio 2022
  Build Tools (C++ workload). The project path contains a space (`PC Games`), which node-gyp warns
  about; builds have worked, but move the repo if a native build ever fails on paths.

## Database

SQLite at `%APPDATA%/forge/forge.db` (Electron `userData`). Schema lives in
`src/main/core/db/schema.ts`; after changing it run `npm run db:generate` to emit a SQL migration
into `drizzle/`. Migrations are bundled into the main build and applied on startup.
