import { useMutation } from '@tanstack/react-query';
import { Archive, ArchiveRestore } from 'lucide-react';
import { type JSX, useState } from 'react';
import { create } from 'zustand';

import type { BackupPreview } from '@shared/ipc/channels/backup';

import { call } from '../../lib/ipc';
import { toast } from '../../stores/toast-store';
import { Button } from '../../ui/Button';
import { Dialog } from '../../ui/Dialog';
import { SettingRow } from './SettingRow';

export async function exportBackup(): Promise<void> {
	const dir = await call('backup:export');
	if (dir) toast.success('Backup saved', dir);
}

const useRestore = create<{ preview: BackupPreview | null }>(() => ({ preview: null }));

/** Asks for a backup folder, then shows what restoring it would replace (from anywhere). */
export async function pickRestore(): Promise<void> {
	try {
		const preview = await call('backup:pick');
		if (preview) useRestore.setState({ preview });
	} catch (e) {
		toast.error('Not a usable backup', e instanceof Error ? e.message : undefined);
	}
}

/** Mounted once in the shell so the palette, settings and onboarding share one restore flow. */
export function RestoreHost(): JSX.Element | null {
	const preview = useRestore((s) => s.preview);
	if (!preview) return null;
	return (
		<RestoreDialog
			key={preview.path}
			preview={preview}
			onClose={() => useRestore.setState({ preview: null })}
		/>
	);
}

function RestoreDialog({
	preview,
	onClose,
}: {
	preview: BackupPreview;
	onClose: () => void;
}): JSX.Element {
	const [restarting, setRestarting] = useState(false);
	const restore = useMutation({
		mutationFn: () => call('backup:restore', preview.path),
		onSuccess: (r) => {
			if (!r.restartRequired) {
				// Settings and layouts are in; a reload shows them.
				void call('app:reloadWindow');
				return;
			}
			setRestarting(true);
		},
		onError: (e) => toast.error('Restore failed', e.message),
	});
	return (
		<Dialog
			open
			onOpenChange={(o) => !o && onClose()}
			title='Restore from backup?'
			description={`Made ${new Date(preview.createdAt).toLocaleString()} with Forge ${preview.appVersion}.`}
			footer={
				restarting ? (
					<Button variant='primary' onClick={() => void call('app:relaunch')}>
						Restart Forge now
					</Button>
				) : (
					<>
						<Button variant='ghost' onClick={onClose}>
							Cancel
						</Button>
						<Button
							variant='danger'
							loading={restore.isPending}
							onClick={() => restore.mutate()}
						>
							Replace my current setup
						</Button>
					</>
				)
			}
		>
			<div className='flex flex-col gap-2 px-4 py-3 text-13 text-fg-1' data-restore-preview>
				{restarting ? (
					<p>
						Settings and layouts are restored. {preview.folders.join(', ')} will be
						swapped in when Forge restarts (your current copy is kept aside).
					</p>
				) : (
					<>
						<p>This replaces, on this machine:</p>
						<ul className='list-disc pl-5'>
							<li>
								{preview.settings} settings (modules, rules, watchlists,
								preferences)
							</li>
							<li>
								Layouts of:{' '}
								{preview.rooms.length ? preview.rooms.join(', ') : 'no rooms'}
							</li>
							{preview.folders.map((f) => (
								<li key={f}>
									The {f} folder (applied at the next restart; the current one is
									kept aside)
								</li>
							))}
						</ul>
						<p className='text-12 text-fg-2'>
							Secrets aren&apos;t in backups: re-enter them in Settings → Secrets if
							needed.
						</p>
					</>
				)}
			</div>
		</Dialog>
	);
}

export function BackupSetting(): JSX.Element {
	const pick = useMutation({ mutationFn: pickRestore });
	const save = useMutation({
		mutationFn: exportBackup,
		onError: (e) => toast.error('Backup failed', e.message),
	});
	return (
		<SettingRow
			label='Backup'
			description='Settings, layouts and the trade journal to a folder you choose (no secrets). Restore on a new install or another machine.'
			htmlFor='backup-export'
		>
			<div className='flex gap-2'>
				<Button
					id='backup-export'
					size='sm'
					icon={<Archive size={12} />}
					loading={save.isPending}
					onClick={() => save.mutate()}
				>
					Export…
				</Button>
				<Button
					size='sm'
					variant='ghost'
					icon={<ArchiveRestore size={12} />}
					loading={pick.isPending}
					onClick={() => pick.mutate()}
				>
					Restore…
				</Button>
			</div>
		</SettingRow>
	);
}
