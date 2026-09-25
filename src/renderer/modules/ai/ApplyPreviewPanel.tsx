import { Check, GitCompare, X } from 'lucide-react';
import type * as Monaco from 'monaco-editor';
import { type JSX, useEffect, useMemo, useRef, useState } from 'react';

import { commandContext } from '../../app/commands/use-commands';
import { getLoadedMonaco } from '../../lib/monaco/load';
import { toWorkspacePath } from '../../lib/monaco/workspace-root';
import { toast } from '../../stores/toast-store';
import { Button } from '../../ui/Button';
import { EmptyState } from '../../ui/EmptyState';
import { type Proposal, useApply } from './apply-store';
import { applyBlock } from './fences';

function findModel(path: string): Monaco.editor.ITextModel | null {
	const monaco = getLoadedMonaco();
	return monaco?.editor.getModels().find((m) => toWorkspacePath(m.uri) === path) ?? null;
}

function Preview({ proposal }: { proposal: Proposal }): JSX.Element {
	const [mode, setMode] = useState<'selection' | 'file'>(
		proposal.selection ? 'selection' : 'file',
	);
	const hostRef = useRef<HTMLDivElement>(null);
	const target = findModel(proposal.path);
	const original = target?.getValue() ?? '';
	const proposed = useMemo(
		() =>
			applyBlock(original, proposal.block, mode === 'selection' ? proposal.selection : null),
		[original, proposal, mode],
	);

	useEffect(() => {
		const monaco = getLoadedMonaco();
		if (!monaco || !hostRef.current) return;
		const diff = monaco.editor.createDiffEditor(hostRef.current, {
			automaticLayout: true,
			readOnly: true,
			originalEditable: false,
			renderSideBySide: true,
			minimap: { enabled: false },
		});
		const left = monaco.editor.createModel(original, proposal.language);
		const right = monaco.editor.createModel(proposed, proposal.language);
		diff.setModel({ original: left, modified: right });
		return () => {
			diff.dispose();
			left.dispose();
			right.dispose();
		};
	}, [original, proposed, proposal.language]);

	const accept = (): void => {
		const model = findModel(proposal.path);
		if (!model) {
			toast.error('File is no longer open', proposal.path);
			return;
		}
		// One undoable edit; the editor marks the file unsaved and Ctrl+S writes it.
		model.pushEditOperations(
			[],
			[{ range: model.getFullModelRange(), text: proposed }],
			() => null,
		);
		toast.success(
			'Applied — review and save',
			`${proposal.path} (Ctrl+S to save, Ctrl+Z to undo)`,
		);
		useApply.getState().set(null);
		commandContext.openPanel('editor.main');
	};

	if (!target) {
		return (
			<EmptyState
				title='Open the file first'
				description={`${proposal.path} isn't open in the editor anymore.`}
			/>
		);
	}
	return (
		<div className='flex h-full flex-col bg-bg-1' data-apply-preview={proposal.path}>
			<header className='flex flex-wrap items-center gap-2 border-b border-border px-3 py-1.5'>
				<GitCompare size={14} className='text-accent' />
				<span className='min-w-0 flex-1 truncate text-13 text-fg-0'>
					Proposed change to <code>{proposal.path}</code>
				</span>
				{proposal.selection && (
					<div
						role='group'
						aria-label='Apply to'
						className='flex overflow-hidden rounded-sm border border-border text-11'
					>
						{(['selection', 'file'] as const).map((m) => (
							<button
								key={m}
								type='button'
								aria-pressed={mode === m}
								onClick={() => setMode(m)}
								className={
									mode === m
										? 'bg-accent-soft px-2 py-0.5 text-fg-0'
										: 'px-2 py-0.5 text-fg-2 hover:text-fg-1'
								}
							>
								{m === 'selection'
									? `Replace lines ${proposal.selection?.startLine}-${proposal.selection?.endLine}`
									: 'Replace whole file'}
							</button>
						))}
					</div>
				)}
				<Button
					size='sm'
					variant='ghost'
					icon={<X size={12} />}
					onClick={() => useApply.getState().set(null)}
				>
					Discard
				</Button>
				<Button size='sm' variant='primary' icon={<Check size={12} />} onClick={accept}>
					Accept
				</Button>
			</header>
			<div ref={hostRef} className='min-h-0 flex-1' />
		</div>
	);
}

export function ApplyPreviewPanel(): JSX.Element {
	const proposal = useApply((s) => s.proposal);
	if (!proposal) {
		return (
			<EmptyState
				icon={<GitCompare size={20} />}
				title='Nothing to apply'
				description='Use "Apply…" on a code block in the AI chat to preview it here.'
			/>
		);
	}
	// Remount per proposal so the mode and diff reset.
	return (
		<Preview
			key={`${proposal.path}:${proposal.block.length}:${proposal.block.slice(0, 40)}`}
			proposal={proposal}
		/>
	);
}
