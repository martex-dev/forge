"""Streams a run with CV folds and calibration to Forge for e2e (no sklearn/calibrate needed)."""

import dataclasses
import sys
import types
from collections.abc import Iterator
from typing import Any

import forge_probe


class StubPurgedSplit:
	"""Shaped like purged-cv's PurgedKFold.split_detail; the rows are fixed for the test."""

	def split_detail(
		self, x: Any, y: Any = None, groups: Any = None
	) -> Iterator[dict[str, list[int]]]:
		yield {'train': [8, 9], 'test': [0, 1, 2], 'purged': [3, 4], 'embargoed': [5]}
		yield {'train': [0, 1], 'test': [6, 7, 8], 'purged': [5, 9], 'embargoed': []}

	def __repr__(self) -> str:
		return 'PurgedKFold(n_splits=2)'


@dataclasses.dataclass(frozen=True)
class Bin:
	lower: float
	upper: float
	count: int
	mean_predicted: float | None
	observed_frequency: float | None
	gap: float | None


@dataclasses.dataclass(frozen=True)
class Report:
	n_samples: int
	brier_score: float
	ece: float
	mce: float
	mce_bin: Bin | None
	bins: tuple[Bin, ...]
	flag: str
	tolerance: float
	min_bin_count: int


def calibration_report(y_true: Any, y_prob: Any, n_bins: int) -> Report:
	low = Bin(0.0, 0.5, 2, 0.3, 0.1, 0.2)
	high = Bin(0.5, 1.0, 2, 0.8, 0.9, -0.1)
	flag = f'Stub report for {len(y_prob)} predictions.'
	return Report(len(y_prob), 0.12, 0.15, 0.2, low, (low, high), flag, 0.05, 30)


stub = types.ModuleType('calibrate')
stub.calibration_report = calibration_report  # type: ignore[attr-defined]
sys.modules['calibrate'] = stub

with forge_probe.run(sys.argv[1], project='e2e') as probe:
	probe.log(step=0, loss=1.0)
	probe.log_cv(StubPurgedSplit(), 10, name='purged')
	probe.log_calibration(
		[0, 1, 1, 0], [0.2, 0.7, 0.9, 0.4], name='val', variants={'isotonic': [0.1, 0.8, 0.9, 0.3]}
	)
