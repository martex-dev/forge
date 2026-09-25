import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FileCode2, GitCompare, KeyRound, Send, Square, TextSelect, Trash2, X } from 'lucide-react';
import { type JSX, useEffect, useRef, useState } from 'react';
import { create } from 'zustand';

import type { AiProvider, AiSettings } from '@shared/ipc/channels/ai';

import { commandContext } from '../../app/commands/use-commands';
import { call } from '../../lib/ipc';
import { useForgeEvent } from '../../lib/use-forge-event';
import { toast } from '../../stores/toast-store';
import { Button } from '../../ui/Button';
import { IconButton } from '../../ui/IconButton';
import { Input } from '../../ui/Input';
import { Select } from '../../ui/Select';
import { useChat } from './chat-store';
import { activeEditor, fileContext, selectionContext } from './editor-context';
import { MessageView } from './MessageView';

const PROVIDERS: Array<{ value: AiProvider; label: string }> = [
	{ value: 'anthropic', label: 'Claude' },
	{ value: 'openai', label: 'OpenAI' },
	{ value: 'gemini', label: 'Gemini' },
];
const SUGGESTED: Record<AiProvider, string[]> = {
	anthropic: [
		'claude-opus-5-5',
		'claude-sonnet-5',
		'claude-haiku-4-5-20251001',
		'claude-fable-5-1',
	],
	openai: ['gpt-5', 'gpt-5-mini'],
	gemini: ['gemini-2.5-pro', 'gemini-2.5-flash'],
};

/** Bumped by "Ask AI" commands so the input takes focus even when the panel was already open. */
export const useChatFocus = create<{ tick: number; focus: () => void }>((set) => ({
	tick: 0,
	focus: () => set((s) => ({ tick: s.tick + 1 })),
}));

export function attachCurrent(kind: 'file' | 'selection'): boolean {
	const editor = activeEditor();
	if (!editor) {
		toast.warn('No file open', 'Open a file in the editor to attach it.');
		return false;
	}
	const item = kind === 'file' ? fileContext(editor) : selectionContext(editor);
	if (!item) {
		toast.warn('Nothing selected', 'Select some code in the editor first.');
		return false;
	}
	useChat.getState().attach(item);
	return true;
}

async function attachDiff(): Promise<void> {
	try {
		const { diff, truncated } = await call('ai:gitDiff');
		if (!diff.trim()) {
			toast.info('No changes', 'The working tree matches HEAD.');
			return;
		}
		useChat.getState().attach({
			kind: 'diff',
			label: truncated ? 'git diff (truncated)' : 'git diff',
			language: 'diff',
			text: diff,
		});
	} catch (error) {
		toast.error(
			'Could not read git diff',
			error instanceof Error ? error.message : String(error),
		);
	}
}

export function ChatPanel(): JSX.Element {
	const client = useQueryClient();
	const settings = useQuery({
		queryKey: ['ai', 'settings'],
		queryFn: () => call('ai:settings'),
	}).data;
	const keys = useQuery({ queryKey: ['ai', 'keys'], queryFn: () => call('ai:keys') }).data;
	useForgeEvent(
		'secrets:changed',
		() => void client.invalidateQueries({ queryKey: ['ai', 'keys'] }),
	);
	const save = useMutation({
		mutationFn: (next: AiSettings) => call('ai:setSettings', next),
		onSuccess: (next) => client.setQueryData(['ai', 'settings'], next),
	});
	const { messages, activeRequest, attached, detach, send, stop, clear } = useChat();
	const [text, setText] = useState('');
	const listRef = useRef<HTMLDivElement>(null);
	const inputRef = useRef<HTMLTextAreaElement>(null);
	const focusTick = useChatFocus((s) => s.tick);

	useEffect(() => {
		if (focusTick > 0) inputRef.current?.focus();
	}, [focusTick]);
	useEffect(() => {
		const el = listRef.current;
		if (el) el.scrollTop = el.scrollHeight;
	}, [messages]);

	if (!settings) return <div className='h-full bg-bg-1' />;
	const provider = settings.provider;
	const model = settings.models[provider];
	const hasKey = keys?.[provider] ?? false;
	const submit = (): void => {
		if (!text.trim() || !hasKey) return;
		send(text, provider, model);
		setText('');
	};

	return (
		<div className='flex h-full flex-col bg-bg-1' data-ai-chat>
			<header className='flex items-center gap-1 border-b border-border px-2 py-1'>
				<Select
					aria-label='AI provider'
					className='h-6 w-24'
					value={provider}
					options={PROVIDERS}
					onValueChange={(v) => save.mutate({ ...settings, provider: v as AiProvider })}
				/>
				<Input
					aria-label='Model'
					list={`ai-models-${provider}`}
					defaultValue={model}
					key={`${provider}:${model}`}
					onBlur={(e) => {
						const value = e.target.value.trim();
						if (value && value !== model)
							save.mutate({
								...settings,
								models: { ...settings.models, [provider]: value },
							});
					}}
					onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
					className='h-6 min-w-0 flex-1 font-mono text-11'
					spellCheck={false}
				/>
				<datalist id={`ai-models-${provider}`}>
					{SUGGESTED[provider].map((m) => (
						<option key={m} value={m} />
					))}
				</datalist>
				<IconButton
					label='New conversation'
					size='sm'
					icon={<Trash2 size={12} />}
					onClick={clear}
				/>
			</header>
			{!hasKey && (
				<div className='flex items-center gap-2 border-b border-warn/40 bg-warn-soft px-3 py-1.5 text-12 text-warn'>
					<KeyRound size={12} />
					<span className='flex-1'>
						No {PROVIDERS.find((p) => p.value === provider)?.label} API key yet.
					</span>
					<Button size='sm' onClick={() => commandContext.openSettings('secrets')}>
						Add in Secrets
					</Button>
				</div>
			)}
			<div
				ref={listRef}
				className='flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-3'
				aria-label='Conversation'
			>
				{messages.length === 0 ? (
					<p className='m-auto max-w-64 text-center text-12 text-fg-2'>
						Ask about your code. Attach the open file, the selection or the git diff;
						code in replies can be applied through a diff preview.
					</p>
				) : (
					messages.map((m) => <MessageView key={m.id} message={m} />)
				)}
			</div>
			<div className='border-t border-border p-2'>
				<div className='mb-1 flex flex-wrap items-center gap-1'>
					<Button
						size='sm'
						variant='ghost'
						icon={<FileCode2 size={11} />}
						onClick={() => attachCurrent('file')}
					>
						File
					</Button>
					<Button
						size='sm'
						variant='ghost'
						icon={<TextSelect size={11} />}
						onClick={() => attachCurrent('selection')}
					>
						Selection
					</Button>
					<Button
						size='sm'
						variant='ghost'
						icon={<GitCompare size={11} />}
						onClick={() => void attachDiff()}
					>
						Git diff
					</Button>
					{attached.map((c, i) => (
						<span
							key={`${c.kind}:${c.label}`}
							className='flex items-center gap-1 rounded-full bg-accent-soft px-1.5 text-11 text-fg-1'
							data-attached={c.kind}
						>
							{c.kind}: {c.label}
							<button
								type='button'
								aria-label={`Remove ${c.label}`}
								onClick={() => detach(i)}
							>
								<X size={10} />
							</button>
						</span>
					))}
				</div>
				<div className='flex items-end gap-1'>
					<textarea
						ref={inputRef}
						aria-label='Message'
						value={text}
						onChange={(e) => setText(e.target.value)}
						onKeyDown={(e) => {
							if (e.key === 'Enter' && !e.shiftKey) {
								e.preventDefault();
								submit();
							}
						}}
						rows={3}
						placeholder={
							hasKey
								? 'Ask… (Enter to send, Shift+Enter for a new line)'
								: 'Add an API key to start'
						}
						className='min-w-0 flex-1 resize-none rounded-sm border border-border bg-bg-2 px-2 py-1 text-13 text-fg-0 outline-none placeholder:text-fg-2 focus:border-accent focus:shadow-glow'
					/>
					{activeRequest ? (
						<IconButton label='Stop' icon={<Square size={14} />} onClick={stop} />
					) : (
						<IconButton
							label='Send (Enter)'
							icon={<Send size={14} />}
							disabled={!hasKey || !text.trim()}
							onClick={submit}
						/>
					)}
				</div>
			</div>
		</div>
	);
}
