# Performance

Measured on Marto's machine (Windows 11, RTX 5070 box), built app (`npm run build`), fresh
profile, median of 3 runs.

```powershell
npx tsx scripts/measure-startup.mts 3
```

## Phase 6 pass (2026-09-25)

| Metric                              | Before | After  | Change |
| ----------------------------------- | ------ | ------ | ------ |
| Window shown                        | 334 ms | 332 ms | —      |
| Shell interactive (Build room)      | 601 ms | 604 ms | —      |
| Idle memory, all Electron processes | 806 MB | 437 MB | −46%   |
| Sidecar ready (`/health`)           | 1.39 s | 0.67 s | −52%   |
| Sidecar idle memory                 | 94 MB  | 65 MB  | −31%   |

### What changed

- **Webviews load on first view.** Every room stays mounted (so panels keep their state), which
  meant the Trade room's TradingView tab loaded at startup in its own renderer process: 329 MB and
  network traffic for a room you might not open. `WebviewPanel` now creates its native view the
  first time its panel is actually on screen, and keeps it after that.
- **polars and DuckDB load on first use.** They were imported when the sidecar started (~150 ms,
  ~30 MB) for the DataFrame viewer and ML tools only. They're now imported inside the functions
  that use them.

### Where the rest goes (after)

Browser (main) ~155 MB, GPU ~110 MB, utility ~70 MB, app renderer ~135 MB. The renderer's
largest chunks are Monaco's VS Code services (`localExtensionHost` 13.5 MB, loaded only when an
editor opens) and the main entry (5.3 MB).

### Not done (and why)

- **Mounting rooms lazily** would save part of the renderer's 135 MB but changes the "switching
  rooms is instant and keeps state" behaviour. It isn't worth it at current numbers.
- **Code-splitting the main entry:** startup is already ~0.6 s to an interactive shell.
