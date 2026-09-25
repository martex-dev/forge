import { create } from 'zustand';

export interface OpenFileRequest {
	path: string;
	/** Optional 1-based position to reveal (search results, diagnostics). */
	line?: number;
	column?: number;
}

type OpenFileHandler = (request: OpenFileRequest) => void;

interface WorkbenchState {
	/** Workspace-relative path of the file focused in the editor, if any. */
	activeFile: string | null;
	openFileHandler: OpenFileHandler | null;
	setActiveFile: (path: string | null) => void;
	setOpenFileHandler: (handler: OpenFileHandler | null) => void;
}

/**
 * Tiny bus between modules that must not import each other: the explorer (or search, git…)
 * asks to open a file; whichever editor module is enabled registers the handler.
 */
export const useWorkbenchStore = create<WorkbenchState>((set) => ({
	activeFile: null,
	openFileHandler: null,
	setActiveFile: (activeFile) => set({ activeFile }),
	setOpenFileHandler: (openFileHandler) => set({ openFileHandler }),
}));

/** Returns false when no editor module is available to handle the request. */
export function requestOpenFile(request: OpenFileRequest): boolean {
	const handler = useWorkbenchStore.getState().openFileHandler;
	if (!handler) return false;
	handler(request);
	return true;
}
