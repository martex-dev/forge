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

## How it finds Forge

While Forge runs, its sidecar writes `%APPDATA%\Forge\sidecar\probe.json` with a local WebSocket
URL (`ws://127.0.0.1:<port>/probe/ws`) and a per-launch token that only opens that one endpoint.
Set `FORGE_PROBE_FILE` to use a different file. The probe only ever connects to `127.0.0.1`.

See `examples/train_mnist_probe.py` in the Forge repo for a complete PyTorch example.
