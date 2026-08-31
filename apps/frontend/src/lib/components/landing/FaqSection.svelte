<script lang="ts">
</script>

<!-- ============ 8. FAQ ============ -->
<section class="section" id="faq">
	<div class="container faq-grid">
		<div class="faq__left" data-reveal>
			<h2 class="t-h2">Asked and answered.</h2>
			<p class="t-b1 shead__lead">The four questions technical reviewers open with, answered straight from the spec.</p>
		</div>

		<div class="faq__list" data-reveal style="--rd:120ms">
			<div class="acc">
				<button class="acc-btn" type="button" aria-expanded="false" aria-controls="acc1" id="accb1">
					<span>How does BYOK AES-256-GCM key security work?</span>
					<span class="acc-ico" aria-hidden="true"><svg class="ic"><use href="#i-plus"/></svg></span>
				</button>
				<div class="acc-panel" id="acc1" role="region" aria-labelledby="accb1">
					<p class="t-b2">Provider keys for Google AI, Mistral, and OpenRouter are encrypted with <code class="code">crypto.subtle</code> AES-256-GCM before any write to Supabase. The 32-byte <code class="code">BYOK_MASTER_KEY</code> lives only as a server environment variable and never touches the database or client. On each RAG stream the key is decrypted exclusively in RAM, used for that dispatch, then scrubbed/GC'd. The UI and logs only ever see a masked value like <code class="code">sk-*******************1234</code>.</p>
				</div>
			</div>

			<div class="acc">
				<button class="acc-btn" type="button" aria-expanded="false" aria-controls="acc2" id="accb2">
					<span>What is the document chunking and embedding strategy?</span>
					<span class="acc-ico" aria-hidden="true"><svg class="ic"><use href="#i-plus"/></svg></span>
				</button>
				<div class="acc-panel" id="acc2" role="region" aria-labelledby="accb2">
					<p class="t-b2">STB Worker extracts text per-page with PyMuPDF and chunks with <code class="code">tiktoken cl100k_base</code> — sliding window 1,000 tokens with 150-token overlap so tables and balance-sheet rows are not cut mid-row. DOCX uses <code class="code">python-docx</code> + OMML → LaTeX (<code class="code">$...$</code> / <code class="code">$$...$$</code>) via LibreOffice headless (with <code class="code">libreoffice-math</code>) and rare 25-char n-gram alignment (≤3 hits) to map chunks to PDF pages; TXT handles UTF-8-BOM/UTF-16/CP1252 and MD renders via <code class="code">python-markdown</code> → HTML → PDF. Chunks are batched (32) to Cloudflare Workers AI <code class="code">@cf/baai/bge-m3</code> at 1,024 dimensions (cosine) and bulk-upserted to Upstash Vector index <code class="code">dokyudo-chunks-1024</code> and Postgres <code class="code">document_chunks.metadata.pages</code> JSONB.</p>
				</div>
			</div>

			<div class="acc">
				<button class="acc-btn" type="button" aria-expanded="false" aria-controls="acc3" id="accb3">
					<span>How is the $0/month operational cost actually enforced?</span>
					<span class="acc-ico" aria-hidden="true"><svg class="ic"><use href="#i-plus"/></svg></span>
				</button>
				<div class="acc-panel" id="acc3" role="region" aria-labelledby="accb3">
					<p class="t-b2">There is no active 7-day hard-delete cron — <code class="code">dky-020</code> is still pending. Cost is contained by architecture: sovereign MinIO + Python STB Worker on the on-premise ARM64 node via Cloudflare Tunnel ($0 storage/compute), Cloudflare Workers AI for 1,024-dim embeddings, Supabase (PgBouncer <code class="code">prepare: false</code>) + Upstash Vector/Redis free tiers, and a 5-provider free LLM fallback (<code class="code">FallbackLlmService</code> with 15s TTFT timeout, Redis RPM/RPD quotas and circuit breaker 5 failures/10s → 30s open). Tier expiry is lazy-evaluated on <code class="code">GET /api/me</code> (no polling downgrade job); the only scheduled job is <code class="code">pg_cron</code> at 00:05 UTC that flips <code class="code">quota_exhausted</code> → <code class="code">confirmed</code> to resume from the last chunk checkpoint.</p>
				</div>
			</div>

			<div class="acc">
				<button class="acc-btn" type="button" aria-expanded="false" aria-controls="acc4" id="accb4">
					<span>How do the four subscription tiers and Stripe Sandbox work?</span>
					<span class="acc-ico" aria-hidden="true"><svg class="ic"><use href="#i-plus"/></svg></span>
				</button>
				<div class="acc-panel" id="acc4" role="region" aria-labelledby="accb4">
					<p class="t-b2">Tiers are <code class="code">FREE</code> (5 docs / 50 searches / 10 QA / 500 MB), <code class="code">SIMULATE</code> (50 / 500 / 100 / 2 GB, one-time 24h), <code class="code">OIL_INVESTOR</code> (unlimited FUP 50/500, 100 QA, 40 GB FUP 2 GB, one-time lifetime), and <code class="code">PRO</code> (50 / 500 / 100 / 2 GB, recurring monthly) — quotas atomically checked before presigned URL, embedding, and search. Stripe runs in sandbox with dashboard-driven <code class="code">price_id</code>: <code class="code">payment</code> mode for SIMULATE/OIL_INVESTOR and <code class="code">subscription</code> for PRO via <code class="code">POST /api/payments/checkout</code>. Webhooks verify <code class="code">Stripe-Signature</code> on <code class="code">checkout.session.completed</code>, upsert <code class="code">tenant_subscriptions</code> and emit <code class="code">billing.payment_completed</code> + Resend email; the success page must verify ownership via <code class="code">POST /api/payments/checkout/verify</code>. SIMULATE has a 30-day HMAC-SHA256 email-hash ledger (<code class="code">EMAIL_HASH_PEPPER</code>) to prevent re-claims across deleted accounts.</p>
				</div>
			</div>
		</div>
	</div>
</section>