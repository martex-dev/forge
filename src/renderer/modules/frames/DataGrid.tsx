import { ArrowDown, ArrowUp } from 'lucide-react';
import {
	type JSX,
	type KeyboardEvent,
	useEffect,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
} from 'react';

import type { FrameQuery } from '@shared/ipc/channels/frames';

import { cn } from '../../lib/cn';
import { toast } from '../../stores/toast-store';
import { ErrorState } from '../../ui/ErrorState';
import { Spinner } from '../../ui/Spinner';
import {
	columnWidth,
	formatCell,
	isNumericType,
	nextSort,
	ROW_HEIGHT,
	visibleRange,
} from './frame-model';
import { useRows } from './use-frame';

interface DataGridProps {
	path: string;
	query: FrameQuery;
	version: number;
	onSortChange: (sort: FrameQuery['sort']) => void;
	onTotal?: (total: number | null, fetching: boolean) => void;
}

/**
 * Keyed by query in the parent, so a new query starts fresh (top, no selection).
 *
 * Virtualized: only the rows in view (plus overscan) are in the DOM, fetched in blocks, so a
 * 50-million-row Parquet file scrolls like a 50-row one.
 */
export function DataGrid({
	path,
	query,
	version,
	onSortChange,
	onTotal,
}: DataGridProps): JSX.Element {
	const scrollRef = useRef<HTMLDivElement>(null);
	const [scrollTop, setScrollTop] = useState(0);
	const [viewport, setViewport] = useState(600);
	const [selected, setSelected] = useState<{ row: number; col: number } | null>(null);
	// Unclamped: the total arrives with the first page. At worst one block past the end is asked
	// for, and comes back empty.
	const range = useMemo(
		() => visibleRange(scrollTop, viewport, Number.MAX_SAFE_INTEGER),
		[scrollTop, viewport],
	);
	const rows = useRows(path, query, range, version);
	const total = rows.total ?? 0;

	useEffect(() => onTotal?.(rows.total, rows.fetching), [rows.total, rows.fetching, onTotal]);

	useLayoutEffect(() => {
		const el = scrollRef.current;
		if (!el) return;
		const observer = new ResizeObserver(() => setViewport(el.clientHeight));
		observer.observe(el);
		return () => observer.disconnect();
	}, []);

	const columns = useMemo(() => rows.columns ?? [], [rows.columns]);
	const widths = useMemo(() => columns.map(columnWidth), [columns]);
	const gutter = Math.max(48, String(total).length * 8 + 20);
	const width = gutter + widths.reduce((a, b) => a + b, 0);

	const move = (e: KeyboardEvent): void => {
		if (!columns.length || !total) return;
		const cur = selected ?? { row: 0, col: 0 };
		const page = Math.max(1, Math.floor(viewport / ROW_HEIGHT) - 1);
		const delta: Record<string, [number, number]> = {
			ArrowDown: [1, 0],
			ArrowUp: [-1, 0],
			ArrowLeft: [0, -1],
			ArrowRight: [0, 1],
			PageDown: [page, 0],
			PageUp: [-page, 0],
		};
		if (e.key === 'c' && e.ctrlKey && selected) {
			const value = rows.row(selected.row)?.[selected.col];
			void navigator.clipboard
				.writeText(formatCell(value))
				.catch(() => toast.error('Could not copy the cell'));
			e.preventDefault();
			return;
		}
		const d = e.key === 'Home' ? [-cur.row, 0] : e.key === 'End' ? [total, 0] : delta[e.key];
		if (!d) return;
		e.preventDefault();
		const next = {
			row: Math.min(total - 1, Math.max(0, cur.row + (d[0] ?? 0))),
			col: Math.min(columns.length - 1, Math.max(0, cur.col + (d[1] ?? 0))),
		};
		setSelected(next);
		const el = scrollRef.current;
		if (!el) return;
		const top = next.row * ROW_HEIGHT;
		if (top < el.scrollTop) el.scrollTop = top;
		else if (top + 2 * ROW_HEIGHT > el.scrollTop + el.clientHeight) {
			el.scrollTop = top + 2 * ROW_HEIGHT - el.clientHeight;
		}
	};

	if (rows.error) {
		return <ErrorState title='Query failed' message={rows.error.message} className='flex-1' />;
	}
	if (rows.total === null) {
		return (
			<div className='flex flex-1 items-center justify-center'>
				<Spinner label='Loading rows' />
			</div>
		);
	}

	const end = Math.min(range.end, total);
	const visible = Array.from(
		{ length: Math.max(0, end - range.start) },
		(_, i) => range.start + i,
	);
	return (
		<div
			ref={scrollRef}
			tabIndex={0}
			role='grid'
			aria-rowcount={total + 1}
			aria-colcount={columns.length}
			aria-label='Rows'
			onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
			onKeyDown={move}
			className='selectable min-h-0 flex-1 overflow-auto focus-visible:shadow-glow focus-visible:outline-none'
			data-frame-grid
		>
			<div style={{ width, minWidth: '100%' }}>
				<div
					role='row'
					className='sticky top-0 z-[1] flex border-b border-border-strong bg-bg-2 text-11'
					style={{ height: ROW_HEIGHT }}
				>
					<span className='shrink-0 border-r border-border' style={{ width: gutter }} />
					{columns.map((c, i) => {
						const s = query.sort.find((k) => k.column === c.name);
						return (
							<button
								key={c.name}
								type='button'
								role='columnheader'
								aria-sort={s ? (s.desc ? 'descending' : 'ascending') : 'none'}
								title={`${c.name} · ${c.type}\nClick to sort, Shift+click to add`}
								onClick={(e) =>
									onSortChange(nextSort(query.sort, c.name, e.shiftKey))
								}
								className={cn(
									'flex shrink-0 items-center gap-1 truncate border-r border-border px-2 hover:bg-bg-3 focus-visible:shadow-glow focus-visible:outline-none',
									isNumericType(c.type) && 'justify-end',
								)}
								style={{ width: widths[i] }}
							>
								<span className='truncate font-medium text-fg-0'>{c.name}</span>
								<span className='num shrink-0 text-fg-2'>
									{c.type.toLowerCase()}
								</span>
								{s &&
									(s.desc ? (
										<ArrowDown size={11} className='shrink-0 text-accent' />
									) : (
										<ArrowUp size={11} className='shrink-0 text-accent' />
									))}
							</button>
						);
					})}
				</div>
				<div className='relative' style={{ height: total * ROW_HEIGHT }}>
					{visible.map((r) => {
						const row = rows.row(r);
						return (
							<div
								key={r}
								role='row'
								aria-rowindex={r + 2}
								className='absolute left-0 flex border-b border-border/50 text-12 hover:bg-bg-3/60'
								style={{ top: r * ROW_HEIGHT, height: ROW_HEIGHT, width }}
							>
								<span
									className='num shrink-0 border-r border-border px-2 text-right leading-6 text-fg-2'
									style={{ width: gutter }}
								>
									{r + 1}
								</span>
								{columns.map((c, ci) => {
									const value = row?.[ci];
									const isSel = selected?.row === r && selected.col === ci;
									return (
										<span
											key={c.name}
											role='gridcell'
											onClick={() => setSelected({ row: r, col: ci })}
											className={cn(
												'shrink-0 truncate border-r border-border/50 px-2 leading-6',
												isNumericType(c.type)
													? 'num text-right'
													: 'text-fg-0',
												value === null && 'text-fg-2 italic',
												isSel &&
													'bg-accent-soft outline outline-1 -outline-offset-1 outline-accent',
												!row && 'text-fg-2',
											)}
											style={{ width: widths[ci] }}
											title={row ? formatCell(value) : undefined}
										>
											{row
												? value === null
													? 'null'
													: formatCell(value)
												: '…'}
										</span>
									);
								})}
							</div>
						);
					})}
				</div>
			</div>
		</div>
	);
}
