import { describe, expect, it } from 'vitest';

import type { Mt5Deal, Mt5Position } from '@shared/ipc/channels/mt5';

import { floating, money, priceDigits, summarizeHistory } from './mt5-model';

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
