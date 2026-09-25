import { useQuery } from '@tanstack/react-query';
import { FilePlus2, FolderOpen, NotebookText } from 'lucide-react';
import { type JSX, useCallback, useEffect, useReducer, useRef, useState } from 'react';

import type { KernelChoice, NbCell } from '@shared/ipc/channels/notebooks';

import { call } from '../../lib/ipc';
import { toast } from '../../stores/toast-store';
import { Button } from '../../ui/Button';
import { EmptyState } from '../../ui/EmptyState';
import { ErrorState } from '../../ui/ErrorState';
import { Spinner } from '../../ui/Spinner';
import type { PanelProps } from '../types';
import { KernelBar } from './KernelBar';
import { type CellHandlers, NbCellView } from './NbCellView';
import { INITIAL, newCell, reducer } from './notebook-model';
import { type KernelSession, useKernel } from './use-kernel';

const AUTOSAVE_MS = 1500;
const basename = (p: string): string => p.split(/[\\/]/).pop() ?? p;

function OpenPrompt({ onOpen }: { onOpen: (path: string) => void }): JSX.Element {
	const recent = useQuery({ queryKey: ['nb', 'recent'], queryFn: () => call('nb:recent') });
	return (
		<EmptyState
			icon={<NotebookText size={22} />}
			title='Open a notebook'
			description='Run .ipynb notebooks with kernels from your own environments.'
			action={
				<div className='flex flex-col items-center gap-2'>
					<div className='flex gap-2'>
						<Button
							size='sm'
							variant='primary'
							icon={<FolderOpen size={12} />}
							onClick={() => void call('nb:pick').then((p) => p && onOpen(p))}
						>
							Open…
						</Button>
						<Button
							size='sm'
							icon={<FilePlus2 size={12} />}
							onClick={() => void call('nb:create').then((p) => p && onOpen(p))}
						>
							New…
						</Button>
					</div>
					{recent.data && recent.data.length > 0 && (
						<ul
							className='flex flex-col items-center gap-0.5'
							aria-label='Recent notebooks'
						>
							{recent.data.map((p) => (
								<li key={p}>
									<button
										type='button'
										title={p}
										className='num text-12 text-fg-1 hover:text-accent focus-visible:shadow-glow focus-visible:outline-none'
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

function Notebook({
	path,
	params,
	setParams,
}: { path: string } & Pick<PanelProps, 'params' | 'setParams'>): JSX.Element {
	const [state, dispatch] = useReducer(reducer, INITIAL);
	const [error, setError] = useState<string | null>(null);
	const [active, setActive] = useState<string | null>(null);
	const initialSession = (params['session'] as KernelSession | undefined) ?? null;
	const onSession = useCallback(
		(s: KernelSession | null) => setParams({ session: s ?? undefined }),
		[setParams],
	);
	const kernel = useKernel(path, initialSession, onSession, dispatch);

	useEffect(() => {
		let cancelled = false;
		call('nb:read', path)
			.then((nb) => !cancelled && dispatch({ type: 'load', nb }))
			.catch(
				(e: unknown) => !cancelled && setError(e instanceof Error ? e.message : String(e)),
			);
		return () => {
			cancelled = true;
		};
	}, [path]);

	// Autosave: every change is written ~1.5 s after the last one (outputs included).
	const latest = useRef(state);
	useEffect(() => {
		latest.current = state;
	}, [state]);
	const [saving, setSaving] = useState(false);
	const [saveFailed, setSaveFailed] = useState(false);
	useEffect(() => {
		if (!state.nb || state.version === state.saved) return;
		const timer = setTimeout(() => {
			const { nb, version } = latest.current;
			if (!nb) return;
			setSaving(true);
			call('nb:write', { path, notebook: nb })
				.then(() => {
					dispatch({ type: 'saved', version });
					setSaveFailed(false);
				})
				.catch((e: unknown) => {
					setSaveFailed(true);
					toast.error('Notebook not saved', e instanceof Error ? e.message : String(e));
				})
				.finally(() => setSaving(false));
		}, AUTOSAVE_MS);
		return () => clearTimeout(timer);
	}, [path, state.nb, state.version, state.saved]);
	const saveState = saving
		? 'Saving…'
		: saveFailed
			? 'Not saved'
			: state.version !== state.saved
				? 'Edited'
				: 'Saved';

	const pickKernel = (choice: KernelChoice): void => {
		void kernel.start(choice).then((ok) => {
			if (!ok) return;
			// Remembered in the notebook, as Jupyter does, so it starts by itself next time.
			dispatch({
				type: 'metadata',
				patch:
					'spec' in choice
						? {
								kernelspec: {
									name: choice.spec,
									display_name: choice.spec,
									language: 'python',
								},
							}
						: { forge: { python: choice.python } },
			});
		});
	};

	// Auto-start the kernel the notebook names, once, if there's no live session.
	const autoStarted = useRef(false);
	useEffect(() => {
		if (autoStarted.current || !state.nb || kernel.status !== 'none') return;
		autoStarted.current = true;
		const meta = state.nb.metadata as {
			forge?: { python?: string };
			kernelspec?: { name?: string };
		};
		if (meta.forge?.python) void kernel.start({ python: meta.forge.python });
		else if (meta.kernelspec?.name) void kernel.start({ spec: meta.kernelspec.name });
	}, [state.nb, kernel]);

	if (error)
		return (
			<ErrorState
				title={`Couldn’t open ${basename(path)}`}
				message={error}
				className='h-full bg-bg-1'
			/>
		);
	const nb = state.nb;
	if (!nb) {
		return (
			<div className='flex h-full items-center justify-center bg-bg-1'>
				<Spinner label='Opening notebook' />
			</div>
		);
	}

	const handlersFor = (cell: NbCell, index: number): CellHandlers => ({
		onEdit: (source) => dispatch({ type: 'edit', id: cell.id, source }),
		onFocus: () => setActive(cell.id),
		onMove: (by) => dispatch({ type: 'move', id: cell.id, by }),
		onRemove: () => dispatch({ type: 'remove', id: cell.id }),
		onType: (cellType) => dispatch({ type: 'setType', id: cell.id, cellType }),
		onRun: (advance) => {
			if (cell.cell_type === 'code') void kernel.run(cell.id, cell.source);
			if (advance === 'stay') return;
			const next = nb.cells[index + 1];
			if (advance === 'insert' || !next) {
				const created = newCell();
				dispatch({ type: 'insert', index: index + 1, cell: created });
				setActive(created.id);
			} else setActive(next.id);
			requestAnimationFrame(() =>
				document
					.querySelector<HTMLElement>(
						`[data-nb-path="${CSS.escape(path)}"] [data-nb-cell="${index + 1}"] textarea, [data-nb-path="${CSS.escape(path)}"] [data-nb-cell="${index + 1}"] [role="button"]`,
					)
					?.focus(),
			);
		},
	});

	return (
		<div className='flex h-full flex-col bg-bg-1' data-nb-path={path}>
			<KernelBar
				kernel={kernel}
				saveState={saveState}
				onPick={pickKernel}
				onRunAll={() =>
					void kernel.runMany(
						nb.cells
							.filter((c) => c.cell_type === 'code')
							.map((c) => ({ id: c.id, code: c.source })),
					)
				}
				onClear={() => dispatch({ type: 'clearOutputs' })}
				onAdd={() => dispatch({ type: 'insert', index: nb.cells.length, cell: newCell() })}
			/>
			<div
				className='flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto py-2'
				role='list'
				aria-label='Cells'
			>
				{nb.cells.map((cell, i) => (
					<div role='listitem' key={cell.id}>
						<NbCellView
							cell={cell}
							index={i}
							active={active === cell.id}
							run={state.running[cell.id]}
							handlers={handlersFor(cell, i)}
						/>
					</div>
				))}
			</div>
		</div>
	);
}

export function NotebookPanel({ params, setParams, setTitle }: PanelProps): JSX.Element {
	const path = typeof params['path'] === 'string' ? params['path'] : null;
	useEffect(() => {
		if (path) setTitle(basename(path));
	}, [path, setTitle]);
	if (!path) return <OpenPrompt onOpen={(p) => setParams({ path: p, session: undefined })} />;
	return <Notebook key={path} path={path} params={params} setParams={setParams} />;
}
