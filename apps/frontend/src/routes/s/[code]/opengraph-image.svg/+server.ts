import { PUBLIC_API_URL } from '$env/static/public';
import faviconSvg from '$lib/assets/favicon.svg?raw';

interface ShareMetadata {
	title: string;
	authorName: string | null;
	createdAt: string;
}

const logoPaths = (faviconSvg.match(/<path\b[^>]*\/\s*>/g) ?? [])
	.join('')
	.replaceAll('fill="white"', 'fill="#F4E6D4"');

function escapeXml(value: string): string {
	return value.replace(/[&<>"']/g, (character) => {
		const entities: Record<string, string> = {
			'&': '&amp;',
			'<': '&lt;',
			'>': '&gt;',
			'"': '&quot;',
			"'": '&apos;'
		};
		return entities[character];
	});
}

function wrapTitle(value: string, maxCharacters = 38): string[] {
	const words = value.trim().split(/\s+/).filter(Boolean);
	if (words.length === 0) return ['Untitled conversation'];

	const lines: string[] = [];
	let current = '';
	for (const word of words) {
		const next = current ? `${current} ${word}` : word;
		if (next.length > maxCharacters && current) {
			lines.push(current);
			current = word;
		} else {
			current = next;
		}
	}
	if (current) lines.push(current);
	if (lines.length <= 2) return lines;

	const secondLine = `${lines.slice(1).join(' ')}`;
	return [lines[0], `${secondLine.slice(0, maxCharacters - 1).trimEnd()}…`];
}

function formatDate(iso: string): string {
	return new Intl.DateTimeFormat('en-US', {
		month: 'short',
		day: 'numeric',
		year: 'numeric'
	}).format(new Date(iso));
}

function renderImage(metadata: ShareMetadata): string {
	const titleLines = wrapTitle(metadata.title)
		.map((line, index) => `<tspan x="92" dy="${index === 0 ? 0 : 68}">${escapeXml(line)}</tspan>`)
		.join('');
	const author = escapeXml(metadata.authorName?.trim() || 'Dokyudo user');
	const publishedDate = escapeXml(formatDate(metadata.createdAt));

	return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630" role="img" aria-labelledby="title description">
<title id="title">${escapeXml(metadata.title)} — Dokyudo</title>
<desc id="description">A shared conversation by ${author}, published ${publishedDate}.</desc>
<defs>
  <linearGradient id="ambient" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#ffffff"/>
    <stop offset="1" stop-color="#4b3117"/>
  </linearGradient>
  <filter id="ambientBlur" x="-30%" y="-30%" width="160%" height="160%">
    <feGaussianBlur stdDeviation="58"/>
  </filter>
  <linearGradient id="line" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#DB8F5E" stop-opacity="0"/>
    <stop offset="0.5" stop-color="#DB8F5E" stop-opacity="0.75"/>
    <stop offset="1" stop-color="#DB8F5E" stop-opacity="0"/>
  </linearGradient>
</defs>
<rect width="1200" height="630" fill="#1F1E1D"/>
<circle cx="245" cy="-20" r="575" fill="url(#ambient)" opacity="0.07" filter="url(#ambientBlur)"/>
<path d="M1010 0C1110 90 1120 185 1060 268C1004 345 1008 424 1116 512" fill="none" stroke="url(#line)" stroke-width="1.5" opacity="0.6"/>
<path d="M1046 0C1142 95 1152 187 1093 270" fill="none" stroke="#DB8F5E" stroke-width="1" opacity="0.2"/>
<rect x="1018" y="474" width="34" height="34" rx="4" fill="none" stroke="#DB8F5E" stroke-width="1" opacity="0.55" transform="rotate(12 1035 491)"/>
<circle cx="1098" cy="534" r="4" fill="#DB8F5E" opacity="0.8"/>
<svg x="92" y="66" width="34" height="39" viewBox="0 0 476 537" aria-hidden="true">${logoPaths}</svg>
<text x="142" y="94" fill="#F4E6D4" font-family="Inter, Arial, sans-serif" font-size="18" font-weight="600" letter-spacing="4">DOKYUDO</text>
<text x="92" y="246" fill="#DB8F5E" font-family="Inter, Arial, sans-serif" font-size="14" font-weight="600" letter-spacing="3">SHARED CONVERSATION</text>
<text x="92" y="320" fill="#F7F4EF" font-family="Inter, Arial, sans-serif" font-size="56" font-weight="500" letter-spacing="-1.8">${titleLines}</text>
<line x1="92" y1="503" x2="1108" y2="503" stroke="#F4E6D4" stroke-opacity="0.16"/>
<text x="92" y="548" fill="#F7F4EF" fill-opacity="0.72" font-family="Inter, Arial, sans-serif" font-size="17">By ${author}</text>
<circle cx="263" cy="542" r="2.5" fill="#F4E6D4" fill-opacity="0.36"/>
<text x="282" y="548" fill="#F7F4EF" fill-opacity="0.48" font-family="Inter, Arial, sans-serif" font-size="17">${publishedDate}</text>
</svg>`;
}

function renderFallbackImage(upstreamStatus: number): Response {
	const metadata: ShareMetadata = {
		title: 'Shared conversation',
		authorName: null,
		createdAt: new Date().toISOString()
	};
	return new Response(renderImage(metadata), {
		status: 200,
		headers: {
			'Content-Type': 'image/svg+xml; charset=utf-8',
			'Cache-Control': 'public, max-age=300, s-maxage=3600, stale-while-revalidate=86400',
			'X-Upstream-Status': String(upstreamStatus)
		}
	});
}

export async function GET({ params, fetch, url }): Promise<Response> {
	const code = params.code;
	if (!code) return new Response('Not found', { status: 404 });

	try {
		const invite = url.searchParams.get('invite');
		const query = invite ? `?invite=${encodeURIComponent(invite)}` : '';
		const response = await fetch(
			`${PUBLIC_API_URL}/api/rag/shares/${encodeURIComponent(code)}${query}`
		);
		// A 404 means the share genuinely does not exist or has expired — keep
		// the 404 so crawlers treat the link as dead. Any other upstream failure
		// (rate limit, Deno 5xx, network) degrades to a branded card instead of
		// breaking the social preview; the upstream status is exposed via header
		// for debugging.
		if (!response.ok) {
			if (response.status === 404) return new Response('Not found', { status: 404 });
			return renderFallbackImage(response.status);
		}

		const metadata = (await response.json()) as ShareMetadata;
		return new Response(renderImage(metadata), {
			headers: {
				'Content-Type': 'image/svg+xml; charset=utf-8',
				'Cache-Control': 'public, max-age=300, s-maxage=3600, stale-while-revalidate=86400'
			}
		});
	} catch {
		return renderFallbackImage(0);
	}
}
