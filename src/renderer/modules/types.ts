import type { LucideIcon } from 'lucide-react';
import type { ComponentType } from 'react';

import type { ModuleManifest } from '@shared/modules/types';
import type { RoomId } from '@shared/rooms';

export interface PanelProps {
	panelId: string;
	room: RoomId;
}

export interface PanelDefinition {
	/** Globally unique, e.g. `build-core.welcome`. Also the dockview component key. */
	id: string;
	title: string;
	room: RoomId;
	icon?: LucideIcon;
	component: ComponentType<PanelProps>;
	/** Opened in the room's default layout (first launch and after "Reset layout"). */
	defaultOpen?: boolean;
}

/** Everything a command may do; implemented by the shell. */
export interface CommandContext {
	switchRoom(room: RoomId): void;
	openPanel(panelId: string): void;
	resetLayout(room?: RoomId): void;
	openSettings(tab?: 'general' | 'secrets' | 'modules'): void;
	openPalette(): void;
	togglePlayground(): void;
	reloadWindow(): void;
	restartSidecar(): void;
}

export interface CommandDefinition {
	/** Globally unique, e.g. `trade-core.openWelcome`. */
	id: string;
	title: string;
	/** Grouping in the palette. */
	room: RoomId | 'global';
	/** Display + binding, e.g. `Ctrl+Shift+P`. */
	shortcut?: string;
	keywords?: string[];
	icon?: LucideIcon;
	run(ctx: CommandContext): void | Promise<void>;
}

export interface RendererModule {
	manifest: ModuleManifest;
	panels?: PanelDefinition[];
	commands?: CommandDefinition[];
}
