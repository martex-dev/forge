import { ArrowLeft, Save, Trash2 } from 'lucide-react';
import { type ClipboardEvent, type JSX, type KeyboardEvent, useMemo, useState } from 'react';

import type { JournalEntry } from '@shared/ipc/channels/journal';

import { cn } from '../../lib/cn';
import { toast } from '../../stores/toast-store';
import { Button } from '../../ui/Button';
import { IconButton } from '../../ui/IconButton';
import { Input } from '../../ui/Input';
import { Select } from '../../ui/Select';
import { type EntryDraft, fromDraft, NUM_FIELDS, type NumField, toDraft } from './entry-draft';
import { EntryMetrics } from './EntryMetrics';
import { newEntry } from './journal-model';
import { JournalImages } from './JournalImages';
import { NotesField } from './NotesField';
import { fileToBase64, useDeleteEntry, useImageAction, useSaveEntry } from './use-journal';

const LABELS: Record<NumField, string> = {
	entry: 'Entry',
	stop: 'Stop',
	target: 'Target',
	exit: 'Exit',
	size: 'Size',
	pnl: 'P/L (override)',
	fees: 'Fees',
};
const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp'] as const;
type ImageType = (typeof IMAGE_TYPES)[number];

function Field({
	label,
	wide = false,
	children,
}: {
	label: string;
	/** Two grid columns, for inputs like datetime that don't fit one. */
	wide?: boolean;
	children: JSX.Element;
}): JSX.Element {
	return (
		<label className={cn('flex min-w-0 flex-col gap-1', wide && 'col-span-2')}>
			<span className='text-11 text-fg-2'>{label}</span>
			{children}
		</label>
	);
}

export function EntryForm({
	id,
	existing,
	draft: prefill,
	onBack,
}: {
	id: string;
	/** Undefined for a new entry that isn't stored yet. */
	existing: JournalEntry | undefined;
	/** Prefill for a new entry. */
	draft: Partial<JournalEntry>;
	onBack: () => void;
}): JSX.Element {
	const [base, setBase] = useState(() => existing ?? newEntry(id, Date.now(), prefill));
	const [stored, setStored] = useState(existing !== undefined);
	const [draft, setDraft] = useState<EntryDraft>(() => toDraft(base));
	const [invalid, setInvalid] = useState<string | null>(null);
	const save = useSaveEntry();
	const remove = useDeleteEntry();
	const image = useImageAction();
	const set = (patch: Partial<EntryDraft>): void => setDraft((d) => ({ ...d, ...patch }));
	const setNum = (f: NumField, v: string): void =>
		setDraft((d) => ({ ...d, nums: { ...d.nums, [f]: v } }));
	// For the live metrics only; the close stamp is applied at save time.
	const live = useMemo(() => fromDraft(base, draft, 0), [base, draft]);

	const commit = async (): Promise<JournalEntry | null> => {
		const result = fromDraft(base, draft, Date.now());
		if ('error' in result) {
			setInvalid(result.field ?? null);
			toast.warn('Check the entry', result.error);
			return null;
		}
		setInvalid(null);
		const next = await save.mutateAsync(result.entry).catch(() => null);
		if (next) {
			setBase(next);
			setStored(true);
		}
		return next;
	};

	// Screenshots are stored per entry, so a new entry is saved before its first image.
	const withStored = async (run: (id: string) => void): Promise<void> => {
		const entry = stored ? base : await commit();
		if (entry) run(entry.id);
	};

	const onPaste = (e: ClipboardEvent): void => {
		const file = [...e.clipboardData.files].find((f) =>
			(IMAGE_TYPES as readonly string[]).includes(f.type),
		);
		if (!file) return;
		e.preventDefault();
		void withStored((entryId) => {
			void fileToBase64(file).then((base64) =>
				image.mutate(
					{ kind: 'paste', entryId, mime: file.type as ImageType, base64 },
					{ onSuccess: setBase },
				),
			);
		});
	};

	const onKeyDown = (e: KeyboardEvent): void => {
		// Ctrl+S is the editor's global save, so the journal uses Ctrl+Enter (as the commit box does).
		if (e.key === 'Enter' && e.ctrlKey) {
			e.preventDefault();
			void commit();
		}
	};

	return (
		<form
			className='flex min-h-0 flex-1 flex-col'
			onSubmit={(e) => {
				e.preventDefault();
				void commit();
			}}
			onPaste={onPaste}
			onKeyDown={onKeyDown}
			data-journal-form
		>
			<header className='flex items-center gap-2 border-b border-border px-2 py-1'>
				<IconButton
					label='Back to entries'
					size='sm'
					icon={<ArrowLeft size={12} />}
					onClick={onBack}
				/>
				<span className='num flex-1 truncate text-13 font-medium text-fg-0'>
					{draft.symbol.toUpperCase() || 'New entry'}
				</span>
				{stored && (
					<IconButton
						label='Delete entry'
						size='sm'
						icon={<Trash2 size={11} />}
						onClick={() => remove.mutate(base.id, { onSuccess: onBack })}
					/>
				)}
				<Button
					type='submit'
					size='sm'
					variant='primary'
					title='Save (Ctrl+Enter)'
					icon={<Save size={12} />}
					loading={save.isPending}
				>
					Save
				</Button>
			</header>
			<div className='flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-3'>
				<div className='grid grid-cols-[repeat(auto-fill,minmax(8.5rem,1fr))] gap-2'>
					<Field label='Symbol'>
						<Input
							value={draft.symbol}
							invalid={invalid === 'symbol'}
							onChange={(e) => set({ symbol: e.target.value })}
							placeholder='EURUSD'
							autoFocus={!existing}
							aria-label='Symbol'
						/>
					</Field>
					<Field label='Market'>
						<Select
							aria-label='Market'
							value={draft.market}
							onValueChange={(v) => set({ market: v as EntryDraft['market'] })}
							options={['crypto', 'forex', 'stocks', 'futures', 'other'].map((m) => ({
								value: m,
								label: m,
							}))}
						/>
					</Field>
					<Field label='Side'>
						<Select
							aria-label='Side'
							value={draft.side}
							onValueChange={(v) => set({ side: v as EntryDraft['side'] })}
							options={[
								{ value: 'long', label: 'Long' },
								{ value: 'short', label: 'Short' },
							]}
						/>
					</Field>
					<Field label='Status'>
						<Select
							aria-label='Status'
							value={draft.status}
							onValueChange={(v) => set({ status: v as EntryDraft['status'] })}
							options={[
								{ value: 'idea', label: 'Idea (not taken)' },
								{ value: 'open', label: 'Open' },
								{ value: 'closed', label: 'Closed' },
							]}
						/>
					</Field>
					{NUM_FIELDS.map((f) => (
						<Field key={f} label={LABELS[f]}>
							<Input
								className='num'
								inputMode='decimal'
								value={draft.nums[f]}
								invalid={invalid === f}
								onChange={(e) => setNum(f, e.target.value)}
								aria-label={LABELS[f]}
							/>
						</Field>
					))}
					<Field label='Opened' wide>
						<Input
							type='datetime-local'
							value={draft.openedAt}
							onChange={(e) => set({ openedAt: e.target.value })}
							aria-label='Opened'
						/>
					</Field>
					{draft.status === 'closed' && (
						<Field label='Closed' wide>
							<Input
								type='datetime-local'
								value={draft.closedAt}
								onChange={(e) => set({ closedAt: e.target.value })}
								aria-label='Closed'
							/>
						</Field>
					)}
					<Field label='Setup'>
						<Input
							value={draft.setup}
							onChange={(e) => set({ setup: e.target.value })}
							placeholder='breakout'
							aria-label='Setup'
						/>
					</Field>
					<Field label='Tags'>
						<Input
							value={draft.tags}
							onChange={(e) => set({ tags: e.target.value })}
							placeholder='london, a+'
							aria-label='Tags'
						/>
					</Field>
				</div>
				{'entry' in live && <EntryMetrics entry={live.entry} />}
				<NotesField value={draft.notes} onChange={(notes) => set({ notes })} />
				<JournalImages
					entryId={base.id}
					images={base.images}
					busy={image.isPending}
					onAdd={() =>
						void withStored((entryId) =>
							image.mutate({ kind: 'pick', entryId }, { onSuccess: setBase }),
						)
					}
					onRemove={(file) =>
						image.mutate(
							{ kind: 'remove', entryId: base.id, file },
							{ onSuccess: setBase },
						)
					}
				/>
			</div>
		</form>
	);
}
