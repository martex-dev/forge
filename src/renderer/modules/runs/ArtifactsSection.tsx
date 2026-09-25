import { useQuery } from '@tanstack/react-query';
import type { JSX } from 'react';

import type { RunDetail } from '@shared/ipc/channels/lab';

import { SIDECAR_META } from '../../app/hooks/use-sidecar-recovery';
import { call } from '../../lib/ipc';
import { ErrorState } from '../../ui/ErrorState';
import { CalibrationView } from '../../ui/ml/CalibrationView';
import { CvFoldsView } from '../../ui/ml/CvFoldsView';
import { Spinner } from '../../ui/Spinner';

type Info = RunDetail['artifacts'][number];

function ArtifactView({ runId, info }: { runId: string; info: Info }): JSX.Element {
	const artifact = useQuery({
		// createdAt in the key: logging the same name again replaces it, and the view follows.
		queryKey: ['runs', 'artifact', runId, info.kind, info.name, info.createdAt],
		queryFn: () => call('runs:artifact', { id: runId, kind: info.kind, name: info.name }),
		meta: SIDECAR_META,
		staleTime: Infinity,
	});
	if (artifact.isPending) {
		return (
			<div className='flex h-24 items-center justify-center'>
				<Spinner label={`Loading ${info.name}`} />
			</div>
		);
	}
	if (artifact.isError) {
		return <ErrorState title={`${info.name} unavailable`} message={artifact.error.message} />;
	}
	const a = artifact.data;
	return a.kind === 'cv_folds' ? (
		<CvFoldsView name={info.name} data={a.data} />
	) : (
		<CalibrationView name={info.name} data={a.data} />
	);
}

/** CV folds and calibration logged by the script (probe.log_cv / probe.log_calibration). */
export function ArtifactsSection({
	detail,
}: {
	detail: RunDetail | undefined;
}): JSX.Element | null {
	if (!detail || detail.artifacts.length === 0) return null;
	return (
		<div className='mt-3 flex flex-col gap-2'>
			{detail.artifacts.map((info) => (
				<ArtifactView key={`${info.kind}:${info.name}`} runId={detail.id} info={info} />
			))}
		</div>
	);
}
