import {
	CandlestickChart,
	Code2,
	Download,
	FlaskConical,
	LayoutGrid,
	Library,
	type LucideIcon,
	Palette,
	RefreshCcw,
	RotateCw,
	Search,
	Settings,
} from 'lucide-react';

import { ROOMS } from '@shared/rooms';

import { call } from '../../lib/ipc';
import type { CommandDefinition } from '../../modules/types';
import { toast } from '../../stores/toast-store';

export const ROOM_ICONS: Record<string, LucideIcon> = {
	build: Code2,
	trade: CandlestickChart,
	lab: FlaskConical,
	hub: Library,
};

/** Shell commands that exist regardless of which modules are enabled. */
export const BUILTIN_COMMANDS: readonly CommandDefinition[] = [
	{
		id: 'core.openPalette',
		title: 'Show Command Palette',
		room: 'global',
		shortcut: 'Ctrl+K',
		icon: Search,
		run: (ctx) => ctx.openPalette(),
	},
	{
		id: 'core.openPaletteAlt',
		title: 'Show All Commands',
		room: 'global',
		shortcut: 'Ctrl+Shift+P',
		icon: Search,
		run: (ctx) => ctx.openPalette(),
	},
	...ROOMS.map((room): CommandDefinition => ({
		id: `core.switchRoom.${room.id}`,
		title: `Switch to ${room.name} Room`,
		room: 'global',
		shortcut: room.shortcut,
		keywords: ['room', room.id, room.description],
		icon: ROOM_ICONS[room.id],
		run: (ctx) => ctx.switchRoom(room.id),
	})),
	{
		id: 'core.resetLayout',
		title: 'Reset Layout of Current Room',
		room: 'global',
		keywords: ['dock', 'panels', 'default'],
		icon: LayoutGrid,
		run: (ctx) => ctx.resetLayout(),
	},
	{
		id: 'core.openSettings',
		title: 'Open Settings',
		room: 'global',
		shortcut: 'Ctrl+,',
		keywords: ['preferences', 'config'],
		icon: Settings,
		run: (ctx) => ctx.openSettings(),
	},
	{
		id: 'core.openSecrets',
		title: 'Settings: Manage Secrets',
		room: 'global',
		keywords: ['api key', 'token', 'vault'],
		icon: Settings,
		run: (ctx) => ctx.openSettings('secrets'),
	},
	{
		id: 'core.openModules',
		title: 'Settings: Enable or Disable Modules',
		room: 'global',
		keywords: ['plugins', 'integrations'],
		icon: Settings,
		run: (ctx) => ctx.openSettings('modules'),
	},
	{
		id: 'core.reloadWindow',
		title: 'Reload Window',
		room: 'global',
		keywords: ['refresh', 'restart'],
		icon: RotateCw,
		run: (ctx) => ctx.reloadWindow(),
	},
	{
		id: 'core.restartSidecar',
		title: 'Restart Python Sidecar',
		room: 'global',
		keywords: ['python', 'backend', 'uv', 'fastapi'],
		icon: RotateCw,
		run: (ctx) => ctx.restartSidecar(),
	},
	{
		id: 'core.checkUpdates',
		title: 'Check for Updates',
		room: 'global',
		keywords: ['update', 'upgrade', 'version', 'release'],
		icon: Download,
		run: async () => {
			const status = await call('update:check');
			if (status.state === 'disabled') toast.info('Updates are off', status.reason);
			else if (status.state === 'idle') toast.success('Forge is up to date');
			else if (status.state === 'error') toast.warn('Update check failed', status.message);
		},
	},
	{
		id: 'core.installUpdate',
		title: 'Restart to Update',
		room: 'global',
		keywords: ['update', 'install', 'restart'],
		icon: RefreshCcw,
		run: async () => {
			const status = await call('update:status');
			if (status.state === 'ready') await call('update:install');
			else toast.info('No update downloaded yet', 'Use "Check for Updates" first.');
		},
	},
	{
		id: 'core.togglePlayground',
		title: 'Dev: Open Design Playground',
		room: 'global',
		keywords: ['design system', 'components', 'tokens', 'toggle'],
		icon: Palette,
		run: (ctx) => ctx.togglePlayground(),
	},
];
