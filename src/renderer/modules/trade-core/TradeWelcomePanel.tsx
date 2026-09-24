import { CandlestickChart } from 'lucide-react';
import type { JSX } from 'react';

import { RoomWelcome } from '../../rooms/RoomWelcome';

export function TradeWelcomePanel(): JSX.Element {
	return (
		<RoomWelcome
			room='trade'
			icon={CandlestickChart}
			heading='Trade'
			tagline='Market awareness and monitoring. Read-only by default.'
			items={[
				{
					title: 'Economic calendar',
					detail: 'Forex Factory feed, impact filters, countdown.',
					phase: 1,
				},
				{
					title: 'DexScreener watchlist',
					detail: 'Price, liquidity, volume, FDV with flashes.',
					phase: 1,
				},
				{
					title: 'Charts + webview tabs',
					detail: 'TradingView, Axiom, Fomo, Forex Factory.',
					phase: 1,
				},
				{
					title: 'MT5 read-only',
					detail: 'Account, positions, live P/L, history.',
					phase: 3,
				},
				{
					title: 'Solana wallet watch',
					detail: 'Public address only, never keys.',
					phase: 3,
				},
				{
					title: 'Alerts + trade journal',
					detail: 'Price/calendar alerts, journal stats.',
					phase: 3,
				},
			]}
		/>
	);
}
