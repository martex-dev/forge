import { type Dispatch, useCallback, useEffect, useRef, useState } from 'react';

import type { KernelChoice } from '@shared/ipc/channels/notebooks';

import { call } from '../../lib/ipc';
import { toast } from '../../stores/toast-store';
import type { NbAction } from './notebook-model';

export type KernelStatus = 'none' | 'starting' | 'idle' | 'busy' | 'dead';

export interface KernelSession {
	session: string;
	label: string;
}

const POLL_MS = 150;
const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));
const isGone = (e: unknown): boolean =>
	e instanceof Error && /SESSION_NOT_FOUND|NOT_FOUND/.test(e.message);

export interface Kernel {
	status: KernelStatus;
	label: string | null;
	start(choice: KernelChoice): Promise<boolean>;
	/** Resolves true when the cell finished without an error. */
	run(cellId: string, code: string): Promise<boolean>;
	runMany(cells: ReadonlyArray<{ id: string; code: string }>): Promise<void>;
	interrupt(): void;
	restart(): void;
}

/**
 * One kernel per notebook panel. The session id lives in panel params (via `onSession`) so a
 * window reload reattaches to the same kernel instead of leaking it.
 */
export function useKernel(
	path: string,
	initial: KernelSession | null,
	onSession: (s: KernelSession | null) => void,
	dispatch: Dispatch<NbAction>,
): Kernel {
	const [session, setSession] = useState<KernelSession | null>(initial);
	const [status, setStatus] = useState<KernelStatus>(initial ? 'idle' : 'none');
	const sessionRef = useRef(session);
	const stopRun = useRef(false);
	useEffect(() => {
		sessionRef.current = session;
	}, [session]);

	const markDead = useCallback((): void => {
		setStatus('dead');
		setSession(null);
		onSession(null);
	}, [onSession]);

	const start = useCallback(
		async (choice: KernelChoice): Promise<boolean> => {
			setStatus('starting');
			try {
				const s = await call('nb:start', { path, kernel: choice });
				setSession(s);
				onSession(s);
				setStatus('idle');
				return true;
			} catch (error) {
				setStatus('none');
				toast.error(
					'Kernel did not start',
					error instanceof Error ? error.message : String(error),
				);
				return false;
			}
		},
		[path, onSession],
	);

	const run = useCallback(
		async (cellId: string, code: string): Promise<boolean> => {
			const s = sessionRef.current;
			if (!s) {
				toast.warn('No kernel', 'Pick a kernel first.');
				return false;
			}
			dispatch({ type: 'clearOutputs', id: cellId });
			dispatch({ type: 'run', id: cellId, state: 'queued' });
			try {
				const exec = await call('nb:execute', { session: s.session, code });
				let after = 0;
				for (;;) {
					const st = await call('nb:poll', { session: s.session, exec, after });
					after = st.next;
					if (st.outputs.length)
						dispatch({ type: 'outputs', id: cellId, outputs: st.outputs });
					if (st.executionCount !== null)
						dispatch({ type: 'count', id: cellId, count: st.executionCount });
					setStatus(
						st.kernelState === 'dead'
							? 'dead'
							: st.kernelState === 'busy'
								? 'busy'
								: 'idle',
					);
					if (st.status === 'running')
						dispatch({ type: 'run', id: cellId, state: 'running' });
					if (st.status === 'done' || st.status === 'error' || st.status === 'aborted') {
						return st.status === 'done';
					}
					await sleep(POLL_MS);
				}
			} catch (error) {
				if (isGone(error)) markDead();
				else
					toast.error(
						'Run failed',
						error instanceof Error ? error.message : String(error),
					);
				return false;
			} finally {
				dispatch({ type: 'run', id: cellId, state: null });
			}
		},
		[dispatch, markDead],
	);

	const runMany = useCallback(
		async (cells: ReadonlyArray<{ id: string; code: string }>): Promise<void> => {
			stopRun.current = false;
			for (const c of cells) dispatch({ type: 'run', id: c.id, state: 'queued' });
			try {
				for (const c of cells) {
					// Like Jupyter's Run All: the first error (or an interrupt) stops the rest.
					if (stopRun.current || !(await run(c.id, c.code))) break;
				}
			} finally {
				for (const c of cells) dispatch({ type: 'run', id: c.id, state: null });
			}
		},
		[dispatch, run],
	);

	const interrupt = useCallback((): void => {
		const s = sessionRef.current;
		stopRun.current = true;
		if (s)
			call('nb:interrupt', s.session).catch((e: unknown) =>
				isGone(e) ? markDead() : undefined,
			);
	}, [markDead]);

	const restart = useCallback((): void => {
		const s = sessionRef.current;
		if (!s) return;
		stopRun.current = true;
		setStatus('starting');
		call('nb:restart', s.session)
			.then(() => setStatus('idle'))
			.catch((e: unknown) => {
				if (isGone(e)) markDead();
				else toast.error('Restart failed', e instanceof Error ? e.message : String(e));
			});
	}, [markDead]);

	return { status, label: session?.label ?? null, start, run, runMany, interrupt, restart };
}
