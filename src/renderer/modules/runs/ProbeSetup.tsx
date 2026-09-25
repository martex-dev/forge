import { Copy, FlaskConical } from 'lucide-react';
import type { JSX } from 'react';

import { toast } from '../../stores/toast-store';
import { IconButton } from '../../ui/IconButton';
import { useProbeSetup } from './use-runs';

function Snippet({ code, label }: { code: string; label: string }): JSX.Element {
	return (
		<div className='relative w-full rounded-sm border border-border bg-bg-2'>
			<pre className='selectable px-3 py-2 pr-9 text-left break-all whitespace-pre-wrap text-12 text-fg-1'>
				{code}
			</pre>
			<IconButton
				label={`Copy ${label}`}
				size='sm'
				icon={<Copy size={12} />}
				className='absolute top-1.5 right-1.5'
				onClick={() =>
					void navigator.clipboard
						.writeText(code)
						.then(() => toast.success('Copied', label))
				}
			/>
		</div>
	);
}

const USAGE = `import forge_probe

probe = forge_probe.run('my-run', config={'lr': 1e-3})
for step in range(epochs):
    probe.log(step=step, loss=loss, acc=acc)
probe.finish()`;

/** Empty state for the Run Monitor: how to get the first run in. */
export function ProbeSetup(): JSX.Element {
	const setup = useProbeSetup();
	const dir = setup?.packageDir ?? 'C:\\path\\to\\forge\\packages\\forge-probe';
	return (
		<div className='mx-auto flex h-full max-w-xl flex-col items-center justify-center gap-3 p-6 text-center'>
			<FlaskConical size={24} className='text-accent' aria-hidden />
			<h2 className='text-14 font-semibold text-fg-0'>No runs yet</h2>
			<p className='text-12 text-fg-2'>
				Install <code className='text-fg-1'>forge-probe</code> into your training
				environment and log metrics; runs appear here live.
			</p>
			<Snippet code={`pip install -e "${dir}"`} label='install command' />
			<Snippet code={USAGE} label='usage example' />
			{setup?.exampleScript && (
				<p className='text-12 text-fg-2'>
					Full PyTorch example:{' '}
					<code className='selectable text-fg-1'>{setup.exampleScript}</code>
				</p>
			)}
		</div>
	);
}
