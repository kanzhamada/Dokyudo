<script lang="ts">
</script>

<!-- ============ 3. VALUE PROPOSITION / CAPABILITIES ============ -->
<section class="section section--dark sec-cap" id="features">
	<span id="about" aria-hidden="true" style="display:block;height:0;scroll-margin-top:88px"></span>
	<div class="container">
		<div class="cap-grid" id="capGrid">

			<!-- LEFT: headline + interactive capability list -->
			<div class="cap-left" data-reveal>
				<h2 class="cap-h">Every answer traced<br />back to its exact chunk.</h2>
				<a class="btn btn--white cap-cta" href="#demo">
					Watch a Query
					<span class="btn__box" aria-hidden="true"><svg class="ic"><use href="#i-arrow"/></svg></span>
				</a>

				<div class="cap-list" id="capList" role="group" aria-label="Dokyudo capabilities">

					<button class="cap-item is-on" type="button" data-cap="0" aria-expanded="true">
						<span class="cap-item__head">
							<span class="cap-item__ico"><svg class="ic" aria-hidden="true"><use href="#i-radar"/></svg></span>
							<span class="cap-item__title">Hybrid Scatter-Gather RRF</span>
						</span>
						<span class="cap-item__body"><span class="cap-item__bodyin">
							<p class="cap-item__desc">Dispatches parallel queries across Upstash Vector (1024-dim BGE-M3) and Supabase Postgres FTS (tsvector), fusing candidate IDs with in-memory RRF (k=60) before lazy-hydrating top chunks with page tracking.</p>
							<span class="cap-bar" aria-hidden="true"><i class="cap-bar__fill"></i></span>
						</span></span>
					</button>

					<button class="cap-item" type="button" data-cap="1" aria-expanded="false">
						<span class="cap-item__head">
							<span class="cap-item__ico"><svg class="ic" aria-hidden="true"><use href="#i-chunk"/></svg></span>
							<span class="cap-item__title">Multi-Format & LaTeX Extraction</span>
						</span>
						<span class="cap-item__body"><span class="cap-item__bodyin">
							<p class="cap-item__desc">Dedicated Python worker extracts PDF, DOCX, TXT, and Markdown. Converts Word OMML equations directly into LaTeX, chunks via 1,000-token sliding windows, and page-aligns via rare n-grams.</p>
							<span class="cap-bar" aria-hidden="true"><i class="cap-bar__fill"></i></span>
						</span></span>
					</button>

					<button class="cap-item" type="button" data-cap="2" aria-expanded="false">
						<span class="cap-item__head">
							<span class="cap-item__ico"><svg class="ic" aria-hidden="true"><use href="#i-shield"/></svg></span>
							<span class="cap-item__title">BYOK Sealed End-to-End</span>
						</span>
						<span class="cap-item__body"><span class="cap-item__bodyin">
							<p class="cap-item__desc">Your provider key is encrypted with AES-256-GCM, stored as ciphertext, and decrypted in volatile memory only at stream dispatch—the MEK never touches the database or client.</p>
							<span class="cap-bar" aria-hidden="true"><i class="cap-bar__fill"></i></span>
						</span></span>
					</button>

					<button class="cap-item" type="button" data-cap="3" aria-expanded="false">
						<span class="cap-item__head">
							<span class="cap-item__ico"><svg class="ic" aria-hidden="true"><use href="#i-route"/></svg></span>
							<span class="cap-item__title">Sovereign $0 Edge & Model Routing</span>
						</span>
						<span class="cap-item__body"><span class="cap-item__bodyin">
							<p class="cap-item__desc">On-prem ARM64 STB running MinIO S3 and Deno 2.x via Cloudflare Tunnels paired with serverless edge databases and a 5-provider fallback pool across 3 complexity tiers keep the bill at $0.</p>
							<span class="cap-bar" aria-hidden="true"><i class="cap-bar__fill"></i></span>
						</span></span>
					</button>

				</div>
			</div>

			<!-- RIGHT: luminous panel, four swappable diagrams -->
			<div class="cap-right" data-reveal style="--rd:120ms">
				<div class="cap-panel" id="capPanel">

					<!-- 0: radial RRF graph -->
					<div class="cap-stage is-on" data-stage="0">
						<div class="radial">
							<svg class="cw-svg" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
								<line class="cw" x1="50" y1="50" x2="26" y2="24"/>
								<line class="cw" x1="50" y1="50" x2="80" y2="40"/>
								<line class="cw" x1="50" y1="50" x2="50" y2="82"/>
								<line class="cw" x1="50" y1="50" x2="20" y2="62"/>
							</svg>
							<span class="rdeco" style="left:80%;top:16%"></span>
							<span class="rdeco" style="left:15%;top:42%"></span>
							<span class="rdot" style="left:33%;top:15%"></span>
							<span class="rdot" style="left:87%;top:33%"></span>
							<span class="rdot" style="left:43%;top:73%"></span>

							<span class="rnode" style="left:26%;top:24%">
								<span class="rnode__dot rnode__dot--terracotta"><svg class="ic" aria-hidden="true"><use href="#i-vector"/></svg></span>
								<span class="rnode__lbl">Vector / BGE-M3</span>
							</span>
							<span class="rnode" style="left:80%;top:40%">
								<span class="rnode__dot rnode__dot--purple"><svg class="ic" aria-hidden="true"><use href="#i-search"/></svg></span>
								<span class="rnode__lbl">Full-text / tsvector</span>
							</span>
							<span class="rnode" style="left:50%;top:82%">
								<span class="rnode__dot rnode__dot--amber"><svg class="ic" aria-hidden="true"><use href="#i-layers"/></svg></span>
								<span class="rnode__lbl">Lazy hydrate / top-3</span>
							</span>
							<span class="rnode" style="left:20%;top:62%">
								<span class="rnode__dot rnode__dot--olive"><svg class="ic" aria-hidden="true"><use href="#i-lock"/></svg></span>
								<span class="rnode__lbl">Tenant scope / row-level</span>
							</span>

							<span class="rhub">
								<span class="rhub__ring"></span>
								<span class="rhub__core"></span>
								<span class="rhub__pill t-tag">RRF k=60 · Deno Layer</span>
							</span>
						</div>
					</div>

					<!-- 1: stacked chunk cards + terracotta block -->
					<div class="cap-stage" data-stage="1">
						<div class="stack">
							<article class="scard">
								<div class="scard__head">
									<span class="scard__ico"><svg class="ic" aria-hidden="true"><use href="#i-chunk"/></svg></span>
									<p class="scard__t">Sliding Chunk Window</p>
								</div>
								<div class="scard__foot">
									<svg class="ic" aria-hidden="true"><use href="#i-refresh"/></svg>
									<span class="scard__meta">1,000 tokens / 150 overlap (tiktoken)</span>
								</div>
							</article>
							<article class="scard">
								<div class="scard__head">
									<span class="scard__ico"><svg class="ic" aria-hidden="true"><use href="#i-doc"/></svg></span>
									<p class="scard__t">Formula & Table Integrity</p>
								</div>
								<div class="scard__foot">
									<svg class="ic" aria-hidden="true"><use href="#i-refresh"/></svg>
									<span class="scard__meta">OMML → LaTeX ($...$ & $$...$$)</span>
								</div>
							</article>
							<article class="scard">
								<div class="scard__head">
									<span class="scard__ico"><svg class="ic" aria-hidden="true"><use href="#i-vector"/></svg></span>
									<p class="scard__t">Page Alignment Engine</p>
								</div>
								<div class="scard__foot">
									<svg class="ic" aria-hidden="true"><use href="#i-refresh"/></svg>
									<span class="scard__meta">Rare n-gram windowing (25-char)</span>
								</div>
							</article>
							<div class="sblock">
								<p class="sblock__t">Zero OCR Hallucination</p>
								<p class="sblock__b">PDF, DOCX, TXT, and Markdown land as page-aligned chunks. Word OMML formulas compile to KaTeX-ready LaTeX, preserving balance sheet grids and financial math exactly.</p>
							</div>
						</div>
					</div>

					<!-- 2: BYOK key-lifecycle pipeline -->
					<div class="cap-stage" data-stage="2">
						<div class="pipe-wrap">
							<div class="pipe">
								<span class="pipe__line" aria-hidden="true"><i class="pipe__spark" style="--sd:0s"></i><i class="pipe__spark" style="--sd:1.3s"></i></span>
								<span class="pnode">
									<span class="pnode__dot pnode__dot--terracotta"><svg class="ic" aria-hidden="true"><use href="#i-key"/></svg></span>
									<span class="pnode__lbl"><b>Paste</b><span>BYOK Key</span></span>
								</span>
								<span class="pnode">
									<span class="pnode__dot pnode__dot--purple"><svg class="ic" aria-hidden="true"><use href="#i-lock"/></svg></span>
									<span class="pnode__lbl"><b>Seal</b><span>AES-256-GCM MEK</span></span>
								</span>
								<span class="pnode">
									<span class="pnode__dot pnode__dot--olive"><svg class="ic" aria-hidden="true"><use href="#i-shield"/></svg></span>
									<span class="pnode__lbl"><b>Stream</b><span>Decrypted in RAM</span></span>
								</span>
							</div>
							<div class="keycard">
								<div class="keycard__row1">
									<code class="mask">sk-proj-*******************789</code>
									<span class="keycard__tag t-tag">masked tail only</span>
								</div>
								<div class="keycard__row2">
									<svg class="ic" aria-hidden="true"><use href="#i-route"/></svg>
									<span>Master encryption key never leaves Deno runtime memory.</span>
								</div>
							</div>
						</div>
					</div>

					<!-- 3: $0 routing tree (SVG Architecture Diagram) -->
					<div class="cap-stage" data-stage="3">
						<svg class="tree-svg" viewBox="0 0 440 300" preserveAspectRatio="xMidYMid meet" aria-label="Sovereign $0 Edge and Model Routing Architecture">
							<defs>
								<linearGradient id="t-terracotta-grad" x1="0%" y1="0%" x2="100%" y2="100%">
									<stop offset="0%" stop-color="var(--color-terracotta)"/>
									<stop offset="100%" stop-color="var(--color-terracotta-deep)"/>
								</linearGradient>
								<filter id="t-card-shadow" x="-8%" y="-10%" width="120%" height="130%">
									<feDropShadow dx="0" dy="3" stdDeviation="3" flood-color="rgba(0,0,0,0.06)"/>
								</filter>
								<filter id="t-pill-shadow" x="-10%" y="-15%" width="125%" height="145%">
									<feDropShadow dx="0" dy="6" stdDeviation="6" flood-color="rgba(240,78,35,0.28)"/>
								</filter>
							</defs>

							<!-- Circuit Routing Lines -->
							<line x1="220" y1="36" x2="220" y2="64" stroke="rgba(255,255,255,0.85)" stroke-width="1.5"/>
							<line x1="220" y1="98" x2="220" y2="122" stroke="rgba(255,255,255,0.85)" stroke-width="1.5"/>
							<line x1="110" y1="122" x2="330" y2="122" stroke="rgba(255,255,255,0.85)" stroke-width="1.5"/>
							<line x1="110" y1="122" x2="110" y2="274" stroke="rgba(255,255,255,0.85)" stroke-width="1.5"/>
							<line x1="330" y1="122" x2="330" y2="274" stroke="rgba(255,255,255,0.85)" stroke-width="1.5"/>

							<!-- Junction Joints -->
							<circle cx="110" cy="122" r="3.5" fill="var(--color-ash)" stroke="#ffffff" stroke-width="1.5"/>
							<circle cx="330" cy="122" r="3.5" fill="var(--color-ash)" stroke="#ffffff" stroke-width="1.5"/>

							<!-- Top Root Brand Node -->
							<circle cx="220" cy="36" r="19" fill="var(--color-white)" filter="url(#t-card-shadow)"/>
							<g transform="translate(210, 26)">
								<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--color-terracotta)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
									<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
									<line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>
									<line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
								</svg>
							</g>

							<!-- Sovereign $0 Pill -->
							<rect x="135" y="64" width="170" height="34" rx="17" fill="url(#t-terracotta-grad)" stroke="rgba(255,255,255,0.4)" stroke-width="1.5" filter="url(#t-pill-shadow)"/>
							<text x="220" y="80" text-anchor="middle" font-family="var(--font-body)" font-weight="600" font-size="14" fill="#ffffff">$0 / mo</text>
							<text x="220" y="91" text-anchor="middle" font-family="var(--font-interface)" font-weight="600" font-size="7" letter-spacing="0.1em" fill="rgba(255,255,255,0.92)">SOVEREIGN CLOUD STACK</text>

							<!-- Card 1: Multi-Provider Pools (Top Left) -->
							<g transform="translate(20, 140)" filter="url(#t-card-shadow)">
								<rect width="180" height="58" rx="0" fill="var(--color-white)" stroke="var(--border-fade)" stroke-width="1"/>
								<circle cx="16" cy="17" r="7.5" fill="var(--color-terracotta)"/>
								<path d="M12.5 17L15 19.5L19.5 14.5" stroke="#ffffff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
								<text x="30" y="21" font-family="var(--font-body)" font-weight="600" font-size="11.5" fill="var(--color-black)" letter-spacing="-0.02em">Multi-Provider Pools</text>
								<line x1="10" y1="32" x2="170" y2="32" stroke="var(--border-fade)" stroke-width="1"/>
								<text x="10" y="47" font-family="var(--font-body)" font-size="11" letter-spacing="-0.02em">
									<tspan font-weight="600" fill="var(--color-black)">3 tiers</tspan>
									<tspan font-weight="400" fill="var(--color-gray)"> · 5 LLM providers</tspan>
								</text>
							</g>

							<!-- Card 2: On-Prem Storage Node (Top Right) -->
							<g transform="translate(240, 140)" filter="url(#t-card-shadow)">
								<rect width="180" height="58" rx="0" fill="var(--color-white)" stroke="var(--border-fade)" stroke-width="1"/>
								<circle cx="16" cy="17" r="7.5" fill="var(--color-terracotta)"/>
								<path d="M12.5 17L15 19.5L19.5 14.5" stroke="#ffffff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
								<text x="30" y="21" font-family="var(--font-body)" font-weight="600" font-size="11.5" fill="var(--color-black)" letter-spacing="-0.02em">On-Prem Storage Node</text>
								<line x1="10" y1="32" x2="170" y2="32" stroke="var(--border-fade)" stroke-width="1"/>
								<text x="10" y="47" font-family="var(--font-body)" font-size="11" letter-spacing="-0.02em">
									<tspan font-weight="600" fill="var(--color-black)">ARM64</tspan>
									<tspan font-weight="400" fill="var(--color-gray)"> · STB + MinIO S3</tspan>
								</text>
							</g>

							<!-- Card 3: Redis Circuit Breakers (Bottom Left) -->
							<g transform="translate(20, 216)" filter="url(#t-card-shadow)">
								<rect width="180" height="58" rx="0" fill="var(--color-white)" stroke="var(--border-fade)" stroke-width="1"/>
								<circle cx="16" cy="17" r="7.5" fill="var(--color-terracotta)"/>
								<path d="M12.5 17L15 19.5L19.5 14.5" stroke="#ffffff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
								<text x="30" y="21" font-family="var(--font-body)" font-weight="600" font-size="11.5" fill="var(--color-black)" letter-spacing="-0.02em">Redis Circuit Breakers</text>
								<line x1="10" y1="32" x2="170" y2="32" stroke="var(--border-fade)" stroke-width="1"/>
								<text x="10" y="47" font-family="var(--font-body)" font-size="11" letter-spacing="-0.02em">
									<tspan font-weight="600" fill="var(--color-black)">5 fails</tspan>
									<tspan font-weight="400" fill="var(--color-gray)"> · 30s open fallback</tspan>
								</text>
							</g>

							<!-- Card 4: Event-Driven Ingestion (Bottom Right) -->
							<g transform="translate(240, 216)" filter="url(#t-card-shadow)">
								<rect width="180" height="58" rx="0" fill="var(--color-white)" stroke="var(--border-fade)" stroke-width="1"/>
								<circle cx="16" cy="17" r="7.5" fill="var(--color-terracotta)"/>
								<path d="M12.5 17L15 19.5L19.5 14.5" stroke="#ffffff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
								<text x="30" y="21" font-family="var(--font-body)" font-weight="600" font-size="11.5" fill="var(--color-black)" letter-spacing="-0.02em">Event-Driven Ingest</text>
								<line x1="10" y1="32" x2="170" y2="32" stroke="var(--border-fade)" stroke-width="1"/>
								<text x="10" y="47" font-family="var(--font-body)" font-size="11" letter-spacing="-0.02em">
									<tspan font-weight="600" fill="var(--color-black)">pg_net</tspan>
									<tspan font-weight="400" fill="var(--color-gray)"> · push → STB worker</tspan>
								</text>
							</g>
						</svg>
					</div>

				</div>
			</div>

		</div>
	</div>
</section>