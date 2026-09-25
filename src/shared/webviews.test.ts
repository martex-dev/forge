import { describe, expect, it } from 'vitest';

import { getWebService, isServiceHost, partitionFor, WEB_SERVICES } from './webviews';

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

	it('gives every service a unique id, an https URL on its own hosts, and a partition', () => {
		const ids = WEB_SERVICES.map((s) => s.id);
		expect(new Set(ids).size).toBe(ids.length);
		for (const s of WEB_SERVICES) {
			expect(isServiceHost(s, s.url)).toBe(true);
			expect(partitionFor(s.id)).toBe(`persist:svc-${s.id}`);
		}
	});

	it('keeps X on x.com and twitter.com only', () => {
		const x = getWebService('x');
		if (!x) throw new Error('missing service');
		expect(isServiceHost(x, 'https://twitter.com/home')).toBe(true);
		expect(isServiceHost(x, 'https://t.co/abc')).toBe(false);
	});
});
