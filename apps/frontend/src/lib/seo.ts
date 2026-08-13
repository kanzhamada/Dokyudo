const SITE_NAME = 'Dokyudo';
const DUMMY_OG_IMAGE = '/landing/hero-dashboard.jpg';

export interface SeoOptions {
	title: string;
	description?: string;
	canonical?: string;
	ogImage?: string;
	ogType?: 'website' | 'article';
	noindex?: boolean;
}

function escapeHtml(value: string): string {
	return value
		.replace(/&/g, '&amp;')
		.replace(/"/g, '&quot;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;');
}

export function seo(options: SeoOptions): string {
	const {
		title,
		description,
		canonical,
		ogImage = DUMMY_OG_IMAGE,
		ogType = 'website',
		noindex = false
	} = options;

	const tags = [`<title>${escapeHtml(title)}</title>`];

	if (description) {
		tags.push(`<meta name="description" content="${escapeHtml(description)}" />`);
	}

	if (canonical) {
		tags.push(`<link rel="canonical" href="${escapeHtml(canonical)}" />`);
	}

	if (noindex) {
		tags.push('<meta name="robots" content="noindex" />');
	}

	tags.push(
		`<meta property="og:type" content="${ogType}" />`,
		`<meta property="og:site_name" content="${SITE_NAME}" />`,
		`<meta property="og:title" content="${escapeHtml(title)}" />`
	);

	if (description) {
		tags.push(`<meta property="og:description" content="${escapeHtml(description)}" />`);
	}

	if (canonical) {
		tags.push(`<meta property="og:url" content="${escapeHtml(canonical)}" />`);
	}

	if (ogImage) {
		tags.push(`<meta property="og:image" content="${escapeHtml(ogImage)}" />`);
	}

	tags.push(
		`<meta name="twitter:card" content="summary_large_image" />`,
		`<meta name="twitter:title" content="${escapeHtml(title)}" />`
	);

	if (description) {
		tags.push(`<meta name="twitter:description" content="${escapeHtml(description)}" />`);
	}

	if (ogImage) {
		tags.push(`<meta name="twitter:image" content="${escapeHtml(ogImage)}" />`);
	}

	return tags.join('\n');
}
