<script lang="ts">
</script>

<!-- ============ 7. TECHNICAL REVIEWS & SOCIAL PROOF ============ -->
<section class="section section--dark sec-voices" id="voices">
	<span id="testimonials" aria-hidden="true" style="display:block;height:0;scroll-margin-top:88px"></span>
	<div class="container">

		<div class="shead" data-reveal>
			<h2 class="t-h2">Read by analysts. Audited by engineers.</h2>
		</div>

		<!--
			TESTIMONIAL SWITCHER
			Each .vp-person button is the source of truth for one quote.
			Edit name/role in the visible <strong>/<em>, the quote in the
			hidden .vp-person__quote span, and the rating in data-rate.
			To drop a real portrait into the center slot, set data-img to a
			path (and data-avatar for the small rail photo). Leave them empty
			to keep the monogram placeholders.
		-->
		<div class="voices-grid" id="voicesGrid" data-reveal style="--rd:120ms">

			<!-- LEFT: selectable rail -->
			<div class="voices-rail" role="group" aria-label="Choose a reviewer">

				<button class="vp-person is-active" type="button" aria-pressed="true"
						data-rate="4.9" data-mono="PR" data-img="/landing/review/mina.webp" data-avatar="/landing/review/mina.webp" data-brand="mina">
					<span class="vp-person__top">
						<span class="vp-person__avatar" aria-hidden="true">MM</span>
						<span class="vp-person__mark"><svg class="ic" aria-hidden="true"><use href="#i-brand-mina"/></svg></span>
					</span>
					<strong class="vp-person__name">Myoui Mina</strong>
					<em class="vp-person__role">Senior Credit Analyst</em>
					<span class="vp-person__quote" hidden>I asked for the Q3 EBITDA bridge and got the exact footnote, cited to page 47. Forty minutes of Ctrl+F became a single query.</span>
				</button>

				<button class="vp-person" type="button" aria-pressed="false"
						data-rate="5.0" data-mono="TW" data-img="/landing/review/kendrick.webp" data-avatar="/landing/review/kendrick.webp" data-brand="kendrick">
					<span class="vp-person__top">
						<span class="vp-person__avatar" aria-hidden="true">KL</span>
						<span class="vp-person__mark"><svg class="ic" aria-hidden="true"><use href="#i-brand-kendrick"/></svg></span>
					</span>
					<strong class="vp-person__name">Kendrick Lamar</strong>
					<em class="vp-person__role">Staff Systems Engineer</em>
					<span class="vp-person__quote" hidden>The scatter-gather RRF path is the cleanest retrieval I have audited. ID-only fetch, lazy hydration, and a circuit breaker on every external call.</span>
				</button>

				<button class="vp-person" type="button" aria-pressed="false"
						data-rate="4.8" data-mono="IH" data-img="/landing/review/sabrina.webp" data-avatar="/landing/review/sabrina.webp" data-brand="sabrina">
					<span class="vp-person__top">
						<span class="vp-person__avatar" aria-hidden="true">SC</span>
						<span class="vp-person__mark"><svg class="ic" aria-hidden="true"><use href="#i-brand-sabrina"/></svg></span>
					</span>
					<strong class="vp-person__name">Sabrina Carpenter</strong>
					<em class="vp-person__role">Portfolio Operations Lead</em>
					<span class="vp-person__quote" hidden>Our keys never sit in plaintext, and the teardown cron wipes the sandbox on schedule. The first zero-dollar demo that behaved like production.</span>
				</button>

				<button class="vp-person" type="button" aria-pressed="false"
						data-rate="4.9" data-mono="DO" data-img="/landing/review/richy.webp" data-avatar="/landing/review/richy.webp" data-brand="richy">
					<span class="vp-person__top">
						<span class="vp-person__avatar" aria-hidden="true">RA</span>
						<span class="vp-person__mark"><svg class="ic" aria-hidden="true"><use href="#i-brand-richy"/></svg></span>
					</span>
					<strong class="vp-person__name">Richarlison de Andrade</strong>
					<em class="vp-person__role">Quantitative Researcher</em>
					<span class="vp-person__quote" hidden>Dense balance sheets stay whole through the chunker, so the model never hallucinates a split row. The citations are trustworthy enough to drop into a memo.</span>
				</button>

			</div>

			<!-- CENTER: portrait slot (your image template) -->
			<figure class="voices-photo" id="voicesPhoto" aria-label="Portrait of the selected reviewer">
				<img class="voices-photo__img" id="voicesImg" src="" alt="" hidden />
				<div class="voices-photo__ph" id="voicesPh" aria-hidden="true">
					<span class="voices-photo__glow"></span>
					<span class="voices-photo__tag t-tag"><svg class="ic" aria-hidden="true"><use href="#i-image"/></svg>portrait slot / 4:5</span>
					<span class="voices-photo__mono" id="voicesMono">MM</span>
					<span class="voices-photo__who"><b id="voicesPhName">Myoui Mina</b><em id="voicesPhRole">Senior Credit Analyst</em></span>
				</div>
			</figure>

			<!-- RIGHT: quote card -->
			<blockquote class="voices-quote" id="voicesQuote" role="group" aria-roledescription="testimonial">
				<div class="voices-quote__swap" id="voicesSwap">
					<span class="voices-quote__mark" aria-hidden="true">&ldquo;</span>
					<span class="voices-quote__rate t-tag" id="voicesRate" aria-label="Rated 4.9 out of 5">
						<svg class="ic" aria-hidden="true"><use href="#i-star"/></svg><b>4.9</b>
					</span>
					<p class="voices-quote__body t-b1" id="voicesBody">I asked for the Q3 EBITDA bridge and got the exact footnote, cited to page 47. Forty minutes of Ctrl+F became a single query.</p>
					<footer class="voices-quote__foot">
						<span class="voices-quote__brand" aria-hidden="true"><svg class="ic"><use href="#i-brand-mina"/></svg></span>
						<cite id="voicesCite">Myoui Mina</cite>
						<span class="t-tag" id="voicesCo">Senior Credit Analyst</span>
					</footer>
				</div>
			</blockquote>

		</div>
	</div>
</section>