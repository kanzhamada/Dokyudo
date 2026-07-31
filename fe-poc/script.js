/* ==========================================================
   Dokyudo landing prototype
   Vanilla JS only. No frameworks, no build step.
   All simulations run locally: no network calls are made.
   ========================================================== */
'use strict';

(function () {
  const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const $ = (sel, ctx) => (ctx || document).querySelector(sel);
  const $$ = (sel, ctx) => Array.from((ctx || document).querySelectorAll(sel));

  /* ---------- header state ---------- */
  const header = $('#siteHeader');
  const onScroll = () => header.classList.toggle('scrolled', window.scrollY > 4);
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* ---------- mobile menu ---------- */
  const burger = $('#burger');
  const mMenu = $('#mMenu');
  const closeMenu = () => {
    header.classList.remove('menu-open');
    burger.setAttribute('aria-expanded', 'false');
  };
  burger.addEventListener('click', () => {
    const open = header.classList.toggle('menu-open');
    burger.setAttribute('aria-expanded', String(open));
  });
  $$('a', mMenu).forEach((a) => a.addEventListener('click', closeMenu));
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeMenu();
  });

  /* ---------- scroll reveals (Emil Kowalski Design Eng) ---------- */
  const autoRevealSelectors = [
    'section h1', 'section h2', 'section h3',
    'section .t-b1', 'section .t-b2',
    'section .btn', 'section .card', 'section .scard', 'section .tcard',
    'section .arch-node', 'section .chunkcard', 'section .cap-item',
    'section .fb-stage', 'section .console', 'section img', 'section figure'
  ];
  
  autoRevealSelectors.forEach((sel) => {
    $$(sel).forEach((el) => {
      if (!el.hasAttribute('data-reveal')) {
        el.setAttribute('data-reveal', '');
      }
    });
  });

  const revealEls = $$('[data-reveal]');
  
  const containers = $$('.hero__copy, .cap-list, .cap-stage, .console__side, .console__main, .arch__row, .arch__data, .fb-toolbar, .tier-grid, .faq-grid, .cta-grid');
  containers.forEach((container) => {
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
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-in');
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.08, rootMargin: '0px 0px -40px 0px' }
    );
    revealEls.forEach((el) => io.observe(el));
  }

  /* ---------- nav spy ---------- */
  const spyLinks = $$('.header__nav a[data-spy]');
  if ('IntersectionObserver' in window && spyLinks.length) {
    const spy = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          spyLinks.forEach((a) =>
            a.classList.toggle('active', a.dataset.spy === entry.target.id)
          );
        });
      },
      { rootMargin: '-40% 0px -55% 0px' }
    );
    ['features', 'architecture', 'tiers', 'faq'].forEach((id) => {
      const sec = document.getElementById(id);
      if (sec) spy.observe(sec);
    });
  }

  /* ---------- hero visualizer: replay + chip hover ---------- */
  const viz = $('#viz');
  const replayBtn = $('#vizReplay');

  function playViz() {
    if (!viz) return;
    viz.classList.remove('run');
    if (REDUCED) return; // static, fully visible state
    void viz.offsetWidth; // restart animations
    viz.classList.add('run');
  }
  if (viz) {
    if ('IntersectionObserver' in window && !REDUCED) {
      const vio = new IntersectionObserver(
        (entries) => {
          if (entries[0].isIntersecting) {
            setTimeout(playViz, 250);
            vio.disconnect();
          }
        },
        { threshold: 0.3 }
      );
      vio.observe(viz);
    }
    replayBtn.addEventListener('click', playViz);

    $$('.vz-hit', viz).forEach((hit) => {
      const chip = document.getElementById(hit.dataset.chip);
      if (!chip) return;
      const on = () => chip.classList.add('hot');
      const off = () => chip.classList.remove('hot');
      hit.addEventListener('mouseenter', on);
      hit.addEventListener('mouseleave', off);
      hit.addEventListener('focus', on);
      hit.addEventListener('blur', off);
    });
  }

  /* ---------- simulated RAG demo ---------- */
  const consoleEl = $('#console');
  const answerText = $('#answerText');
  const answerSummary = $('#answerSummary');
  const stPill = $('#stPill');
  const stText = $('#stText');
  const runBtn = $('#runBtn');
  const runLabel = $('#runLabel');
  const byokSwitch = $('#byokSwitch');
  const routeLine = $('#routeLine');
  const chunkCards = $$('.chunkcard', consoleEl);

  const ANSWER =
    'Q3 EBITDA totaled $48.2M, up 12.4% year over year. Operating income ' +
    'contributed $41.7M, with depreciation and amortization adding $6.5M. ' +
    'Per Section 4.2, North America delivered $29.1M and EMEA $19.1M, ' +
    'partially offset by $2.9M in unallocated corporate costs.';

  const CHUNK_REVEAL_AT = [10, 26, 42]; // word indices
  let streamTimers = [];

  function clearStream() {
    streamTimers.forEach((t) => clearTimeout(t));
    streamTimers = [];
  }

  function setStatus(mode, text) {
    stPill.classList.remove('st--stream', 'st--done');
    if (mode === 'stream') stPill.classList.add('st--stream');
    if (mode === 'done') stPill.classList.add('st--done');
    stText.textContent = text;
  }

  function resetDemo() {
    clearStream();
    answerText.textContent = '';
    answerSummary.textContent = '';
    consoleEl.classList.remove('done');
    chunkCards.forEach((c) => c.classList.remove('show'));
  }

  function finishDemo() {
    consoleEl.classList.add('done');
    setStatus('done', 'complete / 3 sources cited');
    runLabel.textContent = 'Run Query';
    runBtn.setAttribute('aria-busy', 'false');
    answerSummary.textContent = 'Answer complete. ' + ANSWER;
  }

  function runDemo() {
    resetDemo();
    if (REDUCED) {
      answerText.textContent = ANSWER;
      chunkCards.forEach((c) => c.classList.add('show'));
      finishDemo();
      return;
    }

    setStatus('stream', 'streaming / sse');
    runLabel.textContent = 'Streaming…';
    runBtn.setAttribute('aria-busy', 'true');

    const words = ANSWER.split(' ');
    let i = 0;
    const step = () => {
      if (i < words.length) {
        answerText.textContent += (i === 0 ? '' : ' ') + words[i];
        const revealIdx = CHUNK_REVEAL_AT.indexOf(i);
        if (revealIdx > -1 && chunkCards[revealIdx]) {
          chunkCards[revealIdx].classList.add('show');
        }
        i += 1;
        streamTimers.push(setTimeout(step, 26 + Math.random() * 30));
      } else {
        chunkCards.forEach((c) => c.classList.add('show'));
        streamTimers.push(setTimeout(finishDemo, 220));
      }
    };
    streamTimers.push(setTimeout(step, 420)); // simulated scatter-gather latency
  }

  if (runBtn) {
    runBtn.addEventListener('click', runDemo);
    // run once when the console scrolls into view
    if ('IntersectionObserver' in window) {
      const dio = new IntersectionObserver(
        (entries) => {
          if (entries[0].isIntersecting) {
            runDemo();
            dio.disconnect();
          }
        },
        { threshold: 0.35 }
      );
      dio.observe(consoleEl);
    }
  }

  if (byokSwitch) {
    byokSwitch.addEventListener('click', () => {
      const on = byokSwitch.getAttribute('aria-checked') !== 'true';
      byokSwitch.setAttribute('aria-checked', String(on));
      consoleEl.classList.toggle('byok-on', on);
      routeLine.textContent = on
        ? 'your key / openai gpt-4o-mini / decrypted in-memory only'
        : 'platform gateway / groq → gemini → cohere fallback';
    });
  }

  /* ---------- architecture inspector ---------- */
  const NODES = {
    client: {
      zone: 'Client edge', zoneColor: 'var(--c-periwinkle)',
      title: 'Client Layer',
      bullets: [
        'SvelteKit frontend rendered globally on Cloudflare Pages.',
        'Uploads go straight to MinIO over presigned URLs; the API never proxies file bytes.',
        'SSE answers render token by token into reserved space, so the layout never shifts.'
      ],
      deps: ['Cloudflare Pages', 'SvelteKit', 'Tailwind'],
      budgetLabel: 'Server time billed', budget: '0 ms'
    },
    gateway: {
      zone: 'Edge compute', zoneColor: 'var(--color-orange)',
      title: 'API Gateway + Core',
      bullets: [
        'Supabase JWT auth with sliding-window rate limiting, pipelined through Redis in one call.',
        'Tenant context injected into every query; feature flags enforced at a single point.',
        'Search scatter-gathers vector and full-text IDs, fuses them with RRF, then lazy-hydrates the top 3 chunks.',
        'RAG answers stream through the native Web Streams API, never buffered in memory.'
      ],
      deps: ['Deno Deploy', 'Hono', 'Upstash Redis', 'All services'],
      budgetLabel: 'Free-tier CPU budget', budget: '15 hrs / mo'
    },
    minio: {
      zone: 'On-premise', zoneColor: 'var(--c-navy)',
      title: 'Object Storage Node',
      bullets: [
        'Amlogic S905X ARM64 set-top box running Armbian and MinIO, exposed only through a Cloudflare Zero Trust tunnel.',
        'Holds the 100 GB document lake; orphaned uploads are swept after 24 hours.',
        'Hosts the pg_net worker that extracts text, chunks it, and pushes embeddings.'
      ],
      deps: ['MinIO', 'Armbian', 'CF Tunnel', 'pg_net worker'],
      budgetLabel: 'Cloud egress cost', budget: '$0'
    },
    postgres: {
      zone: 'Data plane', zoneColor: 'var(--c-olive)',
      title: 'Relational Core',
      bullets: [
        'Source of truth for tenants, documents, conversations, webhooks, and activity.',
        'Row-level isolation: every tenant table carries a tenant_id column.',
        'pg_net triggers push ingestion jobs outward; pg_cron runs quota resets and teardown.'
      ],
      deps: ['Supabase', 'PostgreSQL', 'pg_net', 'pg_cron'],
      budgetLabel: 'Isolation rule', budget: 'tenant_id on every table'
    },
    vector: {
      zone: 'Data plane', zoneColor: 'var(--c-lavender)',
      title: 'Vector Index',
      bullets: [
        '768-dimension gemini-embedding-2 vectors stored in an HNSW index.',
        'Queries return IDs only; chunk text is hydrated after ranking to keep payloads lean.',
        'Completely offloads embedding storage pressure from the Postgres database.'
      ],
      deps: ['Upstash Vector', 'HNSW', 'REST API'],
      budgetLabel: 'Embedding dimensions', budget: '768 forced'
    },
    redis: {
      zone: 'Control plane', zoneColor: 'var(--c-amber)',
      title: 'Control Plane',
      bullets: [
        'Distributed token bucket guards the embedding API: 30,000 TPM, 100 RPM, 1,000 RPD.',
        'Rate limiting and circuit breaker state evaluated atomically via Lua scripts.',
        'Backs the job queue, DLQ, and feature flag cache with a 30-second TTL.'
      ],
      deps: ['Upstash Redis', 'Lua scripts', 'Job queue'],
      budgetLabel: 'Token bucket', budget: '30K TPM / 100 RPM / 1K RPD'
    }
  };

  const archEl = $('#arch');
  const detailEl = $('#archDetail');
  let activeNode = 'gateway';

  function renderNode(key) {
    const n = NODES[key];
    if (!n || !detailEl) return;
    detailEl.innerHTML =
      '<div class="ad-head">' +
        '<span class="ad-zone" style="color:' + n.zoneColor + '">' + n.zone + '</span>' +
        '<h3 class="ad-title">' + n.title + '</h3>' +
      '</div>' +
      '<div class="ad-grid">' +
        '<ul class="ad-bullets">' +
          n.bullets.map((b) => '<li>' + b + '</li>').join('') +
        '</ul>' +
        '<div class="ad-side">' +
          '<h4>Dependencies</h4>' +
          '<div class="ad-deps">' + n.deps.map((d) => '<span>' + d + '</span>').join('') + '</div>' +
          '<div class="ad-budget"><h4>Key constraint</h4><b>' + n.budget + '</b></div>' +
        '</div>' +
      '</div>';
  }

  function selectNode(key) {
    activeNode = key;
    archEl.classList.add('has-sel');
    $$('.arch-node', archEl).forEach((btn) =>
      btn.classList.toggle('is-active', btn.dataset.node === key)
    );
    $$('[data-link]', archEl).forEach((el) => {
      const links = el.dataset.link.split(' ');
      el.classList.toggle('hot', links.indexOf(key) > -1);
    });
    if (REDUCED) {
      renderNode(key);
      return;
    }
    detailEl.classList.add('swap');
    setTimeout(() => {
      renderNode(key);
      detailEl.classList.remove('swap');
    }, 170);
  }

  if (archEl && detailEl) {
    $$('.arch-node', archEl).forEach((btn) =>
      btn.addEventListener('click', () => selectNode(btn.dataset.node))
    );
    renderNode(activeNode);
    selectNode(activeNode);
  }

  /* ---------- tier unlock simulation (PRD: global event trigger) ---------- */
  const flagLine = $('.flag-line');
  const flagVal = $('#flagVal');
  const realCard = $('#realCard');
  const realBtn = $('#realBtn');
  const realBtnLabel = $('#realBtnLabel');
  const realBadge = $('#realBadge');
  const toast = $('#toast');
  let unlocked = false;
  let toastTimer = null;

  function showToast() {
    if (!toast) return;
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), 4200);
  }

  function doUnlock() {
    if (unlocked) {
      document.getElementById('tiers').scrollIntoView({ behavior: REDUCED ? 'auto' : 'smooth' });
      return;
    }
    unlocked = true;

    $$('.js-investor').forEach((btn) => {
      const label = btn.querySelector('.js-investor-label');
      if (label) label.textContent = 'Processing sandbox invoice…';
      btn.setAttribute('aria-busy', 'true');
    });

    setTimeout(() => {
      $$('.js-investor').forEach((btn) => {
        const label = btn.querySelector('.js-investor-label');
        if (label) label.textContent = 'Investor Tier Unlocked';
        btn.setAttribute('aria-busy', 'false');
        btn.classList.remove('btn--primary', 'btn--ghost-dark', 'btn--investor');
        btn.classList.add('btn--ghost');
      });

      if (flagVal) { flagVal.textContent = 'true'; flagVal.classList.add('on'); }
      if (flagLine) flagLine.classList.add('unlocked');

      if (realCard) realCard.classList.add('unlocked');
      if (realBadge) {
        realBadge.textContent = 'Pro Real / Active';
        realBadge.classList.remove('badge--real');
        realBadge.classList.add('badge--active');
      }
      if (realBtn) {
        realBtn.disabled = false;
        realBtn.querySelector('.ic').style.display = 'none';
        realBtnLabel.textContent = 'Start Subscription';
      }
      showToast();
    }, REDUCED ? 50 : 750);
  }

  $$('.js-investor').forEach((btn) => btn.addEventListener('click', doUnlock));
  if (realBtn) {
    realBtn.addEventListener('click', () => {
      if (!realBtn.disabled) showToast();
    });
  }

  /* ---------- FAQ accordion ---------- */
  const accs = $$('.acc');
  accs.forEach((acc) => {
    const btn = $('.acc-btn', acc);
    const panel = $('.acc-panel', acc);
    btn.addEventListener('click', () => {
      const isOpen = acc.classList.contains('open');
      // close others for a tidy rhythm
      accs.forEach((other) => {
        if (other !== acc && other.classList.contains('open')) {
          other.classList.remove('open');
          $('.acc-btn', other).setAttribute('aria-expanded', 'false');
          $('.acc-panel', other).style.maxHeight = '0px';
        }
      });
      acc.classList.toggle('open', !isOpen);
      btn.setAttribute('aria-expanded', String(!isOpen));
      panel.style.maxHeight = !isOpen ? panel.scrollHeight + 'px' : '0px';
    });
  });

  // keep open panels sized correctly on resize
  window.addEventListener('resize', () => {
    $$('.acc.open .acc-panel').forEach((p) => {
      p.style.maxHeight = p.scrollHeight + 'px';
    });
  }, { passive: true });

  /* ---------- sandbox evaluation code (simulated, local only) ---------- */
  const simBtn = document.getElementById('simBtn');
  const simCode = document.getElementById('simCode');
  if (simBtn && simCode) {
    simBtn.addEventListener('click', () => {
      const bytes = new Uint8Array(4);
      crypto.getRandomValues(bytes);
      const code = 'SIM-' + Array.from(bytes)
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
  const vGrid = document.getElementById('voicesGrid');
  if (vGrid) {
    const persons = $$('.vp-person', vGrid);
    const photo = document.getElementById('voicesPhoto');
    const photoImg = document.getElementById('voicesImg');
    const photoMono = document.getElementById('voicesMono');
    const phName = document.getElementById('voicesPhName');
    const phRole = document.getElementById('voicesPhRole');
    const swap = document.getElementById('voicesSwap');
    const qBody = document.getElementById('voicesBody');
    const qCite = document.getElementById('voicesCite');
    const qCo = document.getElementById('voicesCo');
    const qRate = document.getElementById('voicesRate');

    const firstRoleLine = (s) => (s || '').split('/')[0].trim();
    let current = persons.findIndex((p) => p.classList.contains('is-active'));
    if (current < 0) current = 0;
    let autoTimer = null;
    const AUTO = 6000;

    function paintPhoto(btn) {
      const img = (btn.dataset.img || '').trim();
      const name = $('.vp-person__name', btn).textContent.trim();
      const role = $('.vp-person__role', btn).textContent.trim();
      if (img) {
        photoImg.src = img;
        photoImg.alt = 'Portrait of ' + name;
        photoImg.hidden = false;
        photo.classList.add('has-img');
      } else {
        photoImg.hidden = true;
        photoImg.removeAttribute('src');
        photo.classList.remove('has-img');
        photoMono.textContent = btn.dataset.mono || name.slice(0, 2).toUpperCase();
        phName.textContent = name;
        phRole.textContent = firstRoleLine(role);
      }
    }

    function paintQuote(btn) {
      const name = $('.vp-person__name', btn).textContent.trim();
      const role = $('.vp-person__role', btn).textContent.trim();
      const quote = ($('.vp-person__quote', btn).textContent || '').trim();
      const rate = (btn.dataset.rate || '5.0').trim();
      qBody.textContent = quote;
      qCite.textContent = name;
      qCo.textContent = role;
      qRate.setAttribute('aria-label', 'Rated ' + rate + ' out of 5');
      const b = qRate.querySelector('b');
      if (b) b.textContent = rate;

      const brand = (btn.dataset.brand || '').trim();
      const brandUse = vGrid.querySelector('.voices-quote__brand use');
      if (brandUse && brand) {
        brandUse.setAttribute('href', '#i-brand-' + brand);
      }
    }

    function select(idx, fromAuto) {
      idx = (idx + persons.length) % persons.length;
      current = idx;
      const btn = persons[idx];
      persons.forEach((p, i) => {
        const on = i === idx;
        p.classList.toggle('is-active', on);
        p.setAttribute('aria-pressed', String(on));
      });
      // optional per-person rail avatar photo
      const av = (btn.dataset.avatar || '').trim();
      const avEl = $('.vp-person__avatar', btn);
      persons.forEach((p) => {
        const a = $('.vp-person__avatar', p);
        const src = (p.dataset.avatar || '').trim();
        if (src) { a.style.backgroundImage = 'url(' + src + ')'; a.textContent = ''; }
      });
      void av; void avEl;

      if (REDUCED) { paintPhoto(btn); paintQuote(btn); return; }
      swap.classList.add('swap');
      if (photo) photo.classList.add('swap');
      setTimeout(() => {
        paintPhoto(btn);
        paintQuote(btn);
        swap.classList.remove('swap');
        if (photo) photo.classList.remove('swap');
      }, 200);
    }

    function startAuto() {
      if (REDUCED) return;
      stopAuto();
      autoTimer = setInterval(() => select(current + 1, true), AUTO);
    }
    function stopAuto() { if (autoTimer) { clearInterval(autoTimer); autoTimer = null; } }

    persons.forEach((btn, i) => {
      btn.addEventListener('click', () => { select(i, false); startAuto(); });
    });

    // pause auto-advance while the user is hovering or tabbing through the grid
    vGrid.addEventListener('mouseenter', stopAuto);
    vGrid.addEventListener('mouseleave', startAuto);
    vGrid.addEventListener('focusin', stopAuto);
    vGrid.addEventListener('focusout', startAuto);

    // initial paint + go
    paintPhoto(persons[current]);
    paintQuote(persons[current]);
    startAuto();
  }

  /* ---------- capabilities switcher (list -> diagram, auto-advancing) ---------- */
  (function capSwitcher() {
    const grid = document.getElementById('capGrid');
    const list = document.getElementById('capList');
    const section = document.getElementById('features');
    if (!grid || !list || !section) return;

    const items = $$('.cap-item', list);
    const stages = $$('.cap-stage', document.getElementById('capPanel'));
    const fills = items.map((it) => $('.cap-bar__fill', it));
    const DURATION = 5200;

    let idx = 0, raf = 0, t0 = 0, acc = 0;
    let hover = false, inView = false;

    const setBar = (i, p) => { if (fills[i]) fills[i].style.transform = 'scaleX(' + p + ')'; };
    const show = (i) => {
      items.forEach((it, k) => {
        const on = k === i;
        it.classList.toggle('is-on', on);
        it.setAttribute('aria-expanded', String(on));
      });
      stages.forEach((st, k) => st.classList.toggle('is-on', k === i));
    };
    const tick = (now) => {
      const p = Math.min((acc + (now - t0)) / DURATION, 1);
      setBar(idx, p);
      if (p >= 1) { advance(); return; }
      raf = requestAnimationFrame(tick);
    };
    const run = () => { cancelAnimationFrame(raf); t0 = performance.now(); raf = requestAnimationFrame(tick); };
    const freeze = () => { cancelAnimationFrame(raf); acc += performance.now() - t0; };
    const recompute = () => {
      if (REDUCED) return;
      if (inView && !hover) run(); else freeze();
    };
    const advance = () => {
      setBar(idx, 0);
      idx = (idx + 1) % items.length;
      show(idx); acc = 0; recompute();
    };
    const select = (i) => {
      if (i === idx) return;
      setBar(idx, 0);
      idx = i; show(idx); acc = 0;
      if (!hover && !REDUCED) run(); else setBar(idx, 0);
    };

    items.forEach((it, i) => it.addEventListener('click', () => select(i)));

    // pause while the user is looking at / tabbing through the panel or list
    grid.addEventListener('mouseenter', () => { hover = true; freeze(); });
    grid.addEventListener('mouseleave', () => { hover = false; recompute(); });
    grid.addEventListener('focusin', () => { hover = true; freeze(); });
    grid.addEventListener('focusout', () => { hover = false; recompute(); });

    // only run the auto-advance while the section is on screen
    if ('IntersectionObserver' in window && !REDUCED) {
      const cio = new IntersectionObserver(
        (entries) => {
          inView = entries[0].isIntersecting;
          if (inView && !hover) { acc = 0; run(); } else freeze();
        },
        { threshold: 0.3 }
      );
      cio.observe(section);
    } else {
      inView = true;
    }

    show(0);
    setBar(0, 0);
    if (!REDUCED && inView && !hover) run();
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

    input.addEventListener('input', () => { if (field) field.style.borderColor = ''; });

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      if (wrap.classList.contains('is-sent')) return;
      const val = input.value.trim();
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
    const section = document.getElementById('fallback');
    const drum = document.getElementById('fbDrum');
    const sparkEl = $('.fb-spark', section);
    const routeLine = document.getElementById('fbRouteLine');
    const eventLine = document.getElementById('fbEventLine');
    const live = document.getElementById('fbLive');
    const manifest = document.getElementById('fbManifest');
    const autoSwitch = document.getElementById('fbAutoSwitch');
    if (!section || !drum || !manifest) return;

    /* Kalkulasi path SVG untuk lekukan luar silinder logam */
    const drumBody = document.getElementById('fbDrumBody');
    if (drumBody) {
      const CENTER = 180, BASE_R = 150, DEPTH = 18, SIGMA = 10.5;
      let pathData = "";
      for (let i = 0; i <= 288; i++) {
        const theta = (i / 288) * 360;
        let r = BASE_R;
        for (let j = 0; j < 7; j++) {
          const fluteAngle = j * (360/7) - 90 + (360/14);
          let diff = ((theta - fluteAngle + 180) % 360 + 360) % 360 - 180;
          r -= DEPTH * Math.exp(-(diff*diff) / (2 * SIGMA * SIGMA));
        }
        const rad = theta * Math.PI / 180;
        pathData += (i === 0 ? "M" : "L") + (CENTER + r * Math.cos(rad)).toFixed(2) + "," + (CENTER + r * Math.sin(rad)).toFixed(2) + " ";
      }
      drumBody.setAttribute('d', pathData + "Z");
    }

    const chambers = $$('.fb-ch', section);
    const labels = chambers.map((c) => $('.fb-ch-label', c));
    const dots = chambers.map((c) => $('.fb-ch-dot', c));

    /* chamber -> provider map baru */
    const P = [
      { code: 'MS', name: 'Mistral',  model: 'Ministral',  id: '#f97316' },
      { code: 'QW', name: 'Qwen',     model: 'Qwen 2.5',   id: '#6366f1' },
      { code: 'LL', name: 'Meta',     model: 'Llama 3',    id: '#06b6d4' },
      { code: 'GM', name: 'Google',   model: 'Gemini',     id: '#8b5cf6' },
      { code: 'CO', name: 'Cohere',   model: 'Command',    id: '#10b981' },
      { code: 'OA', name: 'OpenAI',   model: 'GPT-4o',     id: '#14b8a6' },
      { code: 'DS', name: 'Deepseek', model: 'Coder',      id: '#3b82f6' }
    ];
    const N = P.length;
    const STEP = 360 / N;
    const status = P.map(() => 'ready');   // ready | limited | open
    let active = 0, rot = 0;

    const word = (s) => (s === 'limited' ? '429' : s);

    /* bangun menu manifest */
    manifest.innerHTML = P.map((p, i) =>
      '<button class="fb-mchip" type="button" data-i="' + i + '" style="--id:' + p.id + '">' +
        '<span class="fb-mchip__top">' +
          '<span class="fb-mchip__sw" aria-hidden="true"></span>' +
          '<span class="fb-mchip__code">' + p.code + '</span>' +
          '<span class="fb-mchip__st st-ready" data-st>ready</span>' +
        '</span>' +
        '<span class="fb-mchip__name">' + p.name + '</span>' +
        '<span class="fb-mchip__model">' + p.model + '</span>' +
        '<span class="fb-mchip__live" aria-hidden="true">live</span>' +
      '</button>'
    ).join('');
    const chips = $$('.fb-mchip', manifest);
    const chipSt = chips.map((c) => c.querySelector('[data-st]'));

    /* rotasi mekanis dan mekanika spring */
    function apply(x) {
      drum.setAttribute('transform', 'rotate(' + x + ' 180 180)');
      for (let i = 0; i < labels.length; i++) labels[i].setAttribute('transform', 'rotate(' + (-x) + ')');
    }

    function makeSpring(initial) {
      let cur = initial, vel = 0, target = initial, last = 0, raf = 0, on = false;
      const K = 260, D = 24, M = 1, PREC = 0.05;
      function frame(now) {
        if (!last) last = now;
        let dt = (now - last) / 1000; last = now;
        if (dt > 0.032) dt = 0.032;
        const f = -K * (cur - target) - D * vel;
        vel += (f / M) * dt; cur += vel * dt;
        apply(cur);
        if (Math.abs(target - cur) < PREC && Math.abs(vel) < PREC) {
          cur = target; vel = 0; on = false; last = 0; apply(cur); return;
        }
        raf = requestAnimationFrame(frame);
      }
      return {
        set(t) {
          target = t;
          if (REDUCED) { cur = t; vel = 0; apply(t); return; }
          if (!on) { on = true; last = 0; raf = requestAnimationFrame(frame); }
        }
      };
    }
    const spin = makeSpring(0);

    function spark() {
      if (REDUCED || !sparkEl) return;
      sparkEl.classList.remove('flash');
      void sparkEl.getBoundingClientRect();
      sparkEl.classList.add('flash');
      setTimeout(() => sparkEl.classList.remove('flash'), 460);
    }

    function render(ev) {
      const p = P[active];
      for (let i = 0; i < N; i++) {
        chambers[i].classList.toggle('is-active', i === active);
        chips[i].classList.toggle('is-active', i === active);
        dots[i].setAttribute('class', 'fb-ch-dot is-' + status[i]);
        chipSt[i].setAttribute('class', 'fb-mchip__st st-' + status[i]);
        chipSt[i].textContent = word(status[i]);
      }
      routeLine.textContent = 'route → ' + p.name + ' / ' + p.model + ' / ' + word(status[active]) +
        ' / circuit ' + (status[active] === 'open' ? 'open' : 'closed');
      if (ev) {
        eventLine.textContent = ev.text;
        eventLine.setAttribute('class', 'fb-readout__event t-tag hit-' + (ev.kind || 'info'));
      }
      if (live) live.textContent = 'Active route: ' + p.name + ' / ' + p.model + ' / ' + word(status[active]);
    }

    function select(i, opts) {
      opts = opts || {};
      i = ((i % N) + N) % N;
      const desired = -(i * STEP);
      let delta = ((desired - rot) % 360 + 360) % 360;
      if (delta > 0) delta -= 360;
      if (delta === 0 && opts.full) delta = -360;
      rot += delta; active = i;
      spin.set(rot); spark(); render(opts.ev);
    }

    function nextReady(after) {
      for (let k = 1; k <= N; k++) {
        const idx = (after + k) % N;
        if (status[idx] === 'ready') return idx;
      }
      return -1;
    }

    function indexNext() {
      const nx = nextReady(active);
      if (nx < 0) { render({ text: 'no live chamber / chain held', kind: 'info' }); return; }
      if (nx === active) {
        select(active, { full: true, ev: { text: 'cylinder indexed / ' + P[active].name + ' still live', kind: 'info' } });
        return;
      }
      select(nx, { ev: { text: 'cylinder indexed to ' + P[nx].name, kind: 'info' } });
    }

    function sim429() {
      const a = active;
      if (status[a] !== 'open') status[a] = 'limited';
      const nx = nextReady(a);
      if (nx >= 0) {
        select(nx, { ev: { text: P[a].name + ' 429 / rate limit  →  indexed to ' + P[nx].name, kind: 'warn' } });
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
        if (nx >= 0) select(nx, { ev: { text: 'circuit open on ' + P[a].name + '  →  indexed to ' + P[nx].name, kind: 'warn' } });
        else render({ text: 'circuit open on ' + P[a].name + ' / no live chamber', kind: 'warn' });
      }
    }

    function resetAll() {
      for (let i = 0; i < N; i++) status[i] = 'ready';
      active = 0;
      let delta = ((0 - rot) % 360 + 360) % 360;
      if (delta > 180) delta -= 360;
      rot += delta; spin.set(rot); spark();
      render({ text: 'chain reset / all chambers ready', kind: 'ok' });
    }

    let autoOn = false, autoTimer = null, tick = 0, inView = false, interact = false;
    const readyCount = () => status.filter((s) => s === 'ready').length;
    function recoverOne() {
      let idx = status.indexOf('limited');
      if (idx < 0) idx = status.indexOf('open');
      if (idx >= 0) status[idx] = 'ready';
    }
    function autoTick() {
      tick++;
      if (readyCount() < 2) recoverOne();
      sim429();
    }
    function startAuto() { if (REDUCED) return; stopAuto(); autoTimer = setInterval(autoTick, 2600); }
    function stopAuto() { if (autoTimer) { clearInterval(autoTimer); autoTimer = null; } }
    function syncAuto() { if (autoOn && inView && !interact) startAuto(); else stopAuto(); }
    function setAuto(on) {
      autoOn = on;
      autoSwitch.setAttribute('aria-checked', String(on));
      syncAuto();
    }

    document.getElementById('fbBtnIndex').addEventListener('click', indexNext);
    document.getElementById('fbBtn429').addEventListener('click', sim429);
    document.getElementById('fbBtnTrip').addEventListener('click', trip);
    document.getElementById('fbBtnReset').addEventListener('click', resetAll);
    autoSwitch.addEventListener('click', () => setAuto(autoSwitch.getAttribute('aria-checked') !== 'true'));

    chambers.forEach((c, i) => c.addEventListener('click', () => {
      select(i, { ev: { text: 'manual route / ' + P[i].name + ' armed', kind: 'info' } });
    }));
    chips.forEach((c, i) => c.addEventListener('click', () => {
      select(i, { ev: { text: 'manual route / ' + P[i].name + ' armed', kind: 'info' } });
    }));

    const stage = $('.fb-stage', section);
    [stage, manifest, $('.fb-toolbar', section)].forEach((el) => {
      if (!el) return;
      el.addEventListener('mouseenter', () => { interact = true; syncAuto(); });
      el.addEventListener('mouseleave', () => { interact = false; syncAuto(); });
      el.addEventListener('focusin', () => { interact = true; syncAuto(); });
      el.addEventListener('focusout', () => { interact = false; syncAuto(); });
    });

    if ('IntersectionObserver' in window) {
      const io = new IntersectionObserver((entries) => {
        inView = entries[0].isIntersecting;
        syncAuto();
      }, { threshold: 0.3 });
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
    const wrap = document.querySelector('.cmp-wrap');
    const scroller = document.querySelector('.cmp-scroll');
    if (wrap && scroller) {
      const onScroll = () => {
        const x = scroller.scrollLeft;
        wrap.classList.toggle('is-x', x > 2);
        wrap.classList.toggle('at-end', x + scroller.clientWidth >= scroller.scrollWidth - 2);
      };
      scroller.addEventListener('scroll', onScroll, { passive: true });
      window.addEventListener('resize', onScroll, { passive: true });
      onScroll();
    }

    // keep the PRO REAL row CTA in step with the global investor unlock
    const flag = document.getElementById('flagVal');
    const realBtns = document.querySelectorAll('.cmp-wrap .js-real');
    const toast = document.getElementById('toast');
    let toastT = null;
    function fireToast() {
      if (!toast) return;
      toast.classList.add('show');
      clearTimeout(toastT);
      toastT = setTimeout(() => toast.classList.remove('show'), 4200);
    }
    function setReal(on) {
      realBtns.forEach((b) => {
        b.classList.toggle('is-live', on);
        b.classList.toggle('is-locked', !on);
        b.setAttribute('aria-disabled', String(!on));
        const ic = b.querySelector('.ic'); if (ic) ic.style.display = on ? 'none' : '';
        const lbl = b.querySelector('.js-real-label'); if (lbl) lbl.textContent = on ? 'Start Subscription' : 'Locked';
      });
    }
    if (realBtns.length) {
      setReal(!!(flag && flag.textContent.trim() === 'true'));
      if (flag) {
        const mo = new MutationObserver(() => setReal(flag.textContent.trim() === 'true'));
        mo.observe(flag, { childList: true, characterData: true, subtree: true });
      }
      realBtns.forEach((b) => b.addEventListener('click', () => {
        if (b.classList.contains('is-live')) { fireToast(); return; }
        const tiers = document.getElementById('tiers');
        if (tiers) tiers.scrollIntoView({ behavior: RM ? 'auto' : 'smooth' });
      }));
    }
  })();
})();
