import { ImagePlus, X } from 'lucide-react';
import { type JSX, useState } from 'react';

import { Button } from '../../ui/Button';
import { Dialog } from '../../ui/Dialog';
import { IconButton } from '../../ui/IconButton';
import { Spinner } from '../../ui/Spinner';
import { useImage } from './use-journal';

function Thumb({
	entryId,
	file,
	onOpen,
	onRemove,
}: {
	entryId: string;
	file: string;
	onOpen: () => void;
	onRemove: () => void;
}): JSX.Element {
	const src = useImage(entryId, file);
	return (
		<li className='group relative size-24 overflow-hidden rounded-sm border border-border bg-bg-2'>
			{src.data ? (
				<button
					type='button'
					className='size-full focus-visible:shadow-glow focus-visible:outline-none'
					aria-label='View screenshot'
					onClick={onOpen}
				>
					<img src={src.data} alt='Screenshot' className='size-full object-cover' />
				</button>
			) : src.isError ? (
				<span className='flex size-full items-center justify-center p-1 text-center text-11 text-down'>
					Missing
				</span>
			) : (
				<span className='flex size-full items-center justify-center'>
					<Spinner size={12} />
				</span>
			)}
			<IconButton
				label='Remove screenshot'
				size='sm'
				icon={<X size={11} />}
				className='absolute top-0.5 right-0.5 bg-bg-1/80 opacity-0 group-hover:opacity-100 focus-visible:opacity-100'
				onClick={onRemove}
			/>
		</li>
	);
}

function Lightbox({ entryId, file }: { entryId: string; file: string }): JSX.Element {
	const src = useImage(entryId, file);
	return src.data ? (
		<img src={src.data} alt='Screenshot' className='max-h-[70vh] w-full object-contain' />
	) : (
		<Spinner />
	);
}

export function JournalImages({
	entryId,
	images,
	busy,
	onAdd,
	onRemove,
}: {
	entryId: string;
	images: string[];
	busy: boolean;
	onAdd: () => void;
	onRemove: (file: string) => void;
}): JSX.Element {
	const [open, setOpen] = useState<string | null>(null);
	return (
		<section aria-label='Screenshots' className='flex flex-col gap-2'>
			<div className='flex items-center gap-2'>
				<h3 className='text-12 font-medium text-fg-1'>Screenshots</h3>
				<span className='text-11 text-fg-2'>Paste with Ctrl+V anywhere in the entry</span>
				<Button
					size='sm'
					variant='ghost'
					className='ml-auto'
					icon={busy ? <Spinner size={12} /> : <ImagePlus size={12} />}
					disabled={busy}
					onClick={onAdd}
				>
					Add images
				</Button>
			</div>
			{images.length > 0 && (
				<ul className='flex flex-wrap gap-2' data-journal-images>
					{images.map((file) => (
						<Thumb
							key={file}
							entryId={entryId}
							file={file}
							onOpen={() => setOpen(file)}
							onRemove={() => onRemove(file)}
						/>
					))}
				</ul>
			)}
			<Dialog
				open={open !== null}
				onOpenChange={(o) => !o && setOpen(null)}
				title='Screenshot'
				width='lg'
			>
				{open && <Lightbox entryId={entryId} file={open} />}
			</Dialog>
		</section>
	);
}
