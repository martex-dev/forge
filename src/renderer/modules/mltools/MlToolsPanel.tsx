import type { JSX } from 'react';

import type { CvParams, MlEngine } from '@shared/ipc/channels/mltools';

import { cn } from '../../lib/cn';
import type { PanelProps } from '../types';
import {
	type CalibrationDraft,
	CalibrationFromFile,
	DEFAULT_CALIBRATION,
} from './CalibrationFromFile';
import { CvPlayground, DEFAULT_CV } from './CvPlayground';
import { EnginePicker } from './EnginePicker';

type Tab = 'cv' | 'calibration';

/** Settings live in panel params, so the playground comes back as it was left. */
export function MlToolsPanel({ params, setParams }: PanelProps): JSX.Element {
	const tab: Tab = params['tab'] === 'calibration' ? 'calibration' : 'cv';
	const engine = (params['engine'] as MlEngine | undefined) ?? { kind: 'bundled' };
	const cv = { ...DEFAULT_CV, ...((params['cv'] as Partial<CvParams> | undefined) ?? {}) };
	const cal = {
		...DEFAULT_CALIBRATION,
		...((params['calibration'] as Partial<CalibrationDraft> | undefined) ?? {}),
	};

	return (
		<div className='flex h-full flex-col bg-bg-1' data-ml-tools>
			<header className='flex flex-wrap items-center gap-2 border-b border-border px-2 py-1'>
				<div className='flex gap-1' role='tablist' aria-label='Tool'>
					{(
						[
							['cv', 'CV folds'],
							['calibration', 'Calibration'],
						] as const
					).map(([id, label]) => (
						<button
							key={id}
							type='button'
							role='tab'
							aria-selected={tab === id}
							onClick={() => setParams({ tab: id })}
							className={cn(
								'h-6 rounded-sm px-2 text-12 focus-visible:shadow-glow focus-visible:outline-none',
								tab === id ? 'bg-bg-3 text-fg-0' : 'text-fg-2 hover:text-fg-1',
							)}
						>
							{label}
						</button>
					))}
				</div>
				<span className='ml-auto text-11 text-fg-2'>Run with</span>
				<EnginePicker engine={engine} onChange={(e) => setParams({ engine: e })} />
			</header>
			{tab === 'cv' ? (
				<CvPlayground params={cv} engine={engine} onChange={(p) => setParams({ cv: p })} />
			) : (
				<CalibrationFromFile
					draft={cal}
					engine={engine}
					onChange={(d) => setParams({ calibration: d })}
				/>
			)}
		</div>
	);
}
