export interface Document {
	id: string;
	name: string;
	description: string;
	uploadedAt: string;
	size: string;
	status: 'pending' | 'confirmed' | 'processed' | 'quota_exhausted' | 'failed' | 'failed_vectorizing';
	url?: string;
	pages?: number[];
	score?: number;
	semanticContent?: string;
}

