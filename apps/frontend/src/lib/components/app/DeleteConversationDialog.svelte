<script lang="ts">
	import * as Dialog from '$lib/components/ui/dialog';
	import { Button } from '$lib/components/ui/button';
	import { Spinner } from '$lib/components/ui/spinner';

	interface Props {
		open?: boolean;
		isDeleting?: boolean;
		onConfirm: () => Promise<void> | void;
		onClose?: () => void;
	}

	let {
		open = $bindable(false),
		isDeleting = false,
		onConfirm,
		onClose
	}: Props = $props();

	function handleClose() {
		open = false;
		onClose?.();
	}
</script>

<Dialog.Root bind:open>
	<Dialog.Content class="border-white/10 bg-[#232323]/[0.85] text-white backdrop-blur-[42px] sm:max-w-md">
		<Dialog.Header>
			<Dialog.Title class="text-lg font-semibold text-white">Delete conversation?</Dialog.Title>
			<Dialog.Description class="text-sm text-white/45">
				This will permanently delete this conversation and its history.
			</Dialog.Description>
		</Dialog.Header>
		<Dialog.Footer class="mt-1 flex gap-2 sm:justify-end">
			<Button
				variant="ghost"
				class="cursor-pointer text-white/60 hover:bg-white/10 hover:text-white"
				disabled={isDeleting}
				onclick={handleClose}
			>
				Cancel
			</Button>
			<Button
				class="cursor-pointer bg-red-500 text-white hover:bg-red-600 disabled:opacity-50"
				disabled={isDeleting}
				onclick={onConfirm}
			>
				{#if isDeleting}
					<Spinner class="mr-2" />
					Deleting...
				{:else}
					Delete conversation
				{/if}
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
