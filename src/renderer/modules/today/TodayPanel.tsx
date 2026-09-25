import type { JSX } from 'react';

import { useNow } from '../../lib/use-now';
import { greeting } from './today-model';
import { AlertsCard, EarningsCard, JournalCard, MacroCard } from './TradeCards';
import { useEnabledModules } from './use-today';
import { BuildCard, InboxCard, LabCard, NotesCard } from './WorkCards';

const dateFmt = new Intl.DateTimeFormat(undefined, {
	weekday: 'long',
	day: 'numeric',
	month: 'long',
});
const clockFmt = new Intl.DateTimeFormat(undefined, {
	hour: '2-digit',
	minute: '2-digit',
	hour12: false,
});

/** The day at a glance, from whatever modules are on. Each card opens its source panel. */
export function TodayPanel(): JSX.Element {
	const now = useNow(30_000);
	const on = useEnabledModules();
	return (
		<div className='flex h-full flex-col overflow-y-auto bg-bg-0 p-4' data-today>
			<header className='mb-4 flex items-baseline gap-3'>
				<h1 className='text-20 font-semibold text-fg-0'>{greeting(now)}, Marto</h1>
				<span className='text-13 text-fg-2'>{dateFmt.format(now)}</span>
				<span className='num ml-auto text-16 text-accent'>{clockFmt.format(now)}</span>
			</header>
			<div className='grid grid-cols-[repeat(auto-fill,minmax(20rem,1fr))] gap-3'>
				<MacroCard enabled={on.has('calendar')} now={now} />
				<EarningsCard enabled={on.has('earnings')} now={now} />
				<JournalCard enabled={on.has('journal')} now={now} />
				<AlertsCard enabled={on.has('alerts')} now={now} />
				<LabCard runsOn={on.has('runs')} gpuOn={on.has('gpu')} now={now} />
				<BuildCard githubOn={on.has('github')} vercelOn={on.has('vercel')} />
				<InboxCard enabled={on.has('inbox')} />
				<NotesCard enabled={on.has('vault')} />
			</div>
		</div>
	);
}
