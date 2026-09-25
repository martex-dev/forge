# forge-probe

Streams training metrics from any Python script to the **Lab → Run Monitor** panel in Forge.
If Forge isn't running, it does nothing (metrics are buffered briefly, then dropped), so it's safe
to leave in your training code.

## Install

Into the environment your training script uses (venv, conda, uv project):

```powershell
pip install -e "C:\path\to\forge\packages\forge-probe"
# or, in a uv project:
uv add --editable "C:\path\to\forge\packages\forge-probe"
```

Its only dependency is `websockets`.

## Use

```python
import forge_probe

probe = forge_probe.run('mnist-cnn', config={'lr': 1e-3, 'batch_size': 64}, project='mnist')
for step, (loss, acc) in enumerate(train()):
	probe.log(step=step, loss=loss, acc=acc)  # numbers, numpy scalars or 1-element tensors
probe.finish()
```

Or as a context manager, which marks the run **failed** (with the error) if an exception escapes:

```python
with forge_probe.run('mnist-cnn', config=cfg) as probe:
	...
```

- `step` is optional; it auto-increments from 0.
- NaN/inf values are recorded as gaps, so a diverging loss is visible.
- A script that exits without `finish()` is finished automatically (or marked failed if it
  crashed). A script that is killed shows up as **interrupted**.
- `log()` never blocks: a background thread batches and sends every 250 ms.

## CV folds and calibration

Two extra views appear under the run's charts:

```python
from purged_cv import PurgedKFold

cv = PurgedKFold(5, label_end_times=t1, embargo_pct=0.01)
probe.log_cv(cv, X, name='purged 5-fold')  # X can also be just the number of rows
```

Each fold is drawn as a band of **train / test / purged / embargoed / unused** rows, exactly as the
splitter reports them. Purge and embargo come from purged-cv's `split_detail()`; plain sklearn
splitters (`KFold`, `TimeSeriesSplit`) have no such concept and show train/test only, like
cv-visualizer.

```python
probe.log_calibration(y_val, p_val, name='holdout', variants={'isotonic': p_val_iso})
```

A reliability diagram with bin counts, ECE / MCE / Brier and calibrate's plain-language flag,
for the model and any variants (fit calibrators on held-out data). This one needs Marto's
[`calibrate`](https://github.com/martex-dev/calibrate) package in the training environment;
forge-probe itself still only depends on `websockets`.

Logging the same `name` again replaces the view.

## How it finds Forge

While Forge runs, its sidecar writes `%APPDATA%\Forge\sidecar\probe.json` with a local WebSocket
URL (`ws://127.0.0.1:<port>/probe/ws`) and a per-launch token that only opens that one endpoint.
Set `FORGE_PROBE_FILE` to use a different file. The probe only ever connects to `127.0.0.1`.

See `examples/train_mnist_probe.py` in the Forge repo for a complete PyTorch example.
