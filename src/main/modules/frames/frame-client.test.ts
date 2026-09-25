import { describe, expect, it, vi } from 'vitest';

import { ForgeError } from '../../core/errors';
import { FrameClient } from './frame-client';

const PATH = 'C:\\data\\runs.parquet';
const info = (id: string): unknown => ({
	id,
	path: PATH,
	format: 'parquet',
	columns: [{ name: 'loss', type: 'DOUBLE' }],
	row_count: 3,
});

describe('FrameClient', () => {
	it('opens lazily and maps the sidecar info', async () => {
		const sidecar = vi.fn(async (_m: string, path: string) =>
			path === '/frames/open' ? info('a') : { ok: true },
		);
		const client = new FrameClient(sidecar);
		await expect(
			client.call(PATH, (id) => sidecar('POST', `/frames/${id}/rows`)),
		).resolves.toEqual({
			ok: true,
		});
		expect(sidecar.mock.calls.map((c) => c[1])).toEqual(['/frames/open', '/frames/a/rows']);
		await expect(client.open(PATH)).resolves.toMatchObject({ rowCount: 3, format: 'parquet' });
	});

	it('re-opens once when the sidecar forgot the frame (restart)', async () => {
		let opens = 0;
		const sidecar = vi.fn(async (_m: string, path: string) => {
			if (path === '/frames/open') return info(`id${++opens}`);
			if (path === '/frames/id1/rows')
				throw new ForgeError('SIDECAR_HTTP_404', 'FRAME_NOT_FOUND');
			return 'rows';
		});
		const client = new FrameClient(sidecar);
		await expect(
			client.call(PATH, (id) => sidecar('POST', `/frames/${id}/rows`)),
		).resolves.toBe('rows');
		expect(opens).toBe(2);
	});

	it('passes other errors through (e.g. a SQL mistake)', async () => {
		const sidecar = vi.fn(async (_m: string, path: string) => {
			if (path === '/frames/open') return info('a');
			throw new ForgeError('SIDECAR_HTTP_400', 'Binder Error: column "nope" not found');
		});
		const client = new FrameClient(sidecar);
		await expect(
			client.call(PATH, (id) => sidecar('POST', `/frames/${id}/rows`)),
		).rejects.toThrow(/nope/);
		expect(sidecar).toHaveBeenCalledTimes(2);
	});

	it('maps SUMMARIZE rows', async () => {
		const sidecar = vi.fn(async (_m: string, path: string) =>
			path === '/frames/open'
				? info('a')
				: [
						{
							column_name: 'loss',
							column_type: 'DOUBLE',
							min: '0.1',
							max: '1.0',
							approx_unique: 3,
							avg: '0.5',
							std: '0.2',
							q25: '0.2',
							q50: '0.5',
							q75: '0.8',
							count: 3,
							null_percentage: 0,
						},
					],
		);
		const [row] = await new FrameClient(sidecar).summary(PATH);
		expect(row).toMatchObject({ column: 'loss', unique: 3, mean: '0.5', nullPercent: 0 });
	});
});
