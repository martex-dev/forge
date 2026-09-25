"""
The standalone CV / calibration jobs. Written once and run two ways: imported by the sidecar
(bundled engine), or sent as source into a kernel from Marto's environment (see mltools.py), so
this module may only import what such an environment has: numpy, scikit-learn, purged-cv,
calibrate and pandas or polars. Everything is imported inside the functions for that reason.
"""

from typing import Any

from forge_probe.artifacts import calibration, cv_folds


def build_splitter(p: dict[str, Any]) -> Any:
	kind = p['splitter']
	if kind == 'kfold':
		from sklearn.model_selection import KFold

		return KFold(
			p['n_splits'], shuffle=p['shuffle'], random_state=p['seed'] if p['shuffle'] else None
		)
	if kind == 'timeseries':
		from sklearn.model_selection import TimeSeriesSplit

		return TimeSeriesSplit(p['n_splits'], gap=p['gap'])
	import numpy as np
	from purged_cv import PurgedKFold

	# Each row's label resolves `horizon` rows later (e.g. a 5-day forward return).
	ends = np.arange(p['n_samples']) + p['horizon']
	return PurgedKFold(p['n_splits'], label_end_times=ends, embargo_pct=p['embargo_pct'])


def run_cv(p: dict[str, Any]) -> dict[str, Any]:
	return cv_folds(build_splitter(p), p['n_samples'])


def load_columns(path: str, columns: list[str]) -> dict[str, list[Any]]:
	parquet = path.lower().endswith(('.parquet', '.pq'))
	try:
		import polars as pl

		frame = (
			pl.read_parquet(path, columns=columns)
			if parquet
			else pl.read_csv(path, columns=columns)
		)
		return {c: frame[c].to_list() for c in columns}
	except ImportError:
		import pandas as pd

		df = (
			pd.read_parquet(path, columns=columns)
			if parquet
			else pd.read_csv(path, usecols=columns)
		)
		return {c: df[c].tolist() for c in columns}


def run_calibration(p: dict[str, Any]) -> dict[str, Any]:
	cols = load_columns(p['path'], [p['y_true'], p['y_prob'], *p['variants']])
	# Rows with a missing label or probability can't be scored: drop them, and say how many.
	keep = [i for i in range(len(cols[p['y_true']])) if all(cols[c][i] is not None for c in cols)]

	def pick(c: str) -> list[Any]:
		return [cols[c][i] for i in keep]

	out = calibration(
		pick(p['y_true']),
		pick(p['y_prob']),
		p['n_bins'],
		{v: pick(v) for v in p['variants']},
	)
	out['dropped_rows'] = len(cols[p['y_true']]) - len(keep)
	return out
