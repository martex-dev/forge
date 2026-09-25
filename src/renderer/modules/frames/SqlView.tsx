import { Play } from 'lucide-react';
import { type JSX, useState } from 'react';

import type { FrameQuery } from '@shared/ipc/channels/frames';

import { Button } from '../../ui/Button';
import { EmptyState } from '../../ui/EmptyState';
import { DataGrid } from './DataGrid';

const EXAMPLE = 'SELECT *\nFROM t\nLIMIT 100';

/** Free SQL over `t` (the file). Main and the sidecar only run a single SELECT. */
export function SqlView({
	path,
	sql,
	version,
	onRun,
}: {
	path: string;
	sql: string;
	version: number;
	onRun: (sql: string) => void;
}): JSX.Element {
	const [draft, setDraft] = useState(sql || EXAMPLE);
	const [sort, setSort] = useState<FrameQuery['sort']>([]);
	const run = (): void => {
		setSort([]);
		onRun(draft.trim());
	};
	return (
		<div className='flex min-h-0 flex-1 flex-col'>
			<div className='flex gap-2 border-b border-border p-2'>
				<textarea
					value={draft}
					onChange={(e) => setDraft(e.target.value)}
					onKeyDown={(e) => {
						if (e.key === 'Enter' && e.ctrlKey) {
							e.preventDefault();
							run();
						}
					}}
					rows={4}
					spellCheck={false}
					aria-label='SQL query'
					className='selectable num min-w-0 flex-1 resize-y rounded-sm border border-border bg-bg-2 px-2 py-1.5 text-12 text-fg-0 outline-none focus:border-accent focus:shadow-glow'
				/>
				<div className='flex flex-col gap-1'>
					<Button
						size='sm'
						variant='primary'
						icon={<Play size={12} />}
						title='Run (Ctrl+Enter)'
						onClick={run}
					>
						Run
					</Button>
					<span className='max-w-40 text-11 text-fg-2'>
						The file is <code className='num text-fg-1'>t</code>. DuckDB SQL, one
						SELECT.
					</span>
				</div>
			</div>
			{sql ? (
				<DataGrid
					key={JSON.stringify([sql, sort])}
					path={path}
					query={{ sql, sort }}
					version={version}
					onSortChange={setSort}
				/>
			) : (
				<EmptyState
					title='Run a query'
					description='Aggregate, join or reshape the file with DuckDB SQL (Ctrl+Enter).'
				/>
			)}
		</div>
	);
}
