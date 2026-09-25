import { type JSX, useState } from 'react';
import { create } from 'zustand';

import { call } from '../../lib/ipc';
import { Button } from '../../ui/Button';
import { Dialog } from '../../ui/Dialog';
import { Input } from '../../ui/Input';
import { openNote, useVaultUi } from './use-vault';

export const useNewNote = create<{ isOpen: boolean; open: () => void; close: () => void }>(
	(set) => ({
		isOpen: false,
		open: () => set({ isOpen: true }),
		close: () => set({ isOpen: false }),
	}),
);

const folderOf = (path: string | null): string =>
	path?.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '';

/** New note next to the open one (or at the vault root). "Folder/Name" also works. */
export function NewNoteDialog(): JSX.Element {
	const isOpen = useNewNote((s) => s.isOpen);
	const close = useNewNote((s) => s.close);
	const activePath = useVaultUi((s) => s.activePath);
	const [name, setName] = useState('');
	const [error, setError] = useState<string | null>(null);
	const [saving, setSaving] = useState(false);
	const folder = folderOf(activePath);

	const create = async (): Promise<void> => {
		const trimmed = name.trim();
		if (!trimmed || saving) return;
		setSaving(true);
		setError(null);
		const slash = trimmed.lastIndexOf('/');
		const target =
			slash === -1
				? { folder, name: trimmed }
				: { folder: trimmed.slice(0, slash), name: trimmed.slice(slash + 1) };
		try {
			const path = await call('vault:create', target);
			setName('');
			close();
			openNote(path);
		} catch (e) {
			setError(e instanceof Error ? e.message : String(e));
		} finally {
			setSaving(false);
		}
	};

	return (
		<Dialog
			open={isOpen}
			onOpenChange={(open) => !open && close()}
			title='New note'
			description={
				folder ? `In ${folder}/ (type Folder/Name to choose)` : 'At the vault root'
			}
			width='sm'
			footer={
				<>
					<Button variant='ghost' onClick={close}>
						Cancel
					</Button>
					<Button
						variant='primary'
						loading={saving}
						disabled={!name.trim()}
						onClick={() => void create()}
					>
						Create
					</Button>
				</>
			}
		>
			<Input
				autoFocus
				aria-label='Note name'
				placeholder='Untitled'
				value={name}
				invalid={error !== null}
				onChange={(e) => setName(e.target.value)}
				onKeyDown={(e) => e.key === 'Enter' && void create()}
			/>
			{error && <p className='mt-1 text-12 text-down'>{error}</p>}
		</Dialog>
	);
}
