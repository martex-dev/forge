import { describe, expect, it } from 'vitest';

import { MANIFESTS } from './index';

describe('module manifests', () => {
	it('discovers the four core room modules', () => {
		expect(MANIFESTS.map((m) => m.id)).toEqual(
			expect.arrayContaining(['build-core', 'trade-core', 'lab-core', 'hub-core']),
		);
	});

	it('have unique ids', () => {
		const ids = MANIFESTS.map((m) => m.id);
		expect(new Set(ids).size).toBe(ids.length);
	});

	it('declare unique secret keys', () => {
		const keys = MANIFESTS.flatMap((m) => m.requiredSecrets ?? []).map((s) => s.key);
		expect(new Set(keys).size).toBe(keys.length);
	});
});
