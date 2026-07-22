<script lang="ts">
	import { ArrowUpRight } from '@lucide/svelte';
</script>

<section class="cta-section">
	<div class="cta-card">
		<div class="cta-content">
			<h2 class="cta-headline">Start searching your documents intelligently.</h2>
			<div class="cta-mini-card">
				<div class="mini-card-image-placeholder">
					<span class="placeholder-label">UI Preview Image</span>
				</div>
				<p>Hybrid search across all your reports.</p>
				<a href="/auth/register" class="btn-primary btn-sm">
					Get Started
					<ArrowUpRight size={13} strokeWidth={2.5} />
				</a>
			</div>
		</div>
		<div class="cta-image-placeholder">
			<span class="placeholder-label">Feature Overview Image</span>
		</div>
	</div>
</section>

<style>
	section {
		font-family: var(--font-body);
		color: var(--dk-light);
	}

	.btn-primary {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		text-decoration: none;
		color: var(--dk-bg);
		font-family: var(--font-subhead);
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

	.btn-primary:focus-visible {
		outline: 2px solid var(--dk-copper);
		outline-offset: 2px;
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
		border: 1px solid var(--brand-guideline-border-color);
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
		font-family: var(--font-display);
		font-size: clamp(var(--t-h-4), 4vw, var(--t-h-2));
		font-weight: 400;
		color: var(--dk-cream);
		line-height: 1;
		letter-spacing: -0.02em;
		margin: 0;
	}

	.cta-mini-card {
		background: var(--dk-bg-deep);
		border: 1px solid var(--brand-guideline-border-color);
		border-radius: 0px;
		padding: 15px;
		margin-top: 32px;
	}

	.mini-card-image-placeholder {
		width: 100%;
		height: 80px;
		border: 1px dashed var(--dk-border-strong);
		background: var(--dk-bg-card);
		border-radius: 0px;
		display: flex;
		align-items: center;
		justify-content: center;
		margin-bottom: 12px;
	}

	.placeholder-label {
		font-family: var(--font-subhead);
		font-size: var(--t-b-3);
		color: var(--dk-text-muted);
		opacity: 0.6;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.cta-mini-card p {
		font-family: var(--font-subhead);
		font-size: var(--t-b-2);
		color: var(--dk-cream);
		line-height: 1.3;
		letter-spacing: -0.02em;
		margin: 0 0 8px;
		font-weight: 500;
	}

	.cta-image-placeholder {
		border-left: 1px dashed var(--dk-border-strong);
		background: var(--dk-bg-deep);
		display: flex;
		align-items: center;
		justify-content: center;
		min-height: 300px;
	}

	@media (max-width: 1024px) {
		.cta-card {
			grid-template-columns: 1fr;
		}

		.cta-image-placeholder {
			min-height: 240px;
			border-left: none;
			border-top: 1px dashed var(--dk-border-strong);
		}
	}

	@media (max-width: 768px) {
		.cta-content {
			padding: 32px;
		}
	}
</style>
