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
								<span class="rnode__dot rnode__dot--navy"><svg class="ic" aria-hidden="true"><use href="#i-vector"/></svg></span>
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

					<!-- 1: stacked chunk cards + navy block -->
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
									<span class="pnode__dot pnode__dot--navy"><svg class="ic" aria-hidden="true"><use href="#i-key"/></svg></span>
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

					<!-- 3: $0 routing tree -->
					<div class="cap-stage" data-stage="3">
						<div class="tree">
							<svg class="cw-svg" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
								<line class="cw" x1="50" y1="12" x2="50" y2="31"/>
								<line class="cw" x1="50" y1="31" x2="50" y2="45"/>
								<line class="cw" x1="30" y1="45" x2="70" y2="45"/>
								<line class="cw" x1="30" y1="45" x2="30" y2="57"/>
								<line class="cw" x1="70" y1="45" x2="70" y2="57"/>
								<line class="cw" x1="30" y1="57" x2="30" y2="81"/>
								<line class="cw" x1="70" y1="57" x2="70" y2="81"/>
							</svg>
							<span class="tjoint" style="left:30%;top:45%"></span>
							<span class="tjoint" style="left:70%;top:45%"></span>

							<span class="tnode-brand" aria-hidden="true"><svg class="ic"><use href="#i-node"/></svg></span>
							<span class="tpill"><b>$0 / mo</b><span>Sovereign Cloud Stack</span></span>

							<article class="tcard" style="left:30%;top:57%">
								<div class="tcard__head"><span class="tcard__chk"><svg class="ic" aria-hidden="true"><use href="#i-check"/></svg></span><p class="tcard__t">Multi-Provider Pools</p></div>
								<div class="tcard__foot"><b>3 tiers</b><span>· 5 LLM providers</span></div>
							</article>
							<article class="tcard" style="left:70%;top:57%">
								<div class="tcard__head"><span class="tcard__chk"><svg class="ic" aria-hidden="true"><use href="#i-check"/></svg></span><p class="tcard__t">On-Prem Sovereign Node</p></div>
								<div class="tcard__foot"><b>ARM64</b><span>STB + MinIO S3</span></div>
							</article>
							<article class="tcard" style="left:30%;top:81%">
								<div class="tcard__head"><span class="tcard__chk"><svg class="ic" aria-hidden="true"><use href="#i-check"/></svg></span><p class="tcard__t">Redis Circuit Breakers</p></div>
								<div class="tcard__foot"><b>5 fails</b><span>· 30s open fallback</span></div>
							</article>
							<article class="tcard" style="left:70%;top:81%">
								<div class="tcard__head"><span class="tcard__chk"><svg class="ic" aria-hidden="true"><use href="#i-check"/></svg></span><p class="tcard__t">Event-Driven Ingest</p></div>
								<div class="tcard__foot"><b>pg_net</b><span>push → STB worker</span></div>
							</article>
						</div>
					</div>

				</div>
			</div>

		</div>
	</div>
</section>