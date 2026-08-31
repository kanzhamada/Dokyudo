/**
 * Security hardening headers applied to SvelteKit responses in production
 * builds (see hooks.server.ts). The CSP allowlist is derived from the origins
 * the app actually talks to:
 *
 * - Google Fonts      landing page preconnect + stylesheet + font files
 * - reCAPTCHA v3      script (www.google.com), assets (www.gstatic.com),
 *                     iframe + verification XHR (www.google.com)
 * - API               api.dokyudo.my.id (PUBLIC_API_URL — API is cross-origin)
 * - Supabase          PUBLIC_SUPABASE_URL (auth/realtime, *.supabase.co + wss)
 * - CF Web Analytics  beacon.min.js auto-injected by Cloudflare
 * - Provider logos    landing page loads remote company logos from a handful
 *                     of CDNs — hence the looser `img-src https:`
 * - Object storage    the browser PUTs uploads and fetches PDF previews
 *                     straight to short-lived S3/MinIO presigned URLs, so the
 *                     storage origin is injected into `connect-src` per-worker
 *                     via STORAGE_PUBLIC_URL (see hooks.server.ts)
 */

const cspConnectSrc = [
	"'self'",
	'https://api.dokyudo.my.id',
	'https://*.supabase.co',
	'wss://*.supabase.co',
	'https://fonts.googleapis.com',
	'https://fonts.gstatic.com',
	'https://www.google.com',
	'https://static.cloudflareinsights.com'
];

function buildCsp(extraConnectSrc: readonly string[]): string {
	return [
		"default-src 'self'",
		// 'wasm-unsafe-eval' is required for the anti-bot WASM puzzle
		// (vite-plugin-wasm + WebAssembly.instantiate) while a CSP is present.
		"script-src 'self' 'wasm-unsafe-eval' https://www.google.com https://www.gstatic.com https://static.cloudflareinsights.com",
		// 'unsafe-inline' for styles is needed by Svelte's inline style attribute
		// in app.html and runtime style injection (mermaid/katex rendering).
		"style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
		"font-src 'self' data: https://fonts.gstatic.com",
		"img-src 'self' data: blob: https:",
		`connect-src ${[...cspConnectSrc, ...extraConnectSrc].join(' ')}`,
		"frame-src 'self' https://www.google.com",
		"frame-ancestors 'self'",
		"base-uri 'self'",
		"form-action 'self'",
		"object-src 'none'",
		"worker-src 'self' blob:"
	].join('; ');
}

/**
 * Build the security header map. `extraConnectSrc` lets the worker append
 * origins the browser must reach directly (e.g. the S3/MinIO presigned-URL
 * origin for document uploads/previews) without touching this allowlist.
 */
export function buildSecurityHeaders(
	extraConnectSrc: readonly string[] = []
): Readonly<Record<string, string>> {
	return {
		'Content-Security-Policy': buildCsp(extraConnectSrc),
		// Only honored by browsers over HTTPS. `includeSubDomains` also protects
		// api.dokyudo.my.id — ensure everything under the domain serves HTTPS.
		'Strict-Transport-Security': 'max-age=63072000; includeSubDomains; preload',
		'X-Frame-Options': 'SAMEORIGIN',
		'X-Content-Type-Options': 'nosniff',
		'Referrer-Policy': 'strict-origin-when-cross-origin',
		'Permissions-Policy':
			'camera=(), microphone=(), geolocation=(), payment=(), usb=(), battery=(), gyroscope=(), accelerometer=(), magnetometer=(), interest-cohort=(), browsing-topics=()',
		'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
		'Cross-Origin-Resource-Policy': 'same-site'
	};
}

/**
 * Fallback HTTP → HTTPS redirect for when Cloudflare "Always Use HTTPS" is
 * disabled or bypassed. Returns the 301 Location, or null when the request
 * already arrived over HTTPS (or no proxy header is present, e.g. local dev).
 */
export function httpsRedirectUrl(request: Request, forwardedProto: string | null): string | null {
	if (forwardedProto !== 'http') return null;
	const url = new URL(request.url);
	return `https://${url.host}${url.pathname}${url.search}`;
}
