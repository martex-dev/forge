import { defineManifest } from './types';

export const manifest = defineManifest({
	id: 'solana',
	name: 'Solana Wallets',
	description:
		'Watch Solana wallets by public address: SOL and token balances with USD value, recent transactions. Never keys.',
	room: 'trade',
	requiredSecrets: [
		{
			key: 'solana.rpc',
			label: 'Solana RPC URL (optional)',
			help: 'A private RPC URL (Helius, QuickNode, Triton…) avoids the public endpoint’s rate limits. Leave empty to use the public RPC.',
		},
	],
	defaultEnabled: true,
});
