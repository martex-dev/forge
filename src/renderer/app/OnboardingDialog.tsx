import { useQuery } from '@tanstack/react-query';
import { ArchiveRestore, BookOpen, FolderOpen, KeyRound, Webhook } from 'lucide-react';
import { type JSX, type ReactNode, useEffect } from 'react';
import { create } from 'zustand';

import { call } from '../lib/ipc';
import { toast } from '../stores/toast-store';
import { Button } from '../ui/Button';
import { Dialog } from '../ui/Dialog';
import { Kbd } from '../ui/Kbd';
import { commandContext, runCommandById } from './commands/use-commands';
import { pickRestore } from './settings/BackupSetting';

export const useOnboarding = create<{ open: boolean; setOpen: (open: boolean) => void }>((set) => ({
	open: false,
	setOpen: (open) => set({ open }),
}));

const ROOMS: Array<[string, string, string]> = [
	['Build', 'Ctrl+1', 'Editor, terminals, Git, GitHub, Vercel, AI'],
	['Trade', 'Ctrl+2', 'Charts, calendars, alerts, journal, MT5, wallets'],
	['Lab', 'Ctrl+3', 'Runs, data files, notebooks, CV & calibration, GPU'],
	['Hub', 'Ctrl+4', 'Today, inbox, vault, Notion, Discord'],
];

const SHORTCUTS: Array<[string, string]> = [
	['Ctrl+K', 'commands'],
	['Ctrl+Shift+T', 'Today'],
	['Ctrl+Alt+N', 'quick note'],
	['Ctrl+Alt+J', 'journal entry'],
];

function Step({
	icon,
	title,
	children,
	action,
}: {
	icon: ReactNode;
	title: string;
	children: ReactNode;
	action: ReactNode;
}): JSX.Element {
	return (
		<li className='flex items-center gap-3 border-t border-border/60 py-2'>
			<span className='text-accent'>{icon}</span>
			<div className='min-w-0 flex-1'>
				<div className='text-13 text-fg-0'>{title}</div>
				<div className='text-12 text-fg-2'>{children}</div>
			</div>
			{action}
		</li>
	);
}

/** First-launch guide: where things are, and the few connections that make Forge useful. */
export function OnboardingDialog(): JSX.Element | null {
	const open = useOnboarding((s) => s.open);
	const setOpen = useOnboarding((s) => s.setOpen);
	const first = useQuery({
		queryKey: ['app', 'onboarding'],
		queryFn: () => call('app:onboarding'),
		staleTime: Infinity,
	});
	useEffect(() => {
		if (first.data?.show) setOpen(true);
	}, [first.data, setOpen]);

	const done = (): void => {
		setOpen(false);
		void call('app:onboardingDone');
	};
	// Each shortcut closes the guide first: the next step happens in the app, not over it.
	const then = (fn: () => void) => (): void => {
		done();
		fn();
	};

	return (
		<Dialog
			open={open}
			onOpenChange={(o) => (o ? setOpen(true) : done())}
			title='Welcome to Forge'
			description='Four rooms, one palette. Everything is also reachable with Ctrl+K.'
			width='lg'
			footer={
				<Button variant='primary' onClick={done}>
					Get started
				</Button>
			}
		>
			<div className='flex flex-col gap-4 px-4 py-3' data-onboarding>
				<ul className='grid grid-cols-2 gap-2'>
					{ROOMS.map(([name, keys, what]) => (
						<li
							key={name}
							className='rounded-sm border border-border bg-bg-2 px-3 py-2'
						>
							<div className='flex items-center gap-2 text-13 text-fg-0'>
								{name} <Kbd keys={keys} />
							</div>
							<div className='text-12 text-fg-2'>{what}</div>
						</li>
					))}
				</ul>
				<ul
					className='flex flex-wrap gap-x-4 gap-y-1 text-12 text-fg-1'
					aria-label='Shortcuts'
				>
					{SHORTCUTS.map(([keys, what]) => (
						<li key={keys} className='flex items-center gap-1.5'>
							<Kbd keys={keys} /> {what}
						</li>
					))}
				</ul>
				<ul aria-label='Connect'>
					<Step
						icon={<FolderOpen size={14} />}
						title='Open a project folder'
						action={
							<Button
								size='sm'
								onClick={then(
									() =>
										void call('workspace:openDialog').catch(() =>
											toast.error('Could not open the folder'),
										),
								)}
							>
								Open…
							</Button>
						}
					>
						Editor, Git, GitHub and search work on it.
					</Step>
					<Step
						icon={<KeyRound size={14} />}
						title='Add your tokens'
						action={
							<Button
								size='sm'
								onClick={then(() => commandContext.openSettings('secrets'))}
							>
								Secrets
							</Button>
						}
					>
						GitHub, Vercel, AI keys, Notion, Finnhub: stored encrypted, never shown
						again.
					</Step>
					<Step
						icon={<BookOpen size={14} />}
						title='Choose your Obsidian vault'
						action={
							<Button size='sm' onClick={then(() => runCommandById('vault.choose'))}>
								Vault…
							</Button>
						}
					>
						Notes, quick capture and the daily note in the Hub.
					</Step>
					<Step
						icon={<Webhook size={14} />}
						title='Get alerts on your phone'
						action={
							<Button
								size='sm'
								onClick={then(() => commandContext.openPanel('discord.panel'))}
							>
								Discord
							</Button>
						}
					>
						Forward chosen notifications to a Discord channel via a webhook.
					</Step>
					<Step
						icon={<ArchiveRestore size={14} />}
						title='Coming from another install?'
						action={
							<Button
								size='sm'
								variant='ghost'
								onClick={then(() => void pickRestore())}
							>
								Restore…
							</Button>
						}
					>
						Restore settings, layouts and your trade journal from a backup.
					</Step>
				</ul>
			</div>
		</Dialog>
	);
}
