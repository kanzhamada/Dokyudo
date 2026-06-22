import fs from 'node:fs';
import path from 'node:path';
import type { PageServerLoad } from './$types.js';

export const load: PageServerLoad = async () => {
	const docsDir = path.resolve('static/documents');
	let documents: {
		id: string;
		name: string;
		description: string;
		uploadedAt: string;
		size: string;
		url: string;
	}[] = [];

	if (fs.existsSync(docsDir)) {
		const files = fs.readdirSync(docsDir).filter((file) => !file.startsWith('.'));
		documents = files.map((file, i) => {
			const stats = fs.statSync(path.join(docsDir, file));
			
			// Format size
			let sizeStr = '';
			const sizeKB = stats.size / 1024;
			if (sizeKB > 1024) {
				sizeStr = (sizeKB / 1024).toFixed(1) + ' MB';
			} else {
				sizeStr = sizeKB.toFixed(0) + ' KB';
			}

			return {
				id: `doc-${String(i + 1).padStart(3, '0')}`,
				name: file,
				description: 'Automatically loaded from static documents directory.',
				uploadedAt: stats.mtime.toLocaleDateString('en-US', {
					month: 'short',
					day: 'numeric',
					year: 'numeric'
				}),
				size: sizeStr,
				url: `/documents/${file}`
			};
		});
	}

	return {
		documents
	};
};
