import { describe, expect, it, vi } from 'vitest';

vi.mock('dockview-react', () => ({}));

import type { PanelDefinition } from '../../modules/types';
import { defaultLayoutOrder, definitionIdOf } from './layout-controller';

const noop = (): null => null;
const def = (id: string, extra: Partial<PanelDefinition> = {}): PanelDefinition => ({
	id,
	title: id,
	room: 'trade',
	component: noop,
	defaultOpen: true,
	...extra,
});

describe('defaultLayoutOrder', () => {
	it('adds centre panels first, then docked, then tab-joined — stable within each pass', () => {
		const order = defaultLayoutOrder([
			def('calendar.week', { position: 'right' }),
			def('trade-core.welcome'),
			def('trade-web.axiom', { tabWith: 'tradingview.chart', defaultOpen: false }),
			def('git.changes', { tabWith: 'explorer.tree', position: 'left' }),
			def('tradingview.chart'),
			def('editor.main', { position: 'tab' }),
		]);
		expect(order.map((d) => d.id)).toEqual([
			'trade-core.welcome',
			'tradingview.chart',
			'editor.main',
			'calendar.week',
			'git.changes',
		]);
	});
});

describe('definitionIdOf', () => {
	it('strips the instance suffix', () => {
		expect(definitionIdOf('terminal.session#3')).toBe('terminal.session');
		expect(definitionIdOf('editor.main')).toBe('editor.main');
	});
});
