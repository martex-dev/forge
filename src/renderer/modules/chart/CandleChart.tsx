import {
	CandlestickSeries,
	ColorType,
	createChart,
	CrosshairMode,
	HistogramSeries,
	type IChartApi,
	type ISeriesApi,
	TickMarkType,
	type Time,
	type UTCTimestamp,
} from 'lightweight-charts';
import { type JSX, useEffect, useRef, useState } from 'react';

import type { Candle } from '@shared/ipc/channels/chart';

import { formatPrice, formatUsdCompact } from '../../lib/format';
import { resolveToken } from '../../lib/resolve-color';
import {
	formatCrosshairTime,
	formatTick,
	INITIAL_VISIBLE_BARS,
	pricePrecision,
	tailUpdates,
} from './chart-model';

interface Series {
	chart: IChartApi;
	candles: ISeriesApi<'Candlestick'>;
	volume: ISeriesApi<'Histogram'>;
	upVolume: string;
	downVolume: string;
}

const TICK_KIND: Record<TickMarkType, 'year' | 'month' | 'day' | 'time'> = {
	[TickMarkType.Year]: 'year',
	[TickMarkType.Month]: 'month',
	[TickMarkType.DayOfMonth]: 'day',
	[TickMarkType.Time]: 'time',
	[TickMarkType.TimeWithSeconds]: 'time',
};
const seconds = (t: Time): number => (typeof t === 'number' ? t : 0);

function createSeries(el: HTMLElement): Series {
	const border = resolveToken('--border');
	const up = resolveToken('--up');
	const down = resolveToken('--down');
	const chart = createChart(el, {
		autoSize: true,
		layout: {
			background: { type: ColorType.Solid, color: resolveToken('--bg-1') },
			textColor: resolveToken('--text-2'),
			fontFamily: 'JetBrains Mono, monospace',
			fontSize: 11,
		},
		grid: { vertLines: { color: border }, horzLines: { color: border } },
		crosshair: { mode: CrosshairMode.Normal },
		rightPriceScale: { borderColor: border, scaleMargins: { top: 0.08, bottom: 0.24 } },
		timeScale: {
			borderColor: border,
			timeVisible: true,
			secondsVisible: false,
			tickMarkFormatter: (t: Time, kind: TickMarkType) =>
				formatTick(seconds(t), TICK_KIND[kind]),
		},
		localization: { timeFormatter: (t: Time) => formatCrosshairTime(seconds(t)) },
	});
	const candles = chart.addSeries(CandlestickSeries, {
		upColor: up,
		downColor: down,
		wickUpColor: up,
		wickDownColor: down,
		borderVisible: false,
	});
	// Volume shares the pane on its own hidden scale, squeezed into the bottom fifth.
	const volume = chart.addSeries(HistogramSeries, {
		priceScaleId: '',
		priceFormat: { type: 'volume' },
		lastValueVisible: false,
		priceLineVisible: false,
	});
	volume.priceScale().applyOptions({ scaleMargins: { top: 0.8, bottom: 0 } });
	return {
		chart,
		candles,
		volume,
		upVolume: resolveToken('--up-soft'),
		downVolume: resolveToken('--down-soft'),
	};
}

interface CandleChartProps {
	candles: Candle[];
	/** Changes when symbol/pool or interval changes: redraw and scroll to the latest bars. */
	seriesKey: string;
}

export function CandleChart({ candles, seriesKey }: CandleChartProps): JSX.Element {
	const hostRef = useRef<HTMLDivElement>(null);
	const seriesRef = useRef<Series | null>(null);
	const shownRef = useRef<{ key: string; candles: Candle[] }>({ key: '', candles: [] });
	const byTimeRef = useRef(new Map<number, Candle>());
	const [hover, setHover] = useState<Candle | null>(null);

	useEffect(() => {
		const el = hostRef.current;
		if (!el) return;
		const series = createSeries(el);
		seriesRef.current = series;
		series.chart.subscribeCrosshairMove((param) => {
			setHover(param.time ? (byTimeRef.current.get(seconds(param.time)) ?? null) : null);
		});
		return () => {
			series.chart.remove();
			seriesRef.current = null;
			shownRef.current = { key: '', candles: [] };
		};
	}, []);

	useEffect(() => {
		const s = seriesRef.current;
		if (!s) return;
		const toBar = (c: Candle): { time: UTCTimestamp } & Omit<Candle, 'time' | 'volume'> => ({
			time: c.time as UTCTimestamp,
			open: c.open,
			high: c.high,
			low: c.low,
			close: c.close,
		});
		const toVolume = (c: Candle): { time: UTCTimestamp; value: number; color: string } => ({
			time: c.time as UTCTimestamp,
			value: c.volume,
			color: c.close >= c.open ? s.upVolume : s.downVolume,
		});

		const last = candles.at(-1);
		if (last) {
			const precision = pricePrecision(last.close);
			s.candles.applyOptions({
				priceFormat: { type: 'custom', minMove: 10 ** -precision, formatter: formatPrice },
			});
		}
		byTimeRef.current = new Map(candles.map((c) => [c.time, c]));

		const shown = shownRef.current;
		const tail = shown.key === seriesKey ? tailUpdates(shown.candles, candles) : null;
		if (tail) {
			for (const c of tail) {
				s.candles.update(toBar(c));
				s.volume.update(toVolume(c));
			}
		} else {
			s.candles.setData(candles.map(toBar));
			s.volume.setData(candles.map(toVolume));
			if (shown.key !== seriesKey) {
				s.chart.timeScale().setVisibleLogicalRange({
					from: Math.max(0, candles.length - INITIAL_VISIBLE_BARS),
					to: candles.length + 3,
				});
			}
		}
		shownRef.current = { key: seriesKey, candles };
	}, [candles, seriesKey]);

	const legend = hover ?? candles.at(-1) ?? null;
	return (
		<div className='relative h-full min-h-0 w-full' data-chart={seriesKey}>
			<div ref={hostRef} className='absolute inset-0' />
			{legend && (
				<div
					className='num pointer-events-none absolute left-2 top-1.5 z-10 flex gap-2 text-11 text-fg-2'
					aria-hidden
				>
					{(['open', 'high', 'low', 'close'] as const).map((k) => (
						<span key={k}>
							{k[0]?.toUpperCase()}{' '}
							<span className={legend.close >= legend.open ? 'text-up' : 'text-down'}>
								{formatPrice(legend[k])}
							</span>
						</span>
					))}
					<span>
						V <span className='text-fg-1'>{formatUsdCompact(legend.volume)}</span>
					</span>
				</div>
			)}
		</div>
	);
}
