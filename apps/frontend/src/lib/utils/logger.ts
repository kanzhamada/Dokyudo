/**
 * Console logging guard.
 *
 * In production builds (`vite build` / deployed app) the `debug`, `log` and
 * `info` levels are silenced — both through the `logger` helpers below and by
 * patching the global `console` via `suppressConsole()`, so pre-existing
 * `console.log` calls are suppressed as well. `warn` and `error` are always
 * kept, so production diagnostics (Workers logs, error reporting) still work.
 *
 * During `npm run dev` nothing is suppressed.
 */

/** Console levels silenced in production builds. */
const MUTED_LEVELS = ['debug', 'log', 'info'] as const;

type ConsoleLevel = 'debug' | 'log' | 'info' | 'warn' | 'error';

/**
 * Vite replaces `import.meta.env.PROD` with a literal at build time: `true`
 * on `vite build` (mode production), `false` on `vite dev`.
 *
 * This intentionally avoids `dev` from `$app/environment`, which re-exports
 * an esm-env constant that some build pipelines fold to dev values even for
 * production client bundles (observed on this project's deployed site) —
 * that silently disabled this patch.
 */
const isProductionBuild = import.meta.env.PROD;

// NOTE: intentionally NOT using `browser` from `$app/environment` — it is a
// build-time constant from `esm-env` that some pipelines fold to `false` even
// in the client bundle, which would silently disable the console patch.
// A plain `typeof window` check is evaluated at runtime and cannot be folded.
const isBrowser = typeof window !== 'undefined';

const noop = (): void => {};

const call =
	(level: ConsoleLevel) =>
	(...args: unknown[]): void => {
		console[level](...args);
	};

/** Logger that stays silent in production builds for the muted levels. */
export const logger: Record<ConsoleLevel, (...args: unknown[]) => void> = {
	debug: isProductionBuild ? noop : call('debug'),
	log: isProductionBuild ? noop : call('log'),
	info: isProductionBuild ? noop : call('info'),
	warn: call('warn'),
	error: call('error')
};

let consolePatched = false;

/**
 * Patch the global `console` so existing `console.log` / `console.debug` /
 * `console.info` calls become no-ops in production builds. Client-only and a
 * no-op during development; safe to call more than once. Invoke it once from
 * the root layout so every route is covered.
 */
export function suppressConsole(): void {
	if (consolePatched || !isBrowser || !isProductionBuild) return;
	consolePatched = true;
	for (const level of MUTED_LEVELS) {
		console[level] = noop;
	}
}
