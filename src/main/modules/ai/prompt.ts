import type { AiContext } from '@shared/ipc/channels/ai';

const BASE = `You are the coding assistant built into Forge, Marto's desktop IDE (Python, TypeScript/React, trading and ML work).
Be direct and concise. When you change code, reply with complete code blocks tagged with their language; Forge shows them with an "Apply" button that opens a diff preview of the result, so prefer returning the full updated selection or file rather than fragments.`;

/** System prompt: Forge's instructions plus every attached context item, clearly delimited. */
export function buildSystem(context: AiContext[]): string {
	if (context.length === 0) return BASE;
	const blocks = context.map((c) => {
		// Longer fences than any in the content keep nested code blocks intact.
		const longest = Math.max(2, ...[...c.text.matchAll(/`+/g)].map((m) => m[0].length));
		const fence = '`'.repeat(longest + 1);
		return `<context kind="${c.kind}" label="${c.label.replace(/"/g, "'")}">\n${fence}${c.language ?? ''}\n${c.text}\n${fence}\n</context>`;
	});
	return `${BASE}\n\nThe user attached this context:\n\n${blocks.join('\n\n')}`;
}
