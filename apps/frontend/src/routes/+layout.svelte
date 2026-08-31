<script module lang="ts">
	// Belt-and-suspenders with +layout.ts: the root universal layout module
	// silently failed to ship in some deployments (live bundles were observed
	// without suppressConsole while the CSP config was already current). The
	// call is idempotent, so invoking it from both the .ts and this .svelte
	// is safe — this file is guaranteed to be in the client bundle.
	import { suppressConsole } from '$lib/utils/logger';
	suppressConsole();
</script>

<script lang="ts">
	import './layout.css';
	import 'katex/dist/katex.min.css';
	import favicon from '$lib/assets/favicon.svg';
	import { Toaster } from '$lib/components/ui/sonner';

	let { children } = $props();
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>
<Toaster position="bottom-right" theme="dark" expand={true} />
{@render children()}
