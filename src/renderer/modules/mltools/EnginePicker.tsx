import { useQuery } from '@tanstack/react-query';
import type { JSX } from 'react';

import type { MlEngine } from '@shared/ipc/channels/mltools';

import { SIDECAR_META } from '../../app/hooks/use-sidecar-recovery';
import { call } from '../../lib/ipc';
import { Select } from '../../ui/Select';

const BUNDLED = '__bundled__';
const PICK = '__python__';

export function engineKey(engine: MlEngine): string {
	if (engine.kind === 'bundled') return BUNDLED;
	return 'spec' in engine ? `spec:${engine.spec}` : `python:${engine.python}`;
}

/** Bundled libraries, a registered kernel, or any interpreter with the libraries installed. */
export function EnginePicker({
	engine,
	onChange,
}: {
	engine: MlEngine;
	onChange: (engine: MlEngine) => void;
}): JSX.Element {
	const specs = useQuery({
		queryKey: ['ml', 'kernelspecs'],
		queryFn: () => call('ml:kernelspecs'),
		meta: SIDECAR_META,
		staleTime: 60_000,
	});
	const current = engineKey(engine);
	const options = [
		{ value: BUNDLED, label: 'Forge (bundled libraries)' },
		...(specs.data ?? []).map((s) => ({
			value: `spec:${s.name}`,
			label: `Kernel: ${s.displayName}`,
		})),
		...(engine.kind === 'env' && 'python' in engine
			? [{ value: current, label: engine.python }]
			: []),
		{ value: PICK, label: 'Python interpreter…' },
	];
	return (
		<Select
			aria-label='Engine'
			className='h-6 min-w-56'
			value={current}
			onValueChange={(v) => {
				if (v === BUNDLED) onChange({ kind: 'bundled' });
				else if (v.startsWith('spec:')) onChange({ kind: 'env', spec: v.slice(5) });
				else if (v === PICK)
					void call('ml:pickPython').then(
						(python) => python && onChange({ kind: 'env', python }),
					);
			}}
			options={options}
		/>
	);
}
