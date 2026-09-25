import { Search } from 'lucide-react';
import { type JSX, useEffect, useState } from 'react';

import { Input } from '../../ui/Input';
import { Spinner } from '../../ui/Spinner';
import { openNote } from './use-vault';
import { useSearch } from './use-vault';

const DEBOUNCE_MS = 200;

export function SearchView(): JSX.Element {
	const [text, setText] = useState('');
	const [query, setQuery] = useState('');
	useEffect(() => {
		const id = setTimeout(() => setQuery(text.trim()), DEBOUNCE_MS);
		return () => clearTimeout(id);
	}, [text]);
	const { hits, isFetching, error } = useSearch(query);

	return (
		<div className='flex min-h-0 flex-1 flex-col'>
			<div className='p-2'>
				<Input
					autoFocus
					aria-label='Search notes'
					placeholder='Search all notes…'
					leading={isFetching ? <Spinner size={12} /> : <Search size={12} />}
					value={text}
					onChange={(e) => setText(e.target.value)}
				/>
			</div>
			{error && <p className='px-3 text-12 text-down'>{error.message}</p>}
			{query && !isFetching && hits.length === 0 && !error && (
				<p className='px-3 text-12 text-fg-2'>No notes contain “{query}”.</p>
			)}
			<ul className='min-h-0 flex-1 overflow-y-auto' aria-label='Search results'>
				{hits.map((hit) => (
					<li key={hit.path}>
						<button
							type='button'
							onClick={() => openNote(hit.path)}
							className='w-full border-b border-border/60 px-3 py-1.5 text-left hover:bg-bg-2 focus-visible:shadow-glow focus-visible:outline-none'
							data-search-hit={hit.path}
						>
							<div className='truncate text-13 text-fg-0'>{hit.title}</div>
							{hit.snippet && (
								<div className='line-clamp-2 text-12 text-fg-2'>
									<span className='num text-fg-2'>L{hit.line} </span>
									{hit.snippet}
								</div>
							)}
						</button>
					</li>
				))}
			</ul>
		</div>
	);
}
