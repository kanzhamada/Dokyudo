<script lang="ts">
</script>

<!-- ============ 6. TIER PREVIEW & COMPARISON ============ -->
<section class="section section--dark sec-tiers" id="tiers">
	<div class="container">
		<div class="shead" data-reveal>
			<h2 class="t-h2">Three tiers. One honest ledger.</h2>
			<p class="t-b1 shead__lead shead__lead--dark">Sandbox billing only: dummy credentials, no real charges. Monthly counters reset on the 1st at 00:00 UTC. Storage is cumulative and never resets.</p>
		</div>

		<p class="flag-line t-tag" data-reveal>global flag <span>/</span> pro_real_unlocked = <span id="flagVal">false</span></p>

		<div class="tier-grid">

			<!-- FREE -->
			<article class="card tier" data-reveal>
				<div class="tier__head">
					<h3 class="tier__name t-h3">Free</h3>
					<p class="tier__tag t-b2">The default tier for every new tenant.</p>
				</div>
				<div class="tier__price">
					<span class="tier__num">Rp 0</span>
				</div>
				<div class="tier__pills">
					<span class="pill pill--mute">Forever</span>
					<span class="pill pill--hl">No card</span>
				</div>
				<div class="tier-spec">
					<span class="medal medal--sm" aria-hidden="true"><svg class="ic"><use href="#i-node"/></svg></span>
					<ul class="tier-spec__list">
						<li>10 MB max file</li>
						<li>5 uploads / mo</li>
						<li>50 searches / mo</li>
						<li>10 Q&amp;A / mo</li>
						<li class="tier-spec__sum">= 500 MB storage</li>
					</ul>
				</div>
				<div class="tier-feat">
					<span class="pill pill--mute tier-feat__label">Features</span>
					<ul class="perks">
						<li><svg class="ic" aria-hidden="true"><use href="#i-check"/></svg>Hybrid search + RAG included</li>
						<li><svg class="ic" aria-hidden="true"><use href="#i-check"/></svg>OAuth via Google and GitHub</li>
						<li><svg class="ic" aria-hidden="true"><use href="#i-check"/></svg>Automatic 7-day teardown</li>
					</ul>
				</div>
				<a class="btn btn--primary btn--full" href="#demo">Start Free</a>
			</article>

			<!-- PRO INVESTOR (featured / halo) -->
			<article class="card tier tier--feat" data-reveal style="--rd:90ms">
				<div class="tier__head">
					<h3 class="tier__name t-h3">Pro Investor</h3>
					<p class="tier__tag t-b2">The portfolio showcase that flips the global flag.</p>
				</div>
				<div class="tier__price">
					<span class="tier__num">Rp 1,440,000</span>
					<span class="tier__was t-tag">once</span>
				</div>
				<div class="tier__pills">
					<span class="pill pill--mute">Sandbox invoice</span>
					<span class="pill pill--hl">Unlocks all</span>
				</div>
				<div class="tier-spec">
					<span class="medal medal--sm" aria-hidden="true"><svg class="ic"><use href="#i-node"/></svg></span>
					<ul class="tier-spec__list">
						<li>25 MB max file</li>
						<li>Unlimited* uploads</li>
						<li>Unlimited* searches</li>
						<li>100 Q&amp;A / mo</li>
						<li class="tier-spec__sum">= 40 GB storage</li>
					</ul>
				</div>
				<div class="tier-feat">
					<span class="pill pill--mute tier-feat__label">Features</span>
					<ul class="perks">
						<li><svg class="ic" aria-hidden="true"><use href="#i-check"/></svg>One-time sandbox invoice</li>
						<li><svg class="ic" aria-hidden="true"><use href="#i-check"/></svg>3 activation vouchers (Option B)</li>
						<li><svg class="ic" aria-hidden="true"><use href="#i-check"/></svg>Unlocks PRO REAL platform-wide</li>
					</ul>
				</div>
				<button class="btn btn--investor btn--full js-investor" id="investorBtn" type="button">
					<span class="js-investor-label">Unlock Investor Tier</span>
				</button>
			</article>

			<!-- PRO REAL (notch + coin) -->
			<article class="card tier" id="realCard" data-reveal style="--rd:180ms">
				<div class="tier__head">
					<span class="badge badge--locked" id="realLock"><svg class="ic" aria-hidden="true"><use href="#i-lock"/></svg>Locked</span>
					<h3 class="tier__name t-h3">Pro Real</h3>
					<p class="tier__tag t-b2">The commercial B2B tier, gated until the first invoice.</p>
				</div>
				<div class="tier__price">
					<span class="tier__num tier__num--word">Recurring</span>
					<span class="tier__was t-tag">auto-debit</span>
				</div>
				<div class="tier__pills">
					<span class="pill pill--mute">Tokenized</span>
					<span class="pill pill--hl">B2B</span>
				</div>
				<div class="tier-spec">
					<span class="medal medal--sm" aria-hidden="true"><svg class="ic"><use href="#i-node"/></svg></span>
					<ul class="tier-spec__list">
						<li>25 MB+ max file</li>
						<li>Expanded uploads</li>
						<li>Expanded searches</li>
						<li>100+ Q&amp;A / mo</li>
						<li class="tier-spec__sum">= 40 GB+ storage</li>
					</ul>
				</div>
				<div class="tier-feat">
					<span class="pill pill--mute tier-feat__label">Features</span>
					<ul class="perks">
						<li><svg class="ic" aria-hidden="true"><use href="#i-check"/></svg>Tokenized recurring billing</li>
						<li><svg class="ic" aria-hidden="true"><use href="#i-check"/></svg>Multi-seat license provisioning</li>
						<li><svg class="ic" aria-hidden="true"><use href="#i-check"/></svg>Recurring webhook lifecycle</li>
					</ul>
				</div>
				<button class="btn btn--ghost btn--full" id="realBtn" type="button" disabled>
					<svg class="ic" aria-hidden="true"><use href="#i-lock"/></svg>
					<span id="realBtnLabel">Locked</span>
				</button>
			</article>
		</div>

		<!-- WIDE: SANDBOX / PRO (SIMULATE) -->
		<div class="tier-wide" data-reveal style="--rd:120ms">

			<div class="tier-wide__col tier-wide__lead">
				<h3 class="tier__name t-h3">Sandbox &amp; Evaluation</h3>
				<p class="tier__tag t-b2">PRO (SIMULATE): a 24-hour guided evaluation, no card required.</p>
				<button class="btn btn--ink" id="simBtn" type="button">Generate 24h Code</button>
				<p class="sim-code t-tag" id="simCode" hidden>code <b></b> <span>expires in 24h</span></p>
			</div>

			<div class="tier-wide__col tier-wide__spec">
				<div class="tier-spec">
					<span class="medal medal--sm" aria-hidden="true"><svg class="ic"><use href="#i-node"/></svg></span>
					<ul class="tier-spec__list">
						<li>24-hour evaluation window</li>
						<li>Dummy credentials only</li>
						<li>Counters reset monthly</li>
						<li class="tier-spec__sum">= self-destruct on expiry</li>
					</ul>
				</div>
			</div>

			<div class="tier-wide__col tier-wide__feat">
				<div class="tier-feat tier-feat--plain">
					<span class="pill pill--mute tier-feat__label">Features</span>
					<ul class="perks">
						<li><svg class="ic" aria-hidden="true"><use href="#i-check"/></svg>No real charges, ever</li>
						<li><svg class="ic" aria-hidden="true"><use href="#i-check"/></svg>8-char code emailed to you</li>
						<li><svg class="ic" aria-hidden="true"><use href="#i-check"/></svg>Cascading teardown on expiry</li>
						<li><svg class="ic" aria-hidden="true"><use href="#i-check"/></svg>Downgrades back to Free</li>
					</ul>
				</div>
			</div>
		</div>

		<p class="tier-foot t-b3" data-reveal>*Unlimited in the UI. Fair-use backend caps during sandbox: 50 documents, 500 searches, 2 GB. A PRO (SIMULATE) code grants 24-hour access and self-destructs on schedule.</p>
	</div>
</section>