import type { JSX } from 'react';

import { CV_CATEGORIES, type CvFolds } from '@shared/ipc/channels/lab';

import { type CvCategory, presentCategories } from './artifacts-model';

export const CV_STYLE: Record<CvCategory, { fill: string; label: string }> = {
	train: { fill: 'var(--info)', label: 'train' },
	test: { fill: 'var(--warn)', label: 'test' },
	purged: { fill: 'var(--down)', label: 'purged (label window overlaps test)' },
	embargoed: { fill: 'var(--accent-lab)', label: 'embargoed (serial-correlation margin)' },
	unused: { fill: 'var(--bg-3)', label: 'unused' },
};

export function CvFoldsView({ name, data }: { name: string; data: CvFolds }): JSX.Element {
	const n = Math.max(1, data.n);
	return (
		<section className='rounded-sm border border-border bg-bg-1 p-2' data-cv-folds={name}>
			<header className='mb-2 flex flex-wrap items-baseline gap-x-3'>
				<h3 className='text-12 font-medium text-fg-0'>CV folds · {name}</h3>
				<span className='num truncate text-11 text-fg-2' title={data.splitter}>
					{data.splitter} · {data.n.toLocaleString()} rows
				</span>
			</header>
			<div className='grid grid-cols-[3.5rem_1fr] items-center gap-x-2 gap-y-1'>
				{data.folds.map((segments, i) => (
					<div key={i} className='contents'>
						<span className='num text-11 text-fg-2'>fold {i + 1}</span>
						<svg
							viewBox={`0 0 ${n} 1`}
							preserveAspectRatio='none'
							className='h-3.5 w-full'
							role='img'
							aria-label={`Fold ${i + 1}`}
						>
							{segments.map(([c, start, end]) => {
								const cat = CV_CATEGORIES[c] ?? 'unused';
								return (
									<rect
										key={start}
										x={start}
										width={end - start}
										y={0}
										height={1}
										style={{ fill: CV_STYLE[cat].fill }}
										data-cv-category={cat}
									>
										<title>{`${cat}: rows ${start}–${end - 1}`}</title>
									</rect>
								);
							})}
						</svg>
					</div>
				))}
			</div>
			<div className='mt-2 flex flex-wrap gap-x-4 gap-y-1 text-11 text-fg-1'>
				{presentCategories(data).map((cat) => (
					<span key={cat} className='flex items-center gap-1.5'>
						<span
							className='size-2.5 rounded-[2px]'
							style={{ backgroundColor: CV_STYLE[cat].fill }}
						/>
						{CV_STYLE[cat].label}
					</span>
				))}
			</div>
			{!data.detailed && (
				<p className='mt-1 text-11 text-fg-2'>
					This splitter doesn’t report purge or embargo. Plain sklearn splitters can’t, so
					none is drawn; purged-cv’s PurgedKFold does (split_detail).
				</p>
			)}
		</section>
	);
}
