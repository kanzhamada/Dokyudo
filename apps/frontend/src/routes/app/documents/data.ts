export interface Document {
	id: string;
	name: string;
	description: string;
	uploadedAt: string;
	/** Raw upload timestamp (ISO) — the sort key for the "Date Uploaded" column. */
	createdAt: string;
	size: string;
	status:
		| 'pending'
		| 'confirmed'
		| 'processed'
		| 'quota_exhausted'
		| 'failed'
		| 'failed_vectorizing';
	url?: string;
	pages?: number[];
	score?: number;
	semanticContent?: string;
}

export interface BackendDocument {
	id: string;
	title: string;
	description: string | null;
	storagePath: string;
	sizeBytes: number;
	status: string;
	createdAt: string;
}

export interface SemanticSearchResult {
	documentId: string;
	content: string;
	score: number;
	metadata?: {
		pages?: number[];
		[key: string]: unknown;
	};
}
