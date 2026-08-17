<script lang="ts">
</script>

<!-- ============ 6b. PRICING COMPARISON MATRIX ============ -->
<section class="section sec-cmp" id="compare">
	<div class="container">

		<div class="cmp-head" data-reveal>
			<div class="cmp-head__copy">
				<h2 class="t-h2">Every quota, side by side.</h2>
				<p class="cmp-head__lead t-b1">The full feature matrix across all four tiers. Sandbox billing only, dummy credentials, and counters that reset on the first of each month.</p>
			</div>
			<div class="cmp-legend" aria-hidden="false">
				<span class="cmp-leg"><span class="yes"><svg class="ic" aria-hidden="true"><use href="#i-check"/></svg><span class="sr-only">Included</span></span>Included</span>
				<span class="cmp-leg"><span class="no"><svg class="ic" aria-hidden="true"><use href="#i-minus"/></svg><span class="sr-only">Not available</span></span>Not available</span>
			</div>
		</div>

		<div class="cmp-wrap">
			<div class="cmp-scroll" tabindex="0" role="region" aria-label="Pricing comparison table, scroll horizontally for more plans">
				<table class="cmp">
					<colgroup>
						<col class="cmp-col-label" />
						<col /><col class="cmp-col-feat" /><col /><col />
					</colgroup>

					<thead>
						<tr>
							<th class="c-corner" scope="col">
								<svg class="ic cmp-corner__mark" aria-hidden="true"><use href="#i-node"/></svg>
								<span class="t-tag">Plans</span>
							</th>
							<th class="c-plan" scope="col">
								<span class="cmp-name">Free</span>
								<span class="cmp-price t-tag">Rp 0 / forever</span>
							</th>
							<th class="c-plan c-feat" scope="col">
								<span class="cmp-name">Pro Investor</span>
								<span class="cmp-price t-tag">Rp 1,440,000 / once</span>
							</th>
							<th class="c-plan" scope="col">
								<span class="badge badge--locked js-real-lock"><svg class="ic" aria-hidden="true"><use href="#i-lock"/></svg>Locked</span>
								<span class="cmp-name">Pro Real</span>
								<span class="cmp-price t-tag">Recurring / auto-debit</span>
							</th>
							<th class="c-plan" scope="col">
								<span class="cmp-name">Sandbox</span>
								<span class="cmp-price t-tag">24h eval code</span>
							</th>
						</tr>
					</thead>

					<tbody>

						<!-- CLUSTER 1 -->
						<tr class="c-cluster">
							<th class="c-label c-cluster-label" scope="colgroup"><svg class="ic cmp-cluster-ico" aria-hidden="true"><use href="#i-node"/></svg>Quotas &amp; limits</th>
							<td class="c-cluster-cell"></td>
							<td class="c-cluster-cell c-feat"></td>
							<td class="c-cluster-cell"></td>
							<td class="c-cluster-cell"></td>
						</tr>
						<tr class="c-row">
							<th class="c-label" scope="row">Max file size</th>
							<td class="c-val"><span class="val">10 MB</span></td>
							<td class="c-val c-feat"><span class="val">25 MB</span></td>
							<td class="c-val"><span class="val">25 MB+</span></td>
							<td class="c-val"><span class="val">25 MB</span></td>
						</tr>
						<tr class="c-row">
							<th class="c-label" scope="row">Monthly uploads</th>
							<td class="c-val"><span class="val">5</span></td>
							<td class="c-val c-feat"><span class="val">Unlimited<span class="star">*</span></span></td>
							<td class="c-val"><span class="val">Expanded</span></td>
							<td class="c-val"><span class="val">Unlimited<span class="star">*</span></span></td>
						</tr>
						<tr class="c-row">
							<th class="c-label" scope="row">Monthly searches</th>
							<td class="c-val"><span class="val">50</span></td>
							<td class="c-val c-feat"><span class="val">Unlimited<span class="star">*</span></span></td>
							<td class="c-val"><span class="val">Expanded</span></td>
							<td class="c-val"><span class="val">Unlimited<span class="star">*</span></span></td>
						</tr>
						<tr class="c-row">
							<th class="c-label" scope="row">Monthly Q&amp;A</th>
							<td class="c-val"><span class="val">10</span></td>
							<td class="c-val c-feat"><span class="val">100</span></td>
							<td class="c-val"><span class="val">100+</span></td>
							<td class="c-val"><span class="val">100</span></td>
						</tr>
						<tr class="c-row">
							<th class="c-label" scope="row">Cumulative storage</th>
							<td class="c-val"><span class="val">500 MB</span></td>
							<td class="c-val c-feat"><span class="val">40 GB<span class="star">*</span></span></td>
							<td class="c-val"><span class="val">40 GB+</span></td>
							<td class="c-val"><span class="val">2 GB</span></td>
						</tr>

						<!-- CLUSTER 2 -->
						<tr class="c-cluster">
							<th class="c-label c-cluster-label" scope="colgroup"><svg class="ic cmp-cluster-ico" aria-hidden="true"><use href="#i-node"/></svg>Included on every plan</th>
							<td class="c-cluster-cell"></td>
							<td class="c-cluster-cell c-feat"></td>
							<td class="c-cluster-cell"></td>
							<td class="c-cluster-cell"></td>
						</tr>
						<tr class="c-row">
							<th class="c-label" scope="row">Hybrid scatter-gather + RRF</th>
							<td class="c-val"><span class="yes"><svg class="ic" aria-hidden="true"><use href="#i-check"/></svg><span class="sr-only">Included</span></span></td>
							<td class="c-val c-feat"><span class="yes"><svg class="ic" aria-hidden="true"><use href="#i-check"/></svg><span class="sr-only">Included</span></span></td>
							<td class="c-val"><span class="yes"><svg class="ic" aria-hidden="true"><use href="#i-check"/></svg><span class="sr-only">Included</span></span></td>
							<td class="c-val"><span class="yes"><svg class="ic" aria-hidden="true"><use href="#i-check"/></svg><span class="sr-only">Included</span></span></td>
						</tr>
						<tr class="c-row">
							<th class="c-label" scope="row">RAG Q&amp;A streamed over SSE</th>
							<td class="c-val"><span class="yes"><svg class="ic" aria-hidden="true"><use href="#i-check"/></svg><span class="sr-only">Included</span></span></td>
							<td class="c-val c-feat"><span class="yes"><svg class="ic" aria-hidden="true"><use href="#i-check"/></svg><span class="sr-only">Included</span></span></td>
							<td class="c-val"><span class="yes"><svg class="ic" aria-hidden="true"><use href="#i-check"/></svg><span class="sr-only">Included</span></span></td>
							<td class="c-val"><span class="yes"><svg class="ic" aria-hidden="true"><use href="#i-check"/></svg><span class="sr-only">Included</span></span></td>
						</tr>
						<tr class="c-row">
							<th class="c-label" scope="row">Cited source chunks, top 3</th>
							<td class="c-val"><span class="yes"><svg class="ic" aria-hidden="true"><use href="#i-check"/></svg><span class="sr-only">Included</span></span></td>
							<td class="c-val c-feat"><span class="yes"><svg class="ic" aria-hidden="true"><use href="#i-check"/></svg><span class="sr-only">Included</span></span></td>
							<td class="c-val"><span class="yes"><svg class="ic" aria-hidden="true"><use href="#i-check"/></svg><span class="sr-only">Included</span></span></td>
							<td class="c-val"><span class="yes"><svg class="ic" aria-hidden="true"><use href="#i-check"/></svg><span class="sr-only">Included</span></span></td>
						</tr>
						<tr class="c-row">
							<th class="c-label" scope="row">BYOK routing + AES-256-GCM sealing</th>
							<td class="c-val"><span class="yes"><svg class="ic" aria-hidden="true"><use href="#i-check"/></svg><span class="sr-only">Included</span></span></td>
							<td class="c-val c-feat"><span class="yes"><svg class="ic" aria-hidden="true"><use href="#i-check"/></svg><span class="sr-only">Included</span></span></td>
							<td class="c-val"><span class="yes"><svg class="ic" aria-hidden="true"><use href="#i-check"/></svg><span class="sr-only">Included</span></span></td>
							<td class="c-val"><span class="yes"><svg class="ic" aria-hidden="true"><use href="#i-check"/></svg><span class="sr-only">Included</span></span></td>
						</tr>
						<tr class="c-row">
							<th class="c-label" scope="row">Row-level tenant isolation</th>
							<td class="c-val"><span class="yes"><svg class="ic" aria-hidden="true"><use href="#i-check"/></svg><span class="sr-only">Included</span></span></td>
							<td class="c-val c-feat"><span class="yes"><svg class="ic" aria-hidden="true"><use href="#i-check"/></svg><span class="sr-only">Included</span></span></td>
							<td class="c-val"><span class="yes"><svg class="ic" aria-hidden="true"><use href="#i-check"/></svg><span class="sr-only">Included</span></span></td>
							<td class="c-val"><span class="yes"><svg class="ic" aria-hidden="true"><use href="#i-check"/></svg><span class="sr-only">Included</span></span></td>
						</tr>
						<tr class="c-row">
							<th class="c-label" scope="row">7-day teardown + circuit breakers</th>
							<td class="c-val"><span class="yes"><svg class="ic" aria-hidden="true"><use href="#i-check"/></svg><span class="sr-only">Included</span></span></td>
							<td class="c-val c-feat"><span class="yes"><svg class="ic" aria-hidden="true"><use href="#i-check"/></svg><span class="sr-only">Included</span></span></td>
							<td class="c-val"><span class="yes"><svg class="ic" aria-hidden="true"><use href="#i-check"/></svg><span class="sr-only">Included</span></span></td>
							<td class="c-val"><span class="yes"><svg class="ic" aria-hidden="true"><use href="#i-check"/></svg><span class="sr-only">Included</span></span></td>
						</tr>

						<!-- CLUSTER 3 -->
						<tr class="c-cluster">
							<th class="c-label c-cluster-label" scope="colgroup"><svg class="ic cmp-cluster-ico" aria-hidden="true"><use href="#i-node"/></svg>Billing &amp; lifecycle</th>
							<td class="c-cluster-cell"></td>
							<td class="c-cluster-cell c-feat"></td>
							<td class="c-cluster-cell"></td>
							<td class="c-cluster-cell"></td>
						</tr>
						<tr class="c-row">
							<th class="c-label" scope="row">One-time invoice, Rp 1,440,000</th>
							<td class="c-val"><span class="no"><svg class="ic" aria-hidden="true"><use href="#i-minus"/></svg><span class="sr-only">Not available</span></span></td>
							<td class="c-val c-feat"><span class="yes"><svg class="ic" aria-hidden="true"><use href="#i-check"/></svg><span class="sr-only">Included</span></span></td>
							<td class="c-val"><span class="no"><svg class="ic" aria-hidden="true"><use href="#i-minus"/></svg><span class="sr-only">Not available</span></span></td>
							<td class="c-val"><span class="no"><svg class="ic" aria-hidden="true"><use href="#i-minus"/></svg><span class="sr-only">Not available</span></span></td>
						</tr>
						<tr class="c-row">
							<th class="c-label" scope="row">Recurring auto-debit subscription</th>
							<td class="c-val"><span class="no"><svg class="ic" aria-hidden="true"><use href="#i-minus"/></svg><span class="sr-only">Not available</span></span></td>
							<td class="c-val c-feat"><span class="no"><svg class="ic" aria-hidden="true"><use href="#i-minus"/></svg><span class="sr-only">Not available</span></span></td>
							<td class="c-val"><span class="yes"><svg class="ic" aria-hidden="true"><use href="#i-check"/></svg><span class="sr-only">Included</span></span></td>
							<td class="c-val"><span class="no"><svg class="ic" aria-hidden="true"><use href="#i-minus"/></svg><span class="sr-only">Not available</span></span></td>
						</tr>
						<tr class="c-row">
							<th class="c-label" scope="row">Multi-seat activation vouchers</th>
							<td class="c-val"><span class="no"><svg class="ic" aria-hidden="true"><use href="#i-minus"/></svg><span class="sr-only">Not available</span></span></td>
							<td class="c-val c-feat"><span class="yes"><svg class="ic" aria-hidden="true"><use href="#i-check"/></svg><span class="sr-only">Included</span></span></td>
							<td class="c-val"><span class="yes"><svg class="ic" aria-hidden="true"><use href="#i-check"/></svg><span class="sr-only">Included</span></span></td>
							<td class="c-val"><span class="no"><svg class="ic" aria-hidden="true"><use href="#i-minus"/></svg><span class="sr-only">Not available</span></span></td>
						</tr>
						<tr class="c-row">
							<th class="c-label" scope="row">Triggers global PRO REAL unlock</th>
							<td class="c-val"><span class="no"><svg class="ic" aria-hidden="true"><use href="#i-minus"/></svg><span class="sr-only">Not available</span></span></td>
							<td class="c-val c-feat"><span class="yes"><svg class="ic" aria-hidden="true"><use href="#i-check"/></svg><span class="sr-only">Included</span></span></td>
							<td class="c-val"><span class="no"><svg class="ic" aria-hidden="true"><use href="#i-minus"/></svg><span class="sr-only">Not available</span></span></td>
							<td class="c-val"><span class="no"><svg class="ic" aria-hidden="true"><use href="#i-minus"/></svg><span class="sr-only">Not available</span></span></td>
						</tr>
						<tr class="c-row">
							<th class="c-label" scope="row">24-hour evaluation code</th>
							<td class="c-val"><span class="no"><svg class="ic" aria-hidden="true"><use href="#i-minus"/></svg><span class="sr-only">Not available</span></span></td>
							<td class="c-val c-feat"><span class="no"><svg class="ic" aria-hidden="true"><use href="#i-minus"/></svg><span class="sr-only">Not available</span></span></td>
							<td class="c-val"><span class="no"><svg class="ic" aria-hidden="true"><use href="#i-minus"/></svg><span class="sr-only">Not available</span></span></td>
							<td class="c-val"><span class="yes"><svg class="ic" aria-hidden="true"><use href="#i-check"/></svg><span class="sr-only">Included</span></span></td>
						</tr>
						<tr class="c-row">
							<th class="c-label" scope="row">Monthly counter reset, 1st 00:00 UTC</th>
							<td class="c-val"><span class="yes"><svg class="ic" aria-hidden="true"><use href="#i-check"/></svg><span class="sr-only">Included</span></span></td>
							<td class="c-val c-feat"><span class="yes"><svg class="ic" aria-hidden="true"><use href="#i-check"/></svg><span class="sr-only">Included</span></span></td>
							<td class="c-val"><span class="yes"><svg class="ic" aria-hidden="true"><use href="#i-check"/></svg><span class="sr-only">Included</span></span></td>
							<td class="c-val"><span class="yes"><svg class="ic" aria-hidden="true"><use href="#i-check"/></svg><span class="sr-only">Included</span></span></td>
						</tr>

					</tbody>

					<tfoot>
						<tr class="c-foot">
							<th class="c-label" scope="row"><span class="t-tag cmp-foot-label">Start</span></th>
							<td class="c-cta"><a class="btn btn--primary cmp-cta-full" href="#demo">Start Free</a></td>
							<td class="c-cta c-feat">
								<button class="btn btn--investor cmp-cta-full js-investor" type="button">
									<span class="js-investor-label">Unlock Investor Tier</span>
								</button>
							</td>
							<td class="c-cta">
								<button class="cmp-cta cmp-cta-full js-real is-locked" type="button" aria-disabled="true">
									<svg class="ic" aria-hidden="true"><use href="#i-lock"/></svg>
									<span class="js-real-label">Locked</span>
								</button>
							</td>
							<td class="c-cta"><a class="btn btn--ink cmp-cta-full" href="#tiers">Generate 24h Code</a></td>
						</tr>
					</tfoot>

				</table>
			</div>
		</div>

		<p class="cmp-foot t-b3" data-reveal>*Unlimited in the UI. Fair-use backend caps during sandbox: 50 documents, 500 searches, 2 GB. Storage is cumulative and never resets.</p>

	</div>
</section>