import { Coins, Info } from 'lucide-react';

import { manifest } from '@shared/modules/dexscreener.manifest';

import type { RendererModule } from '../types';
import { PairDetailPanel } from './PairDetailPanel';
import { WatchlistPanel } from './WatchlistPanel';

export const rendererModule: RendererModule = {
	manifest,
	panels: [
		{
			id: 'dexscreener.watchlist',
			title: 'Watchlist',
			room: 'trade',
			icon: Coins,
			component: WatchlistPanel,
			defaultOpen: true,
			// Keeps polling (and price flashes) running while another tab is in front.
			renderer: 'always',
			position: 'below',
			initialSize: 300,
		},
		{
			id: 'dexscreener.detail',
			title: 'Token',
			room: 'trade',
			icon: Info,
			component: PairDetailPanel,
			tabWith: 'calendar.week',
		},
	],
	commands: [
		{
			id: 'dexscreener.show',
			title: 'Trade: Show DexScreener Watchlist',
			room: 'trade',
			keywords: ['dex', 'memecoin', 'solana', 'token', 'price'],
			icon: Coins,
			run: (ctx) => ctx.openPanel('dexscreener.watchlist'),
		},
	],
};
