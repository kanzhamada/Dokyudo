<script lang="ts">
	import * as Dialog from '$lib/components/ui/dialog';
	import { Input } from '$lib/components/ui/input';
	import { Button } from '$lib/components/ui/button';
	import { Spinner } from '$lib/components/ui/spinner';

	interface Props {
		open?: boolean;
		title?: string;
		isSaving?: boolean;
		onSave: (newTitle: string) => Promise<void> | void;
		onClose?: () => void;
	}

	let {
		open = $bindable(false),
		title = '',
		isSaving = false,
		onSave,
		onClose
	}: Props = $props();

	let titleDraft = $state('');

	$effect(() => {
		if (open) {
			titleDraft = title === 'New Conversation' ? '' : title;
		}
	});

	async function handleSubmit(e?: Event) {
		e?.preventDefault();
		const trimmed = titleDraft.trim();
		if (!trimmed || isSaving) return;
		await onSave(trimmed);
	}

	function handleClose() {
		open = false;
		onClose?.();
	}
</script>

<Dialog.Root bind:open>
	<Dialog.Content class="border-white/10 bg-[#232323] text-white sm:max-w-md">
		<Dialog.Header>
			<Dialog.Title class="text-lg font-semibold text-white">Edit conversation title</Dialog.Title>
			<Dialog.Description class="text-sm text-white/45">
				Choose a title that makes this conversation easy to find later.
			</Dialog.Description>
		</Dialog.Header>
		<form onsubmit={handleSubmit} class="mt-2 flex flex-col gap-4">
			<Input
				type="text"
				bind:value={titleDraft}
				placeholder="Conversation title"
				maxlength={100}
				disabled={isSaving}
				class="border-white/15 bg-black/20 text-white placeholder:text-white/25 focus-visible:border-[#DB8F5E]/60 focus-visible:ring-[#DB8F5E]/20"
			/>
			<Dialog.Footer class="mt-1 flex gap-2 sm:justify-end">
				<Button
					type="button"
					variant="ghost"
					class="cursor-pointer text-white/60 hover:bg-white/10 hover:text-white"
					disabled={isSaving}
					onclick={handleClose}
				>
					Cancel
				</Button>
				<Button
					type="submit"
					class="cursor-pointer bg-[#DB8F5E] text-black hover:bg-[#E59C6D] disabled:opacity-50"
					disabled={!titleDraft.trim() || isSaving}
				>
					{#if isSaving}
						<Spinner class="mr-2" />
						Saving...
					{:else}
						Save title
					{/if}
				</Button>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>
