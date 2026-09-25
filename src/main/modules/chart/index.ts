import { CandleSeriesSchema } from '@shared/ipc/channels/chart';
import { manifest } from '@shared/modules/chart.manifest';

import { ForgeError } from '../../core/errors';
import type { MainModule } from '../../core/modules/types';

const CANDLE_LIMIT = 500;

export const mainModule: MainModule = {
	manifest,
	activate(ctx) {
		ctx.ipc.handle('chart:candles', async ({ source, interval }) => {
			const query = new URLSearchParams({ interval, limit: String(CANDLE_LIMIT) });
			let path: string;
			if (source.kind === 'binance') {
				query.set('symbol', source.symbol);
				path = `/chart/binance?${query.toString()}`;
			} else {
				query.set('chain', source.chainId);
				query.set('pool', source.pairAddress);
				path = `/chart/gecko?${query.toString()}`;
			}
			const parsed = CandleSeriesSchema.safeParse(await ctx.sidecar('GET', path));
			if (!parsed.success) {
				ctx.log.error('unexpected candle payload', { path, issues: parsed.error.message });
				throw new ForgeError(
					'CHART_BAD_DATA',
					'The chart service returned unexpected data',
				);
			}
			return parsed.data;
		});
	},
};
