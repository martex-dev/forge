import { GitBranch } from 'lucide-react';
import type { JSX } from 'react';

import { commandContext } from '../../app/commands/use-commands';
import { useGitStatus } from './use-git';

/** Branch · pending changes · ahead/behind, in the status bar. Click opens Source Control. */
export function GitStatusItem(): JSX.Element | null {
	const { status } = useGitStatus();
	if (!status?.isRepo) return null;
	const changes = status.staged.length + status.unstaged.length;
	return (
		<button
			type='button'
			onClick={() => commandContext.openPanel('git.changes')}
			title={`${status.branch ?? 'detached'}${status.tracking ? ` → ${status.tracking}` : ''} · ${changes} change(s)`}
			className='num flex items-center gap-1 rounded-sm px-1 text-fg-1 hover:bg-bg-3 hover:text-fg-0 focus-visible:shadow-glow focus-visible:outline-none'
			data-git-branch={status.branch ?? ''}
		>
			<GitBranch size={12} />
			<span>{status.branch ?? '(detached)'}</span>
			{changes > 0 && <span className='text-warn'>*{changes}</span>}
			{status.behind > 0 && <span>↓{status.behind}</span>}
			{status.ahead > 0 && <span>↑{status.ahead}</span>}
		</button>
	);
}
