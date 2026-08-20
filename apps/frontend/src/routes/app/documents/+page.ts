export const ssr = false;
import type { PageLoad } from './$types.js';
import { apiRequest } from '$lib/api/client.js';
import type { BackendDocument, Document } from './data.js';

export const load: PageLoad = async () => {
	const result = await apiRequest<{ documents: BackendDocument[] }>('/api/documents');
	let documents: Document[] = [];

	if (result.ok) {
		documents = result.data.documents.map((doc) => {
			const sizeKB = doc.sizeBytes / 1024;
			const sizeStr =
				sizeKB > 1024 ? (sizeKB / 1024).toFixed(1) + ' MB' : sizeKB.toFixed(0) + ' KB';

			return {
				id: doc.id,
				name: doc.title,
				description: doc.description || 'No description provided.',
				uploadedAt: new Date(doc.createdAt).toLocaleDateString('en-US', {
					month: 'short',
					day: 'numeric',
					year: 'numeric'
				}),
				createdAt: doc.createdAt,
				size: sizeStr,
				status: doc.status as Document['status'],
				url: undefined
			};
		});
	} else {
		console.error('[Document Library] Failed to load documents:', result.error);
	}

	return { documents };
};
