import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { type JSX, useEffect, useState } from 'react';

import type { CvParams, MlEngine } from '@shared/ipc/channels/mltools';

import { SIDECAR_META } from '../../app/hooks/use-sidecar-recovery';
import { call } from '../../lib/ipc';
import { ErrorState } from '../../ui/ErrorState';
import { Input } from '../../ui/Input';
import { CvFoldsView } from '../../ui/ml/CvFoldsView';
import { Select } from '../../ui/Select';
import { Spinner } from '../../ui/Spinner';
import { Switch } from '../../ui/Switch';

export const DEFAULT_CV: CvParams = {
	splitter: 'purged',
	n_samples: 200,
	n_splits: 5,
	shuffle: false,
	seed: 0,
	gap: 0,
	horizon: 10,
	embargo_pct: 0.02,
};

function NumberField({
	label,
	value,
	min,
	max,
	step = 1,
	onChange,
}: {
	label: string;
	value: number;
	min: number;
	max: number;
	step?: number;
	onChange: (v: number) => void;
}): JSX.Element {
	return (
		<label className='flex flex-col gap-1'>
			<span className='text-11 text-fg-2'>{label}</span>
			<Input
				type='number'
				className='num w-28'
				value={value}
				min={min}
				max={max}
				step={step}
				aria-label={label}
				onChange={(e) => {
					const n = Number(e.target.value);
					if (Number.isFinite(n)) onChange(Math.min(max, Math.max(min, n)));
				}}
			/>
		</label>
	);
}

/** Change a setting, see the folds: debounced so typing doesn't queue a run per keystroke. */
export function CvPlayground({
	params,
	engine,
	onChange,
}: {
	params: CvParams;
	engine: MlEngine;
	onChange: (p: CvParams) => void;
}): JSX.Element {
	const [debounced, setDebounced] = useState(params);
	useEffect(() => {
		const t = setTimeout(() => setDebounced(params), 300);
		return () => clearTimeout(t);
	}, [params]);
	const folds = useQuery({
		queryKey: ['ml', 'cv', debounced, engine],
		queryFn: () => call('ml:cv', { params: debounced, engine }),
		meta: SIDECAR_META,
		placeholderData: keepPreviousData,
		retry: false,
	});
	const set = (patch: Partial<CvParams>): void => onChange({ ...params, ...patch });

	return (
		<div className='flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-3' data-ml-cv>
			<div className='flex flex-wrap items-end gap-3'>
				<label className='flex flex-col gap-1'>
					<span className='text-11 text-fg-2'>Splitter</span>
					<Select
						aria-label='Splitter'
						className='min-w-44'
						value={params.splitter}
						onValueChange={(v) => set({ splitter: v as CvParams['splitter'] })}
						options={[
							{ value: 'purged', label: 'PurgedKFold (purged-cv)' },
							{ value: 'kfold', label: 'KFold (sklearn)' },
							{ value: 'timeseries', label: 'TimeSeriesSplit (sklearn)' },
						]}
					/>
				</label>
				<NumberField
					label='Samples'
					value={params.n_samples}
					min={10}
					max={100_000}
					onChange={(n_samples) => set({ n_samples })}
				/>
				<NumberField
					label='Splits'
					value={params.n_splits}
					min={2}
					max={20}
					onChange={(n_splits) => set({ n_splits })}
				/>
				{params.splitter === 'purged' && (
					<>
						<NumberField
							label='Label horizon (rows)'
							value={params.horizon}
							min={0}
							max={10_000}
							onChange={(horizon) => set({ horizon })}
						/>
						<NumberField
							label='Embargo %'
							value={Math.round(params.embargo_pct * 1000) / 10}
							min={0}
							max={49}
							step={0.5}
							onChange={(v) => set({ embargo_pct: v / 100 })}
						/>
					</>
				)}
				{params.splitter === 'timeseries' && (
					<NumberField
						label='Gap (rows)'
						value={params.gap}
						min={0}
						max={10_000}
						onChange={(gap) => set({ gap })}
					/>
				)}
				{params.splitter === 'kfold' && (
					<label className='flex items-center gap-2 pb-1 text-12 text-fg-1'>
						<Switch
							checked={params.shuffle}
							onCheckedChange={(shuffle) => set({ shuffle })}
							aria-label='Shuffle'
						/>
						Shuffle
					</label>
				)}
				{folds.isFetching && <Spinner size={12} label='Splitting' />}
			</div>
			{folds.isError ? (
				<ErrorState title='Split failed' message={folds.error.message} />
			) : folds.data ? (
				<CvFoldsView name='playground' data={folds.data} />
			) : (
				<Spinner label='Splitting' />
			)}
		</div>
	);
}
