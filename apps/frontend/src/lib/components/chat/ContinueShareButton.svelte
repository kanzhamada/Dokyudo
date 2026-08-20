<script lang="ts">
	import { goto } from '$app/navigation';
	import { Spinner } from '$lib/components/ui/spinner';
	import { Button } from '$lib/components/ui/button';
	import { continueShare } from '$lib/api/rag';
	import { sessionStore } from '$lib/state/session.store.svelte';
	import { toast } from 'svelte-sonner';

	interface Props {
		code?: string;
	}

	let { code = '' }: Props = $props();
	let isContinuing = $state(false);

	async function handleContinue() {
		if (isContinuing || !code) return;
		if (!sessionStore.authenticated) {
			await goto(`/login?redirect=/s/${code}`);
			return;
		}
		isContinuing = true;
		try {
			const result = await continueShare(code);
			if (result.ok) {
				await goto(`/app/chat/${result.data.id}`);
			} else if (result.error.code === 'UNAUTHORIZED') {
				await goto(`/login?redirect=/s/${code}`);
			} else {
				toast.error('Failed to continue chat');
			}
		} catch {
			toast.error('Failed to continue chat');
		} finally {
			isContinuing = false;
		}
	}
</script>

<Button
	class="flex h-9 shrink-0 cursor-pointer items-center gap-1.5 rounded-full bg-[#DB8F5E] px-4 text-sm font-medium text-black hover:bg-[#E39B6D] disabled:cursor-not-allowed disabled:opacity-40"
	disabled={isContinuing}
	onclick={handleContinue}
>
	{#if isContinuing}
		<Spinner class="size-3.5" />
		Preparing...
	{:else}
		Continue chat
	{/if}
</Button>
