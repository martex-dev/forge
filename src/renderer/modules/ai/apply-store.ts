import { create } from 'zustand';

export interface Proposal {
	/** Workspace-relative file the change targets. */
	path: string;
	language: string;
	/** The code block from the reply. */
	block: string;
	/** Lines that were selected when Apply was clicked (1-based, inclusive). */
	selection: { startLine: number; endLine: number } | null;
}

/** The change waiting in the Apply preview; null when nothing is pending. */
export const useApply = create<{ proposal: Proposal | null; set: (p: Proposal | null) => void }>(
	(set) => ({
		proposal: null,
		set: (proposal) => set({ proposal }),
	}),
);
