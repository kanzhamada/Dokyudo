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

<h1>Coming Soon</h1>
