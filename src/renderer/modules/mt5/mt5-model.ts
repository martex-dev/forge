import type { Mt5Deal, Mt5Position } from '@shared/ipc/channels/mt5';

export interface HistorySummary {
	/** Profit + commission + swap of trading deals (deposits/withdrawals excluded). */
	net: number;
	closedTrades: number;
	wins: number;
	/** 0–100, or null with no closed trades. */
	winRate: number | null;
	deposits: number;
}

const TRADING = new Set(['buy', 'sell']);

export function summarizeHistory(deals: readonly Mt5Deal[]): HistorySummary {
	let net = 0;
	let closedTrades = 0;
	let wins = 0;
	let deposits = 0;
	for (const d of deals) {
		if (!TRADING.has(d.side)) {
			if (d.side === 'balance') deposits += d.profit;
			continue;
		}
		net += d.profit + d.commission + d.swap;
		// A position's result is booked on its closing ("out") deal.
		if (d.entry === 'out' || d.entry === 'out_by') {
			closedTrades += 1;
			if (d.profit + d.swap + d.commission > 0) wins += 1;
		}
	}
	return {
		net,
		closedTrades,
		wins,
		winRate: closedTrades ? (wins / closedTrades) * 100 : null,
		deposits,
	};
}

export function floating(positions: readonly Mt5Position[]): number {
	return positions.reduce((sum, p) => sum + p.profit + p.swap, 0);
}

/** Price precision from the instrument's quote (EURUSD 1.08123 → 5, XAUUSD 2410.5 → 2). */
export function priceDigits(...prices: number[]): number {
	let digits = 2;
	for (const price of prices) {
		const text = String(price);
		const dot = text.indexOf('.');
		if (dot !== -1) digits = Math.max(digits, Math.min(6, text.length - dot - 1));
	}
	return digits;
}

export const money = (value: number, currency: string): string =>
	`${value < 0 ? '-' : ''}${Math.abs(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;

/** Prefill for a Trade Journal entry (the journal panel's `draft` param). */
export interface JournalPrefill {
	symbol: string;
	market: 'forex';
	side: 'long' | 'short';
	status: 'closed';
	entry: number | null;
	exit: number | null;
	size: number | null;
	pnl: number;
	openedAt: number | null;
	closedAt: number | null;
	notes: string;
}

const vwap = (ds: readonly Mt5Deal[]): number | null => {
	const volume = ds.reduce((a, d) => a + d.volume, 0);
	return volume ? ds.reduce((a, d) => a + d.price * d.volume, 0) / volume : null;
};

/**
 * One journal entry per MT5 position: averaged entry/exit prices and the net of every deal on it
 * (profit, commission and swap), so partial closes don't double count the opening commission.
 */
export function positionToJournal(
	position: number,
	deals: readonly Mt5Deal[],
): JournalPrefill | null {
	const own = deals.filter((d) => d.position === position && TRADING.has(d.side));
	const ins = own.filter((d) => d.entry === 'in');
	const outs = own.filter((d) => d.entry === 'out' || d.entry === 'out_by');
	const first = ins[0] ?? own[0];
	if (!first || outs.length === 0) return null;
	// The opening deal's side is the position's side; without it, a closing sell means a long.
	const long = ins[0] ? ins[0].side === 'buy' : outs[0]?.side === 'sell';
	return {
		symbol: first.symbol,
		market: 'forex',
		side: long ? 'long' : 'short',
		status: 'closed',
		entry: vwap(ins),
		exit: vwap(outs),
		size: ins.length ? ins.reduce((a, d) => a + d.volume, 0) : null,
		pnl: Math.round(own.reduce((a, d) => a + d.profit + d.commission + d.swap, 0) * 100) / 100,
		openedAt: ins[0]?.time ?? null,
		closedAt: Math.max(...outs.map((d) => d.time)),
		notes: `MT5 position #${position} (size in lots).`,
	};
}
