import { describe, expect, it } from 'vitest';

import { checkAddress } from './index';

describe('checkAddress', () => {
	it('accepts public addresses (trimmed)', () => {
		expect(checkAddress('  9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM ')).toBe(
			'9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM',
		);
	});

	it('refuses private keys with a specific warning', () => {
		expect(() => checkAddress('5'.repeat(88))).toThrow(/private key/);
		expect(() => checkAddress('[12,34,56]')).toThrow(/private key/);
	});

	it('refuses other garbage as not an address', () => {
		expect(() => checkAddress('0xabc')).toThrow(/Not a Solana public address/);
	});
});
