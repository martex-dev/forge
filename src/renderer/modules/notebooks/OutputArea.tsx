import { type JSX, useMemo } from 'react';

import type { NbOutput } from '@shared/ipc/channels/notebooks';

import { cn } from '../../lib/cn';
import { renderMarkdown } from '../../lib/markdown/markdown';
import { pickMime, stripAnsi } from './notebook-model';

import '../../lib/markdown/markdown.css';

const PRE =
	'selectable num overflow-x-auto px-3 py-1 text-12 leading-5 whitespace-pre-wrap break-words';

function RichOutput({ data }: { data: Record<string, unknown> }): JSX.Element | null {
	const picked = pickMime(data);
	const html = useMemo(() => {
		const p = pickMime(data);
		return p?.mime === 'text/markdown' ? renderMarkdown(p.value) : '';
	}, [data]);
	if (!picked) return null;
	if (picked.mime.startsWith('image/')) {
		const src =
			picked.mime === 'image/svg+xml'
				? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(picked.value)}`
				: `data:${picked.mime};base64,${picked.value.replace(/\s/g, '')}`;
		// An <img> can't run script, so SVG from the kernel is safe here.
		return <img src={src} alt='Output' className='max-w-full bg-fg-0 p-1' />;
	}
	if (picked.mime === 'text/markdown') {
		// markdown-it with html:false: no markup from the output survives.
		return (
			<div
				className='md-preview px-3 py-1 text-13'
				dangerouslySetInnerHTML={{ __html: html }}
			/>
		);
	}
	if (picked.mime === 'text/html') {
		return (
			<p className='px-3 py-1 text-12 text-fg-2'>
				HTML output (not rendered in Forge; it has no plain-text version).
			</p>
		);
	}
	return <pre className={cn(PRE, 'text-fg-0')}>{picked.value}</pre>;
}

export function OutputArea({ outputs }: { outputs: readonly NbOutput[] }): JSX.Element | null {
	if (outputs.length === 0) return null;
	return (
		<div className='max-h-[32rem] overflow-y-auto border-t border-border/60' data-nb-outputs>
			{outputs.map((o, i) => {
				const key = `${o.output_type}-${i}`;
				switch (o.output_type) {
					case 'stream':
						return (
							<pre
								key={key}
								className={cn(
									PRE,
									o.name === 'stderr' ? 'bg-warn-soft text-fg-1' : 'text-fg-0',
								)}
							>
								{stripAnsi(o.text)}
							</pre>
						);
					case 'error':
						return (
							<pre
								key={key}
								className={cn(PRE, 'bg-down-soft text-down')}
								data-nb-error={o.ename}
							>
								{stripAnsi(
									o.traceback.length
										? o.traceback.join('\n')
										: `${o.ename}: ${o.evalue}`,
								)}
							</pre>
						);
					case 'execute_result':
					case 'display_data':
						return <RichOutput key={key} data={o.data} />;
					case 'clear_output':
						return null;
				}
			})}
		</div>
	);
}
