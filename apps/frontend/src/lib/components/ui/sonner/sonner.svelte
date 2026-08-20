<script lang="ts">
	import { Toaster as Sonner, type ToasterProps as SonnerProps } from "svelte-sonner";
	import { mode } from "mode-watcher";
	import Loader2Icon from '@lucide/svelte/icons/loader-2';
	import InfoIcon from '@lucide/svelte/icons/info';
	import TriangleAlertIcon from '@lucide/svelte/icons/triangle-alert';
	import MxIcon from '$lib/components/icons/MxIcon.svelte';

	let { ...restProps }: SonnerProps = $props();
</script>

<Sonner
	theme={mode.current}
	class="toaster group"
	style="--normal-bg: var(--color-popover); --normal-text: var(--color-popover-foreground); --normal-border: var(--color-border);"
	{...restProps}
>
	{#snippet loadingIcon()}
		<Loader2Icon class="size-5 animate-spin" />
	{/snippet}
	{#snippet successIcon()}
		<MxIcon name="check-circle-outline" class="size-5 text-green-400" />
	{/snippet}
	{#snippet errorIcon()}
		<TriangleAlertIcon class="size-5 text-red-400" />
	{/snippet}
	{#snippet infoIcon()}
		<InfoIcon class="size-5" />
	{/snippet}
	{#snippet warningIcon()}
		<TriangleAlertIcon class="size-5" />
	{/snippet}
</Sonner>
