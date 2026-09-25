import { defineManifest } from './types';

export const manifest = defineManifest({
	id: 'earnings',
	name: 'Earnings Calendar',
	description:
		'Upcoming earnings for S&P 500 and Nasdaq-100 companies: NASDAQ (no key), Finnhub or your Market Calendar deployment.',
	room: 'trade',
	requiredSecrets: [
		{
			key: 'finnhub.key',
			label: 'Finnhub API key (optional)',
			help: 'Only for the Finnhub earnings source. Free key at finnhub.io/register.',
		},
	],
	defaultEnabled: true,
});
