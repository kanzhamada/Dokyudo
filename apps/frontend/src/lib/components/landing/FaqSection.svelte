<script lang="ts">
	import { Plus, Minus } from '@lucide/svelte';

	let openFaq = $state(0);

	function toggleFaq(index: number) {
		openFaq = openFaq === index ? -1 : index;
	}

	const faqs = [
		{
			q: 'What document formats does Dokyudo support?',
			a: 'Dokyudo supports PDF, DOCX, and TXT file formats. Our ingestion pipeline extracts text, generates optimized chunks, and creates high-fidelity 768-dimension vector embeddings for semantic search.'
		},
		{
			q: 'How does hybrid semantic search work?',
			a: 'We combine vector similarity search via Upstash Vector with full-text search on PostgreSQL, then merge results using Reciprocal Rank Fusion (RRF). This delivers both conceptual and keyword-level accuracy.'
		},
		{
			q: 'Is my data isolated from other tenants?',
			a: 'Absolutely. Every database query is scoped by your tenant ID. Document storage, vector embeddings, and conversation history are strictly isolated at the architectural level.'
		},
		{
			q: 'What LLM providers power the Q&A?',
			a: 'Dokyudo uses a multi-provider fallback chain including Groq, Gemini Flash, and Cohere for zero-cost high availability. You can also bring your own OpenAI or Claude API key via our BYOK feature.'
		},
		{
			q: 'How are my API keys secured?',
			a: 'Keys are encrypted using AES-256-GCM with a Master Encryption Key stored exclusively in the runtime environment. Keys are never stored in plaintext and are decrypted only in memory for the duration of a request.'
		},
		{
			q: 'What are the free tier limits?',
			a: 'Free tier includes 5 document uploads per month, 50 search queries, 10 Q&A queries, and 500 MB of storage. Counters reset on the 1st of each month.'
		}
	];
</script>

<section class="faq-section" id="faq">
	<div class="faq-inner">
		<div class="faq-left">
			<span class="section-label">FAQ</span>
			<h2 class="section-headline">
				Frequently Asked<br />Questions
			</h2>
			<div class="faq-image-placeholder">
				<span class="placeholder-label">Tech Diagram Image</span>
			</div>
		</div>

		<div class="faq-right">
			{#each faqs as faq, i}
				<button
					class="faq-item"
					class:faq-open={openFaq === i}
					onclick={() => toggleFaq(i)}
					aria-expanded={openFaq === i}
					id="faq-item-{i}"
				>
					<div class="faq-question">
						<span>{faq.q}</span>
						<div class="faq-toggle">
							{#if openFaq === i}
								<Minus size={16} strokeWidth={2.5} />
							{:else}
								<Plus size={16} strokeWidth={2.5} />
							{/if}
						</div>
					</div>
					{#if openFaq === i}
						<div class="faq-answer">
							<p>{faq.a}</p>
						</div>
					{/if}
				</button>
			{/each}
		</div>
	</div>
</section>

<style>
	section {
		font-family: var(--font-body);
		color: var(--dk-light);
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

	.faq-section {
		background: var(--dk-bg);
		padding: var(--dk-section-py) var(--dk-section-px);
		flex: 1;
		display: flex;
		flex-direction: column;
		justify-content: center;
	}

	.faq-inner {
		max-width: var(--dk-max-width);
		margin: 0 auto;
		display: grid;
		grid-template-columns: 1fr 1.3fr;
		gap: 56px;
		align-items: start;
		width: 100%;
	}

	.faq-left {
		position: sticky;
		top: 100px;
	}

	.faq-image-placeholder {
		border-radius: 0px;
		border: 1px dashed var(--dk-border-strong);
		background: var(--dk-bg-card);
		display: flex;
		align-items: center;
		justify-content: center;
		margin-top: 28px;
		aspect-ratio: 4/3;
	}

	.placeholder-label {
		font-family: var(--font-subhead);
		font-size: var(--t-b-3);
		color: var(--dk-text-muted);
		opacity: 0.6;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.faq-right {
		display: flex;
		flex-direction: column;
		gap: 0;
	}

	.faq-item {
		width: 100%;
		text-align: left;
		background: none;
		border: none;
		border-top: 1px solid var(--brand-guideline-border-color);
		padding: 24px 0;
		cursor: pointer;
		color: inherit;
		font-family: var(--font-subhead);
		transition: background 200ms cubic-bezier(0.37, 0, 0.63, 1);
	}

	.faq-item:last-child {
		border-bottom: 1px solid var(--brand-guideline-border-color);
	}

	.faq-item:focus-visible {
		outline: 2px solid var(--dk-copper);
		outline-offset: -2px;
	}

	.faq-question {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 16px;
	}

	.faq-question span {
		font-family: var(--font-subhead);
		font-size: var(--t-b-1);
		color: var(--dk-cream);
		font-weight: 500;
		letter-spacing: -0.02em;
	}

	.faq-toggle {
		width: 32px;
		height: 32px;
		border-radius: 50%;
		background: var(--dk-copper);
		color: var(--dk-bg);
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
		transition: background 200ms cubic-bezier(0.37, 0, 0.63, 1);
	}

	.faq-open .faq-toggle {
		background: var(--dk-copper);
	}

	.faq-answer {
		padding-top: 16px;
	}

	.faq-answer p {
		font-family: var(--font-body);
		font-size: var(--t-b-2);
		color: var(--dk-text-muted);
		line-height: 1.4;
		letter-spacing: -0.03em;
		margin: 0;
		max-width: 56ch;
	}

	@media (max-width: 1024px) {
		.faq-inner {
			grid-template-columns: 1fr;
			gap: 32px;
		}

		.faq-left {
			position: static;
		}

		.faq-image-placeholder {
			display: none;
		}
	}
</style>
