import type { JSX } from 'react';

import { WebviewPanel } from '../../app/webview/WebviewPanel';
import type { PanelProps } from '../types';

export function TradingViewPanel({ panelId, room }: PanelProps): JSX.Element {
	return <WebviewPanel serviceId='tradingview' instanceId={panelId} room={room} />;
}
