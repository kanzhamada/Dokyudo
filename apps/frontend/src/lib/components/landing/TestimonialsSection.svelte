<script lang="ts">
	import { Star } from '@lucide/svelte';

	let activeTestimonial = $state(0);

	const testimonials = [
		{
			avatar: 'AS',
			name: 'Arif Setiawan',
			role: 'Financial Analyst',
			rating: '4.9 Rating',
			quote:
				'Dokyudo cut our quarterly report analysis time from days to minutes. The semantic search finds exactly what we need across hundreds of pages, and the RAG answers are accurate with proper citations.'
		},
		{
			avatar: 'DR',
			name: 'Diana Rahmawati',
			role: 'Research Lead',
			rating: '5.0 Rating',
			quote:
				'The hybrid search capability is incredible. Combining keyword and vector search gives us complete confidence when auditing financial research documents.'
		},
		{
			avatar: 'BW',
			name: 'Budi Wicaksono',
			role: 'Portfolio Manager',
			rating: '4.8 Rating',
			quote:
				'The streaming RAG Q&A with multi-provider fallback guarantees zero downtime. We rely on Dokyudo daily for deep portfolio due diligence.'
		},
		{
			avatar: 'SP',
			name: 'Sari Putri',
			role: 'Compliance Officer',
			rating: '4.9 Rating',
			quote:
				'Tenant data isolation and BYOK encryption were mandatory for our enterprise compliance. Dokyudo delivers security without sacrificing speed.'
		}
	];
</script>

<section class="testimonials-section" id="testimonials">
	<div class="testimonials-header">
		<span class="section-label">✦ Testimonials</span>
		<div class="testimonials-headline-wrap">
			<div class="features-line"></div>
			<h2 class="section-headline testimonial-headline">What teams are saying.</h2>
			<div class="features-line"></div>
		</div>
	</div>

	<div class="testimonials-grid">
		<!-- Left: Names List -->
		<div class="testimonial-names">
			{#each testimonials as item, i}
				<button
					type="button"
					class="testimonial-name-card"
					class:active={activeTestimonial === i}
					onclick={() => (activeTestimonial = i)}
				>
					<div class="testimonial-avatar">{item.avatar}</div>
					<div>
						<strong>{item.name}</strong>
						<span>{item.role}</span>
					</div>
				</button>
			{/each}
		</div>

		<!-- Center: Featured Image -->
		<div class="testimonial-center-image">
			<img
				src="/landing/about-workspace.jpg"
				alt="Team using Dokyudo for financial analysis"
				loading="lazy"
			/>
		</div>

		<!-- Right: Quote Card -->
		<div class="testimonial-quote-card">
			<div class="quote-badge">
				<Star size={14} fill="var(--color-dk-copper)" stroke="var(--color-dk-copper)" />
				<span>{testimonials[activeTestimonial].rating}</span>
			</div>
			<div class="quote-marks">"</div>
			<p class="quote-text">
				"{testimonials[activeTestimonial].quote}"
			</p>
			<div class="quote-author-mark">
				<svg width="40" height="28" viewBox="0 0 40 28" fill="none">
					<rect width="40" height="28" rx="6" fill="var(--color-dk-bg-deep)" />
					<text
						x="8"
						y="19"
						font-family="Geist Sans, sans-serif"
						font-size="11"
						fill="var(--color-dk-copper)"
						font-weight="600">{testimonials[activeTestimonial].avatar}</text
					>
				</svg>
			</div>
		</div>
	</div>
</section>

<style>
	section {
		font-family: 'Geist Sans', 'Inter Variable', system-ui, sans-serif;
		color: var(--dk-light);
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
		margin: 0 auto;
	}

	.testimonials-section {
		background: var(--dk-bg);
		padding: var(--dk-section-py) var(--dk-section-px);
		flex: 1;
		display: flex;
		flex-direction: column;
		justify-content: center;
	}

	.testimonials-header {
		max-width: var(--dk-max-width);
		margin: 0 auto 48px;
		text-align: center;
		width: 100%;
	}

	.testimonials-headline-wrap {
		max-width: var(--dk-max-width);
		margin: 0 auto;
		width: 100%;
	}

	.testimonial-headline {
		padding: 24px 0;
	}

	.testimonials-grid {
		max-width: var(--dk-max-width);
		margin: 0 auto;
		display: grid;
		grid-template-columns: 200px 1fr 1.2fr;
		gap: 20px;
		align-items: stretch;
		width: 100%;
	}

	.testimonial-names {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.testimonial-name-card {
		padding: 14px 16px;
		border-radius: var(--dk-radius-sm);
		border: 1px solid var(--dk-border);
		background: transparent;
		display: flex;
		align-items: center;
		gap: 12px;
		transition:
			background 0.2s ease,
			border-color 0.2s ease;
		cursor: pointer;
		text-align: left;
		font-family: inherit;
		width: 100%;
	}

	.testimonial-name-card:hover,
	.testimonial-name-card.active {
		background: var(--dk-bg-card);
		border-color: var(--dk-border-strong);
	}

	.testimonial-avatar {
		width: 36px;
		height: 36px;
		border-radius: 50%;
		background: var(--dk-bg-deep);
		border: 1px solid var(--dk-border-strong);
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 12px;
		font-weight: 600;
		color: var(--dk-copper);
		flex-shrink: 0;
	}

	.testimonial-name-card strong {
		font-size: 14px;
		color: var(--dk-cream);
		display: block;
		letter-spacing: -0.01em;
	}

	.testimonial-name-card span {
		font-size: 12px;
		color: var(--dk-text-muted);
	}

	.testimonial-center-image {
		border-radius: var(--dk-radius);
		overflow: hidden;
		min-height: 360px;
	}

	.testimonial-center-image img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.testimonial-quote-card {
		background: rgba(232, 222, 200, 0.06);
		border: 1px solid var(--dk-border);
		border-radius: var(--dk-radius);
		padding: 32px;
		display: flex;
		flex-direction: column;
		position: relative;
	}

	.quote-badge {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		background: var(--dk-bg-card);
		border: 1px solid var(--dk-border-strong);
		border-radius: var(--dk-radius-pill);
		padding: 6px 14px;
		font-size: 12px;
		color: var(--dk-copper);
		font-weight: 500;
		align-self: flex-end;
		margin-bottom: 16px;
	}

	.quote-marks {
		font-size: 56px;
		color: var(--dk-copper);
		line-height: 0.8;
		opacity: 0.4;
		font-family: Georgia, 'Times New Roman', serif;
		margin-bottom: 8px;
	}

	.quote-text {
		font-size: 16px;
		color: var(--dk-cream);
		line-height: 1.65;
		margin: 0;
		flex: 1;
		font-style: normal;
	}

	.quote-author-mark {
		margin-top: 24px;
	}

	@media (max-width: 1024px) {
		.testimonials-grid {
			grid-template-columns: 1fr;
			gap: 20px;
		}

		.testimonial-names {
			flex-direction: row;
			overflow-x: auto;
			gap: 8px;
			padding-bottom: 8px;
		}

		.testimonial-name-card {
			min-width: 180px;
		}
	}

	@media (max-width: 768px) {
		.testimonial-center-image {
			min-height: 240px;
		}
	}
</style>
