# PyInstaller build of the sidecar for the packaged app (ADR-023):
#   uv run pyinstaller forge-sidecar.spec --noconfirm
# Output: dist/forge-sidecar/forge-sidecar.exe (one folder: starts much faster than one-file,
# which would unpack ~hundreds of MB to %TEMP% on every launch).
# ruff: noqa

from PyInstaller.utils.hooks import collect_all, collect_data_files, collect_submodules

import forge_probe
import forge_sidecar

datas, binaries, hiddenimports = [], [], []

# Imported dynamically (uvicorn picks its loop/protocol by name; routers are plain imports but
# listed so a missed one fails the build rather than the first request).
hiddenimports += collect_submodules('forge_sidecar')
hiddenimports += collect_submodules('uvicorn')
hiddenimports += ['pynvml', 'forge_probe.artifacts']

# Packages with data files, compiled extensions or entry points PyInstaller's hooks may miss.
for pkg in ('duckdb', 'polars', 'jupyter_client', 'zmq', 'purged_cv', 'calibrate', 'sklearn'):
	d, b, h = collect_all(pkg)
	datas += d
	binaries += b
	hiddenimports += h

# The "run in your environment" jobs send their own source into a kernel (inspect.getsource),
# so these two modules must also ship as .py files next to their compiled copies.
datas += collect_data_files('forge_sidecar', include_py_files=True, includes=['services/mltool_jobs.py'])
datas += collect_data_files('forge_probe', include_py_files=True, includes=['artifacts.py'])

try:
	import MetaTrader5  # noqa: F401 - Windows only; the module disables itself without it

	hiddenimports += collect_submodules('MetaTrader5')
except ImportError:
	pass

a = Analysis(
	['forge_sidecar/__main__.py'],
	pathex=['.'],
	datas=datas,
	binaries=binaries,
	hiddenimports=hiddenimports,
	# Never needed at runtime; keeps the bundle smaller.
	excludes=['tkinter', 'pytest', 'IPython', 'ipykernel', 'PyInstaller'],
	noarchive=False,
)
pyz = PYZ(a.pure)
exe = EXE(
	pyz,
	a.scripts,
	[],
	exclude_binaries=True,
	name='forge-sidecar',
	console=True,  # stdout/stderr are piped to main's log; no window is shown (windowsHide)
	upx=False,
)
coll = COLLECT(exe, a.binaries, a.datas, name='forge-sidecar', upx=False)
