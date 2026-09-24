export const MAX_RESTART_ATTEMPTS = 5;

/** 1s, 2s, 4s, 8s, 16s — capped so a flapping sidecar can't stall recovery for minutes. */
export function backoffDelayMs(attempt: number, baseMs = 1000, capMs = 16_000): number {
	return Math.min(capMs, baseMs * 2 ** Math.max(0, attempt - 1));
}
