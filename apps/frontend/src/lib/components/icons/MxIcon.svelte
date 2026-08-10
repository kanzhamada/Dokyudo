<script lang="ts">
	import { MX_ICONS, type MxIconName } from './mx-icons-data';

	let {
		name,
		size = 24,
		class: className = '',
		...restProps
	}: {
		name: MxIconName;
		size?: number | string;
		class?: string;
		[key: string]: unknown;
	} = $props();

	const icon = $derived(MX_ICONS[name]);
</script>

<!-- Svelte wrapper around the mx-icons library (mx-icons@1.1.1).
     The SVG paths are extracted into mx-icons-data.ts — this component renders
     them with the same ergonomics as lucide-svelte: size / class / currentColor. -->
<svg
	viewBox="0 0 24 24"
	width={size}
	height={size}
	class={className}
	fill={icon.mode === 'fill' ? 'currentColor' : 'none'}
	stroke={icon.mode === 'stroke' ? 'currentColor' : undefined}
	stroke-width={icon.mode === 'stroke' ? (icon.strokeWidth ?? 1.5) : undefined}
	xmlns="http://www.w3.org/2000/svg"
	{...restProps}
>
	{@html icon.paths}
</svg>
