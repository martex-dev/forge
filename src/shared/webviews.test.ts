import { describe, expect, it } from 'vitest';

import { getWebService, isServiceHost, partitionFor } from './webviews';

describe('webview services', () => {
	const tv = getWebService('tradingview');

	it('registers TradingView with its own persistent partition', () => {
		expect(tv).toBeDefined();
		expect(partitionFor('tradingview')).toBe('persist:svc-tradingview');
	});

	it.each([
		['https://www.tradingview.com/chart/abc', true],
		['https://tradingview.com/', true],
		['https://s3.tradingview.com/x.js', true],
		['http://www.tradingview.com/', false],
		['https://tradingview.com.evil.io/', false],
		['https://eviltradingview.com/', false],
		['https://accounts.google.com/o/oauth2', false],
		['javascript:alert(1)', false],
	])('%s in-app → %s', (url, expected) => {
		if (!tv) throw new Error('missing service');
		expect(isServiceHost(tv, url)).toBe(expected);
	});
});
