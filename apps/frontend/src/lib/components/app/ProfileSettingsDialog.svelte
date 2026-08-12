<script lang="ts">
	import * as Dialog from '$lib/components/ui/dialog';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Spinner } from '$lib/components/ui/spinner';
	import { Eye, EyeOff, KeyRound, Settings2, UserRound } from 'lucide-svelte';
	import { toast } from 'svelte-sonner';
	import { untrack } from 'svelte';
	import { goto } from '$app/navigation';
	import { authUpdatePassword, authUpdateTenantName } from '$lib/api/auth';
	import { getMe } from '$lib/api/me';
	import { profilePasswordSchema, tenantNameSchema } from '$lib/schemas/auth.schema';
	import { sessionStore } from '$lib/state/session.store.svelte';
	import type { UserProfileResponse } from '$lib/types/auth.types';

	interface Props {
		open?: boolean;
		onClose?: () => void;
		onNameUpdated?: (name: string) => void;
	}

	let { open = $bindable(false), onClose, onNameUpdated }: Props = $props();

	let profile = $state<UserProfileResponse | null>(null);
	let displayName = $state('');
	let password = $state('');
	let confirmPassword = $state('');
	let isLoadingProfile = $state(false);
	let isSavingName = $state(false);
	let isUpdatingPassword = $state(false);
	let profileError = $state('');
	let nameError = $state('');
	let passwordError = $state('');
	let confirmPasswordError = $state('');
	let showPassword = $state(false);
	let showConfirmPassword = $state(false);

	async function loadProfile() {
		if (isLoadingProfile) return;
		isLoadingProfile = true;
		profileError = '';

		try {
			const result = await getMe();
			if (result.ok) {
				profile = result.data;
				displayName = result.data.tenant.name;
			} else {
				profileError = result.error.message || 'Unable to load profile details.';
			}
		} catch {
			profileError = 'Unable to load profile details.';
		} finally {
			isLoadingProfile = false;
		}
	}

	function resetPasswordForm() {
		password = '';
		confirmPassword = '';
		passwordError = '';
		confirmPasswordError = '';
		showPassword = false;
		showConfirmPassword = false;
	}

	async function handleNameSubmit(event: SubmitEvent) {
		event.preventDefault();
		nameError = '';

		const parsed = tenantNameSchema.safeParse(displayName);
		if (!parsed.success) {
			nameError = parsed.error.issues[0]?.message || 'Enter a valid display name.';
			return;
		}
		if (isSavingName) return;

		isSavingName = true;
		try {
			const result = await authUpdateTenantName({ name: parsed.data });
			if (result.ok) {
				displayName = result.data.tenant.name;
				if (profile) {
					profile = { ...profile, tenant: { ...profile.tenant, name: result.data.tenant.name } };
				}
				onNameUpdated?.(result.data.tenant.name);
				toast.success(result.data.message || 'Display name updated');
			} else {
				nameError = result.error.message || 'Unable to update display name.';
			}
		} catch {
			nameError = 'Unable to update display name.';
		} finally {
			isSavingName = false;
		}
	}

	async function handlePasswordSubmit(event: SubmitEvent) {
		event.preventDefault();
		passwordError = '';
		confirmPasswordError = '';

		const parsed = profilePasswordSchema.safeParse({ password, confirmPassword });
		if (!parsed.success) {
			for (const issue of parsed.error.issues) {
				if (issue.path[0] === 'confirmPassword') {
					confirmPasswordError = issue.message;
				} else if (!passwordError) {
					passwordError = issue.message;
				}
			}
			return;
		}
		if (isUpdatingPassword) return;

		isUpdatingPassword = true;
		try {
			const result = await authUpdatePassword({ newPassword: parsed.data.password });
			if (result.ok) {
				toast.success(result.data.message || 'Password updated. Please sign in again.');
				resetPasswordForm();
				open = false;
				sessionStore.clear();
				await goto('/login');
			} else {
				passwordError = result.error.message || 'Unable to update password.';
			}
		} catch {
			passwordError = 'Unable to update password.';
		} finally {
			isUpdatingPassword = false;
		}
	}

	$effect(() => {
		if (open) {
			untrack(() => {
				resetPasswordForm();
				void loadProfile();
			});
		}
	});
</script>

<Dialog.Root
	bind:open
	onOpenChange={(nextOpen) => {
		if (!nextOpen) onClose?.();
	}}
>
	<Dialog.Content
		showCloseButton={true}
		class="max-h-[min(720px,calc(100vh-2rem))] gap-0 overflow-y-auto rounded-[18px] border border-white/[0.1] bg-[#242322]/[0.85] p-0 text-white shadow-2xl shadow-black/40 backdrop-blur-[42px] sm:max-w-[520px]"
	>
		<Dialog.Header class="border-b border-white/[0.09] px-5 py-4 pr-14">
			<Dialog.Title
				class="flex items-center gap-2 text-[17px] font-medium tracking-[-0.02em] text-white"
			>
				<Settings2 class="size-[15px] text-white/55" strokeWidth={1.8} />
				Profile settings
			</Dialog.Title>
			<Dialog.Description class="mt-1 text-xs leading-5 text-white/45">
				Manage your workspace identity and account password.
			</Dialog.Description>
		</Dialog.Header>

		<div class="space-y-5 px-5 py-4">
			<section aria-labelledby="profile-details-title">
				<div class="mb-3 flex items-start gap-2.5">
					<div class="flex size-7 shrink-0 items-center justify-center rounded-md bg-white/[0.07]">
						<UserRound class="size-3.5 text-white/45" strokeWidth={1.8} />
					</div>
					<div class="min-w-0 flex-1">
						<h2 id="profile-details-title" class="text-sm font-medium text-white/80">
							Display name
						</h2>
						<p class="mt-0.5 text-[11px] leading-4 text-white/35">
							This name is shown across your Dokyudo workspace.
						</p>
					</div>
					{#if isLoadingProfile}
						<Spinner class="mt-1 size-3.5 text-white/40" />
					{/if}
				</div>

				<form class="space-y-2.5" onsubmit={handleNameSubmit}>
					<label for="profile-display-name" class="text-[11px] font-medium text-white/55">
						Workspace name
					</label>
					<Input
						id="profile-display-name"
						name="name"
						type="text"
						bind:value={displayName}
						disabled={isLoadingProfile || isSavingName}
						autocomplete="organization"
						placeholder="Enter a display name"
						aria-invalid={!!nameError}
						class="h-10 rounded-lg border-white/[0.12] bg-white/[0.055] text-sm text-white placeholder:text-white/28 focus-visible:border-white/30 focus-visible:ring-2 focus-visible:ring-white/10"
					/>
					{#if nameError}
						<p class="text-xs text-red-300" role="alert">{nameError}</p>
					{:else if profileError}
						<p class="text-xs text-red-300" role="alert">{profileError}</p>
					{/if}
					<div class="flex justify-end pt-0.5">
						<Button
							type="submit"
							disabled={isLoadingProfile || isSavingName || !profile}
							class="h-9 rounded-lg bg-white px-3 text-xs font-medium text-[#1B1B1B] hover:bg-white/85 disabled:opacity-40"
						>
							{#if isSavingName}
								<Spinner class="mr-1.5 size-3.5" />
								Saving...
							{:else}
								Save name
							{/if}
						</Button>
					</div>
				</form>
			</section>

			<section class="border-t border-white/[0.09] pt-5" aria-labelledby="password-title">
				<div class="mb-3 flex items-start gap-2.5">
					<div class="flex size-7 shrink-0 items-center justify-center rounded-md bg-white/[0.07]">
						<KeyRound class="size-3.5 text-white/45" strokeWidth={1.8} />
					</div>
					<div>
						<h2 id="password-title" class="text-sm font-medium text-white/80">Change password</h2>
						<p class="mt-0.5 text-[11px] leading-4 text-white/35">
							Use at least 8 characters with upper, lower, number, and symbol.
						</p>
					</div>
				</div>

				<form class="space-y-2.5" onsubmit={handlePasswordSubmit}>
					<div class="space-y-1.5">
						<label for="profile-password" class="text-[11px] font-medium text-white/55">
							New password
						</label>
						<div class="relative">
							<Input
								id="profile-password"
								name="password"
								type={showPassword ? 'text' : 'password'}
								bind:value={password}
								disabled={isUpdatingPassword}
								autocomplete="new-password"
								aria-invalid={!!passwordError}
								class="h-10 rounded-lg border-white/[0.12] bg-white/[0.055] pr-10 text-sm text-white placeholder:text-white/28 focus-visible:border-white/30 focus-visible:ring-2 focus-visible:ring-white/10"
							/>
							<button
								type="button"
								class="absolute top-1/2 right-2.5 -translate-y-1/2 rounded-md p-1 text-white/35 transition-colors hover:text-white"
								aria-label={showPassword ? 'Hide new password' : 'Show new password'}
								aria-pressed={showPassword}
								onclick={() => (showPassword = !showPassword)}
							>
								{#if showPassword}
									<EyeOff class="size-4" strokeWidth={1.8} />
								{:else}
									<Eye class="size-4" strokeWidth={1.8} />
								{/if}
							</button>
						</div>
						{#if passwordError}
							<p class="text-xs text-red-300" role="alert">{passwordError}</p>
						{/if}
					</div>

					<div class="space-y-1.5">
						<label for="profile-confirm-password" class="text-[11px] font-medium text-white/55">
							Confirm password
						</label>
						<div class="relative">
							<Input
								id="profile-confirm-password"
								name="confirmPassword"
								type={showConfirmPassword ? 'text' : 'password'}
								bind:value={confirmPassword}
								disabled={isUpdatingPassword}
								autocomplete="new-password"
								aria-invalid={!!confirmPasswordError}
								class="h-10 rounded-lg border-white/[0.12] bg-white/[0.055] pr-10 text-sm text-white placeholder:text-white/28 focus-visible:border-white/30 focus-visible:ring-2 focus-visible:ring-white/10"
							/>
							<button
								type="button"
								class="absolute top-1/2 right-2.5 -translate-y-1/2 rounded-md p-1 text-white/35 transition-colors hover:text-white"
								aria-label={showConfirmPassword
									? 'Hide password confirmation'
									: 'Show password confirmation'}
								aria-pressed={showConfirmPassword}
								onclick={() => (showConfirmPassword = !showConfirmPassword)}
							>
								{#if showConfirmPassword}
									<EyeOff class="size-4" strokeWidth={1.8} />
								{:else}
									<Eye class="size-4" strokeWidth={1.8} />
								{/if}
							</button>
						</div>
						{#if confirmPasswordError}
							<p class="text-xs text-red-300" role="alert">{confirmPasswordError}</p>
						{/if}
					</div>

					<div class="flex justify-end pt-0.5">
						<Button
							type="submit"
							disabled={isUpdatingPassword}
							class="h-9 rounded-lg bg-white px-3 text-xs font-medium text-[#1B1B1B] hover:bg-white/85 disabled:opacity-40"
						>
							{#if isUpdatingPassword}
								<Spinner class="mr-1.5 size-3.5" />
								Updating...
							{:else}
								Update password
							{/if}
						</Button>
					</div>
				</form>
			</section>
		</div>
	</Dialog.Content>
</Dialog.Root>
