import { z } from 'zod';

import { defineChannels } from '../define';

/** Base58 public key, 32-44 chars. Anything longer is refused (it may be a secret key). */
export const SolanaAddressSchema = z
	.string()
	.trim()
	.regex(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/, 'Not a Solana public address');

export const WatchedWalletSchema = z.object({
	address: SolanaAddressSchema,
	label: z.string().max(40),
	addedAt: z.number(),
});
export type WatchedWallet = z.infer<typeof WatchedWalletSchema>;

export const HoldingSchema = z.object({
	mint: z.string(),
	symbol: z.string().nullable(),
	name: z.string().nullable(),
	amount: z.number(),
	priceUsd: z.number().nullable(),
	valueUsd: z.number().nullable(),
	imageUrl: z.string().nullable(),
});
export type Holding = z.infer<typeof HoldingSchema>;

export const WalletSnapshotSchema = z.object({
	address: z.string(),
	sol: z.number(),
	solPriceUsd: z.number().nullable(),
	holdings: z.array(HoldingSchema),
	totalUsd: z.number().nullable(),
	transactions: z.array(
		z.object({
			signature: z.string(),
			slot: z.number().int(),
			/** Epoch ms, when the RPC knows it. */
			time: z.number().nullable(),
			ok: z.boolean(),
			memo: z.string().nullable(),
		}),
	),
	fetchedAt: z.number(),
});
export type WalletSnapshot = z.infer<typeof WalletSnapshotSchema>;

/** Watch-only by public address (CLAUDE.md §7): no keys, no signing, no transactions sent. */
export const solanaChannels = defineChannels({
	'solana:wallets': { input: z.void(), output: z.array(WatchedWalletSchema) },
	'solana:addWallet': {
		// Loose here so a pasted secret key gets a specific warning instead of a generic error.
		input: z.object({ address: z.string().max(200), label: z.string().max(40) }),
		output: z.array(WatchedWalletSchema),
	},
	'solana:removeWallet': { input: SolanaAddressSchema, output: z.array(WatchedWalletSchema) },
	'solana:snapshot': {
		input: z.object({ address: SolanaAddressSchema, refresh: z.boolean() }),
		output: WalletSnapshotSchema,
	},
});
