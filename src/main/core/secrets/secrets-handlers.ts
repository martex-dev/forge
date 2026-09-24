import { join } from 'node:path';

import { app, safeStorage } from 'electron';

import { MANIFESTS } from '@shared/modules';

import { router } from '../ipc';
import { SecretsService } from './secrets-service';

/** Keys any module manifest declares; e2e runs additionally get a throwaway key. */
function isDeclaredKey(key: string): boolean {
	if (process.env['FORGE_E2E'] === '1' && key === 'e2e.test') return true;
	return MANIFESTS.some((m) => m.requiredSecrets?.some((s) => s.key === key));
}

export function createSecretsService(): SecretsService {
	return new SecretsService(
		join(app.getPath('userData'), 'secrets.json'),
		safeStorage,
		isDeclaredKey,
	);
}

export function registerSecretsHandlers(secrets: SecretsService): void {
	router.handle('secrets:has', (key) => secrets.has(key));
	router.handle('secrets:listSaved', () => secrets.savedKeys());
	router.handle('secrets:set', ({ key, value }) => secrets.set(key, value));
	router.handle('secrets:delete', (key) => secrets.delete(key));
}
