import { z } from 'zod';

import { type FrameInfo, FrameInfoSchema, type FrameSummaryRow } from '@shared/ipc/channels/frames';

import { ForgeError } from '../../core/errors';

type Sidecar = (
	method: 'GET' | 'POST' | 'DELETE',
	path: string,
	body?: unknown,
) => Promise<unknown>;

const SidecarInfo = z.object({
	id: z.string(),
	path: z.string(),
	format: FrameInfoSchema.shape.format,
	columns: FrameInfoSchema.shape.columns,
	row_count: z.number().int(),
});

const Stat = z.union([z.string(), z.number()]).nullable().optional();
const SidecarSummary = z.array(
	z.object({
		column_name: z.string(),
		column_type: z.string(),
		min: Stat,
		max: Stat,
		approx_unique: Stat,
		avg: Stat,
		std: Stat,
		q25: Stat,
		q50: Stat,
		q75: Stat,
		count: Stat,
		null_percentage: Stat,
	}),
);

const isGone = (error: unknown): boolean =>
	error instanceof ForgeError &&
	error.code === 'SIDECAR_HTTP_404' &&
	error.message === 'FRAME_NOT_FOUND';

/**
 * The renderer knows frames by path; the sidecar by id. Ids die with the sidecar (restart, crash)
 * or when it evicts old frames, so a call on a vanished id re-opens the path once and retries.
 */
export class FrameClient {
	private readonly ids = new Map<string, string>();

	constructor(private readonly sidecar: Sidecar) {}

	async open(path: string): Promise<FrameInfo> {
		const raw = SidecarInfo.parse(await this.sidecar('POST', '/frames/open', { path }));
		this.ids.set(path, raw.id);
		return {
			path: raw.path,
			format: raw.format,
			columns: raw.columns,
			rowCount: raw.row_count,
		};
	}

	async call(path: string, run: (id: string) => Promise<unknown>): Promise<unknown> {
		let id = this.ids.get(path);
		if (!id) {
			await this.open(path);
			id = this.ids.get(path);
		}
		try {
			return await run(id ?? '');
		} catch (error) {
			if (!isGone(error)) throw error;
			await this.open(path);
			return run(this.ids.get(path) ?? '');
		}
	}

	async summary(path: string): Promise<FrameSummaryRow[]> {
		const rows = SidecarSummary.parse(
			await this.call(path, (id) => this.sidecar('GET', `/frames/${id}/summary`)),
		);
		return rows.map((r) => ({
			column: r.column_name,
			type: r.column_type,
			min: r.min ?? null,
			max: r.max ?? null,
			unique: r.approx_unique ?? null,
			mean: r.avg ?? null,
			std: r.std ?? null,
			q25: r.q25 ?? null,
			q50: r.q50 ?? null,
			q75: r.q75 ?? null,
			count: r.count ?? null,
			nullPercent: r.null_percentage ?? null,
		}));
	}

	async close(path: string): Promise<void> {
		const id = this.ids.get(path);
		this.ids.delete(path);
		if (id) await this.sidecar('DELETE', `/frames/${id}`).catch(() => undefined);
	}
}
