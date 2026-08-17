<script lang="ts">
</script>

<!-- ============ 5. ARCHITECTURE DIAGRAM ============ -->
<section class="section section--dark sec-cap" id="architecture">
	<div class="container">
		<div class="shead" data-reveal>
			<h2 class="t-h2">A grounded answer has a traceable path.</h2>
			<p class="t-b1 shead__lead shead__lead--dark">
				Inspect the two paths behind Dokyudo: hybrid retrieval on read, event-driven extraction on
				write. Click any node to inspect its responsibilities.
			</p>
		</div>

		<!-- Architecture Flow Tab Toggle -->
		<div class="arch-tabs" role="tablist" aria-label="Architecture Flow Tabs" data-reveal>
			<button
				class="arch-tab is-active"
				id="tab-read"
				type="button"
				role="tab"
				aria-selected="true"
				aria-controls="flowblock-read"
				data-flow="read"
			>
				<span class="arch-tab__num">01</span>
				<span>Read / Query</span>
			</button>
			<button
				class="arch-tab"
				id="tab-ingest"
				type="button"
				role="tab"
				aria-selected="false"
				aria-controls="flowblock-ingest"
				data-flow="ingest"
			>
				<span class="arch-tab__num">02</span>
				<span>Upload / Ingest</span>
			</button>
		</div>

		<!-- ===================== FLOW 1 — READ / QUERY PATH ===================== -->
		<div class="fblock is-active" id="flowblock-read" data-reveal>
			<div class="fhead">
				<span class="fhead__i">01</span>
				<h3 class="fhead__t">Read / Query Path</h3>
				<span class="fhead__rule"></span>
				<span class="fhead__hint">drag to pan ▸</span>
			</div>

			<div class="flow" id="flow-read">
				<div class="flow__canvas">
					<svg class="flow-svg" aria-hidden="true"></svg>

					<button
						class="fn"
						data-node="client"
						style="--c:1;--r:2;--na:var(--c-periwinkle)"
						type="button"
					>
						<span class="fn-frame">
							<span class="fn-screen">
								<span class="fn-screen__tag">WEB</span>
								<span class="mini mini--dots"
									><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i
									></i></span
								>
							</span><span class="fn-crown"></span>
						</span>
						<span class="fn-cap"
							><span class="fn-num">1</span><span
								><strong>Browser Client</strong>
								<p>Bearer JWT · SSE · Realtime</p></span
							></span
						>
					</button>

					<button
						class="fn"
						data-node="gateway"
						style="--c:2;--r:2;--na:var(--color-terracotta)"
						type="button"
					>
						<span class="fn-frame">
							<span class="fn-screen">
								<span class="fn-screen__tag">DENO · HONO</span>
								<span class="mini mini--card"
									><span class="mc-av"></span><span class="mc-ln"></span><span class="mc-ln s"
									></span></span
								>
							</span><span class="fn-crown"></span>
						</span>
						<span class="fn-cap"
							><span class="fn-num">2</span><span
								><strong>API Gateway</strong>
								<p>JWT · tenant · quota gates</p></span
							></span
						>
					</button>

					<button
						class="fn"
						data-node="redis"
						style="--c:3;--r:2;--na:var(--c-amber)"
						type="button"
					>
						<span class="fn-frame">
							<span class="fn-screen">
								<span class="fn-screen__tag">GATE</span>
								<span class="mini mini--tog"
									><span class="mt"><i></i><b></b></span><span class="mt"><i></i><b></b></span><span
										class="mt"><i></i><b></b></span
									></span
								>
							</span><span class="fn-crown"></span>
						</span>
						<span class="fn-cap"
							><span class="fn-num paper">3</span><span
								><strong>Redis Gatekeeper</strong>
								<p>Limits · quota · safety</p></span
							></span
						>
					</button>

					<button
						class="fn"
						data-node="vector"
						style="--c:4;--r:1;--na:var(--c-lavender)"
						type="button"
					>
						<span class="fn-frame">
							<span class="fn-screen">
								<span class="fn-screen__tag">BGE-M3</span>
								<svg class="mini mini--wave" viewBox="0 0 60 24" preserveAspectRatio="none">
									<polyline class="w2" points="0,12 8,9 16,15 24,7 32,17 40,10 48,14 60,12" />
									<polyline class="w1" points="0,12 8,4 16,19 24,2 32,21 40,6 48,16 60,12" />
								</svg>
							</span><span class="fn-crown"></span>
						</span>
						<span class="fn-cap"
							><span class="fn-num">4</span><span
								><strong>Semantic Index</strong>
								<p>BGE-M3 embeddings · 1024-d</p></span
							></span
						>
					</button>

					<button
						class="fn"
						data-node="postgres"
						style="--c:4;--r:3;--na:var(--c-olive)"
						type="button"
					>
						<span class="fn-frame">
							<span class="fn-screen">
								<span class="fn-screen__tag">POSTGRES · FTS</span>
								<span class="mini mini--rows"
									><span class="mr"><i></i><b></b></span><span class="mr"><i></i><b></b></span><span
										class="mr"><i></i><b></b></span
									></span
								>
							</span><span class="fn-crown"></span>
						</span>
						<span class="fn-cap"
							><span class="fn-num paper">5</span><span
								><strong>Relational Search</strong>
								<p>FTS · tenant filter · hydrate</p></span
							></span
						>
					</button>

					<button
						class="fn"
						data-node="fusion"
						style="--c:5;--r:2;--na:var(--c-purple)"
						type="button"
					>
						<span class="fn-frame">
							<span class="fn-screen">
								<span class="fn-screen__tag">RRF</span>
								<span class="mini mini--merge"><i></i><i></i><b></b></span>
							</span><span class="fn-crown"></span>
						</span>
						<span class="fn-cap"
							><span class="fn-num">6</span><span
								><strong>Hybrid Ranker</strong>
								<p>FTS + vector · RRF in Deno</p></span
							></span
						>
					</button>

					<button
						class="fn"
						data-node="router"
						style="--c:6;--r:2;--na:var(--c-purple)"
						type="button"
					>
						<span class="fn-frame">
							<span class="fn-screen">
								<span class="fn-screen__tag">LLM</span>
								<span class="mini mini--gear"
									><span class="mg"></span><span class="mg-bar"></span></span
								>
							</span><span class="fn-crown"></span>
						</span>
						<span class="fn-cap"
							><span class="fn-num paper">7</span><span
								><strong>Model Router</strong>
								<p>Tier fallback · BYOK</p></span
							></span
						>
					</button>

					<button
						class="fn"
						data-node="stream"
						style="--c:7;--r:2;--na:var(--c-lime)"
						type="button"
					>
						<span class="fn-frame">
							<span class="fn-screen">
								<span class="fn-screen__tag">SSE</span>
								<span class="mini mini--eq"><i></i><i></i><i></i><i></i></span>
							</span><span class="fn-crown"></span>
						</span>
						<span class="fn-cap"
							><span class="fn-num">8</span><span
								><strong>Response Stream</strong>
								<p>Tokens · citations · title</p></span
							></span
						>
					</button>
				</div>
			</div>
		</div>

		<!-- ===================== FLOW 2 — INGESTION / WRITE PATH ===================== -->
		<div class="fblock" id="flowblock-ingest" data-reveal>
			<div class="fhead">
				<span class="fhead__i">02</span>
				<h3 class="fhead__t">Ingestion / Write Path</h3>
				<span class="fhead__rule"></span>
				<span class="fhead__hint">drag to pan ▸</span>
			</div>

			<div class="flow" id="flow-ingest">
				<div class="flow__canvas">
					<svg class="flow-svg" aria-hidden="true"></svg>

					<button
						class="fn"
						data-node="client"
						style="--c:1;--r:2;--na:var(--c-periwinkle)"
						type="button"
					>
						<span class="fn-frame">
							<span class="fn-screen">
								<span class="fn-screen__tag">UPLOAD</span>
								<span class="mini mini--dots"
									><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i
									></i></span
								>
							</span><span class="fn-crown"></span>
						</span>
						<span class="fn-cap"
							><span class="fn-num">1</span><span
								><strong>Browser Client</strong>
								<p>Stage files · direct PUT</p></span
							></span
						>
					</button>

					<button
						class="fn"
						data-node="gateway"
						style="--c:2;--r:2;--na:var(--color-terracotta)"
						type="button"
					>
						<span class="fn-frame">
							<span class="fn-screen">
								<span class="fn-screen__tag">DENO · HONO</span>
								<span class="mini mini--card"
									><span class="mc-av"></span><span class="mc-ln"></span><span class="mc-ln s"
									></span></span
								>
							</span><span class="fn-crown"></span>
						</span>
						<span class="fn-cap"
							><span class="fn-num">2</span><span
								><strong>API Gateway</strong>
								<p>JWT · quota · confirm</p></span
							></span
						>
					</button>

					<button
						class="fn"
						data-node="redis"
						style="--c:3;--r:1;--na:var(--c-amber)"
						type="button"
					>
						<span class="fn-frame">
							<span class="fn-screen">
								<span class="fn-screen__tag">GATE</span>
								<span class="mini mini--tog"
									><span class="mt"><i></i><b></b></span><span class="mt"><i></i><b></b></span><span
										class="mt"><i></i><b></b></span
									></span
								>
							</span><span class="fn-crown"></span>
						</span>
						<span class="fn-cap"
							><span class="fn-num paper">3</span><span
								><strong>Redis Gatekeeper</strong>
								<p>Limits · quota · cancellation</p></span
							></span
						>
					</button>

					<button class="fn" data-node="minio" style="--c:3;--r:2;--na:var(--c-navy)" type="button">
						<span class="fn-frame">
							<span class="fn-screen">
								<span class="fn-screen__tag">MINIO · S3</span>
								<span class="mini mini--stack"><span></span><span></span><span></span></span>
							</span><span class="fn-crown"></span>
						</span>
						<span class="fn-cap"
							><span class="fn-num paper">4</span><span
								><strong>Private Object Store</strong>
								<p>Raw files · signed URLs</p></span
							></span
						>
					</button>

					<button
						class="fn"
						data-node="postgres"
						style="--c:3;--r:3;--na:var(--c-olive)"
						type="button"
					>
						<span class="fn-frame">
							<span class="fn-screen">
								<span class="fn-screen__tag">META</span>
								<span class="mini mini--rows"
									><span class="mr"><i></i><b></b></span><span class="mr"><i></i><b></b></span><span
										class="mr"><i></i><b></b></span
									></span
								>
							</span><span class="fn-crown"></span>
						</span>
						<span class="fn-cap"
							><span class="fn-num paper">5</span><span
								><strong>Relational Core</strong>
								<p>Pending → confirmed</p></span
							></span
						>
					</button>

					<button
						class="fn"
						data-node="worker"
						style="--c:4;--r:2;--na:var(--c-purple)"
						type="button"
					>
						<span class="fn-frame">
							<span class="fn-screen">
								<span class="fn-screen__tag">JOB</span>
								<span class="mini mini--gear"
									><span class="mg"></span><span class="mg-bar"></span></span
								>
							</span><span class="fn-crown"></span>
						</span>
						<span class="fn-cap"
							><span class="fn-num paper">6</span><span
								><strong>FastAPI Worker</strong>
								<p>Extract · chunk · embed</p></span
							></span
						>
					</button>

					<button
						class="fn"
						data-node="vector"
						style="--c:5;--r:1;--na:var(--c-lavender)"
						type="button"
					>
						<span class="fn-frame">
							<span class="fn-screen">
								<span class="fn-screen__tag">BGE-M3</span>
								<svg class="mini mini--wave" viewBox="0 0 60 24" preserveAspectRatio="none">
									<polyline class="w2" points="0,12 8,9 16,15 24,7 32,17 40,10 48,14 60,12" />
									<polyline class="w1" points="0,12 8,4 16,19 24,2 32,21 40,6 48,16 60,12" />
								</svg>
							</span><span class="fn-crown"></span>
						</span>
						<span class="fn-cap"
							><span class="fn-num">7</span><span
								><strong>Vector Index</strong>
								<p>Upsert chunks · page data</p></span
							></span
						>
					</button>

					<button
						class="fn"
						data-node="stream"
						style="--c:5;--r:3;--na:var(--c-lime)"
						type="button"
					>
						<span class="fn-frame">
							<span class="fn-screen">
								<span class="fn-screen__tag">HOOK</span>
								<span class="mini mini--eq"><i></i><i></i><i></i><i></i></span>
							</span><span class="fn-crown"></span>
						</span>
						<span class="fn-cap"
							><span class="fn-num">8</span><span
								><strong>Progress Sync</strong>
								<p>pg_net · Realtime · poll</p></span
							></span
						>
					</button>
				</div>
			</div>
		</div>

		<p class="arch__legend" data-reveal>
			<b>terracotta</b> = selected path &nbsp;·&nbsp; <b>pulse</b> = live traffic &nbsp;·&nbsp; write
			flow is event-driven: committed Postgres status changes trigger a pg_net webhook, while the browser
			receives Realtime updates with polling fallback
		</p>

		<!-- inspector -->
		<div class="arch-detail" id="archDetail" data-reveal tabindex="-1"></div>
	</div>
</section>
