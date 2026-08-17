<script lang="ts">
</script>

<!-- ============ FOOTER ============ -->
<footer class="site-footer">
	<div class="ft-shell">

		<!-- TOP: split block (brand + capture | link columns) -->
		<div class="ft-top">

			<!-- LEFT -->
			<div class="ft-brand">
				<a class="wordmark wordmark--dark" href="#top" aria-label="Dokyudo home">
					<svg class="ic wordmark__mark" aria-hidden="true"><use href="#i-node"/></svg>
					<span>Dokyudo</span>
				</a>

				<p class="ft-tagline">Dokyudo - Semantic search and RAG Q&amp;A for dense financial reports.</p>

				<p class="ft-contact">Contact: <a href="mailto:hello@dokyudo.com">hello@dokyudo.com</a></p>

				<div class="ft-capture-wrap">
					<form class="ft-capture" novalidate>
						<label class="ft-capture__field">
							<span class="sr-only">Work email</span>
							<input class="ft-capture__input" type="email" name="email" placeholder="Work email" autocomplete="email" spellcheck="false" />
						</label>
						<button class="ft-capture__btn" type="submit" aria-label="Subscribe">
							<svg class="ic" aria-hidden="true"><use href="#i-arrow"/></svg>
						</button>
					</form>
					<p class="ft-capture__ok" role="status" aria-live="polite"></p>
				</div>

				<div class="ft-meta">
					<p class="ft-status">
						<span class="status-dot" aria-hidden="true"></span>
						all systems nominal / circuit: closed
					</p>
					<nav class="ft-socials" aria-label="Social">
						<a href="#">GitHub</a>
						<a href="#">X</a>
						<a href="#">LinkedIn</a>
					</nav>
				</div>
			</div>

			<!-- vertical hairline -->
			<div class="ft-divider" aria-hidden="true"></div>

			<!-- RIGHT -->
			<div class="ft-cols">
				<nav class="ft-col" aria-label="Product">
					<p class="ft-col__h">Product</p>
					<a href="#features">Features</a>
					<a href="#architecture">Architecture</a>
					<a href="#tiers">Tiers</a>
					<a href="#faq">FAQ</a>
				</nav>

				<nav class="ft-col" aria-label="Resources">
					<p class="ft-col__h">Resources</p>
					<a href="#">Docs</a>
					<a href="#">Status</a>
					<a href="#">Changelog</a>
					<a href="#">Security</a>
				</nav>

				<nav class="ft-col" aria-label="Company">
					<p class="ft-col__h">Company</p>
					<a href="#">About</a>
					<a href="#">Careers</a>
					<a href="mailto:hello@dokyudo.com">Contact</a>
				</nav>

				<div class="ft-col">
					<p class="ft-col__h">Architecture</p>
					<ul class="ft-stack">
						<li>CF Pages</li>
						<li>Deno Deploy</li>
						<li>MinIO on-prem</li>
						<li>Supabase</li>
						<li>Upstash Vector</li>
						<li>Upstash Redis</li>
					</ul>
				</div>
			</div>

		</div>

		<!-- LEGAL STRIP -->
		<div class="ft-legal">
			<span class="ft-legal__copy">© 2026 Dokyudo. All rights reserved</span>
			<a href="#">Privacy</a>
			<a href="#">Terms</a>
		</div>

		<!-- GHOST WORDMARK (bleeds off the bottom edge) -->
		<div class="ft-mark" aria-hidden="true">
			<svg class="ft-mark__sym" viewBox="0 0 24 24"><use href="#i-node"/></svg>
			<span class="ft-mark__word">Dokyudo</span>
		</div>

	</div>
</footer>

<!-- webhook toast -->
<div class="toast" id="toast" role="status" aria-live="polite">
	<p class="t-tag toast__kicker">Webhook verified</p>
	<p class="t-b2">invoice.paid received. PRO (REAL) is now unlocked for all tenants.</p>
</div>