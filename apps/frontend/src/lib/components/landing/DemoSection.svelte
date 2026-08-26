<script lang="ts">
</script>

<!-- ============ 4. INTERACTIVE FEATURE PREVIEW ============ -->
<section class="section section--white" id="demo">
	<div class="container">
		<div class="shead" data-reveal>
			<h2 class="t-h2">Watch a retrieval happen.</h2>
			<p class="t-b1 shead__lead">A simulated run of the RAG pipeline: BGE-M3 (1024-dim) vector + PostgreSQL FTS scatter-gather, in-memory RRF fusion (k=60, 2:1 FTS weight), prompt injection gatekeeper, and SSE streaming with verified [Doc N: Page X] citations.</p>
		</div>

		<div class="console" id="console" data-reveal>
			<!-- controls -->
			<div class="console__side">
				<label class="t-tag console__label" for="qInput">Question</label>
				<input class="console__q" id="qInput" type="text" value="What is the Q3 EBITDA breakdown in Section 4.2?" autocomplete="off" spellcheck="false" />

				<div class="console__byok">
					<div class="console__byok-row">
						<button class="switch" id="byokSwitch" type="button" role="switch" aria-checked="false" aria-label="Toggle BYOK routing">
							<span class="switch__knob"></span>
						</button>
						<div>
							<p class="console__byok-title">BYOK routing</p>
							<p class="console__byok-sub">route via your own provider key</p>
						</div>
					</div>
					<div class="console__key" id="keyBlock">
						<svg class="ic" aria-hidden="true"><use href="#i-shield"/></svg>
						<code>sk-proj-*******************789</code>
						<span class="t-tag console__key-tag">AES-256-GCM</span>
					</div>
					<p class="console__route t-tag" id="routeLine">platform gateway / groq → gemini → cohere (LIGHT / MEDIUM / HEAVY tiers)</p>
				</div>

				<button class="btn btn--primary console__run" id="runBtn" type="button">
					<svg class="ic" aria-hidden="true"><use href="#i-bolt"/></svg>
					<span id="runLabel">Run Query</span>
				</button>
				<p class="console__note t-b3">Pre-flight injection gatekeeper verified. Context engineered with 1,000-token sliding windows and top-3 chunks lazy-hydrated into prompt.</p>
			</div>

			<!-- stream -->
			<div class="console__main">
				<div class="console__head">
					<span class="t-tag">Answer stream / SSE Push</span>
					<span class="st" id="stPill">
						<span class="st__dot" id="stDot"></span>
						<span id="stText">ready / circuit closed</span>
					</span>
				</div>

				<div class="console__answer" id="answerBox" aria-live="off">
					<span id="answerText"></span><span class="cursor" id="cursor" aria-hidden="true"></span>
				</div>
				<p class="sr-only" id="answerSummary" role="status"></p>

				<div class="console__lat" aria-hidden="true">
					<span class="lat" style="--ld:0s">scatter-gather 187 ms (BGE-M3 + FTS)</span>
					<span class="lat" style="--ld:.08s">first token 412 ms</span>
					<span class="lat" style="--ld:.16s">74 tokens / sse</span>
					<span class="lat" style="--ld:.24s">RRF k=60 (2:1 FTS)</span>
				</div>

				<p class="t-tag console__chunks-title">Source chunks / top 3 of 128 (fused with RRF k=60, 2:1 FTS)</p>
				<div class="console__chunks">
					<article class="chunkcard" data-idx="0">
						<span class="chunkcard__rank">1</span>
						<div>
							<p class="chunkcard__name"><span class="ftag">PDF</span> FY2025_Annual_Report.pdf</p>
							<p class="chunkcard__meta t-tag">Section 4.2 / Page 47 <span class="rrf">RRF 0.0328 (FTS #1 · Vec #2)</span></p>
							<p class="chunkcard__ex">…consolidated <mark>EBITDA</mark> of $48.2M for the third quarter, up 12.4% YoY. Operating profitability expansion was driven by…</p>
						</div>
					</article>
					<article class="chunkcard" data-idx="1">
						<span class="chunkcard__rank">2</span>
						<div>
							<p class="chunkcard__name"><span class="ftag">PDF</span> Q3_10Q_Financial_Statement.pdf</p>
							<p class="chunkcard__meta t-tag">Note 7 / Page 12 <span class="rrf">RRF 0.0246 (FTS #2 · Vec #4)</span></p>
							<p class="chunkcard__ex">…operating income of $41.7M before depreciation and amortization of $6.5M. Capital expenditures remained within…</p>
						</div>
					</article>
					<article class="chunkcard" data-idx="2">
						<span class="chunkcard__rank">3</span>
						<div>
							<p class="chunkcard__name"><span class="ftag">PDF</span> Investor_Deck_H2_2025.pdf</p>
							<p class="chunkcard__meta t-tag">Slide 18 <span class="rrf">RRF 0.0189 (FTS #4 · Vec #1)</span></p>
							<p class="chunkcard__ex">…segmental EBITDA contribution: North America $29.1M, EMEA $19.1M, partially offset by $2.9M in unallocated corporate…</p>
						</div>
					</article>
				</div>
				<p class="console__foot t-b3">Simulated locally in your browser. Live tenants stream over SSE with sub-500 ms hybrid search at P95 across tenant-isolated PostgreSQL & Upstash Vector databases.</p>
			</div>
		</div>
	</div>
</section>