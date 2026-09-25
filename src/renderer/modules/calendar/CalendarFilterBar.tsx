import type { JSX } from 'react';

import type { Impact } from '@shared/ipc/channels/calendar';

import { cn } from '../../lib/cn';
import type { CalendarFilters } from './calendar-model';

export const IMPACT_STYLE: Record<Impact, { label: string; dot: string }> = {
	high: { label: 'High', dot: 'bg-down' },
	medium: { label: 'Medium', dot: 'bg-warn' },
	low: { label: 'Low', dot: 'bg-accent-hub' },
	holiday: { label: 'Holiday', dot: 'bg-fg-2' },
	none: { label: 'Other', dot: 'bg-border-strong' },
};

const IMPACT_ORDER: Impact[] = ['high', 'medium', 'low', 'holiday'];

function Chip({
	pressed,
	onClick,
	children,
}: {
	pressed: boolean;
	onClick: () => void;
	children: JSX.Element | string | Array<JSX.Element | string>;
}): JSX.Element {
	return (
		<button
			type='button'
			aria-pressed={pressed}
			onClick={onClick}
			className={cn(
				'num flex h-5 items-center gap-1 rounded-sm border px-1.5 text-11 transition-colors transition-fast',
				'focus-visible:shadow-glow focus-visible:outline-none',
				pressed
					? 'border-accent/50 bg-accent-soft text-fg-0'
					: 'border-border text-fg-2 hover:border-border-strong hover:text-fg-1',
			)}
		>
			{children}
		</button>
	);
}

interface FilterBarProps {
	filters: CalendarFilters;
	currencies: string[];
	onChange: (filters: CalendarFilters) => void;
}

export function CalendarFilterBar({ filters, currencies, onChange }: FilterBarProps): JSX.Element {
	const toggle = <T,>(list: T[], item: T): T[] =>
		list.includes(item) ? list.filter((x) => x !== item) : [...list, item];

	return (
		<div
			className='flex flex-wrap items-center gap-1 border-b border-border px-2 py-1.5'
			role='toolbar'
			aria-label='Calendar filters'
		>
			{IMPACT_ORDER.map((impact) => (
				<Chip
					key={impact}
					pressed={filters.impacts.includes(impact)}
					onClick={() =>
						onChange({ ...filters, impacts: toggle(filters.impacts, impact) })
					}
				>
					<span className={cn('size-1.5 rounded-full', IMPACT_STYLE[impact].dot)} />
					{IMPACT_STYLE[impact].label}
				</Chip>
			))}
			<span className='mx-1 h-4 w-px bg-border' aria-hidden />
			<Chip
				pressed={filters.currencies.length === 0}
				onClick={() => onChange({ ...filters, currencies: [] })}
			>
				All
			</Chip>
			{currencies.map((c) => (
				<Chip
					key={c}
					pressed={filters.currencies.includes(c)}
					onClick={() =>
						onChange({ ...filters, currencies: toggle(filters.currencies, c) })
					}
				>
					{c}
				</Chip>
			))}
		</div>
	);
}
