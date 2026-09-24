import { Component, type ErrorInfo, type ReactNode } from 'react';

import { rlog } from '../../lib/log';
import { ErrorState } from '../../ui/ErrorState';

interface Props {
	title: string;
	children: ReactNode;
}

interface State {
	error: Error | null;
}

/** A crashing panel shows an error state instead of taking down the whole room. */
export class PanelErrorBoundary extends Component<Props, State> {
	override state: State = { error: null };

	static getDerivedStateFromError(error: Error): State {
		return { error };
	}

	override componentDidCatch(error: Error, info: ErrorInfo): void {
		rlog.error('panel', `${this.props.title} crashed\n${info.componentStack ?? ''}`, error);
	}

	override render(): ReactNode {
		if (this.state.error) {
			return (
				<ErrorState
					title={`${this.props.title} crashed`}
					message={this.state.error.message}
					onRetry={() => this.setState({ error: null })}
				/>
			);
		}
		return this.props.children;
	}
}
