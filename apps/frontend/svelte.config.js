import adapter from '@sveltejs/adapter-cloudflare';

// Production-build detection. The app uses both conventions ('production'
// from `vite build`, 'prod' in this team's env files), so accept either.
// The CSP is only enabled for production builds — during `vite dev` the Vite
// HMR client needs ws://localhost and dev-only inline scripts.
const isProduction = process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'prod';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	compilerOptions: {
		// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
		runes: ({ filename }) => (filename.split(/[/\\]/).includes('node_modules') ? undefined : true)
	},
	kit: {
		// adapter-auto only supports some environments, see https://svelte.dev/docs/kit/adapter-auto for a list.
		// If your environment is not supported, or you settled on a specific environment, switch out the adapter.
		// See https://svelte.dev/docs/kit/adapters for more information about adapters.
		adapter: adapter(),
		// Content-Security-Policy via SvelteKit's built-in mechanism (mode
		// "hash") so SvelteKit hashes its own injected inline bootstrap script
		// and appends the hashes to `script-src`. Doing this in hooks.server.ts
		// instead would leave that inline script blocked and the app would
		// never hydrate. Applied per SSR response, production only.
		...(isProduction && {
			csp: {
				mode: 'hash',
				directives: {
					'default-src': ['self'],
					// 'wasm-unsafe-eval' is required for the anti-bot WASM puzzle
					// (vite-plugin-wasm + WebAssembly.instantiate).
					// 'https://cdn.jsdelivr.net' lets @embedpdf's pdfium worker
					// execute — the worker itself loads from jsdelivr
					// (worker-src) and its internal module imports are governed
					// by script-src. Allowing a public CDN in script-src is a
					// trade-off; self-hosting the embedpdf assets would let us
					// drop it (and connect-src/worker-src entries) entirely.
					'script-src': [
						'self',
						"'wasm-unsafe-eval'",
						// Inline console guard from app.html (static content,
						// stable hash). Mutes console.debug/log/info before any
						// app module runs — belt-and-suspenders for the
						// layout-based suppressConsole(), which some deploys
						// failed to include.
						"'sha256-J/yX8DXf1UeNiAyCwisAjkaHAVEpw7zTkFOJUEb2/Do='",
						'https://www.google.com',
						'https://www.gstatic.com',
						'https://static.cloudflareinsights.com',
						'https://cdn.jsdelivr.net'
					],
					// 'unsafe-inline' for styles is needed by Svelte's inline style
					// attribute in app.html and runtime style injection
					// (mermaid/katex rendering).
					'style-src': ['self', "'unsafe-inline'", 'https://fonts.googleapis.com'],
					'font-src': ['self', 'data:', 'https://fonts.gstatic.com'],
					'img-src': ['self', 'data:', 'blob:', 'https:'],
					'connect-src': [
						'self',
						'https://api.dokyudo.my.id',
						// Local dev / preview — backend runs on :8000, frontend on :5173/:8080
						// Wildcard port form is CSP3-compliant; explicit ports kept for older parsers.
						'http://localhost:*',
						'http://127.0.0.1:*',
						'http://localhost:8000',
						'http://localhost:8080',
						'http://127.0.0.1:8000',
						'http://127.0.0.1:8080',
						'ws://localhost:*',
						'ws://127.0.0.1:*',
						'https://*.supabase.co',
						'wss://*.supabase.co',
						'https://fonts.googleapis.com',
						'https://fonts.gstatic.com',
						'https://www.google.com',
						'https://www.gstatic.com',
						'https://static.cloudflareinsights.com',
						// @embedpdf fetches its pdfium.wasm + stamps manifest from
						// cdn.jsdelivr.net at runtime (package-baked URLs).
						'https://cdn.jsdelivr.net',
						// Presigned S3/MinIO uploads + PDF previews (see docs/backend).
						process.env.STORAGE_PUBLIC_URL || 'https://s3.dokyudo.my.id'
					],
					'frame-src': ['self', 'https://www.google.com'],
					'frame-ancestors': ['self'],
					'base-uri': ['self'],
					'form-action': ['self'],
					'object-src': ['none'],
					// @embedpdf boots its pdfium worker from cdn.jsdelivr.net
					// (and auxiliary relay workers from blob: URLs).
					'worker-src': ['self', 'blob:', 'https://cdn.jsdelivr.net']
				}
			}
		})
	}
};

export default config;
