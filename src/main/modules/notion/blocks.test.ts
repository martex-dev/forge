import { describe, expect, it } from 'vitest';

import { blocksToMarkdown, pageTitle, richText } from './blocks';

const rt = (plain: string, extra: Record<string, unknown> = {}): unknown[] => [
	{ plain_text: plain, annotations: {}, ...extra },
];
const block = (
	type: string,
	body: Record<string, unknown>,
	children?: unknown[],
): Record<string, unknown> => ({
	type,
	[type]: body,
	...(children ? { children } : {}),
});

describe('notion blocks', () => {
	it('keeps rich text formatting and only http(s) links', () => {
		expect(
			richText([
				{ plain_text: 'bold', annotations: { bold: true } },
				{ plain_text: ' and ' },
				{ plain_text: 'code', annotations: { code: true } },
				{ plain_text: ' link', href: 'https://x.com' },
				{ plain_text: ' bad', href: 'javascript:alert(1)' },
			]),
		).toBe('**bold** and `code`[ link](https://x.com) bad');
	});

	it('renders a page with headings, lists, to-dos, code and nesting', () => {
		const md = blocksToMarkdown([
			block('heading_2', { rich_text: rt('Plan') }),
			block('numbered_list_item', { rich_text: rt('first') }),
			block('numbered_list_item', { rich_text: rt('second') }, [
				block('bulleted_list_item', { rich_text: rt('nested') }),
			]),
			block('to_do', { rich_text: rt('ship'), checked: true }),
			block('code', { rich_text: rt('print(1)'), language: 'python' }),
			block('image', { type: 'file', file: { url: 'https://s3/x.png' }, caption: [] }),
			block('synced_block', {}),
		]);
		expect(md).toBe(
			[
				'## Plan',
				'',
				'1. first\n2. second\n   - nested\n- [x] ship',
				'',
				'```python\nprint(1)\n```',
				'',
				'[image](https://s3/x.png)',
				'',
				'*(synced block not shown)*',
			].join('\n'),
		);
	});

	it('finds the title property whatever it is called', () => {
		expect(pageTitle({ properties: { Name: { type: 'title', title: rt('Journal') } } })).toBe(
			'Journal',
		);
		expect(pageTitle({ properties: {} })).toBe('Untitled');
	});
});
