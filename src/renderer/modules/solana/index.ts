import { Wallet } from 'lucide-react';

import { manifest } from '@shared/modules/solana.manifest';

import type { RendererModule } from '../types';
import { WalletsPanel } from './WalletsPanel';

export const rendererModule: RendererModule = {
	manifest,
	panels: [
		{
			id: 'solana.wallets',
			title: 'Wallets',
			room: 'trade',
			icon: Wallet,
			component: WalletsPanel,
			defaultOpen: true,
			tabWith: 'calendar.week',
		},
	],
	commands: [
		{
			id: 'solana.show',
			title: 'Trade: Show Solana Wallets',
			room: 'trade',
			keywords: ['solana', 'wallet', 'phantom', 'balance', 'tokens'],
			icon: Wallet,
			run: (ctx) => ctx.openPanel('solana.wallets'),
		},
	],
};
