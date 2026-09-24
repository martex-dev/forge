import {
	CandlestickChart,
	Code2,
	FlaskConical,
	LayoutGrid,
	Library,
	type LucideIcon,
	Palette,
	RotateCw,
	Search,
	Settings,
} from 'lucide-react';

import { ROOMS } from '@shared/rooms';

import type { CommandDefinition } from '../../modules/types';

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
		id: 'core.togglePlayground',
		title: 'Dev: Open Design Playground',
		room: 'global',
		keywords: ['design system', 'components', 'tokens', 'toggle'],
		icon: Palette,
		run: (ctx) => ctx.togglePlayground(),
	},
];
