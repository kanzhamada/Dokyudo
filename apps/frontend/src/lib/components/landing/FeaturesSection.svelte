<script lang="ts">
	import { ArrowUpRight } from '@lucide/svelte';
</script>

<section class="features-section" id="features">
	<div class="features-header">
		<div>
			<span class="section-label">✦ Core Capabilities</span>
			<h2 class="section-headline">Intelligence built into every layer.</h2>
		</div>
		<a href="/auth/register" class="btn-outline btn-outline-sm">
			All Features
			<ArrowUpRight size={14} strokeWidth={2} />
		</a>
	</div>

	<div class="features-line"></div>

	<div class="feature-cards-grid">
		<div class="feature-card">
			<div class="feature-card-image">
				<img
					src="/landing/feature-upload.jpg"
					alt="Document ingestion pipeline"
					loading="lazy"
				/>
			</div>
			<div class="feature-card-overlay">
				<h3>Semantic Document Ingestion</h3>
				<p>
					Upload PDFs, DOCX, and TXT files. Our pipeline extracts text, chunks it with
					finance-optimized 1,000-1,500 token windows, and generates 768-dimension embeddings
					via Gemini. All processing is rate-limited and auto-throttled.
				</p>
				<div class="feature-card-footer">
					<a href="/auth/register" class="btn-primary btn-sm">
						Read More
						<ArrowUpRight size={13} strokeWidth={2.5} />
					</a>
					<span class="feature-meta">PDF · DOCX · TXT</span>
				</div>
			</div>
		</div>

		<div class="feature-card">
			<div class="feature-card-image">
				<img
					src="/landing/feature-rag-chat.jpg"
					alt="RAG Q&A streaming interface"
					loading="lazy"
				/>
			</div>
			<div class="feature-card-overlay">
				<h3>RAG Q&A with Streaming</h3>
				<p>
					Ask questions across your uploaded documents. The RAG engine retrieves relevant
					context via hybrid search, builds a prompt, and streams the answer in real-time using
					Server-Sent Events with multi-provider LLM fallback.
				</p>
				<div class="feature-card-footer">
					<a href="/auth/register" class="btn-primary btn-sm">
						Read More
						<ArrowUpRight size={13} strokeWidth={2.5} />
					</a>
					<span class="feature-meta">SSE · Multi-LLM</span>
				</div>
			</div>
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

	.btn-primary.btn-sm {
		font-size: 13px;
		padding: 8px 18px;
	}

	.btn-outline {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		text-decoration: none;
		color: var(--dk-cream);
		font-size: 14px;
		font-weight: 500;
		padding: 10px 22px;
		border-radius: var(--dk-radius-pill);
		background: transparent;
		border: 1px solid var(--dk-border-strong);
		cursor: pointer;
		transition:
			border-color 0.2s ease,
			background 0.2s ease,
			transform 0.15s ease;
		letter-spacing: -0.01em;
	}

	.btn-outline:hover {
		border-color: var(--dk-copper);
		background: var(--dk-accent-glow);
		transform: translateY(-1px);
	}

	.btn-outline:active {
		transform: scale(0.98);
	}

	.btn-outline.btn-sm,
	.btn-outline.btn-outline-sm {
		font-size: 13px;
		padding: 8px 18px;
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

	.features-section {
		background: var(--dk-bg);
		padding: var(--dk-section-py) var(--dk-section-px);
		flex: 1;
		display: flex;
		flex-direction: column;
		justify-content: center;
	}

	.features-header {
		max-width: var(--dk-max-width);
		margin: 0 auto 20px;
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		width: 100%;
	}

	.features-line {
		height: 1px;
		background: linear-gradient(
			90deg,
			transparent,
			var(--dk-border-strong) 20%,
			var(--dk-border-strong) 80%,
			transparent
		);
		max-width: var(--dk-max-width);
		width: 100%;
		margin: 0 auto 40px;
	}

	.feature-cards-grid {
		max-width: var(--dk-max-width);
		margin: 0 auto;
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 20px;
		width: 100%;
	}

	.feature-card {
		border-radius: var(--dk-radius);
		overflow: hidden;
		position: relative;
		display: flex;
		flex-direction: column;
		border: 1px solid var(--dk-border);
		transition: border-color 0.3s ease;
	}

	.feature-card:hover {
		border-color: var(--dk-border-strong);
	}

	.feature-card-image {
		height: 280px;
		overflow: hidden;
	}

	.feature-card-image img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		transition: transform 0.6s ease;
	}

	.feature-card:hover .feature-card-image img {
		transform: scale(1.04);
	}

	.feature-card-overlay {
		padding: 28px;
		background: linear-gradient(180deg, rgba(37, 34, 32, 0.95), var(--dk-bg-card));
	}

	.feature-card-overlay h3 {
		font-size: 22px;
		font-weight: 600;
		color: var(--dk-cream);
		margin: 0 0 12px;
		letter-spacing: -0.02em;
	}

	.feature-card-overlay p {
		font-size: 14px;
		color: var(--dk-text-muted);
		line-height: 1.65;
		margin: 0 0 20px;
	}

	.feature-card-footer {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.feature-meta {
		font-size: 12px;
		color: var(--dk-text-muted);
		letter-spacing: 0.04em;
	}

	@media (max-width: 1024px) {
		.feature-cards-grid {
			grid-template-columns: 1fr;
		}
	}
</style>
