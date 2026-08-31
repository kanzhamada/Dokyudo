import { dev } from '$app/environment';
import { env } from '$env/dynamic/private';
import type { Handle } from '@sveltejs/kit';
import { buildSecurityHeaders, httpsRedirectUrl } from '$lib/server/security-headers';

// Public origin of the S3/MinIO presigned URLs, e.g. "https://minio.dokyudo.my.id:9000".
// The browser PUTs document uploads and fetches previews straight to this
// origin, so it must be in CSP `connect-src` — otherwise uploads/PDF previews
// break once the CSP is enforced. Set STORAGE_PUBLIC_URL on the frontend
// worker (wrangler [vars] / dashboard); when absent the header is simply
// built without it.
const securityHeaders = buildSecurityHeaders(
	env.STORAGE_PUBLIC_URL ? [env.STORAGE_PUBLIC_URL] : []
);

export const handle: Handle = async ({ event, resolve }) => {
	// Fallback HTTPS redirect — Cloudflare "Always Use HTTPS" is the primary
	// layer; this covers direct HTTP hits for extra safety.
	const location = httpsRedirectUrl(event.request, event.request.headers.get('x-forwarded-proto'));
	if (location) {
		return new Response(null, { status: 301, headers: { Location: location } });
	}

	const response = await resolve(event);

	// Production builds only: CSP is skipped in dev because Vite HMR requires
	// ws://localhost and dev-only inline scripts.
	if (!dev) {
		for (const [name, value] of Object.entries(securityHeaders)) {
			response.headers.set(name, value);
		}
	}

	return response;
};
