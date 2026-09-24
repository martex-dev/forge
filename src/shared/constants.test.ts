import { describe, expect, it } from 'vitest';

import { APP_NAME } from './constants';

describe('constants', () => {
	it('names the app Forge', () => {
		expect(APP_NAME).toBe('Forge');
	});
});
