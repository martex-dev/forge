import type { JSX } from 'react';

import { Toaster } from '../ui/Toast';
import { TooltipProvider } from '../ui/Tooltip';
import { DesignPlayground } from './DesignPlayground';

// TODO(phase-0): replaced by the app shell in step 0.6.
export function App(): JSX.Element {
	return (
		<TooltipProvider>
			<DesignPlayground />
			<Toaster />
		</TooltipProvider>
	);
}
