import { KeyRound } from 'lucide-react';
import { type JSX, useState } from 'react';

import {
	type EarningsSettings,
	type EarningsSource,
	MarketCalendarUrlSchema,
} from '@shared/ipc/channels/earnings';

import { commandContext } from '../../app/commands/use-commands';
import { Button } from '../../ui/Button';
import { Dialog } from '../../ui/Dialog';
import { Input } from '../../ui/Input';
import { Select } from '../../ui/Select';
import { Switch } from '../../ui/Switch';
import { useSaveEarningsSettings } from './use-earnings';

const SOURCES: Array<{ value: EarningsSource; label: string; help: string }> = [
	{
		value: 'nasdaq',
		label: 'NASDAQ (no key)',
		help: 'NASDAQ’s public calendar, as in Market Calendar. Market-cap impact tiers, EPS consensus. Unofficial endpoint: expect the odd outage (cached days keep showing).',
	},
	{
		value: 'finnhub',
		label: 'Finnhub (API key)',
		help: 'Official API with EPS actuals after the report. No company names or market caps, so impact is index membership only.',
	},
	{
		value: 'market-calendar',
		label: 'Market Calendar (your deployment)',
		help: 'Reads GET <url>/api/events?kind=earnings&start&end from your Market Calendar app. Its own index filter and impact ranking apply.',
	},
];

export function EarningsSettingsDialog({
	open,
	onOpenChange,
	initial,
	hasFinnhubKey,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	initial: EarningsSettings;
	hasFinnhubKey: boolean;
}): JSX.Element {
	const [draft, setDraft] = useState(initial);
	const save = useSaveEarningsSettings();
	const url = MarketCalendarUrlSchema.safeParse(draft.marketCalendarUrl);
	const urlError =
		draft.source === 'market-calendar' && (!url.success || draft.marketCalendarUrl === '')
			? url.success
				? 'Required for this source'
				: (url.error.issues[0]?.message ?? 'Invalid URL')
			: null;
	const help = SOURCES.find((s) => s.value === draft.source)?.help;

	return (
		<Dialog
			open={open}
			onOpenChange={onOpenChange}
			title='Earnings source'
			description='Where the Earnings panel gets its data. Keys stay in Settings → Secrets.'
			footer={
				<>
					<Button variant='ghost' onClick={() => onOpenChange(false)}>
						Cancel
					</Button>
					<Button
						variant='primary'
						disabled={urlError !== null}
						loading={save.isPending}
						onClick={() => save.mutate(draft, { onSuccess: () => onOpenChange(false) })}
					>
						Save
					</Button>
				</>
			}
		>
			<div className='flex flex-col gap-3 p-4' data-earnings-settings>
				<label className='flex flex-col gap-1'>
					<span className='text-12 text-fg-1'>Source</span>
					<Select
						aria-label='Earnings source'
						value={draft.source}
						onValueChange={(v) => setDraft({ ...draft, source: v as EarningsSource })}
						options={SOURCES.map(({ value, label }) => ({ value, label }))}
					/>
				</label>
				{help && <p className='text-12 text-fg-2'>{help}</p>}
				{draft.source === 'finnhub' && (
					<div className='flex items-center gap-2 rounded-sm border border-border bg-bg-2 px-3 py-2 text-12'>
						<KeyRound size={13} className={hasFinnhubKey ? 'text-up' : 'text-warn'} />
						<span className='flex-1 text-fg-1'>
							{hasFinnhubKey ? 'Finnhub key saved.' : 'No Finnhub key yet.'}
						</span>
						<Button
							size='sm'
							variant='ghost'
							onClick={() => {
								onOpenChange(false);
								commandContext.openSettings('secrets');
							}}
						>
							{hasFinnhubKey ? 'Change' : 'Add in Secrets'}
						</Button>
					</div>
				)}
				{draft.source === 'market-calendar' && (
					<label className='flex flex-col gap-1'>
						<span className='text-12 text-fg-1'>Market Calendar URL</span>
						<Input
							value={draft.marketCalendarUrl}
							invalid={urlError !== null}
							placeholder='https://market-calendar.vercel.app'
							onChange={(e) =>
								setDraft({ ...draft, marketCalendarUrl: e.target.value })
							}
							aria-label='Market Calendar URL'
						/>
						{urlError && <span className='text-11 text-down'>{urlError}</span>}
					</label>
				)}
				<label className='flex items-center gap-3'>
					<Switch
						checked={draft.indexOnly}
						disabled={draft.source === 'market-calendar'}
						onCheckedChange={(indexOnly) => setDraft({ ...draft, indexOnly })}
						aria-label='S&P 500 and Nasdaq-100 only'
					/>
					<span className='text-12 text-fg-1'>
						S&amp;P 500 and Nasdaq-100 only
						<span className='block text-11 text-fg-2'>
							Off shows every US company reporting (hundreds a day).
						</span>
					</span>
				</label>
			</div>
		</Dialog>
	);
}
