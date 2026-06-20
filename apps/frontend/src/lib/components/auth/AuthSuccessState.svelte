<script lang="ts">
	import Button from '../ui/button/button.svelte';

	let {
		heading,
		description,
		buttonHref,
		buttonText
	}: {
		heading: string;
		description: string;
		buttonHref: string;
		buttonText: string;
	} = $props();
</script>

<div class="mt-4 flex flex-col items-center gap-4 md:mt-0">
	<div class="flex h-16 w-16 items-center justify-center rounded-full bg-[#E8DEC8]/10">
		<svg
			xmlns="http://www.w3.org/2000/svg"
			width="32"
			height="32"
			viewBox="0 0 24 24"
			fill="none"
			stroke="#E8DEC8"
			stroke-width="2"
			stroke-linecap="round"
			stroke-linejoin="round"
		>
			<path d="M20 6 9 17l-5-5" />
		</svg>
	</div>
	<h1 class="auth-heading text-center text-3xl md:text-4xl">{heading}</h1>
	<p class="auth-subheading text-center text-white/80">
		{description}
	</p>
	<Button href={buttonHref} class="auth-btn-primary" variant="authPrimary">
		{buttonText}
	</Button>
</div>
