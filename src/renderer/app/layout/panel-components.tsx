import type { IDockviewPanelProps } from 'dockview-react';
import type { FunctionComponent } from 'react';

import { ALL_PANELS } from '../../modules/registry';
import type { PanelParams } from '../../modules/types';
import { PanelErrorBoundary } from './PanelErrorBoundary';

/**
 * dockview needs a component for every id that might appear in a saved layout,
 * including panels of currently disabled modules, so this covers ALL_PANELS.
 */
export const PANEL_COMPONENTS: Record<
	string,
	FunctionComponent<IDockviewPanelProps<PanelParams>>
> = Object.fromEntries(
	ALL_PANELS.map((def) => {
		const Component = def.component;
		const Wrapped: FunctionComponent<IDockviewPanelProps<PanelParams>> = (props) => (
			<PanelErrorBoundary title={def.title}>
				<Component
					panelId={props.api.id}
					room={def.room}
					params={props.params}
					setParams={(patch) => props.api.updateParameters(patch)}
				/>
			</PanelErrorBoundary>
		);
		Wrapped.displayName = `Panel(${def.id})`;
		return [def.id, Wrapped];
	}),
);
