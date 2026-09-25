import { useQuery, useQueryClient } from '@tanstack/react-query';
import { FileSpreadsheet, FolderOpen, RefreshCw, Search } from 'lucide-react';
import { type JSX, useCallback, useEffect, useState } from 'react';

import type { FrameQuery } from '@shared/ipc/channels/frames';

import { cn } from '../../lib/cn';
import { call } from '../../lib/ipc';
import { Badge } from '../../ui/Badge';
import { Button } from '../../ui/Button';
import { EmptyState } from '../../ui/EmptyState';
import { ErrorState } from '../../ui/ErrorState';
import { IconButton } from '../../ui/IconButton';
import { Input } from '../../ui/Input';
import { Spinner } from '../../ui/Spinner';
import type { PanelProps } from '../types';
import { DataGrid } from './DataGrid';
import { basename } from './frame-model';
import { SqlView } from './SqlView';
import { StatsView } from './StatsView';
import { useFrameInfo } from './use-frame';

type View = 'data' | 'sql' | 'stats';

function OpenPrompt({ onOpen }: { onOpen: (path: string) => void }): JSX.Element {
	const recent = useQuery({
		queryKey: ['frames', 'recent'],
		queryFn: () => call('frames:recent'),
	});
	const pick = (): void => {
		void call('frames:pick').then((path) => path && onOpen(path));
	};
	return (
		<EmptyState
			icon={<FileSpreadsheet size={22} />}
			title='Open a data file'
			description='CSV, TSV, Parquet, JSON(L) or Feather. Queried in place with DuckDB, never loaded whole.'
			action={
				<div className='flex flex-col items-center gap-2'>
					<Button
						size='sm'
						variant='primary'
						icon={<FolderOpen size={12} />}
						onClick={pick}
					>
						Open file…
					</Button>
					{recent.data && recent.data.length > 0 && (
						<ul
							className='flex flex-col items-center gap-0.5'
							aria-label='Recent files'
						>
							{recent.data.map((p) => (
								<li key={p}>
									<button
										type='button'
										className='num text-12 text-fg-1 hover:text-accent focus-visible:shadow-glow focus-visible:outline-none'
										title={p}
										onClick={() => onOpen(p)}
									>
										{basename(p)}
									</button>
								</li>
							))}
						</ul>
					)}
				</div>
			}
		/>
	);
}

export function FramePanel({ params, setParams, setTitle }: PanelProps): JSX.Element {
	const client = useQueryClient();
	const path = typeof params['path'] === 'string' ? params['path'] : null;
	const view: View =
		params['view'] === 'sql' || params['view'] === 'stats' ? params['view'] : 'data';
	const where = typeof params['where'] === 'string' ? params['where'] : '';
	const sql = typeof params['sql'] === 'string' ? params['sql'] : '';
	const sort = Array.isArray(params['sort']) ? (params['sort'] as FrameQuery['sort']) : [];
	const [whereDraft, setWhereDraft] = useState(where);
	const [version, setVersion] = useState(0);
	const [shown, setShown] = useState<{ total: number | null; fetching: boolean }>({
		total: null,
		fetching: false,
	});
	const info = useFrameInfo(path);

	useEffect(() => {
		if (path) setTitle(basename(path));
	}, [path, setTitle]);

	const onTotal = useCallback(
		(total: number | null, fetching: boolean) => setShown({ total, fetching }),
		[],
	);
	const reload = (): void => {
		// Same path again: the sidecar rebuilds the view, picking up schema changes on disk.
		void client.invalidateQueries({ queryKey: ['frames', 'info', path] });
		setVersion((v) => v + 1);
	};

	if (!path)
		return (
			<OpenPrompt
				onOpen={(p) =>
					setParams({ path: p, where: undefined, sql: undefined, sort: undefined })
				}
			/>
		);
	if (info.isPending) {
		return (
			<div className='flex h-full items-center justify-center bg-bg-1'>
				<Spinner label='Opening file' />
			</div>
		);
	}
	if (info.isError) {
		return (
			<ErrorState
				title={`Couldn’t open ${basename(path)}`}
				message={info.error.message}
				onRetry={() => void info.refetch()}
				className='h-full bg-bg-1'
			/>
		);
	}

	const filtered = where !== '' && shown.total !== null && shown.total !== info.data.rowCount;
	return (
		<div className='flex h-full flex-col bg-bg-1' data-frame-panel={basename(path)}>
			<header className='flex flex-wrap items-center gap-2 border-b border-border px-2 py-1'>
				<div className='flex gap-1' role='tablist' aria-label='View'>
					{(['data', 'sql', 'stats'] as const).map((v) => (
						<button
							key={v}
							type='button'
							role='tab'
							aria-selected={view === v}
							onClick={() => setParams({ view: v })}
							className={cn(
								'h-6 rounded-sm px-2 text-12 focus-visible:shadow-glow focus-visible:outline-none',
								view === v ? 'bg-bg-3 text-fg-0' : 'text-fg-2 hover:text-fg-1',
							)}
						>
							{v === 'sql' ? 'SQL' : v === 'data' ? 'Data' : 'Stats'}
						</button>
					))}
				</div>
				{view === 'data' && (
					<form
						className='min-w-40 flex-1'
						onSubmit={(e) => {
							e.preventDefault();
							setParams({ where: whereDraft.trim() || undefined });
						}}
					>
						<Input
							className='h-6'
							leading={<Search size={12} />}
							value={whereDraft}
							onChange={(e) => setWhereDraft(e.target.value)}
							placeholder="WHERE …  e.g. loss < 0.1 AND split = 'val'  (Enter)"
							aria-label='Filter (SQL WHERE)'
						/>
					</form>
				)}
				<span className='num ml-auto text-11 text-fg-2' data-frame-rows>
					{shown.fetching && view !== 'stats' ? '… ' : ''}
					{filtered
						? `${(shown.total ?? 0).toLocaleString()} of ${info.data.rowCount.toLocaleString()} rows`
						: `${info.data.rowCount.toLocaleString()} rows`}{' '}
					· {info.data.columns.length} cols
				</span>
				<Badge>{info.data.format}</Badge>
				<IconButton
					label='Reload file'
					size='sm'
					icon={<RefreshCw size={12} />}
					onClick={reload}
				/>
				<IconButton
					label='Open another file…'
					size='sm'
					icon={<FolderOpen size={12} />}
					onClick={() => {
						void call('frames:pick').then(
							(p) =>
								p &&
								setParams({
									path: p,
									where: undefined,
									sql: undefined,
									sort: undefined,
								}),
						);
					}}
				/>
			</header>
			{view === 'data' && (
				<DataGrid
					key={JSON.stringify([where, sort])}
					path={path}
					query={{ sort, ...(where ? { where } : {}) }}
					version={version}
					onSortChange={(next) => setParams({ sort: next.length ? next : undefined })}
					onTotal={onTotal}
				/>
			)}
			{view === 'sql' && (
				<SqlView
					path={path}
					sql={sql}
					version={version}
					onRun={(q) => setParams({ sql: q || undefined })}
				/>
			)}
			{view === 'stats' && <StatsView path={path} version={version} />}
		</div>
	);
}
