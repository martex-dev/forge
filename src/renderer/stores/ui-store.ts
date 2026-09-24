import { create } from 'zustand';

import type { RoomId } from '@shared/rooms';

export type SettingsTab = 'general' | 'secrets' | 'modules';

interface UiState {
	room: RoomId;
	playgroundOpen: boolean;
	paletteOpen: boolean;
	settingsOpen: boolean;
	settingsTab: SettingsTab;
	setRoom: (room: RoomId) => void;
	setPaletteOpen: (open: boolean) => void;
	togglePlayground: () => void;
	openSettings: (tab?: SettingsTab) => void;
	setSettingsOpen: (open: boolean) => void;
	setSettingsTab: (tab: SettingsTab) => void;
}

const ROOM_KEY = 'forge.room';

function initialRoom(): RoomId {
	try {
		const saved = localStorage.getItem(ROOM_KEY);
		if (saved === 'build' || saved === 'trade' || saved === 'lab' || saved === 'hub')
			return saved;
	} catch {
		// Storage can be unavailable; the default room is fine.
	}
	return 'build';
}

export const useUiStore = create<UiState>((set) => ({
	room: initialRoom(),
	playgroundOpen: false,
	paletteOpen: false,
	settingsOpen: false,
	settingsTab: 'general',
	setRoom: (room) => {
		try {
			localStorage.setItem(ROOM_KEY, room);
		} catch {
			// Non-critical: the room just won't be remembered.
		}
		set({ room, playgroundOpen: false });
	},
	setPaletteOpen: (paletteOpen) => set({ paletteOpen }),
	togglePlayground: () => set((s) => ({ playgroundOpen: !s.playgroundOpen })),
	openSettings: (tab) => set((s) => ({ settingsOpen: true, settingsTab: tab ?? s.settingsTab })),
	setSettingsOpen: (settingsOpen) => set({ settingsOpen }),
	setSettingsTab: (settingsTab) => set({ settingsTab }),
}));
