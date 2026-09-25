import { z } from 'zod';

import { type WatchEntry, WatchEntrySchema } from '@shared/ipc/channels/dex';
import { manifest } from '@shared/modules/dexscreener.manifest';

import { ForgeError } from '../../core/errors';
import type { MainModule } from '../../core/modules/types';
import { parsePairs } from './map-pair';

const WatchlistSchema = z.array(WatchEntrySchema).max(200);
const KEY = 'watchlist';
const same = (a: { chainId: string; pairAddress: string }, b: typeof a): boolean =>
	a.chainId === b.chainId && a.pairAddress.toLowerCase() === b.pairAddress.toLowerCase();

export const mainModule: MainModule = {
	manifest,
	activate(ctx) {
		const read = (): WatchEntry[] => ctx.settings.get(KEY, WatchlistSchema, []);
		const write = (list: WatchEntry[]): WatchEntry[] => {
			const saved = ctx.settings.set(KEY, WatchlistSchema, list);
			ctx.emit('dex:watchlistChanged', saved);
			return saved;
		};
		const fromSidecar = async (path: string): Promise<ReturnType<typeof parsePairs>> => {
			const raw = await ctx.sidecar('GET', path);
			try {
				return parsePairs(raw);
			} catch (error) {
				ctx.log.error('unexpected DexScreener payload', { path, error: String(error) });
				throw new ForgeError('DEX_BAD_DATA', 'DexScreener returned unexpected data');
			}
		};

		ctx.ipc.handle('dex:watchlist', () => read());
		ctx.ipc.handle('dex:watch', ({ chainId, pairAddress, symbol }) => {
			const list = read();
			if (list.some((e) => same(e, { chainId, pairAddress }))) return list;
			if (list.length >= 200)
				throw new ForgeError('DEX_WATCHLIST_FULL', 'Watchlist is full (200)');
			return write([...list, { chainId, pairAddress, symbol, addedAt: Date.now() }]);
		});
		ctx.ipc.handle('dex:unwatch', (id) => write(read().filter((e) => !same(e, id))));
		ctx.ipc.handle('dex:quotes', async () => {
			const list = read();
			if (list.length === 0) return [];
			const ids = list.map((e) => `${e.chainId}:${e.pairAddress}`).join(',');
			return fromSidecar(`/dex/pairs?ids=${encodeURIComponent(ids)}`);
		});
		ctx.ipc.handle('dex:pair', async ({ chainId, pairAddress }) => {
			const [pair] = await fromSidecar(
				`/dex/pairs?ids=${encodeURIComponent(`${chainId}:${pairAddress}`)}`,
			);
			return pair ?? null;
		});
		ctx.ipc.handle('dex:search', (q) => fromSidecar(`/dex/search?q=${encodeURIComponent(q)}`));
	},
};
