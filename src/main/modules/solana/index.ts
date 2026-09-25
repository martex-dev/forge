import { z } from 'zod';

import {
	SolanaAddressSchema,
	type WalletSnapshot,
	type WatchedWallet,
	WatchedWalletSchema,
} from '@shared/ipc/channels/solana';
import { manifest } from '@shared/modules/solana.manifest';

import { ForgeError } from '../../core/errors';
import type { MainModule } from '../../core/modules/types';

const WalletsSchema = z.array(WatchedWalletSchema).max(50);

const SidecarSnapshot = z.object({
	address: z.string(),
	sol: z.number(),
	sol_price_usd: z.number().nullable(),
	holdings: z.array(
		z.object({
			mint: z.string(),
			symbol: z.string().nullable(),
			name: z.string().nullable(),
			amount: z.number(),
			price_usd: z.number().nullable(),
			value_usd: z.number().nullable(),
			image_url: z.string().nullable(),
		}),
	),
	total_usd: z.number().nullable(),
	transactions: z.array(
		z.object({
			signature: z.string(),
			slot: z.number(),
			time: z.number().nullable(),
			ok: z.boolean(),
			memo: z.string().nullable(),
		}),
	),
	fetched_at: z.number(),
});

/** Refuses anything that could be a secret key, with a warning that says why. */
export function checkAddress(input: string): string {
	const value = input.trim();
	// A base58 secret key (64 bytes) is ~87-88 chars; a JSON byte array starts with "[".
	if (value.startsWith('[') || /^[1-9A-HJ-NP-Za-km-z]{60,}$/.test(value)) {
		throw new ForgeError(
			'SOLANA_SECRET_KEY',
			'That looks like a private key. Never paste it anywhere; Forge only needs the public address.',
		);
	}
	const parsed = SolanaAddressSchema.safeParse(value);
	if (!parsed.success) throw new ForgeError('SOLANA_BAD_ADDRESS', 'Not a Solana public address');
	return parsed.data;
}

export const mainModule: MainModule = {
	manifest,
	activate(ctx) {
		const read = (): WatchedWallet[] => ctx.settings.get('wallets', WalletsSchema, []);
		const write = (list: WatchedWallet[]): WatchedWallet[] =>
			ctx.settings.set('wallets', WalletsSchema, list);

		ctx.ipc.handle('solana:wallets', () => read());
		ctx.ipc.handle('solana:addWallet', ({ address, label }) => {
			const clean = checkAddress(address);
			const list = read();
			if (list.some((w) => w.address === clean)) return list;
			if (list.length >= 50)
				throw new ForgeError('SOLANA_TOO_MANY', 'You can watch up to 50 wallets');
			return write([
				...list,
				{
					address: clean,
					label: label.trim() || `${clean.slice(0, 4)}…${clean.slice(-4)}`,
					addedAt: Date.now(),
				},
			]);
		});
		ctx.ipc.handle('solana:removeWallet', (address) =>
			write(read().filter((w) => w.address !== address)),
		);
		ctx.ipc.handle('solana:snapshot', async ({ address, refresh }): Promise<WalletSnapshot> => {
			const rpc = ctx.getSecret('solana.rpc');
			const raw = await ctx.sidecar(
				'GET',
				`/solana/wallet?address=${encodeURIComponent(address)}&refresh=${refresh}`,
				undefined,
				rpc ? { 'X-Solana-Rpc': rpc } : undefined,
			);
			const parsed = SidecarSnapshot.safeParse(raw);
			if (!parsed.success) {
				ctx.log.error('unexpected wallet payload', { issues: parsed.error.message });
				throw new ForgeError(
					'SOLANA_BAD_DATA',
					'The Solana service returned unexpected data',
				);
			}
			const s = parsed.data;
			return {
				address: s.address,
				sol: s.sol,
				solPriceUsd: s.sol_price_usd,
				holdings: s.holdings.map((h) => ({
					mint: h.mint,
					symbol: h.symbol,
					name: h.name,
					amount: h.amount,
					priceUsd: h.price_usd,
					valueUsd: h.value_usd,
					imageUrl: h.image_url,
				})),
				totalUsd: s.total_usd,
				transactions: s.transactions.map((t) => ({
					...t,
					time: t.time === null ? null : t.time * 1000,
				})),
				fetchedAt: s.fetched_at * 1000,
			};
		});
	},
};
