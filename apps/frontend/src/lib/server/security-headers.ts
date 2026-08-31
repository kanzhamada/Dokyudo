/**
 * Security hardening headers applied to SvelteKit responses in production
 * builds (see hooks.server.ts).
 *
 * The Content-Security-Policy header is intentionally NOT set here — it lives
 * in `kit.csp` (svelte.config.js) so SvelteKit can hash its own injected
 * inline bootstrap script (`__sveltekit_*`). A static script-src without
 * 'unsafe-inline', hashes or nonces would block that script and the app would
 * never hydrate.
 */

export const SECURITY_HEADERS: Readonly<Record<string, string>> = {
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
