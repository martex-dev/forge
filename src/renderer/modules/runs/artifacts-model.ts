import { type Calibration, CV_CATEGORIES, type CvFolds } from '@shared/ipc/channels/lab';

export type CvCategory = (typeof CV_CATEGORIES)[number];

/** Only categories that occur get a legend entry (no "purged" key above a KFold diagram). */
export function presentCategories(data: CvFolds): CvCategory[] {
	const seen = new Set(data.folds.flatMap((f) => f.map(([c]) => c)));
	return CV_CATEGORIES.filter((_, i) => seen.has(i));
}

/** Reliability curve points: mean predicted vs observed; empty bins left out (no data isn't 0). */
export function reliabilityPoints(
	bins: Calibration['reports'][string]['bins'],
): Array<[number, number]> {
	return bins.flatMap((b) =>
		b.count > 0 && b.mean_predicted !== null && b.observed_frequency !== null
			? [[b.mean_predicted, b.observed_frequency] as [number, number]]
			: [],
	);
}
