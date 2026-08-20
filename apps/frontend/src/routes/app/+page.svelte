<script lang="ts">
	import { seo } from '$lib/seo';
</script>

<svelte:head>
	<!-- eslint-disable-next-line svelte/no-at-html-tags -->
	{@html seo({
		title: 'Dashboard | Dokyudo',
		description: 'Your workspace overview.',
		noindex: true
	})}
</svelte:head>

<div class="flex h-full w-full items-start px-6 py-8 font-sans md:px-10 md:py-10">
	<div>
		<h1 class="text-3xl font-semibold text-white md:text-4xl">Dashboard</h1>
		<p class="mt-1 text-sm text-white/45">Your workspace overview.</p>
	</div>
</div>
