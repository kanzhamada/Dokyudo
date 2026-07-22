<script lang="ts">
	import { Mail, ArrowUpRight } from '@lucide/svelte';
</script>

<footer class="landing-footer" id="footer">
	<div class="footer-inner">
		<!-- Logo -->
		<div class="footer-logo">
			<svg
				width="36"
				height="36"
				viewBox="0 0 32 32"
				fill="none"
				xmlns="http://www.w3.org/2000/svg"
			>
				<rect width="32" height="32" rx="8" fill="var(--color-dk-copper)" />
				<path d="M8 10h6a6 6 0 0 1 0 12H8V10z" fill="var(--color-dk-bg)" />
				<circle cx="22" cy="16" r="4" fill="var(--color-dk-cream)" />
			</svg>
			<span>Dokyudo</span>
		</div>

		<div class="footer-divider-top"></div>

		<!-- Three-column layout -->
		<div class="footer-grid">
			<div class="footer-col">
				<h4>Product</h4>
				<a href="#features">Features</a>
				<a href="#about">About</a>
				<a href="#faq">FAQ</a>
				<a href="/auth/register">Get Started</a>
			</div>

			<div class="footer-col footer-col-center">
				<p class="footer-quote">
					"Search with meaning, not keywords — unlock intelligence from your documents today."
				</p>
				<div class="footer-ctas">
					<a href="/auth/register" class="btn-primary btn-sm">
						Get Started
						<ArrowUpRight size={13} strokeWidth={2.5} />
					</a>
					<a href="#about" class="btn-outline btn-sm">
						Learn More
						<ArrowUpRight size={13} strokeWidth={2} />
					</a>
				</div>
				<div class="footer-socials">
					<a
						href="https://github.com"
						class="social-circle"
						aria-label="GitHub"
						target="_blank"
						rel="noopener noreferrer"
					>
						<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"
							><path
								d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"
							/></svg
						>
					</a>
					<a
						href="https://twitter.com"
						class="social-circle"
						aria-label="Twitter"
						target="_blank"
						rel="noopener noreferrer"
					>
						<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"
							><path
								d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"
							/></svg
						>
					</a>
					<a href="mailto:hello@dokyudo.com" class="social-circle" aria-label="Email">
						<Mail size={16} />
					</a>
				</div>
			</div>

			<div class="footer-col footer-col-right">
				<h4>Resources</h4>
				<a href="/docs">Documentation</a>
				<a href="/docs/api">API Reference</a>
				<a href="/docs/architecture">Architecture</a>
				<a href="/changelog">Changelog</a>
			</div>
		</div>

		<div class="footer-divider-bottom"></div>

		<p class="footer-copyright">
			©2025 <span class="footer-brand-name">Dokyudo</span> — All Rights Reserved.
		</p>
	</div>
</footer>

<style>
	footer {
		font-family: 'Geist Sans', 'Inter Variable', system-ui, sans-serif;
		color: var(--dk-light);
	}

	.btn-primary {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		text-decoration: none;
		color: var(--dk-bg);
		font-size: 14px;
		font-weight: 600;
		padding: 10px 22px;
		border-radius: var(--dk-radius-sm);
		background: var(--dk-copper);
		border: none;
		cursor: pointer;
		transition:
			background 200ms cubic-bezier(0.37, 0, 0.63, 1),
			transform 200ms cubic-bezier(0.37, 0, 0.63, 1);
		letter-spacing: -0.01em;
	}

	.btn-primary:hover {
		background: var(--color-dk-copper-hover);
		transform: translateY(-1px);
	}

	.btn-primary:active {
		transform: scale(0.98);
	}

	.btn-primary.btn-sm {
		font-size: 13px;
		padding: 8px 18px;
	}

	.btn-outline {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		text-decoration: none;
		color: var(--dk-cream);
		font-size: 14px;
		font-weight: 500;
		padding: 10px 22px;
		border-radius: var(--dk-radius-sm);
		background: transparent;
		border: 1px solid var(--dk-border-strong);
		cursor: pointer;
		transition:
			border-color 200ms cubic-bezier(0.37, 0, 0.63, 1),
			background 200ms cubic-bezier(0.37, 0, 0.63, 1),
			transform 200ms cubic-bezier(0.37, 0, 0.63, 1);
		letter-spacing: -0.01em;
	}

	.btn-outline:hover {
		border-color: var(--dk-copper);
		background: var(--dk-accent-glow);
		transform: translateY(-1px);
	}

	.btn-outline:active {
		transform: scale(0.98);
	}

	.btn-outline.btn-sm {
		font-size: 13px;
		padding: 8px 18px;
	}

	.landing-footer {
		background: var(--dk-bg-deep);
		padding: var(--dk-section-py) var(--dk-section-px) 32px;
	}

	.footer-inner {
		max-width: var(--dk-max-width);
		margin: 0 auto;
	}

	.footer-logo {
		display: flex;
		align-items: center;
		gap: 12px;
		justify-content: center;
		margin-bottom: 32px;
	}

	.footer-logo span {
		font-size: 28px;
		font-weight: 600;
		color: var(--dk-cream);
		letter-spacing: -0.03em;
	}

	.footer-divider-top,
	.footer-divider-bottom {
		height: 1px;
		background: linear-gradient(
			90deg,
			transparent,
			var(--dk-border-strong) 20%,
			var(--dk-border-strong) 80%,
			transparent
		);
		margin: 32px 0;
	}

	.footer-grid {
		display: grid;
		grid-template-columns: 1fr 2fr 1fr;
		gap: 40px;
		align-items: start;
	}

	.footer-col h4 {
		font-size: 14px;
		color: var(--dk-cream);
		font-weight: 500;
		margin: 0 0 16px;
		letter-spacing: -0.02em;
	}

	.footer-col a {
		display: block;
		text-decoration: none;
		color: var(--dk-text-muted);
		font-size: 14px;
		padding: 4px 0;
		transition: color 200ms cubic-bezier(0.37, 0, 0.63, 1);
	}

	.footer-col a:hover {
		color: var(--dk-cream);
	}

	.footer-col-center {
		text-align: center;
		display: flex;
		flex-direction: column;
		align-items: center;
	}

	.footer-col-right {
		text-align: right;
	}

	.footer-col-right a {
		text-align: right;
	}

	.footer-quote {
		font-size: 20px;
		color: var(--dk-cream);
		font-weight: 400;
		line-height: 1.4;
		margin: 0 0 24px;
		max-width: 44ch;
		font-style: italic;
		letter-spacing: -0.02em;
	}

	.footer-ctas {
		display: flex;
		gap: 12px;
		margin-bottom: 28px;
	}

	.footer-socials {
		display: flex;
		gap: 10px;
	}

	.social-circle {
		width: 40px;
		height: 40px;
		border-radius: 50%;
		border: 1px solid var(--dk-border-strong);
		background: transparent;
		color: var(--dk-text-muted);
		display: flex;
		align-items: center;
		justify-content: center;
		text-decoration: none;
		transition:
			border-color 200ms cubic-bezier(0.37, 0, 0.63, 1),
			color 200ms cubic-bezier(0.37, 0, 0.63, 1),
			background 200ms cubic-bezier(0.37, 0, 0.63, 1);
	}

	.social-circle:hover {
		border-color: var(--dk-copper);
		color: var(--dk-cream);
		background: var(--dk-accent-glow);
	}

	.footer-copyright {
		text-align: center;
		font-size: 13px;
		color: var(--dk-text-muted);
		margin: 0;
	}

	.footer-brand-name {
		color: var(--dk-copper);
	}

	@media (max-width: 1024px) {
		.footer-grid {
			grid-template-columns: 1fr 1fr;
			gap: 32px;
		}

		.footer-col-center {
			grid-column: 1 / -1;
			order: -1;
		}
	}

	@media (max-width: 768px) {
		.footer-grid {
			grid-template-columns: 1fr;
			text-align: center;
		}

		.footer-col-right {
			text-align: center;
		}

		.footer-col-right a {
			text-align: center;
		}
	}

	@media (max-width: 480px) {
		.footer-ctas {
			flex-direction: column;
			width: 100%;
		}

		.footer-ctas a {
			width: 100%;
			justify-content: center;
		}
	}
</style>
