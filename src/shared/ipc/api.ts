import type { Channel, ChannelInput, ChannelOutput, EventPayload, ForgeEvent } from './contract';
import type { Result } from './result';

/** Internal transport channel names; renderer code never uses these directly. */
export const TRANSPORT = {
	invoke: 'forge:invoke',
	event: 'forge:event',
} as const;

export interface InvokeEnvelope {
	channel: string;
	input: unknown;
}

export interface EventEnvelope {
	event: string;
	payload: unknown;
}

/** Channels whose input accepts undefined (z.void / optional) can be invoked with no argument. */
export type InvokeArgs<C extends Channel> =
	undefined extends ChannelInput<C> ? [input?: ChannelInput<C>] : [input: ChannelInput<C>];

/** Shape of `window.forge`, exposed by the preload script. */
export interface ForgeApi {
	invoke<C extends Channel>(
		channel: C,
		...args: InvokeArgs<C>
	): Promise<Result<ChannelOutput<C>>>;
	on<E extends ForgeEvent>(event: E, handler: (payload: EventPayload<E>) => void): () => void;
	platform: string;
}
