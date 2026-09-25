import { defineManifest } from './types';

export const manifest = defineManifest({
	id: 'frames',
	name: 'DataFrame Viewer',
	description:
		'Open CSV, Parquet, JSON and Feather files with DuckDB: virtualized grid, sort, filter, SQL, column stats and histograms.',
	room: 'lab',
	defaultEnabled: true,
});
