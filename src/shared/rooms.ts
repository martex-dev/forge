import { z } from 'zod';

export const RoomIdSchema = z.enum(['build', 'trade', 'lab', 'hub']);
export type RoomId = z.infer<typeof RoomIdSchema>;

export interface RoomDefinition {
	id: RoomId;
	name: string;
	shortcut: string;
	description: string;
}

export const ROOMS: readonly RoomDefinition[] = [
	{ id: 'build', name: 'Build', shortcut: 'Ctrl+1', description: 'Write, run, ship code' },
	{
		id: 'trade',
		name: 'Trade',
		shortcut: 'Ctrl+2',
		description: 'Market awareness and monitoring',
	},
	{ id: 'lab', name: 'Lab', shortcut: 'Ctrl+3', description: 'Research and ML' },
	{ id: 'hub', name: 'Hub', shortcut: 'Ctrl+4', description: 'Knowledge and comms' },
];
