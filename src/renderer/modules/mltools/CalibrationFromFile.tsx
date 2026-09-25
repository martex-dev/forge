import { useMutation, useQuery } from '@tanstack/react-query';
import { FolderOpen, Play } from 'lucide-react';
import type { JSX } from 'react';

import type { CalibrationParams, MlEngine } from '@shared/ipc/channels/mltools';

import { SIDECAR_META } from '../../app/hooks/use-sidecar-recovery';
import { cn } from '../../lib/cn';
import { call } from '../../lib/ipc';
import { Button } from '../../ui/Button';
import { EmptyState } from '../../ui/EmptyState';
import { ErrorState } from '../../ui/ErrorState';
import { CalibrationView } from '../../ui/ml/CalibrationView';
import { Select } from '../../ui/Select';

export type CalibrationDraft = Omit<CalibrationParams, 'path'> & { path: string | null };

export const DEFAULT_CALIBRATION: CalibrationDraft = {
	path: null,
	y_true: '',
	y_prob: '',
	variants: [],
	n_bins: 10,
};

/** Guess the usual column names so the common case is one click. */
export function guessColumns(columns: string[]): Pick<CalibrationParams, 'y_true' | 'y_prob'> {
	const find = (re: RegExp): string => columns.find((c) => re.test(c)) ?? '';
	return {
		y_true: find(/^(y_?true|label|target|y)$/i),
		y_prob: find(/^(y_?prob|prob|proba|score|p|pred)/i),
	};
}

export function CalibrationFromFile({
	draft,
	engine,
	onChange,
}: {
	draft: CalibrationDraft;
	engine: MlEngine;
	onChange: (d: CalibrationDraft) => void;
}): JSX.Element {
	const columns = useQuery({
		queryKey: ['ml', 'columns', draft.path],
		queryFn: () => call('ml:columns', draft.path ?? ''),
		enabled: draft.path !== null,
		meta: SIDECAR_META,
		retry: false,
	});
	const report = useMutation({
		mutationFn: () =>
			call('ml:calibration', { params: { ...draft, path: draft.path ?? '' }, engine }),
	});
	const cols = columns.data ?? [];
	const colOptions = cols.map((c) => ({ value: c, label: c }));
	const pick = (): void => {
		void call('ml:pickFile').then(async (path) => {
			if (!path) return;
			const found = await call('ml:columns', path).catch(() => []);
			onChange({ ...draft, path, variants: [], ...guessColumns(found) });
			report.reset();
		});
	};
	const ready = draft.path !== null && draft.y_true !== '' && draft.y_prob !== '';

	return (
		<div className='flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-3' data-ml-calibration>
			<div className='flex flex-wrap items-end gap-3'>
				<Button size='sm' icon={<FolderOpen size={12} />} onClick={pick}>
					{draft.path ? 'Other file…' : 'Predictions file…'}
				</Button>
				{draft.path && (
					<span
						className='num max-w-80 truncate pb-1 text-11 text-fg-2'
						title={draft.path}
					>
						{draft.path}
					</span>
				)}
			</div>
			{draft.path && (
				<div className='flex flex-wrap items-end gap-3'>
					<label className='flex flex-col gap-1'>
						<span className='text-11 text-fg-2'>Label (0/1)</span>
						<Select
							aria-label='Label column'
							className='min-w-36'
							value={draft.y_true}
							placeholder='Column…'
							onValueChange={(y_true) => onChange({ ...draft, y_true })}
							options={colOptions}
						/>
					</label>
					<label className='flex flex-col gap-1'>
						<span className='text-11 text-fg-2'>Probability</span>
						<Select
							aria-label='Probability column'
							className='min-w-36'
							value={draft.y_prob}
							placeholder='Column…'
							onValueChange={(y_prob) => onChange({ ...draft, y_prob })}
							options={colOptions}
						/>
					</label>
					<div className='flex flex-col gap-1'>
						<span className='text-11 text-fg-2'>
							Compare with (e.g. calibrated columns)
						</span>
						<div
							className='flex flex-wrap gap-1'
							role='group'
							aria-label='Variant columns'
						>
							{cols
								.filter((c) => c !== draft.y_true && c !== draft.y_prob)
								.slice(0, 12)
								.map((c) => {
									const on = draft.variants.includes(c);
									return (
										<button
											key={c}
											type='button'
											aria-pressed={on}
											disabled={!on && draft.variants.length >= 4}
											onClick={() =>
												onChange({
													...draft,
													variants: on
														? draft.variants.filter((v) => v !== c)
														: [...draft.variants, c],
												})
											}
											className={cn(
												'h-6 rounded-sm border px-2 text-11 focus-visible:shadow-glow focus-visible:outline-none disabled:opacity-40',
												on
													? 'border-accent/50 bg-accent-soft text-fg-0'
													: 'border-border text-fg-2 hover:text-fg-1',
											)}
										>
											{c}
										</button>
									);
								})}
						</div>
					</div>
					<Button
						size='sm'
						variant='primary'
						icon={<Play size={12} />}
						disabled={!ready}
						loading={report.isPending}
						onClick={() => report.mutate()}
					>
						Report
					</Button>
				</div>
			)}
			{columns.isError && (
				<ErrorState title='Can’t read the file' message={columns.error.message} />
			)}
			{report.isError && <ErrorState title='Report failed' message={report.error.message} />}
			{report.data ? (
				<>
					<CalibrationView
						name={draft.path?.split(/[\\/]/).pop() ?? 'file'}
						data={report.data}
					/>
					{report.data.dropped_rows > 0 && (
						<p className='text-11 text-warn'>
							{report.data.dropped_rows} rows skipped (missing label or probability).
						</p>
					)}
				</>
			) : (
				!draft.path && (
					<EmptyState
						title='Calibration from a file'
						description='A CSV or Parquet file with a 0/1 label column and a probability column (and, optionally, calibrated columns to compare). Uses your calibrate package.'
					/>
				)
			)}
		</div>
	);
}
