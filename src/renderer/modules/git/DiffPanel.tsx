import { useQuery, useQueryClient } from '@tanstack/react-query';
import { FileDiff, FileSymlink } from 'lucide-react';
import type * as Monaco from 'monaco-editor';
import { type JSX, useEffect, useRef, useState } from 'react';

import { useGeneralSettings } from '../../app/hooks/use-general-settings';
import { call } from '../../lib/ipc';
import { rlog } from '../../lib/log';
import { loadMonaco } from '../../lib/monaco/load';
import type { MonacoApi } from '../../lib/monaco/setup';
import { useForgeEvent } from '../../lib/use-forge-event';
import { requestOpenFile } from '../../stores/workbench-store';
import { Badge } from '../../ui/Badge';
import { Button } from '../../ui/Button';
import { EmptyState } from '../../ui/EmptyState';
import { ErrorState } from '../../ui/ErrorState';
import { Spinner } from '../../ui/Spinner';
import type { PanelProps } from '../types';

let modelSeq = 0;

export function DiffPanel({ params }: PanelProps): JSX.Element {
	const path = typeof params['path'] === 'string' ? params['path'] : null;
	const staged = params['staged'] === true;
	const from = typeof params['from'] === 'string' ? params['from'] : undefined;
	const workspacePath =
		typeof params['workspacePath'] === 'string' ? params['workspacePath'] : null;
	const client = useQueryClient();
	const { settings } = useGeneralSettings();
	const hostRef = useRef<HTMLDivElement>(null);
	const [monaco, setMonaco] = useState<MonacoApi | null>(null);
	const [monacoError, setMonacoError] = useState<string | null>(null);

	const key = ['git', 'diff', path, staged, from] as const;
	const diff = useQuery({
		queryKey: key,
		queryFn: () => call('git:diff', { path: path ?? '', staged, ...(from ? { from } : {}) }),
		enabled: path !== null,
	});
	const refresh = (): void => void client.invalidateQueries({ queryKey: key });
	useForgeEvent('git:changed', refresh);
	useForgeEvent('fs:changed', refresh);

	useEffect(() => {
		let cancelled = false;
		loadMonaco(settings.fontSize, settings.reduceMotion)
			.then((m) => !cancelled && setMonaco(m))
			.catch((e: unknown) => {
				rlog.error('git', 'diff editor failed to load', e);
				if (!cancelled) setMonacoError(e instanceof Error ? e.message : String(e));
			});
		return () => {
			cancelled = true;
		};
		// Theme/font updates flow through the shared Monaco configuration.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	const data = diff.data;
	useEffect(() => {
		const host = hostRef.current;
		if (!monaco || !host || !data || data.binary || !path) return;
		const seq = ++modelSeq;
		// Distinct URIs per side; the file extension drives language detection.
		const uri = (side: string): Monaco.Uri =>
			monaco.Uri.parse(`forge-diff:/${seq}/${side}/${path}`);
		const original = monaco.editor.createModel(data.original, undefined, uri('original'));
		const modified = monaco.editor.createModel(data.modified, undefined, uri('modified'));
		const editor = monaco.editor.createDiffEditor(host, {
			automaticLayout: true,
			readOnly: true,
			originalEditable: false,
			renderSideBySide: true,
			ignoreTrimWhitespace: false,
		});
		editor.setModel({ original, modified });
		return () => {
			editor.dispose();
			original.dispose();
			modified.dispose();
		};
	}, [monaco, data, path]);

	if (!path)
		return (
			<EmptyState
				icon={<FileDiff size={22} />}
				title='No change selected'
				description='Pick a file in Source Control.'
			/>
		);
	if (diff.error)
		return (
			<ErrorState
				title='Could not load diff'
				message={diff.error.message}
				onRetry={refresh}
			/>
		);
	if (monacoError) return <ErrorState title='Diff editor failed to load' message={monacoError} />;

	return (
		<div className='flex h-full flex-col bg-bg-1'>
			<div className='flex h-7 shrink-0 items-center gap-2 border-b border-border px-2 text-12'>
				<span className='selectable num min-w-0 flex-1 truncate text-fg-1'>{path}</span>
				<Badge tone={staged ? 'up' : 'warn'}>
					{staged ? 'HEAD ↔ staged' : 'staged ↔ working tree'}
				</Badge>
				{workspacePath && (
					<Button
						size='sm'
						variant='ghost'
						icon={<FileSymlink size={12} />}
						onClick={() => requestOpenFile({ path: workspacePath })}
					>
						Open File
					</Button>
				)}
			</div>
			<div className='relative min-h-0 flex-1'>
				{data?.binary ? (
					<EmptyState
						icon={<FileDiff size={22} />}
						title='Binary or large file'
						description='No text diff to show.'
					/>
				) : (
					<div ref={hostRef} className='absolute inset-0' data-diff-host />
				)}
				{(diff.isLoading || !monaco) && !data?.binary && (
					<div className='absolute inset-0 flex items-center justify-center bg-bg-1'>
						<Spinner label='Loading diff' />
					</div>
				)}
			</div>
		</div>
	);
}
