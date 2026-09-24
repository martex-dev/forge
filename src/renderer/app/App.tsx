import type { JSX } from 'react';

import { APP_NAME } from '@shared/constants';

export function App(): JSX.Element {
	return <main>{APP_NAME}</main>;
}
