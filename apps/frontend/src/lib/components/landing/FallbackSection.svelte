<script lang="ts">
</script>

<!-- ============ 5b. MODEL FALLBACK CHAIN / CYLINDER ============ -->
<section class="section section--white" id="fallback">
	<div class="container">

		<div class="fb-head" data-reveal>
			<h2 class="t-h2">The cylinder never jams.</h2>
			<p class="t-b1 shead__lead shead__lead--white">Seven chambers hold the fallback chain. A 429 or a tripped circuit spins the drum to the next live model, so the stream never stalls. Pull it yourself, or let it auto-failover.</p>
		</div>

		<div class="fb-toolbar" data-reveal style="--rd:80ms">
			<div class="fb-toolbar__grp">
				<button class="btn btn--primary btn--sm" id="fbBtnIndex" type="button">
					<svg class="ic" aria-hidden="true"><use href="#i-bolt"/></svg>Index
				</button>
				<button class="btn btn--ghost btn--sm" id="fbBtn429" type="button">
					<svg class="ic" aria-hidden="true"><use href="#i-stream"/></svg>Simulate 429
				</button>
				<button class="btn btn--ghost btn--sm" id="fbBtnTrip" type="button">
					<svg class="ic" aria-hidden="true"><use href="#i-x"/></svg>Trip circuit
				</button>
				<button class="btn btn--ghost btn--sm" id="fbBtnReset" type="button">
					<svg class="ic" aria-hidden="true"><use href="#i-replay"/></svg>Reset
				</button>
			</div>
			<label class="fb-auto">
				<button class="switch" id="fbAutoSwitch" type="button" role="switch" aria-checked="false" aria-label="Toggle automatic failover">
					<span class="switch__knob"></span>
				</button>
				<span class="t-tag">Auto-failover</span>
			</label>
		</div>

		<div class="fb-stage" data-reveal style="--rd:140ms">
			<svg class="fb-svg" viewBox="0 0 360 360" aria-hidden="true">
				<defs>
					<radialGradient id="metalBody" cx="34%" cy="28%" r="80%">
						<stop offset="0%" stop-color="#9aa3ad"/>
						<stop offset="28%" stop-color="#767e88"/>
						<stop offset="60%" stop-color="#484d54"/>
						<stop offset="100%" stop-color="#202226"/>
					</radialGradient>
					<radialGradient id="boreDeep" cx="50%" cy="50%" r="50%">
						<stop offset="0%" stop-color="#050505"/>
						<stop offset="70%" stop-color="#0c0c0d"/>
						<stop offset="100%" stop-color="#000"/>
					</radialGradient>
					<linearGradient id="boreRim" x1="0%" y1="0%" x2="100%" y2="100%">
						<stop offset="0%" stop-color="#c7ccd2"/>
						<stop offset="45%" stop-color="#4b4f55"/>
						<stop offset="100%" stop-color="#0e0f11"/>
					</linearGradient>
					<radialGradient id="vignette" cx="50%" cy="50%" r="50%">
						<stop offset="60%" stop-color="#000" stop-opacity="0"/>
						<stop offset="100%" stop-color="#000" stop-opacity=".55"/>
					</radialGradient>
					<filter id="softShadow" x="-10%" y="-10%" width="120%" height="120%">
						<feDropShadow dx="0" dy="5" stdDeviation="4" flood-color="#000" flood-opacity=".65"/>
					</filter>

					<clipPath id="clip-img-0"><circle r="31"/></clipPath>
					<clipPath id="clip-img-1"><circle r="31"/></clipPath>
					<clipPath id="clip-img-2"><circle r="31"/></clipPath>
					<clipPath id="clip-img-3"><circle r="31"/></clipPath>
					<clipPath id="clip-img-4"><circle r="31"/></clipPath>
					<clipPath id="clip-img-5"><circle r="31"/></clipPath>
					<clipPath id="clip-img-6"><circle r="31"/></clipPath>
				</defs>

				<g id="fbDrum">
					<!-- Path akan dibuat dinamis melalui file javascript -->
					<path id="fbDrumBody" d="" fill="url(#metalBody)" filter="url(#softShadow)"/>

					<g class="fb-ch" data-i="0" style="--id:#f97316" transform="translate(180 89)">
						<circle class="fb-halo" r="42"/>
						<circle class="fb-bore" r="36" fill="url(#boreDeep)"/>
						<g clip-path="url(#clip-img-0)">
							<image x="-31" y="-31" width="62" height="62" preserveAspectRatio="xMidYMid slice" href="https://images.g2crowd.com/uploads/product/hd_favicon/6b7d52bee8c0fae089ddb96ed81547fe/mistral-ai.jpg" />
							<circle r="31" fill="url(#vignette)" opacity="0.6"/>
						</g>
						<circle r="33.5" fill="none" stroke="url(#boreRim)" stroke-width="5" opacity="0.9"/>
						<circle r="36" fill="none" stroke="#000" stroke-opacity="0.55" stroke-width="1.5"/>
						<g class="fb-ch-label"></g>
					</g>

					<g class="fb-ch" data-i="1" style="--id:#6366f1" transform="translate(251.14 123.26)">
						<circle class="fb-halo" r="42"/>
						<circle class="fb-bore" r="36" fill="url(#boreDeep)"/>
						<g clip-path="url(#clip-img-1)">
							<image x="-31" y="-31" width="62" height="62" preserveAspectRatio="xMidYMid slice" href="https://res.cloudinary.com/secretsaas/image/upload/v1/production/yk9ja0q7cjy29st70tpgf8l6ruwx.jpg" />
							<circle r="31" fill="url(#vignette)" opacity="0.6"/>
						</g>
						<circle r="33.5" fill="none" stroke="url(#boreRim)" stroke-width="5" opacity="0.9"/>
						<circle r="36" fill="none" stroke="#000" stroke-opacity="0.55" stroke-width="1.5"/>
						<g class="fb-ch-label"></g>
					</g>

					<g class="fb-ch" data-i="2" style="--id:#06b6d4" transform="translate(268.72 200.25)">
						<circle class="fb-halo" r="42"/>
						<circle class="fb-bore" r="36" fill="url(#boreDeep)"/>
						<g clip-path="url(#clip-img-2)">
							<image x="-31" y="-31" width="62" height="62" preserveAspectRatio="xMidYMid slice" href="https://bullfincher.io/logos/us/META.png" />
							<circle r="31" fill="url(#vignette)" opacity="0.6"/>
						</g>
						<circle r="33.5" fill="none" stroke="url(#boreRim)" stroke-width="5" opacity="0.9"/>
						<circle r="36" fill="none" stroke="#000" stroke-opacity="0.55" stroke-width="1.5"/>
						<g class="fb-ch-label"></g>
					</g>

					<g class="fb-ch" data-i="3" style="--id:#8b5cf6" transform="translate(219.47 261.99)">
						<circle class="fb-halo" r="42"/>
						<circle class="fb-bore" r="36" fill="url(#boreDeep)"/>
						<g clip-path="url(#clip-img-3)">
							<image x="-31" y="-31" width="62" height="62" preserveAspectRatio="xMidYMid slice" href="https://static.vecteezy.com/system/resources/previews/055/687/055/non_2x/rectangle-gemini-google-icon-symbol-logo-free-png.png" />
							<circle r="31" fill="url(#vignette)" opacity="0.6"/>
						</g>
						<circle r="33.5" fill="none" stroke="url(#boreRim)" stroke-width="5" opacity="0.9"/>
						<circle r="36" fill="none" stroke="#000" stroke-opacity="0.55" stroke-width="1.5"/>
						<g class="fb-ch-label"></g>
					</g>

					<g class="fb-ch" data-i="4" style="--id:#10b981" transform="translate(140.53 261.99)">
						<circle class="fb-halo" r="42"/>
						<circle class="fb-bore" r="36" fill="url(#boreDeep)"/>
						<g clip-path="url(#clip-img-4)">
							<image x="-31" y="-31" width="62" height="62" preserveAspectRatio="xMidYMid slice" href="https://cdn.pulse2.com/cdn/2026/04/Cohere-Logo.jpeg" />
							<circle r="31" fill="url(#vignette)" opacity="0.6"/>
						</g>
						<circle r="33.5" fill="none" stroke="url(#boreRim)" stroke-width="5" opacity="0.9"/>
						<circle r="36" fill="none" stroke="#000" stroke-opacity="0.55" stroke-width="1.5"/>
						<g class="fb-ch-label"></g>
					</g>

					<g class="fb-ch" data-i="5" style="--id:#14b8a6" transform="translate(91.28 200.25)">
						<circle class="fb-halo" r="42"/>
						<circle class="fb-bore" r="36" fill="url(#boreDeep)"/>
						<g clip-path="url(#clip-img-5)">
							<image x="-31" y="-31" width="62" height="62" preserveAspectRatio="xMidYMid slice" href="https://uxwing.com/wp-content/themes/uxwing/download/brands-and-social-media/chatgpt-icon.png" />
							<circle r="31" fill="url(#vignette)" opacity="0.6"/>
						</g>
						<circle r="33.5" fill="none" stroke="url(#boreRim)" stroke-width="5" opacity="0.9"/>
						<circle r="36" fill="none" stroke="#000" stroke-opacity="0.55" stroke-width="1.5"/>
						<g class="fb-ch-label"></g>
					</g>

					<g class="fb-ch" data-i="6" style="--id:#3b82f6" transform="translate(108.86 123.26)">
						<circle class="fb-halo" r="42"/>
						<circle class="fb-bore" r="36" fill="url(#boreDeep)"/>
						<g clip-path="url(#clip-img-6)">
							<image x="-31" y="-31" width="62" height="62" preserveAspectRatio="xMidYMid slice" href="https://upload.wikimedia.org/wikipedia/commons/thumb/b/ba/Deepseek-logo-icon.svg/3840px-Deepseek-logo-icon.svg.png" />
							<circle r="31" fill="url(#vignette)" opacity="0.6"/>
						</g>
						<circle r="33.5" fill="none" stroke="url(#boreRim)" stroke-width="5" opacity="0.9"/>
						<circle r="36" fill="none" stroke="#000" stroke-opacity="0.55" stroke-width="1.5"/>
						<g class="fb-ch-label"></g>
					</g>

					<circle cx="180" cy="180" r="18" fill="url(#metalBody)" stroke="rgba(0,0,0,0.5)"/>
					<circle cx="180" cy="180" r="12" fill="#101113" stroke="rgba(255,255,255,0.1)"/>
				</g>

				<circle class="fb-spark" cx="180" cy="40" r="10" fill="var(--color-orange)"/>
				<rect x="172" y="2" width="16" height="22" rx="3" fill="var(--color-orange)"/>
				<circle cx="180" cy="11" r="4" fill="#14110f"/>
				<path d="M172 24 L188 24 L180 35 Z" fill="var(--color-orange)"/>
			</svg>

			<p class="sr-only" id="fbLive" role="status" aria-live="polite"></p>
		</div>

		<div class="fb-readout" data-reveal style="--rd:180ms">
			<span class="t-tag fb-readout__tag">simulated</span>
			<p class="fb-readout__route t-tag" id="fbRouteLine">route → Mistral / Ministral / ready / circuit closed</p>
			<p class="fb-readout__event t-tag" id="fbEventLine">standby / chain armed / 7 chambers ready</p>
		</div>

		<div class="fb-manifest" id="fbManifest" data-reveal style="--rd:220ms" role="group" aria-label="Fallback chain chambers"></div>

	</div>
</section>