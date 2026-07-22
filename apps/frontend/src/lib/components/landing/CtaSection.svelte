<script lang="ts">
	import { ArrowUpRight } from '@lucide/svelte';
</script>

<section class="cta-section">
	<div class="cta-card">
		<div class="cta-content">
			<h2 class="cta-headline">Start searching your documents intelligently.</h2>
			<div class="cta-mini-card">
				<img src="/landing/feature-rag-chat.jpg" alt="Dokyudo AI chat" loading="lazy" />
				<p>Hybrid search across all your reports.</p>
				<a href="/auth/register" class="btn-primary btn-sm">
					Get Started
					<ArrowUpRight size={13} strokeWidth={2.5} />
				</a>
			</div>
		</div>
		<div class="cta-image">
			<img src="/landing/cta-person.jpg" alt="Professional using Dokyudo" loading="lazy" />
		</div>
	</div>
</section>

<style>
	section {
		font-family: 'Geist Sans', 'Inter Variable', system-ui, sans-serif;
		color: var(--dk-light);
	}

	.btn-primary {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		text-decoration: none;
		color: var(--dk-bg);
		font-size: 14px;
		font-weight: 600;
		padding: 10px 22px;
		border-radius: var(--dk-radius-sm);
		background: var(--dk-copper);
		border: none;
		cursor: pointer;
		transition:
			background 200ms cubic-bezier(0.37, 0, 0.63, 1),
			transform 200ms cubic-bezier(0.37, 0, 0.63, 1);
		letter-spacing: -0.01em;
	}

	.btn-primary:hover {
		background: var(--color-dk-copper-hover);
		transform: translateY(-1px);
	}

	.btn-primary:active {
		transform: scale(0.98);
	}

	.btn-primary.btn-sm {
		font-size: 13px;
		padding: 8px 18px;
	}

	.cta-section {
		background: var(--dk-bg);
		padding: 0 var(--dk-section-px) var(--dk-section-py);
	}

	.cta-card {
		max-width: var(--dk-max-width);
		margin: 0 auto;
		display: grid;
		grid-template-columns: 1fr 1.2fr;
		border-radius: 0px;
		overflow: hidden;
		background: var(--dk-bg-card);
		border: 1px solid var(--dk-border);
		min-height: 400px;
		width: 100%;
	}

	.cta-content {
		padding: 48px;
		display: flex;
		flex-direction: column;
		justify-content: space-between;
	}

	.cta-headline {
		font-size: clamp(28px, 4vw, 40px);
		font-weight: 500;
		color: var(--dk-cream);
		line-height: 1.1;
		letter-spacing: -0.03em;
		margin: 0;
	}

	.cta-mini-card {
		background: var(--dk-bg-deep);
		border: 1px solid var(--dk-border);
		border-radius: 0px;
		padding: 15px;
		margin-top: 32px;
	}

	.cta-mini-card img {
		width: 100%;
		height: 80px;
		object-fit: cover;
		border-radius: 8px;
		margin-bottom: 12px;
	}

	.cta-mini-card p {
		font-size: 14px;
		color: var(--dk-cream);
		line-height: 1.3;
		letter-spacing: -0.02em;
		margin: 0 0 5px;
		font-weight: 500;
	}

	.cta-image {
		overflow: hidden;
	}

	.cta-image img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	@media (max-width: 1024px) {
		.cta-card {
			grid-template-columns: 1fr;
		}

		.cta-image {
			height: 280px;
		}
	}

	@media (max-width: 768px) {
		.cta-content {
			padding: 32px;
		}
	}
</style>
