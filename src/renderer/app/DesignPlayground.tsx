import { Bell, Plus, RefreshCw, Search, Settings, Trash2 } from 'lucide-react';
import { type CSSProperties, type JSX, type ReactNode, useState } from 'react';

import { ROOMS } from '@shared/rooms';

import { toast } from '../stores/toast-store';
import { Badge } from '../ui/Badge';
import { Button, type ButtonVariant } from '../ui/Button';
import { Dialog } from '../ui/Dialog';
import { EmptyState } from '../ui/EmptyState';
import { ErrorState } from '../ui/ErrorState';
import { IconButton } from '../ui/IconButton';
import { Input } from '../ui/Input';
import { Kbd } from '../ui/Kbd';
import { Panel } from '../ui/Panel';
import { Select } from '../ui/Select';
import { Spinner } from '../ui/Spinner';
import { Tabs } from '../ui/Tabs';
import { Tooltip } from '../ui/Tooltip';

function Section({ title, children }: { title: string; children: ReactNode }): JSX.Element {
	return (
		<section className='border-b border-border py-5'>
			<h3 className='mb-3 text-11 font-medium tracking-widest text-fg-2 uppercase'>
				{title}
			</h3>
			<div className='flex flex-wrap items-center gap-3'>{children}</div>
		</section>
	);
}

const variants: ButtonVariant[] = ['primary', 'secondary', 'ghost', 'danger'];

/** Dev-only view (palette: "Dev: Open Design Playground") showing every primitive in every state. */
export function DesignPlayground(): JSX.Element {
	const [dialogOpen, setDialogOpen] = useState(false);
	const [selectValue, setSelectValue] = useState('eurusd');

	return (
		<div className='h-full overflow-auto bg-bg-0 px-6 pb-10'>
			<header className='sticky top-0 z-10 flex h-12 items-center gap-3 border-b border-border bg-bg-0'>
				<h1 className='text-16 font-semibold'>Design Playground</h1>
				<Badge tone='accent'>tokens.css</Badge>
			</header>

			<Section title='Room accents'>
				{ROOMS.map((room) => (
					<div
						key={room.id}
						style={{ '--accent': `var(--accent-${room.id})` } as CSSProperties}
						className='flex w-56 flex-col gap-2 rounded-sm border border-border border-t-accent bg-bg-1 p-3'
					>
						<div className='flex items-center justify-between'>
							<span className='text-13 font-medium'>{room.name}</span>
							<span className='num text-12 text-accent'>+2.41%</span>
						</div>
						<Button variant='primary' size='sm'>
							Primary
						</Button>
						<Input placeholder='Focus me' />
						<Badge tone='accent'>active</Badge>
					</div>
				))}
			</Section>

			<Section title='Surfaces & text'>
				{(['bg-bg-0', 'bg-bg-1', 'bg-bg-2', 'bg-bg-3'] as const).map((bg) => (
					<div
						key={bg}
						className={`${bg} flex h-14 w-28 items-end rounded-sm border border-border p-2`}
					>
						<code className='text-11 text-fg-1'>{bg.slice(3)}</code>
					</div>
				))}
				<div className='flex flex-col'>
					<span className='text-fg-0'>text-0 primary</span>
					<span className='text-fg-1'>text-1 secondary</span>
					<span className='text-fg-2'>text-2 muted</span>
				</div>
				<div className='num flex gap-3 text-14'>
					<span className='text-up'>▲ 1.0842</span>
					<span className='text-down'>▼ 0.9731</span>
					<span className='text-warn'>warn</span>
					<span className='text-info'>info</span>
				</div>
				<span className='flash-up num rounded-sm px-2 py-1'>price flash ↑</span>
				<span className='flash-down num rounded-sm px-2 py-1'>price flash ↓</span>
			</Section>

			<Section title='Type scale'>
				{/* Literal class names so Tailwind's scanner can see them. */}
				{(
					[
						['text-11', 11],
						['text-12', 12],
						['text-13', 13],
						['text-14', 14],
						['text-16', 16],
						['text-20', 20],
					] as const
				).map(([cls, size]) => (
					<span key={size} className={cls}>
						{size}px Geist
					</span>
				))}
				<code className='text-13'>JetBrains Mono 0123456789</code>
			</Section>

			<Section title='Buttons'>
				{variants.map((v) => (
					<div key={v} className='flex items-center gap-2'>
						<Button variant={v} size='sm'>
							{v} sm
						</Button>
						<Button variant={v}>{v}</Button>
						<Button variant={v} size='lg' icon={<Plus size={14} />}>
							{v} lg
						</Button>
						<Button variant={v} loading>
							Loading
						</Button>
						<Button variant={v} disabled>
							Disabled
						</Button>
					</div>
				))}
			</Section>

			<Section title='Icon buttons & tooltips'>
				<IconButton label='Search' shortcut='Ctrl+K' icon={<Search size={14} />} />
				<IconButton label='Settings' shortcut='Ctrl+,' icon={<Settings size={14} />} />
				<IconButton label='Notifications' icon={<Bell size={14} />} active />
				<IconButton label='Delete' size='sm' icon={<Trash2 size={12} />} />
				<IconButton label='Disabled' icon={<RefreshCw size={14} />} disabled />
				<Tooltip content='Tooltip with shortcut' shortcut='Ctrl+Shift+P'>
					<span tabIndex={0} className='text-12 text-fg-1 underline decoration-dotted'>
						Hover me
					</span>
				</Tooltip>
				<Kbd keys='Ctrl+K' />
				<Kbd keys='Ctrl+Shift+P' />
			</Section>

			<Section title='Inputs'>
				<Input placeholder='Default' className='w-56' />
				<Input placeholder='With icon' leading={<Search size={12} />} className='w-56' />
				<Input defaultValue='Invalid value' invalid className='w-56' />
				<Input placeholder='Disabled' disabled className='w-56' />
				<Input type='password' defaultValue='hunter2' className='w-56' />
				<Select
					aria-label='Symbol'
					value={selectValue}
					onValueChange={setSelectValue}
					options={[
						{ value: 'eurusd', label: 'EURUSD' },
						{ value: 'xauusd', label: 'XAUUSD' },
						{ value: 'btcusd', label: 'BTCUSD' },
						{ value: 'nas100', label: 'NAS100', disabled: true },
					]}
				/>
				<Select
					aria-label='Empty'
					value=''
					onValueChange={() => undefined}
					options={[]}
					placeholder='Placeholder'
				/>
			</Section>

			<Section title='Badges & spinners'>
				{(['neutral', 'accent', 'up', 'down', 'warn', 'info'] as const).map((tone) => (
					<Badge key={tone} tone={tone}>
						{tone}
					</Badge>
				))}
				<Spinner size={12} />
				<Spinner />
				<Spinner size={24} />
			</Section>

			<Section title='Tabs'>
				<div className='h-40 w-96 rounded-sm border border-border bg-bg-1'>
					<Tabs
						aria-label='Demo tabs'
						items={[
							{
								value: 'a',
								label: 'Overview',
								content: <p className='p-3 text-fg-1'>Overview content</p>,
							},
							{
								value: 'b',
								label: 'Positions',
								content: <p className='p-3 text-fg-1'>Positions content</p>,
							},
							{ value: 'c', label: 'Disabled', content: null, disabled: true },
						]}
					/>
				</div>
				<div className='h-40 w-96 rounded-sm border border-border bg-bg-1'>
					<Tabs
						orientation='vertical'
						aria-label='Vertical tabs'
						items={[
							{
								value: 'g',
								label: 'General',
								content: <p className='p-3 text-fg-1'>General</p>,
							},
							{
								value: 's',
								label: 'Secrets',
								content: <p className='p-3 text-fg-1'>Secrets</p>,
							},
						]}
					/>
				</div>
			</Section>

			<Section title='Panels & states'>
				<div className='h-56 w-72'>
					<Panel
						title='Active panel'
						active
						actions={
							<IconButton size='sm' label='Refresh' icon={<RefreshCw size={12} />} />
						}
					>
						<p className='p-3 text-fg-1'>Body content</p>
					</Panel>
				</div>
				<div className='h-56 w-72'>
					<Panel title='Loading'>
						<div className='flex h-full items-center justify-center'>
							<Spinner />
						</div>
					</Panel>
				</div>
				<div className='h-56 w-72'>
					<Panel title='Empty'>
						<EmptyState
							icon={<Bell size={20} />}
							title='No notifications'
							description='Modules will post updates here.'
							action={<Button size='sm'>Configure</Button>}
						/>
					</Panel>
				</div>
				<div className='h-56 w-72'>
					<Panel title='Error'>
						<ErrorState
							message='Sidecar did not respond within 10s.'
							code='SIDECAR_TIMEOUT'
							onRetry={() => undefined}
						/>
					</Panel>
				</div>
			</Section>

			<Section title='Dialog & toasts'>
				<Button onClick={() => setDialogOpen(true)}>Open dialog</Button>
				<Button onClick={() => toast.info('Info toast', 'Something neutral happened.')}>
					Info
				</Button>
				<Button onClick={() => toast.success('Saved', 'Settings were saved.')}>
					Success
				</Button>
				<Button
					onClick={() => toast.warn('Rate limited', 'DexScreener asked us to slow down.')}
				>
					Warn
				</Button>
				<Button
					onClick={() => toast.error('Sidecar crashed', 'Restarting (attempt 2 of 5).')}
				>
					Error
				</Button>
				<Dialog
					open={dialogOpen}
					onOpenChange={setDialogOpen}
					title='Confirm order'
					description='Dialogs register as overlays, so webviews hide while open.'
					footer={
						<>
							<Button variant='ghost' onClick={() => setDialogOpen(false)}>
								Cancel
							</Button>
							<Button variant='primary' onClick={() => setDialogOpen(false)}>
								Confirm
							</Button>
						</>
					}
				>
					<p className='text-fg-1'>Dialog body.</p>
				</Dialog>
			</Section>
		</div>
	);
}
