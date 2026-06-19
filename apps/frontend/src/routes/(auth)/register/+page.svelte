<script lang="ts">
	import { superForm } from 'sveltekit-superforms';
	import { zod4Client as zodClient } from 'sveltekit-superforms/adapters';
	import { registerSchema } from '$lib/schemas/auth.schema';
	import { authRegister } from '$lib/api/auth';
	import { loadRecaptcha, executeRecaptcha } from '$lib/utils/recaptcha.util';
	import { PUBLIC_RECAPTCHA_SITE_KEY } from '$env/static/public';
	import * as Form from '$lib/components/ui/form';
	import { Input } from '$lib/components/ui/input';
	import { Separator } from '$lib/components/ui/separator';
	import { Button } from '$lib/components/ui/button';
	import { Spinner } from '$lib/components/ui/spinner';
	import * as Tooltip from '$lib/components/ui/tooltip';
	import { onMount } from 'svelte';

	let { data } = $props();

	let showPassword = $state(false);
	let apiError = $state('');
	let isSubmitting = $state(false);
	let registrationSuccess = $state(false);

	let lockoutEndTime = $state<number | null>(null);
	let countdownText = $state<string>('');

	$effect(() => {
		if (lockoutEndTime !== null) {
			// Run immediately once
			const updateTimer = () => {
				const now = Date.now();
				if (now >= lockoutEndTime!) {
					lockoutEndTime = null;
					countdownText = '';
					localStorage.removeItem('dokyudo_register_lockout');
				} else {
					const diffSeconds = Math.ceil((lockoutEndTime! - now) / 1000);
					const minutes = Math.floor(diffSeconds / 60);
					const seconds = diffSeconds % 60;
					countdownText = `${minutes}:${seconds.toString().padStart(2, '0')}`;
				}
			};

			updateTimer(); // Initial call to avoid 1s delay
			const interval = setInterval(updateTimer, 1000);
			return () => clearInterval(interval);
		}
	});

	const form = superForm(data.form, {
		validators: zodClient(registerSchema),
		SPA: true,
		resetForm: false,
		onUpdate: async ({ form: f }) => {
			if (!f.valid) return;

			isSubmitting = true;
			apiError = '';

			// Debug Log: Frontend State BEFORE hitting backend
			console.log('[Auth Register] Form Submitted:', {
				email: f.data.email,
				password: f.data.password,
				confirmPassword: f.data.confirmPassword
			});

			try {
				const token = await executeRecaptcha(PUBLIC_RECAPTCHA_SITE_KEY, 'register');

				const result = await authRegister({
					email: f.data.email,
					password: f.data.password,
					recaptchaToken: token
				});

				// Debug Log: Raw response AFTER hitting backend
				console.log(`[Auth Register] Backend Response (POST /api/auth/register):`, result);

				if (result.ok) {
					localStorage.removeItem('dokyudo_register_lockout');
					registrationSuccess = true;
				} else {
					if (result.error.code === 'RATE_LIMIT_EXCEEDED' && result.error.retryAfter) {
						const endTime = Date.now() + result.error.retryAfter * 1000;
						localStorage.setItem('dokyudo_register_lockout', endTime.toString());
						lockoutEndTime = endTime;
					} else {
						apiError = result.error.message;
					}
				}
			} catch (err: any) {
				apiError = 'Something went wrong. Please try again.';
				console.error('[Auth Register] Catch Error:', err);
			} finally {
				isSubmitting = false;
				f.data.password = '';
				f.data.confirmPassword = '';
			}
		}
	});

	const { form: formData, enhance } = form;

	onMount(() => {
		loadRecaptcha(PUBLIC_RECAPTCHA_SITE_KEY);

		const storedLockout = localStorage.getItem('dokyudo_register_lockout');
		if (storedLockout) {
			const end = parseInt(storedLockout, 10);
			if (end > Date.now()) {
				lockoutEndTime = end;
			} else {
				localStorage.removeItem('dokyudo_register_lockout');
			}
		}
	});
</script>

<svelte:head>
	<title>{data.title} | Dokyudo</title>
	<meta name="description" content={data.description} />
</svelte:head>

<!-- Back button -->
<Tooltip.Provider>
	<Tooltip.Root>
		<Tooltip.Trigger>
			{#snippet child({ props })}
				<a
					{...props}
					href="/"
					class="absolute top-6 left-6 flex cursor-pointer items-center justify-center rounded-md p-1.5 text-white transition-colors hover:bg-white/10 md:top-8 md:left-8"
					aria-label="Back to Home"
				>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						width="22"
						height="22"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"><path d="m12 19-7-7 7-7" /><path d="M19 12H5" /></svg
					>
				</a>
			{/snippet}
		</Tooltip.Trigger>
		<Tooltip.Content>Back to Home</Tooltip.Content>
	</Tooltip.Root>
</Tooltip.Provider>

{#if registrationSuccess}
	<!-- Success state -->
	<div class="mt-4 flex flex-col items-center gap-4 md:mt-0">
		<div class="flex h-16 w-16 items-center justify-center rounded-full bg-[#E8DEC8]/10">
			<svg
				xmlns="http://www.w3.org/2000/svg"
				width="32"
				height="32"
				viewBox="0 0 24 24"
				fill="none"
				stroke="#E8DEC8"
				stroke-width="2"
				stroke-linecap="round"
				stroke-linejoin="round"><path d="M20 6 9 17l-5-5" /></svg
			>
		</div>
		<h1 class="auth-heading text-3xl md:text-4xl">Check your email.</h1>
		<p class="auth-subheading text-white/80">
			We've sent a verification link to your email address. Please verify to complete registration.
		</p>
		<Button href="/login" variant="authPrimary" class="auth-btn-primary">Go to Sign In</Button>
	</div>
{:else}
	<!-- Header -->
	<div class="mt-4 mb-8 md:mt-0">
		<h1 class="auth-heading">Create Account.</h1>
		<p class="auth-subheading">Join us today.</p>
	</div>

	<!-- Form -->
	<form method="POST" use:enhance class="flex flex-col gap-3">
		<!-- Email -->
		<Form.Field {form} name="email">
			<Form.Control>
				{#snippet children({ props })}
					<Input
						{...props}
						type="email"
						placeholder="Email"
						autofocus={lockoutEndTime === null}
						disabled={isSubmitting || lockoutEndTime !== null}
						bind:value={$formData.email}
						variant="auth"
						class="auth-input"
					/>
				{/snippet}
			</Form.Control>
			<Form.FieldErrors class="text-xs text-[#FB6363]" />
		</Form.Field>

		<!-- Password -->
		<Form.Field {form} name="password">
			<Form.Control>
				{#snippet children({ props })}
					<div class="relative">
						<Input
							{...props}
							type={showPassword ? 'text' : 'password'}
							placeholder="Password"
							disabled={isSubmitting || lockoutEndTime !== null}
							bind:value={$formData.password}
							variant="auth"
							class="auth-input pr-12"
						/>
						<Tooltip.Provider>
							<Tooltip.Root>
								<Tooltip.Trigger>
									{#snippet child({ props })}
										<button
											{...props}
											type="button"
											class="absolute top-1/2 right-3 -translate-y-1/2 cursor-pointer rounded p-1 text-[#5D5D5D] transition-colors hover:text-white"
											onclick={() => (showPassword = !showPassword)}
											aria-label={showPassword ? 'Hide password' : 'Show password'}
										>
											{#if showPassword}
												<svg
													xmlns="http://www.w3.org/2000/svg"
													width="20"
													height="20"
													viewBox="0 0 24 24"
													fill="none"
													stroke="currentColor"
													stroke-width="2"
													stroke-linecap="round"
													stroke-linejoin="round"
													><path
														d="M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575 1 1 0 0 1 0 .696 10.747 10.747 0 0 1-1.444 2.49"
													/><path d="M14.084 14.158a3 3 0 0 1-4.242-4.242" /><path
														d="M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151 1 1 0 0 1 0-.696 10.75 10.75 0 0 1 4.446-5.143"
													/><path d="m2 2 20 20" /></svg
												>
											{:else}
												<svg
													xmlns="http://www.w3.org/2000/svg"
													width="20"
													height="20"
													viewBox="0 0 24 24"
													fill="none"
													stroke="currentColor"
													stroke-width="2"
													stroke-linecap="round"
													stroke-linejoin="round"
													><path
														d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0"
													/><circle cx="12" cy="12" r="3" /></svg
												>
											{/if}
										</button>
									{/snippet}
								</Tooltip.Trigger>
								<Tooltip.Content>{showPassword ? 'Hide Password' : 'Show Password'}</Tooltip.Content
								>
							</Tooltip.Root>
						</Tooltip.Provider>
					</div>
				{/snippet}
			</Form.Control>
			<Form.FieldErrors class="text-xs text-[#FB6363]" />
		</Form.Field>

		<!-- Confirm Password -->
		<Form.Field {form} name="confirmPassword">
			<Form.Control>
				{#snippet children({ props })}
					<div class="relative">
						<Input
							{...props}
							type={showPassword ? 'text' : 'password'}
							placeholder="Confirm Password"
							disabled={isSubmitting || lockoutEndTime !== null}
							bind:value={$formData.confirmPassword}
							variant="auth"
							class="auth-input pr-12"
						/>
						<Tooltip.Provider>
							<Tooltip.Root>
								<Tooltip.Trigger>
									{#snippet child({ props })}
										<button
											{...props}
											type="button"
											class="absolute top-1/2 right-3 -translate-y-1/2 cursor-pointer rounded p-1 text-[#5D5D5D] transition-colors hover:text-white"
											onclick={() => (showPassword = !showPassword)}
											aria-label={showPassword ? 'Hide password' : 'Show password'}
										>
											{#if showPassword}
												<svg
													xmlns="http://www.w3.org/2000/svg"
													width="20"
													height="20"
													viewBox="0 0 24 24"
													fill="none"
													stroke="currentColor"
													stroke-width="2"
													stroke-linecap="round"
													stroke-linejoin="round"
													><path
														d="M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575 1 1 0 0 1 0 .696 10.747 10.747 0 0 1-1.444 2.49"
													/><path d="M14.084 14.158a3 3 0 0 1-4.242-4.242" /><path
														d="M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151 1 1 0 0 1 0-.696 10.75 10.75 0 0 1 4.446-5.143"
													/><path d="m2 2 20 20" /></svg
												>
											{:else}
												<svg
													xmlns="http://www.w3.org/2000/svg"
													width="20"
													height="20"
													viewBox="0 0 24 24"
													fill="none"
													stroke="currentColor"
													stroke-width="2"
													stroke-linecap="round"
													stroke-linejoin="round"
													><path
														d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0"
													/><circle cx="12" cy="12" r="3" /></svg
												>
											{/if}
										</button>
									{/snippet}
								</Tooltip.Trigger>
								<Tooltip.Content>{showPassword ? 'Hide Password' : 'Show Password'}</Tooltip.Content
								>
							</Tooltip.Root>
						</Tooltip.Provider>
					</div>
				{/snippet}
			</Form.Control>
			<Form.FieldErrors class="text-xs text-[#FB6363]" />
		</Form.Field>

		<!-- Submit button -->
		<Button
			type="submit"
			disabled={isSubmitting || lockoutEndTime !== null}
			variant="authPrimary"
			class="auth-btn-primary"
		>
			{#if isSubmitting}
				<Spinner class="mr-2 size-4" />
				Creating account...
			{:else}
				Register
			{/if}
		</Button>

		<!-- Error box -->
		{#if apiError || lockoutEndTime !== null}
			<div class="auth-error-box flex flex-col items-center justify-center text-center">
				{#if lockoutEndTime !== null}
					<span class="font-semibold text-[#FB6363]">Temporarily Locked</span>
					<span class="mt-1 text-sm text-white/80">
						Registration limit reached. Try again in <span class="font-mono font-bold text-white"
							>{countdownText}</span
						>
					</span>
				{:else}
					{apiError}
				{/if}
			</div>
		{/if}
	</form>

	<!-- Separator -->
	<div class="relative my-6 flex items-center">
		<Separator class="flex-1 bg-white/20" />
		<span class="px-4 text-sm text-white" style="font-family: 'Inter Variable', sans-serif;"
			>OR</span
		>
		<Separator class="flex-1 bg-white/20" />
	</div>

	<!-- OAuth buttons -->
	<div class="flex flex-col gap-2.5">
		<Tooltip.Provider>
			<Tooltip.Root>
				<Tooltip.Trigger>
					{#snippet child({ props })}
						<Button
							{...props}
							variant="authOauth"
							class="auth-btn-oauth"
							onclick={() => console.log('Google OAuth not yet implemented')}
						>
							<svg class="mr-2" width="20" height="20" viewBox="0 0 24 24">
								<path
									d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
									fill="#4285F4"
								/>
								<path
									d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
									fill="#34A853"
								/>
								<path
									d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18A11.996 11.996 0 0 0 0 12c0 1.94.46 3.77 1.28 5.39l3.56-2.77z"
									fill="#FBBC05"
								/>
								<path
									d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
									fill="#EA4335"
								/>
							</svg>
							Register with Google
						</Button>
					{/snippet}
				</Tooltip.Trigger>
				<Tooltip.Content>Register with Google</Tooltip.Content>
			</Tooltip.Root>
		</Tooltip.Provider>

		<Tooltip.Provider>
			<Tooltip.Root>
				<Tooltip.Trigger>
					{#snippet child({ props })}
						<Button
							{...props}
							variant="authOauth"
							class="auth-btn-oauth"
							onclick={() => console.log('GitHub OAuth not yet implemented')}
						>
							<svg class="mr-2" width="20" height="20" viewBox="0 0 24 24" fill="#1C1B1B">
								<path
									d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"
								/>
							</svg>
							Register with GitHub
						</Button>
					{/snippet}
				</Tooltip.Trigger>
				<Tooltip.Content>Register with GitHub</Tooltip.Content>
			</Tooltip.Root>
		</Tooltip.Provider>
	</div>

	<!-- Footer link -->
	<p class="mt-6 text-center text-sm text-white" style="font-family: 'Inter Variable', sans-serif;">
		Already have an account?
		<Tooltip.Provider>
			<Tooltip.Root>
				<Tooltip.Trigger>
					{#snippet child({ props })}
						<a
							{...props}
							href="/login"
							class="cursor-pointer font-semibold text-white underline underline-offset-2 transition-colors hover:text-[#E8DEC8]"
						>
							Sign in
						</a>
					{/snippet}
				</Tooltip.Trigger>
				<Tooltip.Content>Login to your account</Tooltip.Content>
			</Tooltip.Root>
		</Tooltip.Provider>
	</p>
{/if}
