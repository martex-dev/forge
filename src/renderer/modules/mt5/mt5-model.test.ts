import { describe, expect, it } from 'vitest';

import type { Mt5Deal, Mt5Position } from '@shared/ipc/channels/mt5';

import { floating, money, positionToJournal, priceDigits, summarizeHistory } from './mt5-model';

const deal = (side: string, entry: string, profit: number, commission = 0): Mt5Deal => ({
	ticket: 1,
	position: 1,
	symbol: 'EURUSD',
	side,
	entry,
	volume: 0.1,
	price: 1.08,
	profit,
	commission,
	swap: 0,
	time: 0,
	comment: '',
});

describe('summarizeHistory', () => {
	it('nets trading deals, counts closed trades and excludes deposits', () => {
		const s = summarizeHistory([
			deal('balance', 'in', 5_000),
			deal('buy', 'in', 0, -0.7),
			deal('sell', 'out', 100, -0.7),
			deal('sell', 'in', 0, -0.7),
			deal('buy', 'out', -40, -0.7),
		]);
		expect(s.net).toBeCloseTo(57.2);
		expect([s.closedTrades, s.wins, s.winRate, s.deposits]).toEqual([2, 1, 50, 5_000]);
		expect(summarizeHistory([]).winRate).toBeNull();
	});
});

describe('helpers', () => {
	it('sums floating P/L including swap', () => {
		const p = { profit: 10, swap: -1 } as Mt5Position;
		expect(floating([p, { ...p, profit: -5 }])).toBe(3);
	});

	it('picks price precision from quotes', () => {
		expect(priceDigits(1.08123, 1.0812)).toBe(5);
		expect(priceDigits(2410.5)).toBe(2);
		expect(priceDigits(150)).toBe(2);
	});

	it('formats money with sign and currency', () => {
		expect(money(-1234.5, 'USD')).toBe('-1,234.50 USD');
	});
});

describe('positionToJournal', () => {
	const d = (over: Partial<Mt5Deal>): Mt5Deal => ({ ...deal('buy', 'in', 0), ...over });

	it('averages a partially closed long and nets every deal on the position', () => {
		const deals = [
			d({
				position: 7,
				side: 'buy',
				entry: 'in',
				volume: 0.2,
				price: 1.08,
				commission: -1,
				time: 10,
			}),
			d({
				position: 7,
				side: 'sell',
				entry: 'out',
				volume: 0.1,
				price: 1.09,
				profit: 100,
				time: 20,
			}),
			d({
				position: 7,
				side: 'sell',
				entry: 'out',
				volume: 0.1,
				price: 1.07,
				profit: -100,
				swap: -0.5,
				time: 30,
			}),
			d({ position: 8, side: 'buy', entry: 'out', profit: 999 }),
		];
		expect(positionToJournal(7, deals)).toMatchObject({
			symbol: 'EURUSD',
			side: 'long',
			entry: 1.08,
			size: 0.2,
			pnl: -1.5,
			openedAt: 10,
			closedAt: 30,
		});
		expect(positionToJournal(7, deals)?.exit).toBeCloseTo(1.08);
	});

	it('reads a short from the closing side when the opening deal is outside the window', () => {
		const deals = [d({ position: 9, side: 'buy', entry: 'out', price: 1.2, profit: 5 })];
		expect(positionToJournal(9, deals)).toMatchObject({
			side: 'short',
			entry: null,
			size: null,
		});
		expect(positionToJournal(10, deals)).toBeNull();
	});
});
