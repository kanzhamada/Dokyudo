<script lang="ts">
	import { Shield, Zap, Lock, ArrowUpRight } from '@lucide/svelte';
</script>

<div class="snap-section">
	<section class="about-section" id="about">
		<div class="about-inner">
			<div class="about-image">
				<img
					src="/landing/about-workspace.jpg"
					alt="Analyst working with financial reports"
					loading="lazy"
				/>
			</div>
			<div class="about-content">
				<span class="section-label">✦ About Dokyudo</span>
				<h2 class="section-headline">Precise answers from dense financial reports.</h2>
				<p class="section-body">
					Dokyudo transforms how teams interact with financial documents. Upload annual reports,
					search across them semantically, and ask contextual questions. Our hybrid search engine
					combines vector similarity with full-text matching for unmatched accuracy.
				</p>
				<a href="/auth/register" class="btn-primary">
					Know More
					<ArrowUpRight size={15} strokeWidth={2.5} />
				</a>

				<!-- Value Cards Row -->
				<div class="about-cards">
					<div class="value-card">
						<div class="value-icon">
							<Shield size={22} />
						</div>
						<h3>Data Isolation</h3>
						<p>Multi-tenant architecture with strict per-query tenant scoping.</p>
					</div>
					<div class="value-card">
						<div class="value-icon">
							<Zap size={22} />
						</div>
						<h3>Sub-500ms Search</h3>
						<p>Hybrid RRF search delivers P95 latency under 500 milliseconds.</p>
					</div>
					<div class="value-card">
						<div class="value-icon">
							<Lock size={22} />
						</div>
						<h3>BYOK Encryption</h3>
						<p>AES-256-GCM encryption for your own API keys. Zero plaintext storage.</p>
					</div>
				</div>
			</div>
		</div>
	</section>
</div>

<style>
	.snap-section {
		scroll-snap-align: start;
		min-height: 100vh;
		display: flex;
		flex-direction: column;
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
		border-radius: var(--dk-radius-pill);
		background: var(--dk-copper);
		border: none;
		cursor: pointer;
		transition:
			background 0.2s ease,
			transform 0.15s ease;
		letter-spacing: -0.01em;
	}

	.btn-primary:hover {
		background: var(--color-dk-copper-hover);
		transform: translateY(-1px);
	}

	.btn-primary:active {
		transform: scale(0.98);
	}

	.section-label {
		display: block;
		font-size: 13px;
		color: var(--dk-text-muted);
		letter-spacing: 0.02em;
		margin-bottom: 16px;
	}

	.section-headline {
		font-size: clamp(32px, 5vw, 48px);
		font-weight: 500;
		color: var(--dk-cream);
		line-height: 1.1;
		letter-spacing: -0.03em;
		margin: 0;
	}

	.section-body {
		font-size: 15px;
		color: var(--dk-text-muted);
		line-height: 1.7;
		max-width: 50ch;
		margin: 20px 0 28px;
	}

	.about-section {
		background: var(--dk-bg);
		padding: var(--dk-section-py) var(--dk-section-px);
		flex: 1;
		display: flex;
		flex-direction: column;
		justify-content: center;
	}

	.about-inner {
		max-width: var(--dk-max-width);
		margin: 0 auto;
		display: grid;
		grid-template-columns: 1fr 1.3fr;
		gap: 56px;
		align-items: start;
	}

	.about-image {
		border-radius: var(--dk-radius);
		overflow: hidden;
		aspect-ratio: 4/5;
	}

	.about-image img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.about-cards {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 16px;
		margin-top: 36px;
	}

	.value-card {
		padding: 24px;
		border-radius: var(--dk-radius);
		border: 1px solid var(--dk-border);
		background: var(--dk-bg-card);
		transition:
			border-color 0.25s ease,
			background 0.25s ease;
	}

	.value-card:hover {
		border-color: var(--dk-border-strong);
		background: var(--dk-bg-card-hover);
	}

	.value-icon {
		width: 44px;
		height: 44px;
		border-radius: 50%;
		background: var(--dk-bg-deep);
		border: 1px solid var(--dk-border-strong);
		display: flex;
		align-items: center;
		justify-content: center;
		color: var(--dk-copper);
		margin-bottom: 16px;
	}

	.value-card h3 {
		font-size: 15px;
		font-weight: 600;
		color: var(--dk-cream);
		margin: 0 0 8px;
		letter-spacing: -0.01em;
	}

	.value-card p {
		font-size: 13px;
		color: var(--dk-text-muted);
		line-height: 1.55;
		margin: 0;
	}
</style>
