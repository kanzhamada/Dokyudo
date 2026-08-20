<script lang="ts">
	import { Input } from '$lib/components/ui/input';
	import * as Tooltip from '$lib/components/ui/tooltip';
	import type { HTMLInputAttributes } from 'svelte/elements';

	// We accept the bound value, a placeholder, disabled state, and pass through any other attributes (like those from Form.Control snippet props)
	let {
		value = $bindable(),
		placeholder = 'Password',
		disabled = false,
		autofocus = false,
		...rest
	}: {
		value: string;
		placeholder?: string;
		disabled?: boolean;
		autofocus?: boolean;
		[key: string]: any;
	} = $props();

	let showPassword = $state(false);
</script>

<div class="relative">
	<Input
		{...rest}
		type={showPassword ? 'text' : 'password'}
		{placeholder}
		{disabled}
		{autofocus}
		bind:value
		variant="auth"
		class="auth-input pr-12"
	/>
	<Tooltip.Provider>
		<Tooltip.Root>
			<Tooltip.Trigger>
				{#snippet child({ props })}
					<button
						{...props}
						type="button"
						class="absolute top-1/2 right-3 -translate-y-1/2 cursor-pointer rounded p-1 text-warm-gray transition-colors hover:text-white"
						onclick={() => (showPassword = !showPassword)}
						aria-label={showPassword ? 'Hide password' : 'Show password'}
					>
						{#if showPassword}
							<svg
								xmlns="http://www.w3.org/2000/svg"
								width="20"
								height="20"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="2"
								stroke-linecap="round"
								stroke-linejoin="round"
								><path
									d="M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575 1 1 0 0 1 0 .696 10.747 10.747 0 0 1-1.444 2.49"
								/><path d="M14.084 14.158a3 3 0 0 1-4.242-4.242" /><path
									d="M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151 1 1 0 0 1 0-.696 10.75 10.75 0 0 1 4.446-5.143"
								/><path d="m2 2 20 20" /></svg
							>
						{:else}
							<svg
								xmlns="http://www.w3.org/2000/svg"
								width="20"
								height="20"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="2"
								stroke-linecap="round"
								stroke-linejoin="round"
								><path
									d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0"
								/><circle cx="12" cy="12" r="3" /></svg
							>
						{/if}
					</button>
				{/snippet}
			</Tooltip.Trigger>
			<Tooltip.Content
				class="border-white/[0.16] bg-graphite text-white"
				arrowClasses="bg-graphite border-none"
				>{showPassword ? 'Hide Password' : 'Show Password'}</Tooltip.Content
			>
		</Tooltip.Root>
	</Tooltip.Provider>
</div>
