<script lang="ts">
	import { ArrowUpRight } from '@lucide/svelte';
</script>

<section class="features-section" id="features">
	<div class="features-header">
		<div>
			<span class="section-label">Core Capabilities</span>
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
			<div class="feature-card-image-placeholder">
				<span class="placeholder-label">Ingestion Pipeline Image</span>
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
			<div class="feature-card-image-placeholder">
				<span class="placeholder-label">RAG Q&A Streaming Image</span>
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

	.btn-outline {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		text-decoration: none;
		color: var(--dk-cream);
		font-family: var(--font-subhead);
		font-size: 14px;
		font-weight: 500;
		padding: 10px 22px;
		border-radius: var(--dk-radius-sm);
		background: transparent;
		border: 1px solid var(--dk-border-strong);
		cursor: pointer;
		transition:
			border-color 200ms cubic-bezier(0.37, 0, 0.63, 1),
			background 200ms cubic-bezier(0.37, 0, 0.63, 1),
			transform 200ms cubic-bezier(0.37, 0, 0.63, 1);
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

	.btn-primary:focus-visible,
	.btn-outline:focus-visible {
		outline: 2px solid var(--dk-copper);
		outline-offset: 2px;
	}

	.section-label {
		display: block;
		font-family: var(--font-subhead);
		font-size: var(--t-b-3);
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--dk-text-muted);
		margin-bottom: 16px;
	}

	.section-headline {
		font-family: var(--font-display);
		font-size: clamp(var(--t-h-4), 4.5vw, var(--t-h-1));
		font-weight: 400;
		color: var(--dk-cream);
		line-height: 1;
		letter-spacing: -0.02em;
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
		border-radius: 0px;
		overflow: hidden;
		position: relative;
		display: flex;
		flex-direction: column;
		border: 1px solid var(--brand-guideline-border-color);
		transition: border-color 200ms cubic-bezier(0.37, 0, 0.63, 1);
	}

	.feature-card:hover {
		border-color: var(--dk-border-strong);
	}

	.feature-card-image-placeholder {
		height: 240px;
		border-bottom: 1px dashed var(--dk-border-strong);
		background: var(--dk-bg-card);
		display: flex;
		align-items: center;
		justify-content: center;
		transition: background 200ms cubic-bezier(0.37, 0, 0.63, 1);
	}

	.feature-card:hover .feature-card-image-placeholder {
		background: var(--dk-bg-card-hover);
	}

	.placeholder-label {
		font-family: var(--font-subhead);
		font-size: var(--t-b-3);
		color: var(--dk-text-muted);
		opacity: 0.6;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.feature-card-overlay {
		padding: 15px;
		background: linear-gradient(180deg, rgba(37, 34, 32, 0.95), var(--dk-bg-card));
	}

	.feature-card-overlay h3 {
		font-family: var(--font-subhead);
		font-size: var(--t-h-4);
		font-weight: 500;
		color: var(--dk-cream);
		margin: 0 0 5px;
		letter-spacing: -0.02em;
	}

	.feature-card-overlay p {
		font-family: var(--font-body);
		font-size: var(--t-b-2);
		color: var(--dk-text-muted);
		line-height: 1.4;
		letter-spacing: -0.03em;
		margin: 0 0 20px;
	}

	.feature-card-footer {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.feature-meta {
		font-family: var(--font-subhead);
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
