"""
Payloads for Lab's CV-fold and calibration views. Nothing here does the maths itself: folds come
from the splitter (purged-cv's split_detail() when it has one) and calibration from Marto's
`calibrate` package, so the pictures can't drift from the libraries they describe.
"""

import dataclasses
from collections.abc import Iterable, Mapping, Sequence
from typing import Any

CATEGORIES = ('train', 'test', 'purged', 'embargoed', 'unused')
UNUSED = CATEGORIES.index('unused')
MAX_FOLDS = 50


def _n_samples(X: Any) -> int:
	if isinstance(X, int):
		return X
	shape = getattr(X, 'shape', None)
	if shape is not None and len(shape) > 0:
		return int(shape[0])
	return len(X)


def _indices(values: Any) -> Iterable[int]:
	return () if values is None else (int(i) for i in values)


def _field(fold: Any, name: str) -> Any:
	value = getattr(fold, name, None)
	if value is None and isinstance(fold, Mapping):
		value = fold.get(name)
	return value


def _runs(labels: Sequence[int]) -> list[list[int]]:
	"""[category, start, end) runs: a fold of a million rows is a handful of segments."""
	segments: list[list[int]] = []
	start = 0
	for i in range(1, len(labels) + 1):
		if i == len(labels) or labels[i] != labels[start]:
			segments.append([labels[start], start, i])
			start = i
	return segments


def cv_folds(splitter: Any, X: Any, y: Any = None, groups: Any = None) -> dict[str, Any]:
	"""
	Every row of every fold in exactly one category, like cv_visualizer.fold_masks: purge and
	embargo only exist when the splitter reports them (split_detail), and rows no category claims
	are 'unused' (TimeSeriesSplit's not-yet-reached tail), never 'purged'.
	"""
	n = _n_samples(X)
	data = list(range(n)) if isinstance(X, int) else X
	detailed = callable(getattr(splitter, 'split_detail', None))
	folds_iter = (
		splitter.split_detail(data, y, groups) if detailed else splitter.split(data, y, groups)
	)
	folds: list[list[list[int]]] = []
	for fold in folds_iter:
		if len(folds) >= MAX_FOLDS:
			raise ValueError(f'forge-probe shows at most {MAX_FOLDS} folds')
		parts = (
			[_field(fold, name) for name in CATEGORIES[:4]]
			if detailed
			else [fold[0], fold[1], None, None]
		)
		labels = [UNUSED] * n
		for category, members in enumerate(parts):
			for i in _indices(members):
				if labels[i] != UNUSED:
					raise ValueError(
						f'{type(splitter).__name__} put row {i} in two categories in one fold; '
						'train/test/purged/embargoed must be disjoint'
					)
				labels[i] = category
		folds.append(_runs(labels))
	if not folds:
		raise ValueError(f'{type(splitter).__name__} produced no folds')
	return {
		'n': n,
		'splitter': repr(splitter)[:300],
		'detailed': detailed,
		'categories': list(CATEGORIES),
		'folds': folds,
	}


def _report_dict(report: Any) -> dict[str, Any]:
	out = dataclasses.asdict(report)
	return {
		'n_samples': out['n_samples'],
		'brier': out['brier_score'],
		'ece': out['ece'],
		'mce': out['mce'],
		'flag': out['flag'],
		'bins': [
			{
				k: b[k]
				for k in ('lower', 'upper', 'count', 'mean_predicted', 'observed_frequency', 'gap')
			}
			for b in out['bins']
		],
	}


def calibration(
	y_true: Any,
	y_prob: Any,
	n_bins: int = 10,
	variants: Mapping[str, Any] | None = None,
) -> dict[str, Any]:
	"""
	The model's probabilities plus optional variants (e.g. {'isotonic': p_iso}) for the same
	labels. Fit calibrators on held-out data: calibrate's docs explain why in-sample looks perfect.
	"""
	try:
		from calibrate import calibration_report
	except ImportError as error:
		raise ImportError(
			'log_calibration needs the calibrate package: '
			'pip install git+https://github.com/martex-dev/calibrate'
		) from error
	reports = {'model': _report_dict(calibration_report(y_true, y_prob, n_bins))}
	for label, probs in (variants or {}).items():
		reports[str(label)[:40]] = _report_dict(calibration_report(y_true, probs, n_bins))
	return {'n_bins': n_bins, 'reports': reports}
