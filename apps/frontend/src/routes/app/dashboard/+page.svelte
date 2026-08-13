<script lang="ts">
	import { seo } from '$lib/seo';
</script>

<svelte:head>
	{@html seo({ title: 'Dashboard | Dokyudo', description: 'Your workspace overview.', noindex: true })}
</svelte:head>

<h1>
    Dashboard
</h1>