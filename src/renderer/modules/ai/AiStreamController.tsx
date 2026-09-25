import { useForgeEvent } from '../../lib/use-forge-event';
import { useChat } from './chat-store';

/**
 * Headless (module overlay): routes streamed replies into the chat store even while the chat
 * panel is a hidden tab and unmounted, so nothing is lost mid-answer.
 */
export function AiStreamController(): null {
	useForgeEvent('ai:delta', ({ requestId, text }) => useChat.getState().onDelta(requestId, text));
	useForgeEvent('ai:done', ({ requestId, inputTokens, outputTokens, cancelled }) =>
		useChat.getState().onDone(requestId, { inputTokens, outputTokens }, cancelled),
	);
	useForgeEvent('ai:error', ({ requestId, message }) =>
		useChat.getState().onError(requestId, message),
	);
	return null;
}
