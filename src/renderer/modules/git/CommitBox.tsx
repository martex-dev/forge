import { Check } from 'lucide-react';
import { type JSX, useState } from 'react';

import { Button } from '../../ui/Button';
import { Kbd } from '../../ui/Kbd';

interface CommitBoxProps {
	branch: string | null;
	stagedCount: number;
	busy: boolean;
	onCommit: (message: string) => Promise<boolean>;
}

export function CommitBox({ branch, stagedCount, busy, onCommit }: CommitBoxProps): JSX.Element {
	const [message, setMessage] = useState('');
	const canCommit = message.trim().length > 0 && stagedCount > 0 && !busy;

	const submit = (): void => {
		if (!canCommit) return;
		void onCommit(message.trim()).then((ok) => {
			if (ok) setMessage('');
		});
	};

	return (
		<div className='flex flex-col gap-1.5 p-2'>
			<textarea
				value={message}
				onChange={(e) => setMessage(e.target.value)}
				onKeyDown={(e) => {
					if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
						e.preventDefault();
						submit();
					}
				}}
				rows={3}
				spellCheck
				aria-label='Commit message'
				placeholder={
					branch ? `Message (Ctrl+Enter to commit on ${branch})` : 'Commit message'
				}
				className='selectable w-full resize-y rounded-sm border border-border bg-bg-2 px-2 py-1.5 text-12 text-fg-0 outline-none placeholder:text-fg-2 focus:border-accent focus:shadow-glow'
			/>
			<Button
				variant='primary'
				size='sm'
				icon={<Check size={12} />}
				disabled={!canCommit}
				loading={busy}
				onClick={submit}
				title={stagedCount === 0 ? 'Stage changes first' : undefined}
			>
				Commit{stagedCount > 0 ? ` ${stagedCount} file${stagedCount === 1 ? '' : 's'}` : ''}
				<Kbd keys='Ctrl+Enter' className='ml-1 opacity-70' />
			</Button>
		</div>
	);
}
