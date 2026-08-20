<script lang="ts">
	import { Pagination as PaginationPrimitive } from "bits-ui";
	import { cn } from "$lib/utils.js";
	import { buttonVariants } from "$lib/components/ui/button/index.js";
	import MxIcon from '$lib/components/icons/MxIcon.svelte';

	let {
		ref = $bindable(null),
		class: className,
		...restProps
	}: PaginationPrimitive.NextButtonProps = $props();
</script>

<PaginationPrimitive.NextButton
	bind:ref
	aria-label="Go to next page"
	class={cn(
		buttonVariants({ variant: "ghost", size: "default" }),
		"pr-2!",
		className
	)}
	{...restProps}
>
	<MxIcon name="alt-arrow-right-outline" data-icon="inline-end" />
</PaginationPrimitive.NextButton>
