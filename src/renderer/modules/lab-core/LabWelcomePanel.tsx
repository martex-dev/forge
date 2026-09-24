import { FlaskConical } from 'lucide-react';
import type { JSX } from 'react';

import { RoomWelcome } from '../../rooms/RoomWelcome';

export function LabWelcomePanel(): JSX.Element {
	return (
		<RoomWelcome
			room='lab'
			icon={FlaskConical}
			heading='Lab'
			tagline='Research and ML: watch training runs live, inspect data, track experiments.'
			items={[
				{
					title: 'forge-probe + Run Monitor',
					detail: 'probe.log(step, loss, acc) → live charts.',
					phase: 1,
				},
				{
					title: 'GPU monitor',
					detail: 'Utilization, VRAM, temperature, power.',
					phase: 1,
				},
				{
					title: 'DataFrame viewer',
					detail: 'CSV / Parquet / Feather via DuckDB + SQL.',
					phase: 4,
				},
				{
					title: 'Notebook runner',
					detail: 'Jupyter kernels with matplotlib output.',
					phase: 4,
				},
				{
					title: 'Experiment comparison',
					detail: 'Side-by-side runs, cv-visualizer, calibrate.',
					phase: 4,
				},
			]}
		/>
	);
}
