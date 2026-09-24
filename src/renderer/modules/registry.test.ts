import { describe, expect, it } from 'vitest';

import { defineManifest } from '@shared/modules/types';

import { commandsFor, panelsFor } from './registry';
import type { RendererModule } from './types';

const noop = (): null => null;

function mod(id: string): RendererModule {
	return {
		manifest: defineManifest({
			id,
			name: id,
			description: '',
			room: 'build',
			defaultEnabled: true,
		}),
		panels: [{ id: `${id}.panel`, title: id, room: 'build', component: noop }],
		commands: [{ id: `${id}.cmd`, title: id, room: 'build', run: () => undefined }],
	};
}

describe('renderer module registry', () => {
	const modules = [mod('a'), mod('b')];

	it('only exposes panels and commands of enabled modules', () => {
		const enabled = new Set(['a']);
		expect(panelsFor(modules, enabled).map((p) => p.id)).toEqual(['a.panel']);
		expect(commandsFor(modules, enabled).map((c) => c.id)).toEqual(['a.cmd']);
	});

	it('removes contributions as soon as a module is disabled', () => {
		expect(panelsFor(modules, new Set(['a', 'b']))).toHaveLength(2);
		expect(panelsFor(modules, new Set(['b'])).map((p) => p.id)).toEqual(['b.panel']);
		expect(commandsFor(modules, new Set())).toEqual([]);
	});
});
