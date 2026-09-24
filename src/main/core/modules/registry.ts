import {
	isModuleEnabled,
	type ModuleInfo,
	type ModuleManifest,
	toModuleInfo,
} from '@shared/modules/types';

import type { MainModule, MainModuleContext } from './types';

export interface RegistryDeps {
	manifests: readonly ModuleManifest[];
	/** Main-side implementations; modules without one are renderer-only. */
	mainModules: ReadonlyMap<string, MainModule>;
	platform: string;
	getToggles(): Record<string, boolean>;
	setToggles(toggles: Record<string, boolean>): void;
	/** Builds a context whose disposables are pushed into `disposers`. */
	createContext(
		manifest: ModuleManifest,
		disposers: Array<() => void | Promise<void>>,
	): MainModuleContext;
	onError(moduleId: string, phase: 'activate' | 'deactivate', error: unknown): void;
}

interface ActiveModule {
	module: MainModule;
	disposers: Array<() => void | Promise<void>>;
}

export class ModuleRegistry {
	private readonly active = new Map<string, ActiveModule>();

	constructor(private readonly deps: RegistryDeps) {}

	async start(): Promise<void> {
		const toggles = this.deps.getToggles();
		for (const manifest of this.deps.manifests) {
			if (isModuleEnabled(manifest, toggles, this.deps.platform))
				await this.activate(manifest.id);
		}
	}

	list(): ModuleInfo[] {
		const toggles = this.deps.getToggles();
		return this.deps.manifests.map((m) => toModuleInfo(m, toggles, this.deps.platform));
	}

	isActive(id: string): boolean {
		return this.active.has(id);
	}

	async setEnabled(id: string, enabled: boolean): Promise<ModuleInfo[]> {
		const manifest = this.deps.manifests.find((m) => m.id === id);
		if (!manifest) throw new Error(`Unknown module "${id}"`);
		this.deps.setToggles({ ...this.deps.getToggles(), [id]: enabled });

		const shouldRun = isModuleEnabled(manifest, this.deps.getToggles(), this.deps.platform);
		if (shouldRun && !this.active.has(id)) await this.activate(id);
		if (!shouldRun && this.active.has(id)) await this.deactivate(id);
		return this.list();
	}

	async stopAll(): Promise<void> {
		for (const id of [...this.active.keys()].reverse()) await this.deactivate(id);
	}

	private async activate(id: string): Promise<void> {
		const module = this.deps.mainModules.get(id);
		const manifest = this.deps.manifests.find((m) => m.id === id);
		if (!manifest) return;
		const disposers: ActiveModule['disposers'] = [];
		// Renderer-only modules are still tracked as active so the state is consistent.
		if (!module) {
			this.active.set(id, { module: { manifest, activate: () => undefined }, disposers });
			return;
		}
		try {
			await module.activate(this.deps.createContext(manifest, disposers));
			this.active.set(id, { module, disposers });
		} catch (error) {
			await runDisposers(disposers);
			this.deps.onError(id, 'activate', error);
		}
	}

	private async deactivate(id: string): Promise<void> {
		const entry = this.active.get(id);
		if (!entry) return;
		this.active.delete(id);
		try {
			await entry.module.deactivate?.();
		} catch (error) {
			this.deps.onError(id, 'deactivate', error);
		}
		await runDisposers(entry.disposers);
	}
}

async function runDisposers(disposers: Array<() => void | Promise<void>>): Promise<void> {
	for (const dispose of disposers.reverse()) await dispose();
	disposers.length = 0;
}
