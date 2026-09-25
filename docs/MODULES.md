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
