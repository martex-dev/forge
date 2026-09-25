import { type JSX, useState } from 'react';
import { create } from 'zustand';

import { call } from '../../lib/ipc';
import { toast } from '../../stores/toast-store';
import { Button } from '../../ui/Button';
import { Dialog } from '../../ui/Dialog';
import { Kbd } from '../../ui/Kbd';

export const useQuickNote = create<{ open: boolean; setOpen: (open: boolean) => void }>((set) => ({
	open: false,
	setOpen: (open) => set({ open }),
}));

/** Hub: Quick Note — a line (or a few) appended to today's daily note, from any room. */
export function QuickNoteDialog(): JSX.Element {
	const open = useQuickNote((s) => s.open);
	const setOpen = useQuickNote((s) => s.setOpen);
	const [text, setText] = useState('');
	const [saving, setSaving] = useState(false);

	const save = async (): Promise<void> => {
		if (!text.trim() || saving) return;
		setSaving(true);
		try {
			const path = await call('vault:quickNote', text);
			setText('');
			setOpen(false);
			toast.success('Added to daily note', path);
		} catch (error) {
			// Keep the text so nothing typed is lost.
			toast.error(
				'Could not save quick note',
				error instanceof Error ? error.message : String(error),
			);
		} finally {
			setSaving(false);
		}
	};

	return (
		<Dialog
			open={open}
			onOpenChange={setOpen}
			title='Quick note'
			description="Appended to today's daily note with the time."
			footer={
				<>
					<Button variant='ghost' onClick={() => setOpen(false)}>
						Cancel
					</Button>
					<Button
						variant='primary'
						loading={saving}
						disabled={!text.trim()}
						onClick={() => void save()}
					>
						Add <Kbd keys='Ctrl+Enter' />
					</Button>
				</>
			}
		>
			<textarea
				autoFocus
				aria-label='Quick note text'
				value={text}
				onChange={(e) => setText(e.target.value)}
				onKeyDown={(e) => {
					if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
						e.preventDefault();
						void save();
					}
				}}
				rows={4}
				placeholder='Idea, todo, trade thought…'
				className='w-full resize-none rounded-sm border border-border bg-bg-2 px-2 py-1.5 text-13 text-fg-0 outline-none placeholder:text-fg-2 focus:border-accent focus:shadow-glow'
			/>
		</Dialog>
	);
}
