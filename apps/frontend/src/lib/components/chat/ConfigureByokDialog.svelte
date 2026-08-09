<script lang="ts">
	import { onMount } from 'svelte';
	import { Check, KeyRound, RotateCw, X } from 'lucide-svelte';
	import * as Dialog from '$lib/components/ui/dialog';
	import { Input } from '$lib/components/ui/input';
	import { Button } from '$lib/components/ui/button';
	import { Spinner } from '$lib/components/ui/spinner';
	import { toast } from 'svelte-sonner';
	import { deleteKey, getKeys, upsertKey } from '$lib/api/keys';

	import geminiIcon from '$lib/assets/llm/gemini.svg';
	import mistralIcon from '$lib/assets/llm/mistral.svg';
	import openrouterIcon from '$lib/assets/llm/openrouter.svg';

	type ByokProvider = 'gemini' | 'mistral' | 'openrouter';

	interface ByokProviderOption {
		id: ByokProvider;
		label: string;
		description: string;
		icon: string;
		placeholder: string;
	}

	const BYOK_PROVIDER_OPTIONS: ByokProviderOption[] = [
		{
			id: 'gemini',
			label: 'Google AI',
			description: 'Gemini models',
			icon: geminiIcon,
			placeholder: 'AIza...'
		},
		{
			id: 'mistral',
			label: 'Mistral',
			description: 'Mistral models',
			icon: mistralIcon,
			placeholder: 'Mistral API key'
		},
		{
			id: 'openrouter',
			label: 'OpenRouter',
			description: 'Access more models',
			icon: openrouterIcon,
			placeholder: 'sk-or-v1-...'
		}
	];

	let {
		open = $bindable(false),
		/** Called after a key is saved/reset so the caller can refresh its model list. */
		onSaved = () => {}
	} = $props();

	let provider = $state<ByokProvider>('gemini');
	let apiKey = $state('');
	let isSavingKey = $state(false);
	let isResettingKey = $state(false);
	let error = $state('');
	let keyMasks = $state<Record<ByokProvider, string>>({
		gemini: '',
		mistral: '',
		openrouter: ''
	});

	const providerLabel = $derived(
		BYOK_PROVIDER_OPTIONS.find((item) => item.id === provider)?.label ?? ''
	);

	async function loadKeyMasks() {
		try {
			const keysRes = await getKeys();
			if (!keysRes.ok) return;
			const nextMasks: Record<ByokProvider, string> = {
				gemini: '',
				mistral: '',
				openrouter: ''
			};
			for (const item of keysRes.data.data ?? []) {
				const p = item.provider.toLowerCase();
				if (p === 'gemini' || p === 'mistral' || p === 'openrouter') {
					nextMasks[p] = item.maskedKey;
				}
			}
			keyMasks = nextMasks;
		} catch (err) {
			console.error('[ConfigureByokDialog] Failed to fetch keys:', err);
		}
	}

	onMount(loadKeyMasks);

	// Refresh the "configured" state each time the dialog is opened.
	$effect(() => {
		if (open) loadKeyMasks();
	});

	function selectConfigureProvider(next: ByokProvider) {
		provider = next;
		apiKey = '';
		error = '';
	}

	async function saveConfigureKey() {
		const key = apiKey.trim();
		if (!key || isSavingKey) return;

		isSavingKey = true;
		error = '';
		try {
			const result = await upsertKey(provider, key);
			if (!result.ok) {
				error = result.error.message;
				return;
			}

			await loadKeyMasks();
			await onSaved();
			apiKey = '';
			open = false;
			toast.success(`${providerLabel} key saved`);
		} catch (err) {
			console.error('[ConfigureByokDialog] Failed to save BYOK key:', err);
			error = 'Failed to save API key.';
		} finally {
			isSavingKey = false;
		}
	}

	async function resetConfigureKey() {
		if (isResettingKey) return;

		isResettingKey = true;
		error = '';
		try {
			const result = await deleteKey(provider);
			if (!result.ok) {
				error = result.error.message;
				return;
			}

			await loadKeyMasks();
			await onSaved();
			toast.success(`${providerLabel} key reset`);
		} catch (err) {
			console.error('[ConfigureByokDialog] Failed to reset BYOK key:', err);
			error = 'Failed to reset API key.';
		} finally {
			isResettingKey = false;
		}
	}
</script>

<Dialog.Root bind:open>
	<Dialog.Content
		showCloseButton={false}
		class="w-full max-w-lg border border-white/[0.16] bg-[#232323]/[0.85] p-0 text-white shadow-2xl backdrop-blur-[42px]"
	>
		<button
			type="button"
			onclick={() => (open = false)}
			class="absolute top-4 right-4 z-10 flex size-8 cursor-pointer items-center justify-center rounded-md text-white/45 transition-colors hover:bg-white/10 hover:text-white focus:outline-none focus-visible:ring-1 focus-visible:ring-white/30"
			aria-label="Close configure dialog"
		>
			<X class="size-4" />
		</button>
		<Dialog.Header class="border-b border-white/10 px-6 py-5">
			<Dialog.Title class="text-lg font-semibold text-white">Configure BYOK</Dialog.Title>
			<Dialog.Description class="text-sm text-white/45">
				Connect your own API key to access provider models directly.
			</Dialog.Description>
		</Dialog.Header>

		<div class="flex gap-2 border-b border-white/10 px-6 py-3">
			{#each BYOK_PROVIDER_OPTIONS as providerOption (providerOption.id)}
				<button
					type="button"
					class="flex min-w-0 flex-1 cursor-pointer items-center gap-2 rounded-lg border px-2.5 py-2 text-left transition-colors {provider ===
					providerOption.id
						? 'border-[#DB8F5E]/60 bg-[#DB8F5E]/10 text-white'
						: 'border-white/10 bg-white/[0.03] text-white/50 hover:bg-white/[0.08] hover:text-white/80'}"
					onclick={() => selectConfigureProvider(providerOption.id)}
				>
					<img
						src={providerOption.icon}
						alt={providerOption.label}
						class="size-4 shrink-0 opacity-70 brightness-0 invert"
					/>
					<span class="min-w-0 truncate text-xs font-medium">{providerOption.label}</span>
				</button>
			{/each}
		</div>

		<div class="flex flex-col gap-3 px-6 py-5">
			<div class="flex items-center justify-between gap-3">
				<div>
					<p class="text-sm font-medium text-white/85">{providerLabel} API key</p>
					<p class="mt-1 text-xs text-white/40">
						{BYOK_PROVIDER_OPTIONS.find((item) => item.id === provider)?.description}
					</p>
				</div>
				<KeyRound class="size-4 text-white/35" />
			</div>

			{#if keyMasks[provider]}
				<div
					class="flex h-10 items-center justify-between rounded-lg border border-white/15 bg-black/20 px-3"
				>
					<div class="flex items-center gap-2 text-sm text-white/75">
						<Check class="size-4 text-white/60" />
						<span>API Key Configured</span>
					</div>
					<button
						type="button"
						class="flex cursor-pointer items-center gap-1 text-xs text-white/50 transition-colors hover:text-white/85 disabled:cursor-not-allowed disabled:opacity-50"
						disabled={isResettingKey}
						onclick={resetConfigureKey}
					>
						<RotateCw class="size-3.5" />
						<span>{isResettingKey ? 'Resetting...' : 'Reset Key'}</span>
					</button>
				</div>
			{:else}
				<Input
					type="password"
					bind:value={apiKey}
					placeholder={BYOK_PROVIDER_OPTIONS.find((item) => item.id === provider)?.placeholder}
					class="h-10 border-white/15 bg-black/20 text-sm text-white placeholder:text-white/25 focus-visible:border-[#DB8F5E]/60 focus-visible:ring-[#DB8F5E]/20"
					autocomplete="new-password"
				/>
			{/if}

			{#if error}
				<p class="text-xs text-red-400">{error}</p>
			{/if}
		</div>

		<Dialog.Footer class="border-t border-white/10 px-6 py-4">
			<Button
				variant="ghost"
				class="cursor-pointer text-white/60 hover:bg-white/10 hover:text-white"
				disabled={isSavingKey}
				onclick={() => (open = false)}
			>
				Cancel
			</Button>
			<Button
				class="cursor-pointer bg-[#DB8F5E] text-black hover:bg-[#E59C6D] disabled:opacity-50"
				disabled={!apiKey.trim() || isSavingKey || isResettingKey}
				onclick={saveConfigureKey}
			>
				{#if isSavingKey}
					<Spinner class="mr-2" />
					Saving...
				{:else}
					Save key
				{/if}
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
