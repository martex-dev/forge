import type { JournalEntry } from './ipc/channels/journal';

/** Net P/L of a closed trade: the explicit figure when given, else derived from prices × size. */
export function entryPnl(e: JournalEntry): number | null {
	if (e.status !== 'closed') return null;
	if (e.pnl !== null) return e.pnl - e.fees;
	if (e.entry === null || e.exit === null || e.size === null) return null;
	const sign = e.side === 'long' ? 1 : -1;
	// Rounded so price-math float noise (1.085 - 1.08) doesn't turn a scratch into a win or loss.
	return Math.round(((e.exit - e.entry) * e.size * sign - e.fees) * 1e6) / 1e6;
}
