<script lang="ts">
	import { onMount } from 'svelte';
	import mermaid from 'mermaid';

	type NodeDetail = {
		zone: string;
		zoneColor: string;
		title: string;
		bullets: string[];
		deps: string[];
		budgetLabel: string;
		budget: string;
	};

	const NODES: Record<string, NodeDetail> = {
		client: {
			zone: 'Browser client',
			zoneColor: '#7b88d1',
			title: 'Browser Client',
			bullets: [
				'SvelteKit sends Bearer JWT requests to the Deno gateway and keeps the session in the frontend store.',
				'Uploads go straight to private MinIO through 15-minute presigned PUT URLs; the API never proxies file bytes.',
				'Chat consumes SSE events, while Supabase Realtime and four-second polling keep document status current.'
			],
			deps: ['SvelteKit', 'Supabase Auth', 'SSE', 'Realtime'],
			budgetLabel: 'Client transport',
			budget: 'SSE + Realtime'
		},
		gateway: {
			zone: 'API boundary',
			zoneColor: '#c85a32',
			title: 'Deno + Hono Gateway',
			bullets: [
				'Validates Supabase HS256 JWTs, resolves tenant context, and applies explicit tenant predicates across the stack.',
				'Orchestrates presigned uploads, confirmation, hybrid search, RAG turns, fallback routing, and SSE streaming.',
				'Runs in Docker on the ARM64 STB and is reached through a Cloudflare Tunnel.'
			],
			deps: ['Deno', 'Hono', 'Drizzle ORM', 'Cloudflare Tunnel'],
			budgetLabel: 'Request boundary',
			budget: 'JWT + tenant + quota'
		},
		redis: {
			zone: 'Control plane',
			zoneColor: '#d99b26',
			title: 'Redis Gatekeeper',
			bullets: [
				'Applies global standard, strict, and block-tier rate limits before protected work proceeds.',
				'Caches tenant mapping, quotas, circuit-breaker state, prompt-injection decisions, embeddings, and share payloads.',
				'Worker Lua gates protect Cloudflare token allowance; failures do not silently become an unbounded queue.'
			],
			deps: ['Upstash Redis', 'Lua gates', 'Rate limits', 'Circuit breakers'],
			budgetLabel: 'Standard limit',
			budget: '300 requests / minute'
		},
		vector: {
			zone: 'Semantic data plane',
			zoneColor: '#a390c4',
			title: 'Semantic Index',
			bullets: [
				'Current production embeddings use Cloudflare Workers AI BGE-M3 at 1024 dimensions.',
				'Upstash Vector stores tenant-filtered chunk vectors with document, chunk, page, and content metadata.',
				'Read search returns ranked IDs before the Deno layer hydrates the matching chunk records.'
			],
			deps: ['Cloudflare Workers AI', 'BGE-M3', 'Upstash Vector'],
			budgetLabel: 'Vector width',
			budget: '1024 dimensions'
		},
		postgres: {
			zone: 'Relational data plane',
			zoneColor: '#7c9d60',
			title: 'Relational Core',
			bullets: [
				'Source of truth for tenants, documents, chunks, conversations, subscriptions, activity, and turn state.',
				'Postgres FTS supplies the keyword branch; Deno performs RRF fusion and later hydrates chunk content.',
				'Committed document status changes trigger pg_net; pg_cron reopens quota-exhausted documents for retry.'
			],
			deps: ['Supabase PostgreSQL', 'Drizzle', 'pg_net', 'pg_cron'],
			budgetLabel: 'Isolation rule',
			budget: 'tenant_id predicates'
		},
		fusion: {
			zone: 'Search orchestration',
			zoneColor: '#c85a32',
			title: 'Hybrid Ranker',
			bullets: [
				'Runs Postgres FTS and semantic Vector search in parallel, then fuses ranked IDs in the Deno application layer.',
				'Uses RRF with the documented FTS-heavy weighting of 2:1 over vector results.',
				'Filters, deduplicates, groups by document, and hydrates page-aware context for the answer.'
			],
			deps: ['Deno', 'Postgres FTS', 'Upstash Vector', 'RRF'],
			budgetLabel: 'Fusion weighting',
			budget: 'FTS 2 : vector 1'
		},
		router: {
			zone: 'Model orchestration',
			zoneColor: '#9c6f9e',
			title: 'Model Router',
			bullets: [
				'Classifies history depth, question length, and context complexity before the answer stream begins.',
				'Rotates through Light, Medium, and Heavy provider pools when a provider is unavailable or limited.',
				'BYOK can route supported requests to Gemini, Mistral, or OpenRouter without exposing the key to the client.'
			],
			deps: ['Gemini', 'Mistral', 'Groq', 'SambaNova', 'Cohere', 'BYOK'],
			budgetLabel: 'Routing tiers',
			budget: 'Light / Medium / Heavy'
		},
		minio: {
			zone: 'Private storage',
			zoneColor: '#4a6572',
			title: 'Private MinIO Store',
			bullets: [
				'Private S3-compatible storage on the STB holds originals and worker-generated preview PDFs.',
				'Browsers receive short-lived presigned URLs: 15 minutes for PUT and 12 hours for preview GET.',
				'Deletion removes both storage objects, vectors, database rows, and any active worker job.'
			],
			deps: ['MinIO', 'S3 API', 'ARM64 STB', 'Cloudflare Tunnel'],
			budgetLabel: 'Browser upload',
			budget: 'Direct, never proxied'
		},
		worker: {
			zone: 'On-premise worker',
			zoneColor: '#9c6f9e',
			title: 'FastAPI Ingestion Worker',
			bullets: [
				'FastAPI receives the pg_net webhook, downloads the confirmed object, and converts DOCX, TXT, or Markdown for preview.',
				'Extracts text into 1,000-token chunks with 150-token overlap, aligns chunks to pages, and checkpoints progress.',
				'Generates BGE-M3 embeddings in batches up to 32, summarizes in parallel, and resumes after quota exhaustion.'
			],
			deps: ['Python FastAPI', 'PyMuPDF', 'LibreOffice', 'Workers AI', 'Redis'],
			budgetLabel: 'Chunk policy',
			budget: '1,000 + 150 overlap'
		},
		stream: {
			zone: 'Response and sync plane',
			zoneColor: '#86af49',
			title: 'Response and Progress Stream',
			bullets: [
				'RAG responses emit turn status, references, tokens, titles, and a final done event over SSE.',
				'The backend filters citations and finalizes the turn; the frontend drains tokens through its typewriter buffer.',
				'Document status reaches the UI through Supabase Realtime with a four-second polling fallback.'
			],
			deps: ['SSE', 'Supabase Realtime', 'Polling', 'Turn state'],
			budgetLabel: 'Citation contract',
			budget: '[Doc N: Page X]'
		}
	};

	let activeFlow = $state<'read' | 'ingest'>('read');
	let activeKey = $state<string>('gateway');
	let isSwapping = $state<boolean>(false);
	let readSvg = $state<string>('');
	let ingestSvg = $state<string>('');
	let zoomLevel = $state<number>(1.0);

	const MIN_ZOOM = 0.6;
	const MAX_ZOOM = 1.6;
	const ZOOM_STEP = 0.15;

	function zoomIn() {
		zoomLevel = Math.min(MAX_ZOOM, Math.round((zoomLevel + ZOOM_STEP) * 100) / 100);
	}

	function zoomOut() {
		zoomLevel = Math.max(MIN_ZOOM, Math.round((zoomLevel - ZOOM_STEP) * 100) / 100);
	}

	function resetZoom() {
		zoomLevel = 1.0;
	}

	const activeNode = $derived(NODES[activeKey] ?? NODES.gateway);

	const readDiagram = `flowchart LR
		client["<div class='m-node client' data-node-key='client'><span class='m-tag' style='color:#7b88d1;'>WEB</span><div class='m-head'><span class='m-num' style='background:rgba(123,136,209,0.2);color:#7b88d1;'>1</span><strong>Browser Client</strong></div><p class='m-sub'>Bearer JWT · SSE · Realtime</p></div>"]
		gateway["<div class='m-node gateway' data-node-key='gateway'><span class='m-tag' style='color:#c85a32;'>DENO · HONO</span><div class='m-head'><span class='m-num' style='background:rgba(200,90,50,0.2);color:#c85a32;'>2</span><strong>API Gateway</strong></div><p class='m-sub'>JWT · tenant · quota gates</p></div>"]
		redis["<div class='m-node redis' data-node-key='redis'><span class='m-tag' style='color:#d99b26;'>GATE</span><div class='m-head'><span class='m-num' style='background:rgba(217,155,38,0.2);color:#d99b26;'>3</span><strong>Redis Gatekeeper</strong></div><p class='m-sub'>Limits · quota · safety</p></div>"]
		vector["<div class='m-node vector' data-node-key='vector'><span class='m-tag' style='color:#a390c4;'>BGE-M3</span><div class='m-head'><span class='m-num' style='background:rgba(163,144,196,0.2);color:#a390c4;'>4</span><strong>Semantic Index</strong></div><p class='m-sub'>BGE-M3 embeddings · 1024-d</p></div>"]
		postgres["<div class='m-node postgres' data-node-key='postgres'><span class='m-tag' style='color:#7c9d60;'>POSTGRES · FTS</span><div class='m-head'><span class='m-num' style='background:rgba(124,157,96,0.2);color:#7c9d60;'>5</span><strong>Relational Search</strong></div><p class='m-sub'>FTS · tenant filter · hydrate</p></div>"]
		fusion["<div class='m-node fusion' data-node-key='fusion'><span class='m-tag' style='color:#c85a32;'>RRF</span><div class='m-head'><span class='m-num' style='background:rgba(200,90,50,0.2);color:#c85a32;'>6</span><strong>Hybrid Ranker</strong></div><p class='m-sub'>FTS + vector · RRF in Deno</p></div>"]
		router["<div class='m-node router' data-node-key='router'><span class='m-tag' style='color:#9c6f9e;'>LLM</span><div class='m-head'><span class='m-num' style='background:rgba(156,111,158,0.2);color:#9c6f9e;'>7</span><strong>Model Router</strong></div><p class='m-sub'>Tier fallback · BYOK</p></div>"]
		stream["<div class='m-node stream' data-node-key='stream'><span class='m-tag' style='color:#86af49;'>SSE</span><div class='m-head'><span class='m-num' style='background:rgba(134,175,73,0.2);color:#86af49;'>8</span><strong>Response Stream</strong></div><p class='m-sub'>Tokens · citations · title</p></div>"]

		client --> gateway
		gateway --> redis
		redis --> vector
		redis --> postgres
		vector --> fusion
		postgres --> fusion
		fusion --> router
		router --> stream
	`;

	const ingestDiagram = `flowchart LR
		client["<div class='m-node client' data-node-key='client'><span class='m-tag' style='color:#7b88d1;'>UPLOAD</span><div class='m-head'><span class='m-num' style='background:rgba(123,136,209,0.2);color:#7b88d1;'>1</span><strong>Browser Client</strong></div><p class='m-sub'>Stage files · direct PUT</p></div>"]
		gateway["<div class='m-node gateway' data-node-key='gateway'><span class='m-tag' style='color:#c85a32;'>DENO · HONO</span><div class='m-head'><span class='m-num' style='background:rgba(200,90,50,0.2);color:#c85a32;'>2</span><strong>API Gateway</strong></div><p class='m-sub'>JWT · quota · confirm</p></div>"]
		redis["<div class='m-node redis' data-node-key='redis'><span class='m-tag' style='color:#d99b26;'>GATE</span><div class='m-head'><span class='m-num' style='background:rgba(217,155,38,0.2);color:#d99b26;'>3</span><strong>Redis Gatekeeper</strong></div><p class='m-sub'>Limits · quota · cancellation</p></div>"]
		minio["<div class='m-node minio' data-node-key='minio'><span class='m-tag' style='color:#4a6572;'>MINIO · S3</span><div class='m-head'><span class='m-num' style='background:rgba(74,101,114,0.2);color:#4a6572;'>4</span><strong>Private Object Store</strong></div><p class='m-sub'>Raw files · signed URLs</p></div>"]
		postgres["<div class='m-node postgres' data-node-key='postgres'><span class='m-tag' style='color:#7c9d60;'>META</span><div class='m-head'><span class='m-num' style='background:rgba(124,157,96,0.2);color:#7c9d60;'>5</span><strong>Relational Core</strong></div><p class='m-sub'>Pending → confirmed</p></div>"]
		worker["<div class='m-node worker' data-node-key='worker'><span class='m-tag' style='color:#9c6f9e;'>JOB</span><div class='m-head'><span class='m-num' style='background:rgba(156,111,158,0.2);color:#9c6f9e;'>6</span><strong>FastAPI Worker</strong></div><p class='m-sub'>Extract · chunk · embed</p></div>"]
		vector["<div class='m-node vector' data-node-key='vector'><span class='m-tag' style='color:#a390c4;'>BGE-M3</span><div class='m-head'><span class='m-num' style='background:rgba(163,144,196,0.2);color:#a390c4;'>7</span><strong>Vector Index</strong></div><p class='m-sub'>Upsert chunks · page data</p></div>"]
		stream["<div class='m-node stream' data-node-key='stream'><span class='m-tag' style='color:#86af49;'>HOOK</span><div class='m-head'><span class='m-num' style='background:rgba(134,175,73,0.2);color:#86af49;'>8</span><strong>Progress Sync</strong></div><p class='m-sub'>pg_net · Realtime · poll</p></div>"]

		client --> gateway
		gateway --> redis
		gateway --> minio
		gateway --> postgres
		redis --> worker
		minio --> worker
		postgres --> worker
		worker --> vector
		worker --> stream
	`;

	function getNodeKeyFromTarget(target: EventTarget | null): string | null {
		if (!target || !(target instanceof Element)) return null;

		// 1. Check data-node-key directly
		const withData = target.closest<HTMLElement>('[data-node-key]');
		if (withData?.dataset.nodeKey && NODES[withData.dataset.nodeKey]) {
			return withData.dataset.nodeKey;
		}

		// 2. Check classes on target and ancestors
		const elWithClass = target.closest<Element>('.m-node, .node, [id*="mermaid"]');
		if (elWithClass) {
			const classStr = elWithClass.getAttribute('class') || '';
			const idStr = elWithClass.id || '';
			for (const key of Object.keys(NODES)) {
				if (classStr.includes(key) || idStr.toLowerCase().includes(key)) {
					return key;
				}
			}
		}

		// 3. Fallback: check inner text keywords
		const txt = target.textContent?.toLowerCase() || '';
		for (const key of Object.keys(NODES)) {
			if (txt.includes(key)) {
				return key;
			}
		}

		return null;
	}

	function selectNode(key: string) {
		if (NODES[key] && activeKey !== key) {
			isSwapping = true;
			setTimeout(() => {
				activeKey = key;
				isSwapping = false;
			}, 90);
		}
	}

	function handleCanvasClick(event: MouseEvent) {
		const key = getNodeKeyFromTarget(event.target);
		if (key) {
			selectNode(key);
		}
	}

	function bindMermaidEvents() {
		if (typeof document === 'undefined') return;
		const allNodes = document.querySelectorAll<HTMLElement>('.mermaid-canvas .node, .mermaid-canvas .m-node');
		allNodes.forEach((node) => {
			node.style.cursor = 'pointer';
			node.onclick = (e) => {
				e.stopPropagation();
				const key = getNodeKeyFromTarget(e.target) || getNodeKeyFromTarget(node);
				if (key) {
					selectNode(key);
				}
			};
		});
	}

	$effect(() => {
		const currentKey = activeKey;
		const _read = readSvg;
		const _ingest = ingestSvg;
		if (typeof document !== 'undefined') {
			const allNodes = document.querySelectorAll<HTMLElement>('.m-node');
			allNodes.forEach((n) => {
				const isCurrent = n.dataset.nodeKey === currentKey;
				n.classList.toggle('is-selected', isCurrent);
			});
			bindMermaidEvents();
		}
	});

	onMount(async () => {
		mermaid.initialize({
			startOnLoad: false,
			theme: 'base',
			themeVariables: {
				darkMode: true,
				background: 'transparent',
				mainBkg: '#161514',
				nodeBorder: '#3d3a36',
				nodeTextColor: '#f5f3eb',
				lineColor: '#c85a32',
				textColor: '#f5f3eb',
				fontFamily: 'var(--font-interface, sans-serif)',
				fontSize: '12px'
			},
			securityLevel: 'loose',
			flowchart: {
				curve: 'basis',
				htmlLabels: true,
				useMaxWidth: false,
				nodeSpacing: 48,
				rankSpacing: 54
			}
		});

		try {
			const { svg: rSvg } = await mermaid.render('mermaid-read-diag', readDiagram);
			readSvg = rSvg;
			const { svg: iSvg } = await mermaid.render('mermaid-ingest-diag', ingestDiagram);
			ingestSvg = iSvg;
		} catch (err) {
			console.log('[ArchitectureSection] Mermaid render error:', err);
		}
	});
</script>

<!-- ============ 5. ARCHITECTURE DIAGRAM ============ -->
<section class="section section--white" id="architecture">
	<div class="container">
		<div class="shead" data-reveal>
			<h2 class="t-h2">A grounded answer has a traceable path.</h2>
			<p class="t-b1 shead__lead">
				Inspect the two paths behind Dokyudo: hybrid retrieval on read, event-driven extraction on
				write. Click any node to inspect its responsibilities.
			</p>
		</div>

		<!-- Architecture Flow Tab Toggle -->
		<div class="arch-tabs" role="tablist" aria-label="Architecture Flow Tabs" data-reveal>
			<button
				class="arch-tab"
				class:is-active={activeFlow === 'read'}
				id="tab-read"
				type="button"
				role="tab"
				aria-selected={activeFlow === 'read'}
				aria-controls="flowblock-read"
				onclick={() => {
					activeFlow = 'read';
					if (['minio', 'worker'].includes(activeKey)) {
						selectNode('gateway');
					}
				}}
			>
				<span class="arch-tab__num">01</span>
				<span>Read / Query</span>
			</button>
			<button
				class="arch-tab"
				class:is-active={activeFlow === 'ingest'}
				id="tab-ingest"
				type="button"
				role="tab"
				aria-selected={activeFlow === 'ingest'}
				aria-controls="flowblock-ingest"
				onclick={() => {
					activeFlow = 'ingest';
					if (['fusion', 'router'].includes(activeKey)) {
						selectNode('worker');
					}
				}}
			>
				<span class="arch-tab__num">02</span>
				<span>Upload / Ingest</span>
			</button>
		</div>

		<!-- ===================== FLOW 1 — READ / QUERY PATH ===================== -->
		<div
			class="fblock"
			class:is-active={activeFlow === 'read'}
			id="flowblock-read"
			data-reveal
		>
			<div class="fhead">
				<span class="fhead__i">01</span>
				<h3 class="fhead__t">Read / Query Path</h3>
				<span class="fhead__rule"></span>
				<span class="fhead__hint">drag to pan ▸</span>
			</div>

			<div class="flow-mermaid-container">
				<!-- Zoom controls -->
				<div class="flow-controls" aria-label="Diagram Zoom Controls">
					<button
						class="flow-btn"
						type="button"
						onclick={zoomOut}
						disabled={zoomLevel <= MIN_ZOOM}
						aria-label="Zoom out"
						title="Zoom out"
					>
						<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round">
							<line x1="5" y1="12" x2="19" y2="12" />
						</svg>
					</button>
					<button
						class="flow-btn flow-btn--level"
						type="button"
						onclick={resetZoom}
						title="Click to reset zoom (100%)"
						aria-label="Current zoom level"
					>
						{Math.round(zoomLevel * 100)}%
					</button>
					<button
						class="flow-btn"
						type="button"
						onclick={zoomIn}
						disabled={zoomLevel >= MAX_ZOOM}
						aria-label="Zoom in"
						title="Zoom in"
					>
						<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round">
							<line x1="12" y1="5" x2="12" y2="19" />
							<line x1="5" y1="12" x2="19" y2="12" />
						</svg>
					</button>
					<button
						class="flow-btn flow-btn--reset"
						type="button"
						onclick={resetZoom}
						disabled={zoomLevel === 1.0}
						title="Reset zoom to 100%"
						aria-label="Reset zoom"
					>
						<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
							<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
							<path d="M3 3v5h5" />
						</svg>
					</button>
				</div>

				<!-- svelte-ignore a11y_click_events_have_key_events -->
				<!-- svelte-ignore a11y_no_static_element_interactions -->
				<div
					class="mermaid-canvas"
					style="transform: scale({zoomLevel}); transform-origin: left center;"
					onclick={handleCanvasClick}
				>
					{#if readSvg}
						<!-- eslint-disable-next-line svelte/no-at-html-tags -->
						{@html readSvg}
					{:else}
						<div class="mermaid-loading">Rendering architecture flow…</div>
					{/if}
				</div>
			</div>
		</div>

		<!-- ===================== FLOW 2 — INGESTION / WRITE PATH ===================== -->
		<div
			class="fblock"
			class:is-active={activeFlow === 'ingest'}
			id="flowblock-ingest"
			data-reveal
		>
			<div class="fhead">
				<span class="fhead__i">02</span>
				<h3 class="fhead__t">Ingestion / Write Path</h3>
				<span class="fhead__rule"></span>
				<span class="fhead__hint">drag to pan ▸</span>
			</div>

			<div class="flow-mermaid-container">
				<!-- Zoom controls -->
				<div class="flow-controls" aria-label="Diagram Zoom Controls">
					<button
						class="flow-btn"
						type="button"
						onclick={zoomOut}
						disabled={zoomLevel <= MIN_ZOOM}
						aria-label="Zoom out"
						title="Zoom out"
					>
						<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round">
							<line x1="5" y1="12" x2="19" y2="12" />
						</svg>
					</button>
					<button
						class="flow-btn flow-btn--level"
						type="button"
						onclick={resetZoom}
						title="Click to reset zoom (100%)"
						aria-label="Current zoom level"
					>
						{Math.round(zoomLevel * 100)}%
					</button>
					<button
						class="flow-btn"
						type="button"
						onclick={zoomIn}
						disabled={zoomLevel >= MAX_ZOOM}
						aria-label="Zoom in"
						title="Zoom in"
					>
						<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round">
							<line x1="12" y1="5" x2="12" y2="19" />
							<line x1="5" y1="12" x2="19" y2="12" />
						</svg>
					</button>
					<button
						class="flow-btn flow-btn--reset"
						type="button"
						onclick={resetZoom}
						disabled={zoomLevel === 1.0}
						title="Reset zoom to 100%"
						aria-label="Reset zoom"
					>
						<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
							<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
							<path d="M3 3v5h5" />
						</svg>
					</button>
				</div>

				<!-- svelte-ignore a11y_click_events_have_key_events -->
				<!-- svelte-ignore a11y_no_static_element_interactions -->
				<div
					class="mermaid-canvas"
					style="transform: scale({zoomLevel}); transform-origin: left center;"
					onclick={handleCanvasClick}
				>
					{#if ingestSvg}
						<!-- eslint-disable-next-line svelte/no-at-html-tags -->
						{@html ingestSvg}
					{:else}
						<div class="mermaid-loading">Rendering architecture flow…</div>
					{/if}
				</div>
			</div>
		</div>

		<!-- inspector: seamlessly connected to the diagram preview panel above -->
		<div
			class="arch-detail"
			class:swap={isSwapping}
			id="archDetail"
			data-reveal
			tabindex="-1"
			style="--active-zone-color: {activeNode.zoneColor};"
		>
			<div class="ad-head">
				<span
					class="ad-zone"
					style="
						color: {activeNode.zoneColor};
						border-color: {activeNode.zoneColor};
						background: color-mix(in srgb, {activeNode.zoneColor} 14%, transparent);
					"
				>
					{activeNode.zone}
				</span>
				<h3 class="ad-title">{activeNode.title}</h3>
			</div>
			<div class="ad-grid">
				<ul class="ad-bullets">
					{#each activeNode.bullets as bullet}
						<li>{bullet}</li>
					{/each}
				</ul>
				<div class="ad-side">
					<h4>Dependencies</h4>
					<div class="ad-deps">
						{#each activeNode.deps as dep}
							<span>{dep}</span>
						{/each}
					</div>
					<div class="ad-budget">
						<h4>{activeNode.budgetLabel}</h4>
						<b>{activeNode.budget}</b>
					</div>
				</div>
			</div>
		</div>
	</div>
</section>

<style>
	.flow-mermaid-container {
		position: relative;
		overflow-x: auto;
		overflow-y: hidden;
		scrollbar-width: thin;
		scrollbar-color: var(--color-gray-light, #444) transparent;
		padding: 52px 20px 24px;
		background: #0f0e0d;
		border: 1px solid rgba(255, 255, 255, 0.08);
		border-bottom: none;
		border-radius: 12px 12px 0 0;
		box-shadow: inset 0 2px 8px rgba(0, 0, 0, 0.4);
	}

	:global(.landing-root .arch-detail) {
		margin-top: 0 !important;
		background: #141312 !important;
		border: 1px solid rgba(255, 255, 255, 0.08) !important;
		border-top: 1px solid rgba(255, 255, 255, 0.06) !important;
		border-radius: 0 0 12px 12px !important;
		padding: 24px 28px !important;
		box-shadow: none !important;
		position: relative;
	}

	:global(.landing-root .ad-zone) {
		box-shadow: none !important;
		transition:
			color 180ms ease,
			border-color 180ms ease,
			background-color 180ms ease;
	}

	:global(.landing-root .ad-bullets li::before) {
		border-color: var(--active-zone-color, #c85a32) !important;
		transition: border-color 180ms ease;
	}

	.flow-controls {
		position: absolute;
		top: 14px;
		right: 14px;
		z-index: 10;
		display: inline-flex;
		align-items: center;
		gap: 2px;
		background: rgba(26, 25, 23, 0.9);
		backdrop-filter: blur(10px);
		border: 1px solid rgba(255, 255, 255, 0.14);
		border-radius: 8px;
		padding: 3px 4px;
		box-shadow: 0 4px 14px rgba(0, 0, 0, 0.4);
	}

	.flow-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 26px;
		height: 26px;
		border-radius: 5px;
		background: transparent;
		border: none;
		color: #e5e3db;
		cursor: pointer;
		font-family: var(--font-interface, sans-serif);
		font-size: 0.72rem;
		font-weight: 600;
		transition: background 140ms ease, color 140ms ease, opacity 140ms ease;
	}

	.flow-btn:hover:not(:disabled) {
		background: rgba(255, 255, 255, 0.12);
		color: #ffffff;
	}

	.flow-btn:disabled {
		opacity: 0.3;
		cursor: not-allowed;
	}

	.flow-btn--level {
		width: auto;
		min-width: 44px;
		padding: 0 6px;
		font-size: 0.7rem;
		font-variant-numeric: tabular-nums;
		letter-spacing: 0.02em;
		color: var(--color-terracotta, #c85a32);
	}

	.flow-btn--reset {
		border-left: 1px solid rgba(255, 255, 255, 0.12);
		margin-left: 2px;
		padding-left: 5px;
		width: 28px;
	}

	.flow-mermaid-container::-webkit-scrollbar {
		height: 6px;
	}
	.flow-mermaid-container::-webkit-scrollbar-thumb {
		background: rgba(255, 255, 255, 0.18);
		border-radius: 9999px;
	}

	.mermaid-canvas {
		display: flex;
		justify-content: flex-start;
		min-width: 980px;
		width: max-content;
		user-select: none;
		transition: transform 180ms cubic-bezier(0.2, 0, 0.2, 1);
		padding: 8px 0;
	}

	.mermaid-loading {
		padding: 48px;
		font-family: var(--font-interface, sans-serif);
		font-size: 0.85rem;
		color: var(--color-gray, #888);
		text-align: center;
	}

	:global(.mermaid-canvas svg) {
		max-width: 100% !important;
		height: auto !important;
		overflow: visible;
	}

	:global(.mermaid-canvas .node) {
		cursor: pointer;
		pointer-events: all;
	}

	:global(.mermaid-canvas .node rect),
	:global(.mermaid-canvas .node circle),
	:global(.mermaid-canvas .node polygon) {
		fill: transparent !important;
		stroke: transparent !important;
	}

	:global(.mermaid-canvas .edgePath path) {
		stroke: var(--color-terracotta, #c85a32) !important;
		stroke-width: 2px !important;
		opacity: 0.85;
	}

	:global(.mermaid-canvas .marker) {
		fill: var(--color-terracotta, #c85a32) !important;
		stroke: var(--color-terracotta, #c85a32) !important;
	}

	:global(.m-node) {
		display: flex;
		flex-direction: column;
		gap: 6px;
		width: 160px;
		padding: 12px 14px;
		background: #181716;
		border: 1px solid rgba(255, 255, 255, 0.12);
		border-radius: 10px;
		color: #f5f3eb;
		box-shadow: 0 4px 16px rgba(0, 0, 0, 0.35);
		text-align: left;
		cursor: pointer;
		pointer-events: auto;
		transition: background 160ms ease, border-color 160ms ease, box-shadow 160ms ease;
	}

	:global(.m-node:hover) {
		background: #23211f;
		border-color: rgba(255, 255, 255, 0.4);
		box-shadow: 0 6px 20px rgba(0, 0, 0, 0.6);
	}

	:global(.m-node.is-selected) {
		background: #282522 !important;
		border-color: var(--color-terracotta, #c85a32) !important;
		box-shadow: 0 0 0 1px var(--color-terracotta, #c85a32) !important;
	}

	:global(.m-node.client) {
		border-top: 3px solid #7b88d1;
	}
	:global(.m-node.gateway) {
		border-top: 3px solid #c85a32;
	}
	:global(.m-node.redis) {
		border-top: 3px solid #d99b26;
	}
	:global(.m-node.minio) {
		border-top: 3px solid #4a6572;
	}
	:global(.m-node.postgres) {
		border-top: 3px solid #7c9d60;
	}
	:global(.m-node.worker) {
		border-top: 3px solid #9c6f9e;
	}
	:global(.m-node.vector) {
		border-top: 3px solid #a390c4;
	}
	:global(.m-node.fusion) {
		border-top: 3px solid #c85a32;
	}
	:global(.m-node.router) {
		border-top: 3px solid #9c6f9e;
	}
	:global(.m-node.stream) {
		border-top: 3px solid #86af49;
	}

	:global(.m-tag) {
		font-family: var(--font-interface, sans-serif);
		font-size: 0.6rem;
		font-weight: 700;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: rgba(255, 255, 255, 0.45);
	}

	:global(.m-head) {
		display: flex;
		align-items: center;
		gap: 6px;
	}

	:global(.m-num) {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 18px;
		height: 18px;
		border-radius: 50%;
		background: rgba(255, 255, 255, 0.12);
		color: #f5f3eb;
		font-size: 0.65rem;
		font-weight: 700;
		flex-shrink: 0;
	}

	:global(.m-head strong) {
		font-family: var(--font-display, serif);
		font-size: 0.85rem;
		font-weight: 600;
		color: #f5f3eb;
		line-height: 1.2;
	}

	:global(.m-sub) {
		margin: 0;
		font-family: var(--font-interface, sans-serif);
		font-size: 0.68rem;
		line-height: 1.35;
		color: rgba(255, 255, 255, 0.6);
	}
</style>


