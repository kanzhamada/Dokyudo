/* ==========================================================
   Dokyudo landing page interactive wiring.

   This module powers the landing page's simulations and
	 interactions: the architecture
   flow routing + inspector, the model-fallback cylinder, the
   tier-unlock flow, the testimonial switcher, the FAQ
   accordion, and the scroll reveals.

   Notes:
   - All queries are scoped to `.landing-root` so the hero
     section and app chrome are never touched.
   - Header state, mobile menu, nav-spy, and the old hero
     visualizer were dropped (the page keeps LandingNav +
     HeroSection from the app, not the static design's).
   - Every listener / observer / timer / rAF is tracked so the
     returned cleanup function can tear everything down on
     unmount.
	 The retrieval demo is a Svelte component; the remaining simulations run
	 locally and make no network calls.
   ========================================================== */

type ObserverLike = { disconnect: () => void };

type FlowConn = [string, string, string, string, { glyph?: boolean }];

const FLOW_CONNS: Record<string, FlowConn[]> = {
	'flow-read': [
		['client', 'gateway', 'right', 'left', {}],
		['gateway', 'redis', 'right', 'left', {}],
		['redis', 'vector', 'right', 'left', {}],
		['redis', 'postgres', 'right', 'left', {}],
		['vector', 'fusion', 'right', 'left', { glyph: true }],
		['postgres', 'fusion', 'right', 'left', {}],
		['fusion', 'router', 'right', 'left', {}],
		['router', 'stream', 'right', 'left', {}]
	],
	'flow-ingest': [
		['client', 'gateway', 'right', 'left', {}],
		['gateway', 'redis', 'right', 'left', {}],
		['gateway', 'minio', 'right', 'left', {}],
		['gateway', 'postgres', 'right', 'left', {}],
		['redis', 'worker', 'right', 'left', {}],
		['minio', 'worker', 'right', 'left', {}],
		['postgres', 'worker', 'right', 'left', {}],
		['worker', 'vector', 'right', 'left', {}],
		['worker', 'stream', 'right', 'left', {}]
	]
};

interface ArchNode {
	zone: string;
	zoneColor: string;
	title: string;
	bullets: string[];
	deps: string[];
	budgetLabel: string;
	budget: string;
}

const NODES: Record<string, ArchNode> = {
	client: {
		zone: 'Browser client',
		zoneColor: 'var(--c-periwinkle)',
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
		zoneColor: 'var(--color-terracotta)',
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
		zoneColor: 'var(--c-amber)',
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
		zoneColor: 'var(--c-lavender)',
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
		zoneColor: 'var(--c-olive)',
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
		zoneColor: 'var(--c-purple)',
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
		zoneColor: 'var(--c-purple)',
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
		zoneColor: 'var(--c-navy)',
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
		zoneColor: 'var(--c-purple)',
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
		zoneColor: 'var(--c-lime)',
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

export function initLanding(): () => void {
	const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

	const root = document.querySelector<HTMLElement>('.landing-root');
	if (!root) return () => {};
	const $ = <T extends Element = HTMLElement>(
		sel: string,
		ctx: ParentNode | null = root
	): T | null => ctx?.querySelector<T>(sel) ?? null;
	const $$ = <T extends Element = HTMLElement>(sel: string, ctx: ParentNode | null = root): T[] =>
		ctx ? Array.from(ctx.querySelectorAll<T>(sel)) : [];

	/* ---------- cleanup registry ---------- */
	const disposers: Array<() => void> = [];
	const timeouts = new Set<number>();
	const intervals = new Set<number>();
	const rafs = new Set<number>();
	const observers: ObserverLike[] = [];

	const on = (
		target: EventTarget | null | undefined,
		event: string,
		fn: EventListenerOrEventListenerObject,
		opts?: AddEventListenerOptions | boolean
	) => {
		if (!target) return;
		target.addEventListener(event, fn, opts);
		disposers.push(() => target.removeEventListener(event, fn, opts));
	};
	const later = (fn: () => void, ms?: number) => {
		const id = window.setTimeout(fn, ms);
		timeouts.add(id);
		return id;
	};
	const every = (fn: () => void, ms: number) => {
		const id = window.setInterval(fn, ms);
		intervals.add(id);
		return id;
	};
	const clearLater = (id: number) => {
		timeouts.delete(id);
		clearTimeout(id);
	};
	const clearEvery = (id: number) => {
		intervals.delete(id);
		clearInterval(id);
	};
	const nextFrame = (fn: FrameRequestCallback) => {
		const id = requestAnimationFrame(fn);
		rafs.add(id);
		return id;
	};
	const cancelFrame = (id: number | null | undefined) => {
		if (id == null) return;
		rafs.delete(id);
		cancelAnimationFrame(id);
	};
	const observe = <T extends ObserverLike>(o: T): T => {
		observers.push(o);
		return o;
	};

	/* ---------- scroll reveals (Emil Kowalski Design Eng) ---------- */
	const autoRevealSelectors = [
		'section h1',
		'section h2',
		'section h3',
		'section .t-b1',
		'section .t-b2',
		'section .btn',
		'section .card',
		'section .scard',
		'section .tcard',
		'section .arch-node',
		'section .chunkcard',
		'section .cap-item',
		'section .fb-stage',
		'section .console',
		'section img',
		'section figure'
	];

	autoRevealSelectors.forEach((sel) => {
		$$(sel).forEach((el) => {
			if (!el.hasAttribute('data-reveal') && !el.closest('.acc, .acc-panel')) {
				el.setAttribute('data-reveal', '');
			}
		});
	});

	const revealEls = $$('[data-reveal]');

	const revealContainers = $$(
		'.hero__copy, .cap-list, .cap-stage, .console__side, .console__main, .arch__row, .arch__data, .fb-toolbar, .tier-grid, .faq-grid, .cta-grid'
	);
	revealContainers.forEach((container) => {
		const items = $$('[data-reveal]', container);
		items.forEach((item, idx) => {
			if (!item.style.getPropertyValue('--rd')) {
				item.style.setProperty('--rd', `${idx * 75}ms`);
			}
		});
	});

	if (REDUCED || !('IntersectionObserver' in window)) {
		revealEls.forEach((el) => el.classList.add('is-in'));
	} else {
		const io = observe(
			new IntersectionObserver(
				(entries) => {
					entries.forEach((entry) => {
						if (entry.isIntersecting) {
							entry.target.classList.add('is-in');
							io.unobserve(entry.target);
						}
					});
				},
				{ threshold: 0.08, rootMargin: '0px 0px -40px 0px' }
			)
		);
		revealEls.forEach((el) => io.observe(el));
	}

	/* ---------- tier unlock simulation (PRD: global event trigger) ---------- */
	const flagLine = $('.flag-line');
	const flagVal = $('#flagVal');
	const realCard = $('#realCard');
	const realBtn = $<HTMLButtonElement>('#realBtn');
	const realBtnLabel = $('#realBtnLabel');
	const toast = $('#toast');
	let unlocked = false;
	let toastTimer: number | undefined;

	function showToast() {
		if (!toast) return;
		toast.classList.add('show');
		if (toastTimer) clearLater(toastTimer);
		toastTimer = later(() => toast.classList.remove('show'), 4200);
	}

	function doUnlock() {
		if (unlocked) {
			const tiers = $('#tiers');
			if (tiers) tiers.scrollIntoView({ behavior: REDUCED ? 'auto' : 'smooth' });
			return;
		}
		unlocked = true;

		$$('.js-investor').forEach((btn) => {
			const label = $('.js-investor-label', btn);
			if (label) label.textContent = 'Processing sandbox invoice…';
			btn.setAttribute('aria-busy', 'true');
		});

		later(
			() => {
				$$('.js-investor').forEach((btn) => {
					const label = $('.js-investor-label', btn);
					if (label) label.textContent = 'Investor Tier Unlocked';
					btn.setAttribute('aria-busy', 'false');
					btn.classList.remove('btn--primary', 'btn--ghost-dark', 'btn--investor');
					btn.classList.add('btn--ghost');
				});

				if (flagVal) {
					flagVal.textContent = 'true';
					flagVal.classList.add('on');
				}
				if (flagLine) flagLine.classList.add('unlocked');

				if (realCard) realCard.classList.add('unlocked');
				if (realBtn) {
					realBtn.disabled = false;
					const ic = realBtn.querySelector('.ic');
					if (ic) (ic as HTMLElement).style.display = 'none';
					if (realBtnLabel) realBtnLabel.textContent = 'Start Subscription';
				}
				showToast();
			},
			REDUCED ? 50 : 750
		);
	}

	$$('.js-investor').forEach((btn) => on(btn, 'click', doUnlock));
	if (realBtn) {
		on(realBtn, 'click', () => {
			if (!realBtn.disabled) showToast();
		});
	}

	/* ---------- FAQ accordion ---------- */
	const accs = $$('.acc');
	accs.forEach((acc) => {
		const btn = $('.acc-btn', acc);
		const panel = $('.acc-panel', acc);
		if (!btn || !panel) return;
		on(btn, 'click', () => {
			const isOpen = acc.classList.contains('open');
			// close others for a tidy rhythm
			accs.forEach((other) => {
				if (other !== acc && other.classList.contains('open')) {
					other.classList.remove('open');
					const ob = $('.acc-btn', other);
					const op = $('.acc-panel', other);
					ob?.setAttribute('aria-expanded', 'false');
					if (op) op.style.maxHeight = '0px';
				}
			});
			acc.classList.toggle('open', !isOpen);
			btn.setAttribute('aria-expanded', String(!isOpen));
			panel.style.maxHeight = !isOpen ? panel.scrollHeight + 'px' : '0px';
		});
	});

	// keep open panels sized correctly on resize
	on(
		window,
		'resize',
		() => {
			$$('.acc.open .acc-panel').forEach((p) => {
				p.style.maxHeight = p.scrollHeight + 'px';
			});
		},
		{ passive: true }
	);

	/* ---------- sandbox evaluation code (simulated, local only) ---------- */
	const simBtn = $<HTMLButtonElement>('#simBtn');
	const simCode = $('#simCode');
	if (simBtn && simCode) {
		on(simBtn, 'click', () => {
			const bytes = new Uint8Array(4);
			crypto.getRandomValues(bytes);
			const code =
				'SIM-' +
				Array.from(bytes)
					.map((b) => b.toString(16).padStart(2, '0').toUpperCase())
					.join('');
			const chip = simCode.querySelector('b');
			if (chip) chip.textContent = code;
			simCode.hidden = false;
			simBtn.textContent = 'Code generated';
			simBtn.disabled = true;
			simBtn.classList.remove('btn--ink');
			simBtn.classList.add('btn--ghost');
		});
	}

	/* ---------- testimonial switcher (rail -> portrait + quote) ---------- */
	const vGrid = $('#voicesGrid');
	if (vGrid) {
		const gridEl = vGrid;
		const persons = $$('.vp-person', vGrid);
		const photo = $('#voicesPhoto');
		const photoImg = <HTMLImageElement | null>$('#voicesImg');
		const photoMono = $('#voicesMono');
		const phName = $('#voicesPhName');
		const phRole = $('#voicesPhRole');
		const swap = $('#voicesSwap');
		const qBody = $('#voicesBody');
		const qCite = $('#voicesCite');
		const qCo = $('#voicesCo');
		const qRate = $('#voicesRate');

		const firstRoleLine = (s: string) => (s || '').split('/')[0].trim();
		let current = persons.findIndex((p) => p.classList.contains('is-active'));
		if (current < 0) current = 0;
		let autoTimer: number | undefined;
		const AUTO = 6000;

		function paintPhoto(btn: HTMLElement) {
			const img = (btn.dataset.img || '').trim();
			const name = $<HTMLElement>('.vp-person__name', btn)?.textContent?.trim() || '';
			const role = $<HTMLElement>('.vp-person__role', btn)?.textContent?.trim() || '';
			if (img && photoImg) {
				photoImg.src = img;
				photoImg.alt = 'Portrait of ' + name;
				photoImg.hidden = false;
				photo?.classList.add('has-img');
			} else {
				if (photoImg) {
					photoImg.hidden = true;
					photoImg.removeAttribute('src');
				}
				photo?.classList.remove('has-img');
				if (photoMono) photoMono.textContent = btn.dataset.mono || name.slice(0, 2).toUpperCase();
				if (phName) phName.textContent = name;
				if (phRole) phRole.textContent = firstRoleLine(role);
			}
		}

		function paintQuote(btn: HTMLElement) {
			const name = $<HTMLElement>('.vp-person__name', btn)?.textContent?.trim() || '';
			const role = $<HTMLElement>('.vp-person__role', btn)?.textContent?.trim() || '';
			const quote = ($<HTMLElement>('.vp-person__quote', btn)?.textContent || '').trim();
			const rate = (btn.dataset.rate || '5.0').trim();
			if (qBody) qBody.textContent = quote;
			if (qCite) qCite.textContent = name;
			if (qCo) qCo.textContent = role;
			qRate?.setAttribute('aria-label', 'Rated ' + rate + ' out of 5');
			const b = qRate?.querySelector('b');
			if (b) b.textContent = rate;

			const brand = (btn.dataset.brand || '').trim();
			const brandUse = gridEl.querySelector('.voices-quote__brand use');
			if (brandUse && brand) {
				brandUse.setAttribute('href', '#i-brand-' + brand);
			}
		}

		function select(idx: number) {
			idx = ((idx % persons.length) + persons.length) % persons.length;
			current = idx;
			const btn = persons[idx];
			persons.forEach((p, i) => {
				const onNow = i === idx;
				p.classList.toggle('is-active', onNow);
				p.setAttribute('aria-pressed', String(onNow));
			});
			// optional per-person rail avatar photo
			persons.forEach((p) => {
				const a = $<HTMLElement>('.vp-person__avatar', p);
				const src = (p.dataset.avatar || '').trim();
				if (a && src) {
					a.style.backgroundImage = 'url(' + src + ')';
					a.textContent = '';
				}
			});

			if (REDUCED) {
				paintPhoto(btn);
				paintQuote(btn);
				return;
			}
			swap?.classList.add('swap');
			photo?.classList.add('swap');
			later(() => {
				paintPhoto(btn);
				paintQuote(btn);
				swap?.classList.remove('swap');
				photo?.classList.remove('swap');
			}, 200);
		}

		function startAuto() {
			if (REDUCED) return;
			stopAuto();
			autoTimer = every(() => select(current + 1), AUTO);
		}
		function stopAuto() {
			if (autoTimer) {
				clearEvery(autoTimer);
				autoTimer = undefined;
			}
		}

		persons.forEach((btn, i) => {
			on(btn, 'click', () => {
				select(i);
				startAuto();
			});
		});

		// pause auto-advance while the user is hovering or tabbing through the grid
		on(vGrid, 'mouseenter', stopAuto);
		on(vGrid, 'mouseleave', startAuto);
		on(vGrid, 'focusin', stopAuto);
		on(vGrid, 'focusout', startAuto);

		// initial paint + go
		paintPhoto(persons[current]);
		paintQuote(persons[current]);
		startAuto();
	}

	/* ---------- capabilities switcher (list -> diagram, auto-advancing) ---------- */
	(function capSwitcher() {
		const grid = $('#capGrid');
		const list = $('#capList');
		const panel = $('#capPanel');
		const section = $('#features');
		if (!grid || !list || !section) return;

		const items = $$('.cap-item', list);
		const stages = $$('.cap-stage', panel || root);
		const fills = items.map((it) => $('.cap-bar__fill', it));
		const DURATION = 5200;

		let idx = 0;
		let raf = 0;
		let t0 = 0;
		let acc = 0;
		let inView = false;

		const setBar = (i: number, p: number) => {
			if (fills[i]) fills[i].style.transform = 'scaleX(' + p + ')';
		};
		const show = (i: number) => {
			items.forEach((it, k) => {
				const onNow = k === i;
				it.classList.toggle('is-on', onNow);
				it.setAttribute('aria-expanded', String(onNow));
				if (!onNow) setBar(k, 0);
			});
			stages.forEach((st, k) => st.classList.toggle('is-on', k === i));
		};
		const tick = (now: number) => {
			const p = Math.min((acc + (now - t0)) / DURATION, 1);
			setBar(idx, p);
			if (p >= 1) {
				advance();
				return;
			}
			raf = nextFrame(tick);
		};
		const run = () => {
			cancelFrame(raf);
			t0 = performance.now();
			raf = nextFrame(tick);
		};
		const freeze = () => {
			cancelFrame(raf);
			acc += performance.now() - t0;
		};
		const advance = () => {
			setBar(idx, 0);
			idx = (idx + 1) % items.length;
			show(idx);
			acc = 0;
			if (!REDUCED && inView) {
				run();
			}
		};
		const select = (i: number) => {
			if (i === idx) return;
			setBar(idx, 0);
			idx = i;
			show(idx);
			acc = 0;
			if (!REDUCED) {
				run();
			} else {
				setBar(idx, 1);
			}
		};

		items.forEach((it, i) => on(it, 'click', () => select(i)));

		// only run the auto-advance while the section is on screen
		if ('IntersectionObserver' in window && !REDUCED) {
			const cio = observe(
				new IntersectionObserver(
					(entries) => {
						inView = entries[0].isIntersecting;
						if (inView) {
							run();
						} else {
							freeze();
						}
					},
					{ threshold: 0.1 }
				)
			);
			cio.observe(section);
		} else {
			inView = true;
		}

		show(0);
		setBar(0, 0);
		if (!REDUCED) {
			inView = true;
			run();
		}
	})();

	/* ---------- footer email capture (local-only confirmation) ---------- */
	(function footerCapture() {
		const wrap = $('.ft-capture-wrap');
		if (!wrap) return;
		const form = $('.ft-capture', wrap);
		const input = $('.ft-capture__input', wrap);
		const btn = $('.ft-capture__btn', wrap);
		const field = $('.ft-capture__field', wrap);
		const ok = $('.ft-capture__ok', wrap);
		if (!form || !input || !btn) return;

		const RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

		on(input, 'input', () => {
			if (field) field.style.borderColor = '';
		});

		on(form, 'submit', (e) => {
			e.preventDefault();
			if (wrap.classList.contains('is-sent')) return;
			const val = (input as HTMLInputElement).value.trim();
			if (!RE.test(val)) {
				if (field) field.style.borderColor = 'var(--color-orange)';
				input.focus();
				return;
			}
			wrap.classList.add('is-sent');
			btn.setAttribute('aria-label', 'Subscribed');
			btn.innerHTML = '<svg class="ic" aria-hidden="true"><use href="#i-check"/></svg>';
			input.setAttribute('readonly', 'readonly');
			if (ok) ok.textContent = "You're on the list - we'll be in touch.";
		});
	})();

	/* ---------- model fallback chain / revolver cylinder ---------- */
	(function fbCylinder() {
		const section = $('#fallback');
		const drum = $('#fbDrum');
		const sparkEl = $('.fb-spark', section);
		const routeLine = $('#fbRouteLine');
		const eventLine = $('#fbEventLine');
		const live = $('#fbLive');
		const manifest = $('#fbManifest');
		const autoSwitch = $('#fbAutoSwitch');
		if (!section || !drum || !manifest) return;
		const drm = drum;

		/* Kalkulasi path SVG untuk lekukan luar silinder logam */
		const drumBody = $('#fbDrumBody');
		if (drumBody) {
			const CENTER = 180,
				BASE_R = 150,
				DEPTH = 18,
				SIGMA = 10.5;
			let pathData = '';
			for (let i = 0; i <= 288; i++) {
				const theta = (i / 288) * 360;
				let r = BASE_R;
				for (let j = 0; j < 7; j++) {
					const fluteAngle = j * (360 / 7) - 90 + 360 / 14;
					const diff = ((((theta - fluteAngle + 180) % 360) + 360) % 360) - 180;
					r -= DEPTH * Math.exp(-(diff * diff) / (2 * SIGMA * SIGMA));
				}
				const rad = (theta * Math.PI) / 180;
				pathData +=
					(i === 0 ? 'M' : 'L') +
					(CENTER + r * Math.cos(rad)).toFixed(2) +
					',' +
					(CENTER + r * Math.sin(rad)).toFixed(2) +
					' ';
			}
			drumBody.setAttribute('d', pathData + 'Z');
		}

		const chambers = $$('.fb-ch', section);
		const labels = chambers.map((c) => $('.fb-ch-label', c));
		const dots = chambers.map((c) => $('.fb-ch-dot', c));

		/* chamber -> provider map baru */
		const P = [
			{ code: 'MS', name: 'Mistral', model: 'Ministral', id: '#f97316' },
			{ code: 'QW', name: 'Qwen', model: 'Qwen 2.5', id: '#6366f1' },
			{ code: 'LL', name: 'Meta', model: 'Llama 3', id: '#06b6d4' },
			{ code: 'GM', name: 'Google', model: 'Gemini', id: '#8b5cf6' },
			{ code: 'CO', name: 'Cohere', model: 'Command', id: '#10b981' },
			{ code: 'OA', name: 'OpenAI', model: 'GPT-4o', id: '#14b8a6' },
			{ code: 'DS', name: 'Deepseek', model: 'Coder', id: '#3b82f6' }
		];
		const N = P.length;
		const STEP = 360 / N;
		const status = P.map(() => 'ready'); // ready | limited | open
		let active = 0;
		let rot = 0;

		const word = (s: string) => (s === 'limited' ? '429' : s);

		/* bangun menu manifest */
		manifest.innerHTML = P.map(
			(p, i) =>
				'<button class="fb-mchip" type="button" data-i="' +
				i +
				'" style="--id:' +
				p.id +
				'">' +
				'<span class="fb-mchip__top">' +
				'<span class="fb-mchip__sw" aria-hidden="true"></span>' +
				'<span class="fb-mchip__code">' +
				p.code +
				'</span>' +
				'<span class="fb-mchip__st st-ready" data-st>ready</span>' +
				'</span>' +
				'<span class="fb-mchip__name">' +
				p.name +
				'</span>' +
				'<span class="fb-mchip__model">' +
				p.model +
				'</span>' +
				'<span class="fb-mchip__live" aria-hidden="true">live</span>' +
				'</button>'
		).join('');
		const chips = $$('.fb-mchip', manifest);
		const chipSt = chips.map((c) => c.querySelector('[data-st]'));

		/* rotasi mekanis dan mekanika spring */
		function apply(x: number) {
			drm.setAttribute('transform', 'rotate(' + x + ' 180 180)');
			for (let i = 0; i < labels.length; i++)
				labels[i]?.setAttribute('transform', 'rotate(' + -x + ')');
		}

		function makeSpring(initial: number) {
			let cur = initial,
				vel = 0,
				target = initial,
				last = 0,
				on = false;
			const K = 260,
				D = 24,
				M = 1,
				PREC = 0.05;
			function frame(now: number) {
				if (!last) last = now;
				let dt = (now - last) / 1000;
				last = now;
				if (dt > 0.032) dt = 0.032;
				const f = -K * (cur - target) - D * vel;
				vel += (f / M) * dt;
				cur += vel * dt;
				apply(cur);
				if (Math.abs(target - cur) < PREC && Math.abs(vel) < PREC) {
					cur = target;
					vel = 0;
					on = false;
					last = 0;
					apply(cur);
					return;
				}
				nextFrame(frame);
			}
			return {
				set(t: number) {
					target = t;
					if (REDUCED) {
						cur = t;
						vel = 0;
						apply(t);
						return;
					}
					if (!on) {
						on = true;
						last = 0;
						nextFrame(frame);
					}
				}
			};
		}
		const spin = makeSpring(0);

		function spark() {
			if (REDUCED || !sparkEl) return;
			sparkEl.classList.remove('flash');
			void sparkEl.getBoundingClientRect();
			sparkEl.classList.add('flash');
			later(() => sparkEl.classList.remove('flash'), 460);
		}

		function render(ev?: { text: string; kind?: string }) {
			const p = P[active];
			for (let i = 0; i < N; i++) {
				chambers[i].classList.toggle('is-active', i === active);
				chips[i].classList.toggle('is-active', i === active);
				dots[i]?.setAttribute('class', 'fb-ch-dot is-' + status[i]);
				const st = chipSt[i];
				if (st) {
					st.setAttribute('class', 'fb-mchip__st st-' + status[i]);
					st.textContent = word(status[i]);
				}
			}
			if (routeLine) {
				routeLine.textContent =
					'route → ' +
					p.name +
					' / ' +
					p.model +
					' / ' +
					word(status[active]) +
					' / circuit ' +
					(status[active] === 'open' ? 'open' : 'closed');
			}
			if (ev) {
				if (eventLine) {
					eventLine.textContent = ev.text;
					eventLine.setAttribute('class', 'fb-readout__event t-tag hit-' + (ev.kind || 'info'));
				}
			}
			if (live)
				live.textContent =
					'Active route: ' + p.name + ' / ' + p.model + ' / ' + word(status[active]);
		}

		function select(i: number, opts?: { full?: boolean; ev?: { text: string; kind?: string } }) {
			opts = opts || {};
			i = ((i % N) + N) % N;
			const desired = -(i * STEP);
			let delta = (((desired - rot) % 360) + 360) % 360;
			if (delta > 0) delta -= 360;
			if (delta === 0 && opts.full) delta = -360;
			rot += delta;
			active = i;
			spin.set(rot);
			spark();
			render(opts.ev);
		}

		function nextReady(after: number) {
			for (let k = 1; k <= N; k++) {
				const idx = (after + k) % N;
				if (status[idx] === 'ready') return idx;
			}
			return -1;
		}

		function indexNext() {
			const nx = nextReady(active);
			if (nx < 0) {
				render({ text: 'no live chamber / chain held', kind: 'info' });
				return;
			}
			if (nx === active) {
				select(active, {
					full: true,
					ev: { text: 'cylinder indexed / ' + P[active].name + ' still live', kind: 'info' }
				});
				return;
			}
			select(nx, { ev: { text: 'cylinder indexed to ' + P[nx].name, kind: 'info' } });
		}

		function sim429() {
			const a = active;
			if (status[a] !== 'open') status[a] = 'limited';
			const nx = nextReady(a);
			if (nx >= 0) {
				select(nx, {
					ev: { text: P[a].name + ' 429 / rate limit  →  indexed to ' + P[nx].name, kind: 'warn' }
				});
			} else {
				render({ text: P[a].name + ' 429 / rate limit  →  no live chamber', kind: 'warn' });
			}
		}

		function trip() {
			const a = active;
			if (status[a] === 'open') {
				status[a] = 'ready';
				render({ text: 'circuit closed on ' + P[a].name + ' / probe ok', kind: 'ok' });
			} else {
				status[a] = 'open';
				const nx = nextReady(a);
				if (nx >= 0) {
					select(nx, {
						ev: {
							text: 'circuit open on ' + P[a].name + '  →  indexed to ' + P[nx].name,
							kind: 'warn'
						}
					});
				} else {
					render({ text: 'circuit open on ' + P[a].name + ' / no live chamber', kind: 'warn' });
				}
			}
		}

		function resetAll() {
			for (let i = 0; i < N; i++) status[i] = 'ready';
			active = 0;
			let delta = (((0 - rot) % 360) + 360) % 360;
			if (delta > 180) delta -= 360;
			rot += delta;
			spin.set(rot);
			spark();
			render({ text: 'chain reset / all chambers ready', kind: 'ok' });
		}

		const fbIndex = $('#fbBtnIndex');
		const fb429 = $('#fbBtn429');
		const fbTrip = $('#fbBtnTrip');
		const fbReset = $('#fbBtnReset');
		if (fbIndex) on(fbIndex, 'click', indexNext);
		if (fb429) on(fb429, 'click', sim429);
		if (fbTrip) on(fbTrip, 'click', trip);
		if (fbReset) on(fbReset, 'click', resetAll);
		if (autoSwitch) {
			on(autoSwitch, 'click', () => setAuto(autoSwitch.getAttribute('aria-checked') !== 'true'));
		}

		chambers.forEach((c, i) =>
			on(c, 'click', () => {
				select(i, { ev: { text: 'manual route / ' + P[i].name + ' armed', kind: 'info' } });
			})
		);
		chips.forEach((c, i) =>
			on(c, 'click', () => {
				select(i, { ev: { text: 'manual route / ' + P[i].name + ' armed', kind: 'info' } });
			})
		);

		let autoOn = false;
		let autoTimer: number | undefined;
		let inView = false;
		let interact = false;
		const readyCount = () => status.filter((s) => s === 'ready').length;
		function recoverOne() {
			let idx = status.indexOf('limited');
			if (idx < 0) idx = status.indexOf('open');
			if (idx >= 0) status[idx] = 'ready';
		}
		function autoTick() {
			if (readyCount() < 2) recoverOne();
			sim429();
		}
		function startAuto() {
			if (REDUCED) return;
			stopAuto();
			autoTimer = every(autoTick, 2600);
		}
		function stopAuto() {
			if (autoTimer) {
				clearEvery(autoTimer);
				autoTimer = undefined;
			}
		}
		function setAuto(on: boolean) {
			autoOn = on;
			autoSwitch?.setAttribute('aria-checked', String(on));
			syncAuto();
		}
		function syncAuto() {
			if (autoOn && inView && !interact) startAuto();
			else stopAuto();
		}

		const stage = $('.fb-stage', section);
		[stage, manifest, $('.fb-toolbar', section)].forEach((el) => {
			if (!el) return;
			on(el, 'mouseenter', () => {
				interact = true;
				syncAuto();
			});
			on(el, 'mouseleave', () => {
				interact = false;
				syncAuto();
			});
			on(el, 'focusin', () => {
				interact = true;
				syncAuto();
			});
			on(el, 'focusout', () => {
				interact = false;
				syncAuto();
			});
		});

		if ('IntersectionObserver' in window) {
			const io = observe(
				new IntersectionObserver(
					(entries) => {
						inView = entries[0].isIntersecting;
						syncAuto();
					},
					{ threshold: 0.3 }
				)
			);
			io.observe(section);
		} else {
			inView = true;
		}

		apply(0);
		render({ text: 'standby / chain armed / 7 chambers ready', kind: 'info' });
	})();

	/* ---------- pricing comparison matrix (sticky shadows + REAL sync) ---------- */
	(function cmpMatrix() {
		const RM = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
		const wrap = $('.cmp-wrap');
		const scroller = $('.cmp-scroll');
		if (wrap && scroller) {
			const onScroll = () => {
				const x = scroller.scrollLeft;
				wrap.classList.toggle('is-x', x > 2);
				wrap.classList.toggle('at-end', x + scroller.clientWidth >= scroller.scrollWidth - 2);
			};
			on(scroller, 'scroll', onScroll, { passive: true });
			on(window, 'resize', onScroll, { passive: true });
			onScroll();
		}

		// keep the PRO REAL row CTA in step with the global investor unlock
		const flag = $('#flagVal');
		const realBtns = $$('.cmp-wrap .js-real');
		const toast = $('#toast');
		let toastT: number | undefined;
		function fireToast() {
			if (!toast) return;
			toast.classList.add('show');
			if (toastT) clearLater(toastT);
			toastT = later(() => toast.classList.remove('show'), 4200);
		}
		function setReal(on: boolean) {
			realBtns.forEach((b) => {
				b.classList.toggle('is-live', on);
				b.classList.toggle('is-locked', !on);
				b.setAttribute('aria-disabled', String(!on));
				const ic = b.querySelector('.ic');
				if (ic) (ic as HTMLElement).style.display = on ? 'none' : '';
				const lbl = b.querySelector('.js-real-label');
				if (lbl) lbl.textContent = on ? 'Start Subscription' : 'Locked';
			});
		}
		if (realBtns.length) {
			setReal(!!(flag && flag.textContent.trim() === 'true'));
			if (flag) {
				const mo = observe(new MutationObserver(() => setReal(flag.textContent.trim() === 'true')));
				mo.observe(flag, { childList: true, characterData: true, subtree: true });
			}
			realBtns.forEach((b) =>
				on(b, 'click', () => {
					if (b.classList.contains('is-live')) {
						fireToast();
						return;
					}
					const tiers = $('#tiers');
					if (tiers) tiers.scrollIntoView({ behavior: RM ? 'auto' : 'smooth' });
				})
			);
		}
	})();

	/* ---------- teardown ---------- */
	return () => {
		timeouts.forEach((id) => clearTimeout(id));
		timeouts.clear();
		intervals.forEach((id) => clearInterval(id));
		intervals.clear();
		rafs.forEach((id) => cancelAnimationFrame(id));
		rafs.clear();
		observers.forEach((o) => o.disconnect());
		disposers.forEach((d) => d());
	};
}
