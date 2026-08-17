<script lang="ts">
	import Button from '../ui/button/button.svelte';

	let {
		heading,
		buttonHref,
		buttonText
	}: {
		heading: string;
		buttonHref: string;
		buttonText: string;
	} = $props();
</script>

<div class="auth-state">
	<div class="auth-state-mark">
		<svg
			xmlns="http://www.w3.org/2000/svg"
			width="32"
			height="32"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			stroke-width="2"
			stroke-linecap="round"
			stroke-linejoin="round"
		>
			<path d="M20 6 9 17l-5-5" />
		</svg>
	</div>
	<h1 class="auth-heading auth-state-heading">{heading}</h1>
	<Button href={buttonHref} class="auth-btn-primary" variant="authPrimary">
		{buttonText}
	</Button>
</div>
