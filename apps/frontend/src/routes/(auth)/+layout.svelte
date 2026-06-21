<script lang="ts">
	import vintageFloral from '$lib/assets/images/vintage_floral_bg.webp';
	import favicon from '$lib/assets/favicon.svg';

	let { children } = $props();
</script>

<!-- Layer 1: Full-screen background image -->
<div class="fixed inset-0 -z-20">
	<img src={vintageFloral} alt="" class="h-full w-full object-cover" aria-hidden="true" />
</div>

<!-- Layer 2: Dark overlay with blur -->
<div
	class="fixed inset-0 -z-10 backdrop-blur-[11px]"
	style="background-color: rgba(25, 25, 25, 0.78);"
	aria-hidden="true"
></div>

<!-- Layer 3: Card container -->
<div class="flex min-h-svh items-center justify-center p-4 md:p-8">
	<div class="grid w-full max-w-[960px] min-h-[500px] grid-cols-1 overflow-hidden rounded-[20px] md:h-[769px] md:grid-cols-2">
		<!-- Left Column: Auth Panel -->
		<div class="relative flex flex-col justify-center overflow-y-auto bg-[#1C1B1B] px-8 py-10 md:px-20 md:py-20">
			{@render children()}
		</div>

		<!-- Right Column: Hero Panel (hidden on mobile) -->
		<div
			class="relative hidden overflow-hidden md:flex md:flex-col md:items-end md:justify-between md:p-10"
		>
			<!-- Hero background: blurred floral -->
			<img
				src={vintageFloral}
				alt=""
				class="absolute right-0 top-1/2 h-[1200px] w-[1200px] -translate-y-1/2 max-w-none object-cover object-right blur-[33px]"
				aria-hidden="true"
			/>

			<!-- Noise overlay -->
			<div
				class="absolute inset-0 mix-blend-overlay"
				style="background: rgba(0, 0, 0, 0.25); filter: url('data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22><filter id=%22n%22><feTurbulence type=%22fractalNoise%22 baseFrequency=%221%22 numOctaves=%224%22 stitchTiles=%22stitch%22/></filter><rect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23n)%22/></svg>#n');"
				aria-hidden="true"
			></div>

			<!-- Brand -->
			<div class="relative z-10 flex items-center gap-0.5">
				<img src={favicon} alt="Dokyudo" class="h-7 w-auto" />
				<span
					class="text-xl font-semibold tracking-tight text-white"
					style="font-family: 'Inter Variable', sans-serif;"
				>
					okyudo
				</span>
			</div>

			<div class="relative z-10 flex flex-col items-end gap-8 text-right">
				<!-- Tagline -->
				<h2
					class="max-w-sm text-4xl leading-snug font-medium text-white"
					style="font-family: 'Inter Variable', sans-serif;"
				>
					Lorem ipsum non amet fermentum id aliquet senectus
				</h2>
			</div>

			<!-- Feature list -->
			<div class="relative z-10 flex flex-col items-end gap-8 text-right">
				<ul
					class="flex flex-col items-end gap-3 text-base text-white"
					style="font-family: 'Inter Variable', sans-serif;"
				>
					<li class="flex items-center gap-2.5">
						<span>Hybrid Semantic Search</span>
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
							><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg
						>
					</li>
					<li class="flex items-center gap-2.5">
						<span>RAG Chat Assistant</span>
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
								d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"
							/></svg
						>
					</li>
					<li class="flex items-center gap-2.5">
						<span>Enterprise-Ready</span>
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
							><rect width="18" height="11" x="3" y="11" rx="2" ry="2" /><path
								d="M7 11V7a5 5 0 0 1 10 0v4"
							/></svg
						>
					</li>
				</ul>
			</div>
		</div>
	</div>
</div>
