export interface Document {
	id: string;
	name: string;
	description: string;
	uploadedAt: string;
	size: string;
	status: 'pending' | 'confirmed' | 'processed' | 'quota_exhausted' | 'failed';
	url?: string;
}

