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
					<p class="t-b2">Your provider key is encrypted with the Web Crypto API before it is written to Supabase, using a 32-byte master encryption key held only as a Deno Deploy environment variable. Decryption happens in memory at request time and is garbage-collected immediately. The UI only ever sees a masked tail like <code class="code">sk-proj-***789</code>, and all logs are sanitized.</p>
				</div>
			</div>

			<div class="acc">
				<button class="acc-btn" type="button" aria-expanded="false" aria-controls="acc2" id="accb2">
					<span>What is the financial report chunking strategy?</span>
					<span class="acc-ico" aria-hidden="true"><svg class="ic"><use href="#i-plus"/></svg></span>
				</button>
				<div class="acc-panel" id="acc2" role="region" aria-labelledby="accb2">
					<p class="t-b2">Text is split with a sliding window of 1,000 to 1,500 tokens and a 150-token overlap, sized so balance sheets and note tables are never cut horizontally. Each chunk is embedded with gemini-embedding-2 at a forced 768 dimensions and pushed to the HNSW index on Upstash Vector.</p>
				</div>
			</div>

			<div class="acc">
				<button class="acc-btn" type="button" aria-expanded="false" aria-controls="acc3" id="accb3">
					<span>How does the automated 7-day teardown protect the $0 cost?</span>
					<span class="acc-ico" aria-hidden="true"><svg class="ic"><use href="#i-plus"/></svg></span>
				</button>
				<div class="acc-panel" id="acc3" role="region" aria-labelledby="accb3">
					<p class="t-b2">A daily cron hard-deletes chunks, vectors, and MinIO objects older than 7 days for non-admin tenants, and an hourly job cascades expired PRO (SIMULATE) accounts: files, vectors, counters, and tier. Storage quotas never reset, so this sweep is what keeps Supabase and Upstash inside their free tiers.</p>
				</div>
			</div>

			<div class="acc">
				<button class="acc-btn" type="button" aria-expanded="false" aria-controls="acc4" id="accb4">
					<span>How does the Investor tier unlock the global platform?</span>
					<span class="acc-ico" aria-hidden="true"><svg class="ic"><use href="#i-plus"/></svg></span>
				</button>
				<div class="acc-panel" id="acc4" role="region" aria-labelledby="accb4">
					<p class="t-b2">The first verified Investor webhook flips a global feature flag. From that moment PRO (REAL) becomes purchasable for every tenant. One sandbox invoice, Rp 1,440,000, opens the B2B tier for the whole platform. Try it in the Tiers section above.</p>
				</div>
			</div>
		</div>
	</div>
</section>