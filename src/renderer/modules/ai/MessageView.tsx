import { AlertTriangle, Copy, FileDiff } from 'lucide-react';
import { type JSX, useMemo } from 'react';

import { commandContext } from '../../app/commands/use-commands';
import { cn } from '../../lib/cn';
import { call } from '../../lib/ipc';
import { renderMarkdown } from '../../lib/markdown/markdown';
import { toast } from '../../stores/toast-store';
import { Button } from '../../ui/Button';
import { useApply } from './apply-store';
import type { ChatMessage } from './chat-store';
import { activeEditor } from './editor-context';
import { splitFences } from './fences';

import '../../lib/markdown/markdown.css';

function applyToEditor(block: string): void {
	const editor = activeEditor();
	if (!editor) {
		toast.warn(
			'Open a file first',
			'Apply previews the change against the file in the editor.',
		);
		return;
	}
	useApply.getState().set({
		path: editor.path,
		language: editor.language,
		block,
		selection: editor.selection
			? { startLine: editor.selection.startLine, endLine: editor.selection.endLine }
			: null,
	});
	commandContext.openPanel('ai.apply');
}

function CodeBlock({
	lang,
	code,
	closed,
}: {
	lang: string | null;
	code: string;
	closed: boolean;
}): JSX.Element {
	return (
		<div className='my-2 overflow-hidden rounded-sm border border-border' data-code-block>
			<div className='flex items-center gap-1 border-b border-border bg-bg-2 px-2 py-0.5'>
				<span className='flex-1 font-mono text-11 text-fg-2'>{lang ?? 'text'}</span>
				<Button
					size='sm'
					variant='ghost'
					icon={<Copy size={11} />}
					onClick={() =>
						void navigator.clipboard.writeText(code).then(() => toast.success('Copied'))
					}
				>
					Copy
				</Button>
				<Button
					size='sm'
					variant='ghost'
					icon={<FileDiff size={11} />}
					disabled={!closed}
					onClick={() => applyToEditor(code)}
					title='Preview this code as a change to the open file'
				>
					Apply…
				</Button>
			</div>
			<pre className='selectable overflow-x-auto bg-bg-0 p-2 font-mono text-12 text-fg-1'>
				{code}
			</pre>
		</div>
	);
}

function Prose({ text }: { text: string }): JSX.Element {
	const html = useMemo(() => renderMarkdown(text), [text]);
	return (
		<div
			className='md-preview selectable text-13'
			// Raw HTML is disabled in the renderer (lib/markdown); links open externally below.
			dangerouslySetInnerHTML={{ __html: html }}
			onClick={(e) => {
				const a = (e.target as HTMLElement).closest('a');
				if (!a) return;
				e.preventDefault();
				if (a.href.startsWith('https://')) {
					call('app:openExternal', a.href).catch(() =>
						toast.error('Could not open link'),
					);
				}
			}}
		/>
	);
}

export function MessageView({ message }: { message: ChatMessage }): JSX.Element {
	const segments = useMemo(() => splitFences(message.content), [message.content]);
	if (message.role === 'user') {
		return (
			<div
				className='ml-6 rounded-sm border border-border bg-bg-2 px-3 py-2'
				data-chat-role='user'
			>
				{message.context && message.context.length > 0 && (
					<div className='mb-1 flex flex-wrap gap-1'>
						{message.context.map((c) => (
							<span
								key={`${c.kind}:${c.label}`}
								className='rounded-full bg-bg-3 px-1.5 text-11 text-fg-2'
							>
								{c.kind}: {c.label}
							</span>
						))}
					</div>
				)}
				<p className='selectable text-13 whitespace-pre-wrap text-fg-0'>
					{message.content}
				</p>
			</div>
		);
	}
	return (
		<div
			className='mr-2'
			data-chat-role='assistant'
			data-streaming={message.streaming ? 'true' : 'false'}
		>
			{segments.map((s, i) =>
				s.kind === 'md' ? (
					<Prose key={i} text={s.text} />
				) : (
					<CodeBlock
						key={i}
						lang={s.lang}
						code={s.code}
						closed={s.closed || !message.streaming}
					/>
				),
			)}
			{message.streaming && !message.content && (
				<p className='text-12 text-fg-2'>Thinking…</p>
			)}
			{message.error && (
				<p role='alert' className='mt-1 flex items-start gap-1 text-12 text-down'>
					<AlertTriangle size={12} className='mt-0.5 shrink-0' /> {message.error}
				</p>
			)}
			{!message.streaming && !message.error && (
				<p className={cn('num mt-1 text-11 text-fg-2')}>
					{message.model}
					{message.usage?.outputTokens
						? ` · ${message.usage.inputTokens ?? '?'} in / ${message.usage.outputTokens} out`
						: ''}
				</p>
			)}
		</div>
	);
}
