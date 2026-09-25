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
