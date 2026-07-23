<script lang="ts">
	let {
		apiError,
		lockoutEndTime = $bindable(null),
		localStorageKey = '',
		lockoutMessage = 'Too many requests. Try again in'
	}: {
		apiError: string;
		lockoutEndTime?: number | null;
		localStorageKey?: string;
		lockoutMessage?: string;
	} = $props();

	let countdownText = $state<string>('');

	$effect(() => {
		if (lockoutEndTime !== null) {
			const updateTimer = () => {
				const now = Date.now();
				if (now >= lockoutEndTime!) {
					lockoutEndTime = null;
					countdownText = '';
					localStorage.removeItem(localStorageKey);
				} else {
					const diffSeconds = Math.ceil((lockoutEndTime! - now) / 1000);
					const minutes = Math.floor(diffSeconds / 60);
					const seconds = diffSeconds % 60;
					countdownText = `${minutes}:${seconds.toString().padStart(2, '0')}`;
				}
			};

			updateTimer();
			const interval = setInterval(updateTimer, 1000);
			return () => clearInterval(interval);
		}
	});
</script>

{#if apiError || lockoutEndTime !== null}
	<div class="auth-error-box flex flex-col items-center justify-center text-center">
		{#if lockoutEndTime !== null}
			<span class="font-semibold text-[#FB6363]">Temporarily Locked</span>
			<span class="mt-1 text-sm text-white/80">
				{lockoutMessage} <span class="font-mono font-bold text-white">{countdownText}</span>
			</span>
		{:else}
			{apiError}
		{/if}
	</div>
{/if}
