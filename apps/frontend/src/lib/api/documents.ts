import { apiRequest } from './client';

/** A file uploaded as a chat attachment — its document id feeds RAG scoping. */
export interface ChatAttachment {
	documentId: string;
	name: string;
	size: number;
}

export type UploadAttachmentsResult =
	| { ok: true; attachments: ChatAttachment[] }
	| { ok: false; error: string };

function mimeTypeFor(filename: string): 'application/pdf' | 'text/plain' {
	const ext = filename.split('.').pop()?.toLowerCase();
	return ext === 'txt' ? 'text/plain' : 'application/pdf';
}

/**
 * Uploads files as regular tenant documents (presigned PUT + confirm) — the
 * same pipeline the Documents page uses. Chat attachments ARE documents: the
 * pg_net trigger fires on confirm and the STB worker ingests them, so a chat
 * turn can then scope RAG retrieval to their chunks.
 *
 * On failure, the documents created so far are rolled back (best-effort) so
 * no orphaned rows linger in the tenant's document list or storage quota.
 */
export async function uploadFilesAsDocuments(
	files: File[]
): Promise<UploadAttachmentsResult> {
	const createdDocIds: string[] = [];
	let allSucceeded = false;

	try {
		const presignedRes = await apiRequest<{
			results: Array<{
				filename: string;
				url: string;
				documentId: string;
				key: string;
				expiresIn: number;
			}>;
		}>('/api/documents/presigned-url/batch', {
			method: 'POST',
			body: {
				files: files.map((file) => ({
					filename: file.name,
					mimeType: mimeTypeFor(file.name),
					sizeBytes: file.size
				}))
			}
		});

		if (!presignedRes.ok) {
			return {
				ok: false,
				error: presignedRes.error?.message || 'Failed to get upload URLs'
			};
		}

		const results = presignedRes.data.results;
		const attachments: ChatAttachment[] = [];

		for (let i = 0; i < results.length; i++) {
			const result = results[i];
			const file = files[i];
			if (!file || !result) continue;
			createdDocIds.push(result.documentId);

			const putRes = await fetch(result.url, {
				method: 'PUT',
				headers: { 'Content-Type': file.type || mimeTypeFor(file.name) },
				body: file
			});
			if (!putRes.ok) {
				return {
					ok: false,
					error: `Upload failed for "${file.name}" (HTTP ${putRes.status})`
				};
			}

			const confirmRes = await apiRequest<{ status: string }>(
				'/api/documents/confirm-upload',
				{ method: 'POST', body: { documentId: result.documentId } }
			);
			if (!confirmRes.ok) {
				return {
					ok: false,
					error: confirmRes.error?.message || `Failed to confirm "${file.name}"`
				};
			}

			attachments.push({
				documentId: result.documentId,
				name: file.name,
				size: file.size
			});
		}

		allSucceeded = true;
		return { ok: true, attachments };
	} catch (err: any) {
		return { ok: false, error: err?.message || 'Upload failed' };
	} finally {
		// Roll back partially-created documents so the tenant's document list
		// and storage quota never count files that were never sent.
		if (!allSucceeded && createdDocIds.length > 0) {
			try {
				await apiRequest('/api/documents/batch-delete', {
					method: 'POST',
					body: { documentIds: createdDocIds }
				});
			} catch {
				// Best-effort — the failure the user sees is the one above.
			}
		}
	}
}
