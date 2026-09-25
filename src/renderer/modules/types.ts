import type { LucideIcon } from 'lucide-react';
import type { ComponentType } from 'react';

import type { ModuleManifest } from '@shared/modules/types';
import type { RoomId } from '@shared/rooms';

export type PanelParams = Record<string, unknown>;

export interface PanelProps {
	/** Instance id: `<definitionId>` or `<definitionId>#<n>` for multi-instance panels. */
	panelId: string;
	room: RoomId;
	/** Serialized with the layout, so a restored panel gets the same params back. */
	params: PanelParams;
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
	/**
	 * 'always' keeps the panel mounted while its tab is hidden (needed for webviews and
	 * terminals, which would otherwise be torn down and reloaded on every tab switch).
	 */
	renderer?: 'always' | 'onlyWhenVisible';
	/** Where a newly opened instance goes relative to existing panels. */
	position?: 'left' | 'right' | 'below' | 'tab';
	/** Initial size in px along the split axis (width for left/right, height for below). */
	initialSize?: number;
	/**
	 * Called when the user closes this panel (or its module is disabled / layout reset) —
	 * not on window reload, so long-lived resources like terminal shells survive reloads.
	 */
	onClose?: (params: PanelParams, panelId: string) => void;
}

export interface OpenPanelOptions {
	/** Defaults to the definition id (single instance). */
	instanceId?: string;
	title?: string;
	params?: PanelParams;
}

/** Everything a command may do; implemented by the shell. */
export interface CommandContext {
	switchRoom(room: RoomId): void;
	openPanel(panelId: string, options?: OpenPanelOptions): void;
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

export interface StatusItemDefinition {
	id: string;
	side: 'left' | 'right';
	/** Lower comes first. */
	order?: number;
	component: ComponentType;
}

export interface RendererModule {
	manifest: ModuleManifest;
	panels?: PanelDefinition[];
	commands?: CommandDefinition[];
	statusItems?: StatusItemDefinition[];
}
