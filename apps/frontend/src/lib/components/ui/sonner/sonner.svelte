<script lang="ts">
	import { Toaster as Sonner, type ToasterProps as SonnerProps } from "svelte-sonner";
	import { mode } from "mode-watcher";
	import Loader2Icon from '@lucide/svelte/icons/loader-2';
	import InfoIcon from '@lucide/svelte/icons/info';
	import TriangleAlertIcon from '@lucide/svelte/icons/triangle-alert';
	import MxIcon from '$lib/components/icons/MxIcon.svelte';

	let { position = 'bottom-right', ...restProps }: SonnerProps = $props();
</script>

<Sonner
	theme={mode.current}
	class="toaster group"
	{position}
	style="--normal-bg: var(--color-offblack); --normal-text: var(--color-white); --normal-border: rgba(255, 255, 255, 0.15);"
	{...restProps}
>
	{#snippet loadingIcon()}
		<Loader2Icon class="size-5 animate-spin text-warm-gray" />
	{/snippet}
	{#snippet successIcon()}
		<MxIcon name="check-circle-outline" class="size-5 text-c-lime" />
	{/snippet}
	{#snippet errorIcon()}
		<TriangleAlertIcon class="size-5 text-c-lavender" />
	{/snippet}
	{#snippet infoIcon()}
		<InfoIcon class="size-5 text-c-periwinkle" />
	{/snippet}
	{#snippet warningIcon()}
		<TriangleAlertIcon class="size-5 text-c-yellow" />
	{/snippet}
</Sonner>
