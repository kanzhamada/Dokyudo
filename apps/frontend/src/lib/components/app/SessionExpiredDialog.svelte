<script lang="ts">
	import * as Dialog from '$lib/components/ui/dialog';
	import { Button } from '$lib/components/ui/button';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { sessionStore } from '$lib/state/session.store.svelte';
	import { sessionExpiryStore } from '$lib/state/session-expiry.store.svelte';
	import { authLogout } from '$lib/api/auth';

	let open = $derived(sessionExpiryStore.value);

	async function handleRedirectToLogin() {
		// Best-effort: clear the httpOnly cookies on the server, then drop the
		// local state and send the user to sign in again.
		await authLogout().catch(() => {});
		sessionStore.clear();
		await goto(resolve('/login'));
	}
</script>

<Dialog.Root {open}>
	<Dialog.Content
		class="border-white/10 bg-offblack/[0.85] text-white backdrop-blur-[42px] sm:max-w-md"
		showCloseButton={false}
		escapeKeydownBehavior="ignore"
		interactOutsideBehavior="ignore"
	>
		<Dialog.Header>
			<Dialog.Title class="text-lg font-semibold text-white">Session Expired</Dialog.Title>
			<Dialog.Description class="text-sm text-white/45">
				Your session has expired. Please log in again to continue using Dokyudo.
			</Dialog.Description>
		</Dialog.Header>
		<Dialog.Footer class="mt-1 flex gap-2 sm:justify-end">
			<Button
				variant="authPrimary"
				class="auth-btn-primary cursor-pointer"
				onclick={handleRedirectToLogin}
			>
				Go to Login
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
