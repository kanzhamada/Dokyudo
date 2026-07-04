<script lang="ts">
	import { FileText, Search, MessageSquare, Shield, Zap, Lock, Upload, Database, ChevronRight, ArrowUpRight, Star, Plus, Minus, Mail, Phone } from '@lucide/svelte';

	import book from '$lib/assets/landing_pages/book.webp';
	import paper1 from '$lib/assets/landing_pages/paper1.webp';
	import paper2 from '$lib/assets/landing_pages/paper2.webp';
	import paper3 from '$lib/assets/landing_pages/paper3.webp';
	import paper4 from '$lib/assets/landing_pages/paper4.webp';
	import paper5 from '$lib/assets/landing_pages/paper5.webp';
	import paper6 from '$lib/assets/landing_pages/paper6.webp';
	import paper7 from '$lib/assets/landing_pages/paper7.webp';
	import paperBlur from '$lib/assets/landing_pages/paper blur.webp';
	import flower1 from '$lib/assets/landing_pages/flower 1.webp';
	import flower2 from '$lib/assets/landing_pages/flower2.webp';
	import flower3 from '$lib/assets/landing_pages/flower3.webp';
	import flower4 from '$lib/assets/landing_pages/flower4.webp';
	import flower5 from '$lib/assets/landing_pages/flower5.webp';
	import flower6 from '$lib/assets/landing_pages/flower6.webp';
	import flower7 from '$lib/assets/landing_pages/flower7.webp';
	import flower8 from '$lib/assets/landing_pages/flower8.webp';
	import flowerBlur from '$lib/assets/landing_pages/flower blur.webp';

	/* ── FAQ Accordion State ── */
	let openFaq = $state(0);

	function toggleFaq(index: number) {
		openFaq = openFaq === index ? -1 : index;
	}

	const faqs = [
		{
			q: 'What document formats does Dokyudo support?',
			a: 'Dokyudo supports PDF, DOCX, and TXT file formats. Our ingestion pipeline extracts text, generates optimized chunks, and creates high-fidelity 768-dimension vector embeddings for semantic search.'
		},
		{
			q: 'How does hybrid semantic search work?',
			a: 'We combine vector similarity search via Upstash Vector with full-text search on PostgreSQL, then merge results using Reciprocal Rank Fusion (RRF). This delivers both conceptual and keyword-level accuracy.'
		},
		{
			q: 'Is my data isolated from other tenants?',
			a: 'Absolutely. Every database query is scoped by your tenant ID. Document storage, vector embeddings, and conversation history are strictly isolated at the architectural level.'
		},
		{
			q: 'What LLM providers power the Q&A?',
			a: 'Dokyudo uses a multi-provider fallback chain including Groq, Gemini Flash, and Cohere for zero-cost high availability. You can also bring your own OpenAI or Claude API key via our BYOK feature.'
		},
		{
			q: 'How are my API keys secured?',
			a: 'Keys are encrypted using AES-256-GCM with a Master Encryption Key stored exclusively in the runtime environment. Keys are never stored in plaintext and are decrypted only in memory for the duration of a request.'
		},
		{
			q: 'What are the free tier limits?',
			a: 'Free tier includes 5 document uploads per month, 50 search queries, 10 Q&A queries, and 500 MB of storage. Counters reset on the 1st of each month.'
		}
	];
</script>

<svelte:head>
	<title>Dokyudo — Semantic Document Search & AI-Powered Q&A</title>
	<meta name="description" content="Upload documents, search semantically, and ask contextual questions powered by RAG. Enterprise-grade multi-tenant SaaS with hybrid cloud architecture." />
	<link rel="preconnect" href="https://fonts.googleapis.com" />
	<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
</svelte:head>

<!-- ═══════════════════════════════════════════════════════ -->
<!-- NAVIGATION                                             -->
<!-- ═══════════════════════════════════════════════════════ -->
<nav class="landing-nav" id="landing-nav">
	<div class="nav-inner">
		<a href="/" class="nav-logo" aria-label="Dokyudo Home">
			<svg width="28" height="28" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
				<rect width="32" height="32" rx="8" fill="#C5937B"/>
				<path d="M8 10h6a6 6 0 0 1 0 12H8V10z" fill="#1C1B1B"/>
				<circle cx="22" cy="16" r="4" fill="#E8DEC8"/>
			</svg>
			<span>Dokyudo</span>
		</a>
		<div class="nav-links">
			<a href="#about">About</a>
			<a href="#features">Features</a>
			<a href="#testimonials">Testimonials</a>
			<a href="#faq">FAQ</a>
		</div>
		<div class="nav-actions">
			<a href="/auth/login" class="nav-btn-ghost">Log In</a>
			<a href="/auth/register" class="nav-btn-accent">
				Get Started
				<ArrowUpRight size={14} strokeWidth={2.5} />
			</a>
		</div>
	</div>
</nav>

<!-- ═══════════════════════════════════════════════════════ -->
<!-- HERO — Centered headline + image mosaic below          -->
<!-- ═══════════════════════════════════════════════════════ -->
<section class="hero-section" id="hero">
	<div class="hero-bg-elements">
		<img src={book} class="bg-el book" alt="" aria-hidden="true" />
		<img src={paper1} class="bg-el paper1" alt="" aria-hidden="true" />
		<img src={paper2} class="bg-el paper2" alt="" aria-hidden="true" />
		<img src={paper3} class="bg-el paper3" alt="" aria-hidden="true" />
		<img src={paper4} class="bg-el paper4" alt="" aria-hidden="true" />
		<img src={paper5} class="bg-el paper5" alt="" aria-hidden="true" />
		<img src={paper6} class="bg-el paper6" alt="" aria-hidden="true" />
		<img src={paper7} class="bg-el paper7" alt="" aria-hidden="true" />
		<img src={paperBlur} class="bg-el paper-blur" alt="" aria-hidden="true" />
		<img src={flower1} class="bg-el flower1" alt="" aria-hidden="true" />
		<img src={flower2} class="bg-el flower2" alt="" aria-hidden="true" />
		<img src={flower3} class="bg-el flower3" alt="" aria-hidden="true" />
		<img src={flower4} class="bg-el flower4" alt="" aria-hidden="true" />
		<img src={flower5} class="bg-el flower5" alt="" aria-hidden="true" />
		<img src={flower6} class="bg-el flower6" alt="" aria-hidden="true" />
		<img src={flower7} class="bg-el flower7" alt="" aria-hidden="true" />
		<img src={flower8} class="bg-el flower8" alt="" aria-hidden="true" />
		<img src={flowerBlur} class="bg-el flower-blur" alt="" aria-hidden="true" />
	</div>

	<div class="hero-trust-badge">
		<div class="trust-avatars">
			<div class="trust-avatar" style="background: #C5937B;">A</div>
			<div class="trust-avatar" style="background: #8B7355;">K</div>
			<div class="trust-avatar" style="background: #6B8E72;">R</div>
			<div class="trust-avatar" style="background: #7B8EA0;">M</div>
		</div>
		<span>Built for Financial Analysts</span>
	</div>

	<h1 class="hero-headline">
		Search your documents<br/>with meaning, not keywords.
	</h1>

	<p class="hero-subtext">
		Upload financial reports, search semantically, and get AI-powered answers
		with cited sources. Enterprise-grade RAG built on hybrid cloud architecture.
	</p>

	<div class="hero-ctas">
		<a href="/auth/register" class="btn-primary">
			Start Free
			<ArrowUpRight size={15} strokeWidth={2.5} />
		</a>
		<a href="#features" class="btn-outline">
			See Features
			<ArrowUpRight size={15} strokeWidth={2} />
		</a>
	</div>
</section>

<!-- ═══════════════════════════════════════════════════════ -->
<!-- ABOUT — Split layout: image left, text + cards right   -->
<!-- ═══════════════════════════════════════════════════════ -->
<section class="about-section" id="about">
	<div class="about-inner">
		<div class="about-image">
			<img src="/landing/about-workspace.jpg" alt="Analyst working with financial reports" loading="lazy" />
		</div>
		<div class="about-content">
			<span class="section-label">✦ About Dokyudo</span>
			<h2 class="section-headline">
				Precise answers from dense financial reports.
			</h2>
			<p class="section-body">
				Dokyudo transforms how teams interact with financial documents. Upload annual reports,
				search across them semantically, and ask contextual questions. Our hybrid search engine
				combines vector similarity with full-text matching for unmatched accuracy.
			</p>
			<a href="/auth/register" class="btn-primary">
				Know More
				<ArrowUpRight size={15} strokeWidth={2.5} />
			</a>

			<!-- Value Cards Row -->
			<div class="about-cards">
				<div class="value-card">
					<div class="value-icon">
						<Shield size={22} />
					</div>
					<h3>Data Isolation</h3>
					<p>Multi-tenant architecture with strict per-query tenant scoping.</p>
				</div>
				<div class="value-card">
					<div class="value-icon">
						<Zap size={22} />
					</div>
					<h3>Sub-500ms Search</h3>
					<p>Hybrid RRF search delivers P95 latency under 500 milliseconds.</p>
				</div>
				<div class="value-card">
					<div class="value-icon">
						<Lock size={22} />
					</div>
					<h3>BYOK Encryption</h3>
					<p>AES-256-GCM encryption for your own API keys. Zero plaintext storage.</p>
				</div>
			</div>
		</div>
	</div>
</section>

<!-- ═══════════════════════════════════════════════════════ -->
<!-- LOGO WALL — Trusted tech partners / stack              -->
<!-- ═══════════════════════════════════════════════════════ -->
<section class="logo-wall-section">
	<div class="logo-wall-divider"></div>
	<div class="logo-wall">
		<div class="logo-item">
			<svg viewBox="0 0 120 30" fill="currentColor" width="100" height="26">
				<text x="0" y="22" font-family="Geist Sans, sans-serif" font-size="18" font-weight="600" letter-spacing="1">Supabase</text>
			</svg>
		</div>
		<div class="logo-item">
			<svg viewBox="0 0 100 30" fill="currentColor" width="90" height="26">
				<text x="0" y="22" font-family="Geist Sans, sans-serif" font-size="18" font-weight="600" letter-spacing="1">Upstash</text>
			</svg>
		</div>
		<div class="logo-item">
			<svg viewBox="0 0 80 30" fill="currentColor" width="80" height="26">
				<text x="0" y="22" font-family="Geist Sans, sans-serif" font-size="18" font-weight="600" letter-spacing="1">Deno</text>
			</svg>
		</div>
		<div class="logo-item">
			<svg viewBox="0 0 130 30" fill="currentColor" width="110" height="26">
				<text x="0" y="22" font-family="Geist Sans, sans-serif" font-size="18" font-weight="600" letter-spacing="1">Cloudflare</text>
			</svg>
		</div>
		<div class="logo-item">
			<svg viewBox="0 0 80 30" fill="currentColor" width="80" height="26">
				<text x="0" y="22" font-family="Geist Sans, sans-serif" font-size="18" font-weight="600" letter-spacing="1">Hono</text>
			</svg>
		</div>
	</div>
	<div class="logo-wall-divider"></div>
</section>

<!-- ═══════════════════════════════════════════════════════ -->
<!-- FEATURES — Two large showcase cards (portfolio-style)  -->
<!-- ═══════════════════════════════════════════════════════ -->
<section class="features-section" id="features">
	<div class="features-header">
		<div>
			<span class="section-label">✦ Core Capabilities</span>
			<h2 class="section-headline">
				Intelligence built into every layer.
			</h2>
		</div>
		<a href="/auth/register" class="btn-outline btn-outline-sm">
			All Features
			<ArrowUpRight size={14} strokeWidth={2} />
		</a>
	</div>

	<div class="features-line"></div>

	<div class="feature-cards-grid">
		<div class="feature-card">
			<div class="feature-card-image">
				<img src="/landing/feature-upload.jpg" alt="Document ingestion pipeline" loading="lazy" />
			</div>
			<div class="feature-card-overlay">
				<h3>Semantic Document Ingestion</h3>
				<p>
					Upload PDFs, DOCX, and TXT files. Our pipeline extracts text, chunks it with
					finance-optimized 1,000-1,500 token windows, and generates 768-dimension embeddings
					via Gemini. All processing is rate-limited and auto-throttled.
				</p>
				<div class="feature-card-footer">
					<a href="/auth/register" class="btn-primary btn-sm">
						Read More
						<ArrowUpRight size={13} strokeWidth={2.5} />
					</a>
					<span class="feature-meta">PDF · DOCX · TXT</span>
				</div>
			</div>
		</div>

		<div class="feature-card">
			<div class="feature-card-image">
				<img src="/landing/feature-rag-chat.jpg" alt="RAG Q&A streaming interface" loading="lazy" />
			</div>
			<div class="feature-card-overlay">
				<h3>RAG Q&A with Streaming</h3>
				<p>
					Ask questions across your uploaded documents. The RAG engine retrieves relevant
					context via hybrid search, builds a prompt, and streams the answer in real-time
					using Server-Sent Events with multi-provider LLM fallback.
				</p>
				<div class="feature-card-footer">
					<a href="/auth/register" class="btn-primary btn-sm">
						Read More
						<ArrowUpRight size={13} strokeWidth={2.5} />
					</a>
					<span class="feature-meta">SSE · Multi-LLM</span>
				</div>
			</div>
		</div>
	</div>
</section>

<!-- ═══════════════════════════════════════════════════════ -->
<!-- TESTIMONIALS — Left names list, center image, right    -->
<!-- quote card                                             -->
<!-- ═══════════════════════════════════════════════════════ -->
<section class="testimonials-section" id="testimonials">
	<div class="testimonials-header">
		<span class="section-label">✦ Testimonials</span>
		<div class="testimonials-headline-wrap">
			<div class="features-line"></div>
			<h2 class="section-headline testimonial-headline">What teams are saying.</h2>
			<div class="features-line"></div>
		</div>
	</div>

	<div class="testimonials-grid">
		<!-- Left: Names List -->
		<div class="testimonial-names">
			<div class="testimonial-name-card active">
				<div class="testimonial-avatar">AS</div>
				<div>
					<strong>Arif Setiawan</strong>
					<span>Financial Analyst</span>
				</div>
			</div>
			<div class="testimonial-name-card">
				<div class="testimonial-avatar">DR</div>
				<div>
					<strong>Diana Rahmawati</strong>
					<span>Research Lead</span>
				</div>
			</div>
			<div class="testimonial-name-card">
				<div class="testimonial-avatar">BW</div>
				<div>
					<strong>Budi Wicaksono</strong>
					<span>Portfolio Manager</span>
				</div>
			</div>
			<div class="testimonial-name-card">
				<div class="testimonial-avatar">SP</div>
				<div>
					<strong>Sari Putri</strong>
					<span>Compliance Officer</span>
				</div>
			</div>
		</div>

		<!-- Center: Featured Image -->
		<div class="testimonial-center-image">
			<img src="/landing/about-workspace.jpg" alt="Team using Dokyudo for financial analysis" loading="lazy" />
		</div>

		<!-- Right: Quote Card -->
		<div class="testimonial-quote-card">
			<div class="quote-badge">
				<Star size={14} fill="#C5937B" stroke="#C5937B" />
				<span>4.9 Rating</span>
			</div>
			<div class="quote-marks">"</div>
			<p class="quote-text">
				"Dokyudo cut our quarterly report analysis time from days to minutes. The semantic
				search finds exactly what we need across hundreds of pages, and the RAG answers
				are accurate with proper citations."
			</p>
			<div class="quote-author-mark">
				<svg width="40" height="28" viewBox="0 0 40 28" fill="none">
					<rect width="40" height="28" rx="6" fill="#2A221E"/>
					<text x="8" y="19" font-family="Geist Sans, sans-serif" font-size="11" fill="#C5937B" font-weight="600">AS</text>
				</svg>
			</div>
		</div>
	</div>
</section>

<!-- ═══════════════════════════════════════════════════════ -->
<!-- FAQ — Split: headline + image left, accordion right    -->
<!-- ═══════════════════════════════════════════════════════ -->
<section class="faq-section" id="faq">
	<div class="faq-inner">
		<div class="faq-left">
			<span class="section-label">✦ FAQ</span>
			<h2 class="section-headline">
				Frequently Asked<br/>Questions
			</h2>
			<div class="faq-image">
				<img src="/landing/abstract-tech.jpg" alt="Neural network data visualization" loading="lazy" />
			</div>
		</div>

		<div class="faq-right">
			{#each faqs as faq, i}
				<button
					class="faq-item"
					class:faq-open={openFaq === i}
					onclick={() => toggleFaq(i)}
					aria-expanded={openFaq === i}
					id="faq-item-{i}"
				>
					<div class="faq-question">
						<span>{faq.q}</span>
						<div class="faq-toggle">
							{#if openFaq === i}
								<Minus size={16} strokeWidth={2.5} />
							{:else}
								<Plus size={16} strokeWidth={2.5} />
							{/if}
						</div>
					</div>
					{#if openFaq === i}
						<div class="faq-answer">
							<p>{faq.a}</p>
						</div>
					{/if}
				</button>
			{/each}
		</div>
	</div>
</section>

<!-- ═══════════════════════════════════════════════════════ -->
<!-- CTA BANNER — Large headline + image right              -->
<!-- ═══════════════════════════════════════════════════════ -->
<section class="cta-section">
	<div class="cta-card">
		<div class="cta-content">
			<h2 class="cta-headline">
				Start searching your
				documents intelligently.
			</h2>
			<div class="cta-mini-card">
				<img src="/landing/feature-rag-chat.jpg" alt="Dokyudo AI chat" loading="lazy" />
				<p>Hybrid search across all your reports.</p>
				<a href="/auth/register" class="btn-primary btn-sm">
					Get Started
					<ArrowUpRight size={13} strokeWidth={2.5} />
				</a>
			</div>
		</div>
		<div class="cta-image">
			<img src="/landing/cta-person.jpg" alt="Professional using Dokyudo" loading="lazy" />
		</div>
	</div>
</section>

<!-- ═══════════════════════════════════════════════════════ -->
<!-- FOOTER                                                 -->
<!-- ═══════════════════════════════════════════════════════ -->
<footer class="landing-footer" id="footer">
	<div class="footer-inner">
		<!-- Logo -->
		<div class="footer-logo">
			<svg width="36" height="36" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
				<rect width="32" height="32" rx="8" fill="#C5937B"/>
				<path d="M8 10h6a6 6 0 0 1 0 12H8V10z" fill="#1C1B1B"/>
				<circle cx="22" cy="16" r="4" fill="#E8DEC8"/>
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
					<a href="https://github.com" class="social-circle" aria-label="GitHub" target="_blank" rel="noopener noreferrer">
						<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/></svg>
					</a>
					<a href="https://twitter.com" class="social-circle" aria-label="Twitter" target="_blank" rel="noopener noreferrer">
						<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
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
	/* ══════════════════════════════════════════════════════ */
	/* DESIGN TOKENS                                         */
	/* ══════════════════════════════════════════════════════ */
	:root {
		--dk-bg: #1C1B1B;
		--dk-bg-deep: #2A221E;
		--dk-cream: #E8DEC8;
		--dk-copper: #C5937B;
		--dk-light: #EFEFEF;
		--dk-bg-card: #252220;
		--dk-bg-card-hover: #302B27;
		--dk-border: rgba(232, 222, 200, 0.12);
		--dk-border-strong: rgba(232, 222, 200, 0.22);
		--dk-text-muted: rgba(239, 239, 239, 0.55);
		--dk-accent-glow: rgba(197, 147, 123, 0.15);
		--dk-radius: 14px;
		--dk-radius-sm: 10px;
		--dk-radius-pill: 100px;
		--dk-max-width: 1280px;
		--dk-section-py: clamp(80px, 10vw, 120px);
		--dk-section-px: clamp(20px, 5vw, 48px);
	}

	/* ── Global Section Reset ── */
	section, nav, footer {
		font-family: 'Geist Sans', 'Inter Variable', system-ui, sans-serif;
		color: var(--dk-light);
	}

	/* ══════════════════════════════════════════════════════ */
	/* NAVIGATION                                            */
	/* ══════════════════════════════════════════════════════ */
	.landing-nav {
		position: fixed;
		top: 16px;
		left: 16px;
		right: 16px;
		max-width: var(--dk-max-width);
		margin: 0 auto;
		z-index: 100;
		padding: 0 16px;
		background: rgba(35, 35, 35, 0.4);
		backdrop-filter: blur(42px);
		-webkit-backdrop-filter: blur(42px);
		border: 1px solid rgba(255, 255, 255, 0.16);
		border-radius: 24px;
		box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.3), 0 4px 6px -4px rgba(0, 0, 0, 0.2);
	}

	.nav-inner {
		display: flex;
		align-items: center;
		justify-content: space-between;
		height: 56px;
	}

	.nav-logo {
		display: flex;
		align-items: center;
		gap: 10px;
		text-decoration: none;
		color: var(--dk-cream);
		font-weight: 600;
		font-size: 18px;
		letter-spacing: -0.02em;
	}

	.nav-links {
		display: flex;
		gap: 32px;
	}

	.nav-links a {
		text-decoration: none;
		color: var(--dk-text-muted);
		font-size: 14px;
		font-weight: 400;
		transition: color 0.2s ease;
		letter-spacing: -0.01em;
	}

	.nav-links a:hover {
		color: var(--dk-cream);
	}

	.nav-actions {
		display: flex;
		align-items: center;
		gap: 12px;
	}

	.nav-btn-ghost {
		text-decoration: none;
		color: var(--dk-cream);
		font-size: 14px;
		font-weight: 500;
		padding: 8px 16px;
		border-radius: var(--dk-radius-pill);
		transition: background 0.2s ease;
	}

	.nav-btn-ghost:hover {
		background: rgba(232, 222, 200, 0.08);
	}

	.nav-btn-accent {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		text-decoration: none;
		color: var(--dk-bg);
		font-size: 14px;
		font-weight: 600;
		padding: 8px 18px;
		border-radius: var(--dk-radius-pill);
		background: var(--dk-copper);
		transition: background 0.2s ease, transform 0.15s ease;
	}

	.nav-btn-accent:hover {
		background: #d4a48c;
		transform: translateY(-1px);
	}

	/* ══════════════════════════════════════════════════════ */
	/* BUTTONS (Shared)                                      */
	/* ══════════════════════════════════════════════════════ */
	.btn-primary {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		text-decoration: none;
		color: var(--dk-bg);
		font-size: 14px;
		font-weight: 600;
		padding: 10px 22px;
		border-radius: var(--dk-radius-pill);
		background: var(--dk-copper);
		border: none;
		cursor: pointer;
		transition: background 0.2s ease, transform 0.15s ease;
		letter-spacing: -0.01em;
	}

	.btn-primary:hover {
		background: #d4a48c;
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
		border-radius: var(--dk-radius-pill);
		background: transparent;
		border: 1px solid var(--dk-border-strong);
		cursor: pointer;
		transition: border-color 0.2s ease, background 0.2s ease, transform 0.15s ease;
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

	.btn-outline.btn-sm, .btn-outline.btn-outline-sm {
		font-size: 13px;
		padding: 8px 18px;
	}

	/* ══════════════════════════════════════════════════════ */
	/* SECTION LABELS & HEADLINES (Shared)                   */
	/* ══════════════════════════════════════════════════════ */
	.section-label {
		display: block;
		font-size: 13px;
		color: var(--dk-text-muted);
		letter-spacing: 0.02em;
		margin-bottom: 16px;
	}

	.section-headline {
		font-size: clamp(32px, 5vw, 48px);
		font-weight: 500;
		color: var(--dk-cream);
		line-height: 1.1;
		letter-spacing: -0.03em;
		margin: 0;
	}

	.section-body {
		font-size: 15px;
		color: var(--dk-text-muted);
		line-height: 1.7;
		max-width: 50ch;
		margin: 20px 0 28px;
	}

	/* ══════════════════════════════════════════════════════ */
	/* HERO SECTION                                          */
	/* ══════════════════════════════════════════════════════ */
	.hero-section {
		background: var(--dk-bg);
		padding: calc(72px + 80px) var(--dk-section-px) 0;
		display: flex;
		flex-direction: column;
		align-items: center;
		text-align: center;
		overflow: hidden;
		position: relative;
		min-height: 860px;
	}

	.hero-bg-elements {
		position: absolute;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		pointer-events: none;
		z-index: 0;
	}

	.bg-el {
		position: absolute;
		/* Posisi dihitung dari tengah layar (50%) + offset dari tengah */
		left: calc(50% + calc(var(--x-offset) * 1px));
		top: calc(var(--y) * 1px);
	}

	@keyframes float1 {
		0%, 100% { transform: translateY(0); }
		50% { transform: translateY(-10px); }
	}
	@keyframes float2 {
		0%, 100% { transform: translateY(0) rotate(0deg); }
		50% { transform: translateY(-14px) rotate(1.5deg); }
	}
	@keyframes float3 {
		0%, 100% { transform: translateY(0) rotate(0deg); }
		50% { transform: translateY(-12px) rotate(-1.5deg); }
	}

	.bg-el.book { --x-offset: -789.21; --y: 150.41; animation: float2 7s ease-in-out infinite -2s; }
	.bg-el.paper1 { --x-offset: -255.79; --y: 262.56; animation: float1 6s ease-in-out infinite -1s; }
	.bg-el.paper2 { --x-offset: -43.96; --y: 382.25; animation: float3 8s ease-in-out infinite -4s; }
	.bg-el.paper3 { --x-offset: 247.54; --y: 132.14; animation: float2 6.5s ease-in-out infinite -3s; }
	.bg-el.paper4 { --x-offset: 269.33; --y: 307.27; animation: float1 7.5s ease-in-out infinite 0s; }
	.bg-el.paper5 { --x-offset: 385.13; --y: 186.02; animation: float3 9s ease-in-out infinite -5s; }
	.bg-el.paper6 { --x-offset: 267.03; --y: 515.94; animation: float2 5.5s ease-in-out infinite -2s; }
	.bg-el.paper7 { --x-offset: 474.76; --y: 448.58; animation: float1 8.5s ease-in-out infinite -1.5s; }
	.bg-el.paper-blur { --x-offset: 532.74; --y: -3.44; animation: float3 10s ease-in-out infinite 0s; }
	.bg-el.flower1 { --x-offset: -89.54; --y: 456.48; animation: float2 6.8s ease-in-out infinite -4s; }
	.bg-el.flower2 { --x-offset: -22.35; --y: 185.45; animation: float1 7.2s ease-in-out infinite -0.5s; }
	.bg-el.flower3 { --x-offset: 126.3; --y: 271.4; animation: float3 8.2s ease-in-out infinite -2.5s; }
	.bg-el.flower4 { --x-offset: 170.88; --y: 220.13; animation: float2 5.8s ease-in-out infinite -1s; }
	.bg-el.flower5 { --x-offset: 184.96; --y: 440.2; animation: float1 9.5s ease-in-out infinite -6s; }
	.bg-el.flower6 { --x-offset: 431.38; --y: 65.56; animation: float3 7.7s ease-in-out infinite -3s; }
	.bg-el.flower7 { --x-offset: 571.31; --y: 237.15; animation: float2 6.2s ease-in-out infinite 0s; }
	.bg-el.flower8 { --x-offset: 608.12; --y: 303.98; animation: float1 8.8s ease-in-out infinite -4.5s; }
	.bg-el.flower-blur { --x-offset: 629.62; --y: 593.05; animation: float3 11s ease-in-out infinite -2s; }

	.hero-trust-badge,
	.hero-headline,
	.hero-subtext,
	.hero-ctas {
		position: relative;
		z-index: 10;
	}

	.hero-trust-badge {
		display: inline-flex;
		align-items: center;
		gap: 10px;
		padding: 6px 16px 6px 6px;
		border-radius: var(--dk-radius-pill);
		background: var(--dk-bg-card);
		border: 1px solid var(--dk-border);
		margin-bottom: 28px;
		font-size: 13px;
		color: var(--dk-text-muted);
	}

	.trust-avatars {
		display: flex;
	}

	.trust-avatar {
		width: 28px;
		height: 28px;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 11px;
		font-weight: 600;
		color: var(--dk-bg);
		margin-left: -6px;
		border: 2px solid var(--dk-bg-card);
	}

	.trust-avatar:first-child {
		margin-left: 0;
	}

	.hero-headline {
		font-size: clamp(36px, 6vw, 64px);
		font-weight: 500;
		color: var(--dk-cream);
		line-height: 1.05;
		letter-spacing: -0.04em;
		margin: 0 0 20px;
		max-width: 750px;
	}

	.hero-subtext {
		font-size: 15px;
		color: var(--dk-text-muted);
		line-height: 1.7;
		max-width: 52ch;
		margin: 0 auto 32px;
	}

	.hero-ctas {
		display: flex;
		gap: 12px;
		margin-bottom: 56px;
	}

	/* ══════════════════════════════════════════════════════ */
	/* ABOUT SECTION                                         */
	/* ══════════════════════════════════════════════════════ */
	.about-section {
		background: var(--dk-bg);
		padding: var(--dk-section-py) var(--dk-section-px);
	}

	.about-inner {
		max-width: var(--dk-max-width);
		margin: 0 auto;
		display: grid;
		grid-template-columns: 1fr 1.3fr;
		gap: 56px;
		align-items: start;
	}

	.about-image {
		border-radius: var(--dk-radius);
		overflow: hidden;
		aspect-ratio: 4/5;
	}

	.about-image img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.about-cards {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 16px;
		margin-top: 36px;
	}

	.value-card {
		padding: 24px;
		border-radius: var(--dk-radius);
		border: 1px solid var(--dk-border);
		background: var(--dk-bg-card);
		transition: border-color 0.25s ease, background 0.25s ease;
	}

	.value-card:hover {
		border-color: var(--dk-border-strong);
		background: var(--dk-bg-card-hover);
	}

	.value-icon {
		width: 44px;
		height: 44px;
		border-radius: 50%;
		background: var(--dk-bg-deep);
		border: 1px solid var(--dk-border-strong);
		display: flex;
		align-items: center;
		justify-content: center;
		color: var(--dk-copper);
		margin-bottom: 16px;
	}

	.value-card h3 {
		font-size: 15px;
		font-weight: 600;
		color: var(--dk-cream);
		margin: 0 0 8px;
		letter-spacing: -0.01em;
	}

	.value-card p {
		font-size: 13px;
		color: var(--dk-text-muted);
		line-height: 1.55;
		margin: 0;
	}

	/* ══════════════════════════════════════════════════════ */
	/* LOGO WALL                                             */
	/* ══════════════════════════════════════════════════════ */
	.logo-wall-section {
		background: var(--dk-bg-deep);
		padding: 0 var(--dk-section-px);
	}

	.logo-wall-divider {
		height: 1px;
		background: var(--dk-border);
		max-width: var(--dk-max-width);
		margin: 0 auto;
	}

	.logo-wall {
		max-width: var(--dk-max-width);
		margin: 0 auto;
		display: grid;
		grid-template-columns: repeat(5, 1fr);
		align-items: center;
		justify-items: center;
		padding: 40px 0;
	}

	.logo-item {
		color: var(--dk-text-muted);
		opacity: 0.6;
		transition: opacity 0.25s ease;
	}

	.logo-item:hover {
		opacity: 1;
	}

	/* ══════════════════════════════════════════════════════ */
	/* FEATURES SECTION                                      */
	/* ══════════════════════════════════════════════════════ */
	.features-section {
		background: var(--dk-bg);
		padding: var(--dk-section-py) var(--dk-section-px);
	}

	.features-header {
		max-width: var(--dk-max-width);
		margin: 0 auto 20px;
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
	}

	.features-line {
		height: 1px;
		background: linear-gradient(90deg, transparent, var(--dk-border-strong) 20%, var(--dk-border-strong) 80%, transparent);
		max-width: var(--dk-max-width);
		margin: 0 auto 40px;
	}

	.feature-cards-grid {
		max-width: var(--dk-max-width);
		margin: 0 auto;
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 20px;
	}

	.feature-card {
		border-radius: var(--dk-radius);
		overflow: hidden;
		position: relative;
		display: flex;
		flex-direction: column;
		border: 1px solid var(--dk-border);
		transition: border-color 0.3s ease;
	}

	.feature-card:hover {
		border-color: var(--dk-border-strong);
	}

	.feature-card-image {
		height: 280px;
		overflow: hidden;
	}

	.feature-card-image img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		transition: transform 0.6s ease;
	}

	.feature-card:hover .feature-card-image img {
		transform: scale(1.04);
	}

	.feature-card-overlay {
		padding: 28px;
		background: linear-gradient(180deg, rgba(37, 34, 32, 0.95), var(--dk-bg-card));
	}

	.feature-card-overlay h3 {
		font-size: 22px;
		font-weight: 600;
		color: var(--dk-cream);
		margin: 0 0 12px;
		letter-spacing: -0.02em;
	}

	.feature-card-overlay p {
		font-size: 14px;
		color: var(--dk-text-muted);
		line-height: 1.65;
		margin: 0 0 20px;
	}

	.feature-card-footer {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.feature-meta {
		font-size: 12px;
		color: var(--dk-text-muted);
		letter-spacing: 0.04em;
	}

	/* ══════════════════════════════════════════════════════ */
	/* TESTIMONIALS                                          */
	/* ══════════════════════════════════════════════════════ */
	.testimonials-section {
		background: var(--dk-bg);
		padding: var(--dk-section-py) var(--dk-section-px);
	}

	.testimonials-header {
		max-width: var(--dk-max-width);
		margin: 0 auto 48px;
		text-align: center;
	}

	.testimonials-headline-wrap {
		max-width: var(--dk-max-width);
	}

	.testimonial-headline {
		padding: 24px 0;
	}

	.testimonials-grid {
		max-width: var(--dk-max-width);
		margin: 0 auto;
		display: grid;
		grid-template-columns: 200px 1fr 1.2fr;
		gap: 20px;
		align-items: stretch;
	}

	.testimonial-names {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.testimonial-name-card {
		padding: 14px 16px;
		border-radius: var(--dk-radius-sm);
		border: 1px solid var(--dk-border);
		display: flex;
		align-items: center;
		gap: 12px;
		transition: background 0.2s ease, border-color 0.2s ease;
		cursor: pointer;
	}

	.testimonial-name-card:hover,
	.testimonial-name-card.active {
		background: var(--dk-bg-card);
		border-color: var(--dk-border-strong);
	}

	.testimonial-avatar {
		width: 36px;
		height: 36px;
		border-radius: 50%;
		background: var(--dk-bg-deep);
		border: 1px solid var(--dk-border-strong);
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 12px;
		font-weight: 600;
		color: var(--dk-copper);
		flex-shrink: 0;
	}

	.testimonial-name-card strong {
		font-size: 14px;
		color: var(--dk-cream);
		display: block;
		letter-spacing: -0.01em;
	}

	.testimonial-name-card span {
		font-size: 12px;
		color: var(--dk-text-muted);
	}

	.testimonial-center-image {
		border-radius: var(--dk-radius);
		overflow: hidden;
		min-height: 360px;
	}

	.testimonial-center-image img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.testimonial-quote-card {
		background: rgba(232, 222, 200, 0.06);
		border: 1px solid var(--dk-border);
		border-radius: var(--dk-radius);
		padding: 32px;
		display: flex;
		flex-direction: column;
		position: relative;
	}

	.quote-badge {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		background: var(--dk-bg-card);
		border: 1px solid var(--dk-border-strong);
		border-radius: var(--dk-radius-pill);
		padding: 6px 14px;
		font-size: 12px;
		color: var(--dk-copper);
		font-weight: 500;
		align-self: flex-end;
		margin-bottom: 16px;
	}

	.quote-marks {
		font-size: 56px;
		color: var(--dk-copper);
		line-height: 0.8;
		opacity: 0.4;
		font-family: Georgia, 'Times New Roman', serif;
		margin-bottom: 8px;
	}

	.quote-text {
		font-size: 16px;
		color: var(--dk-cream);
		line-height: 1.65;
		margin: 0;
		flex: 1;
		font-style: normal;
	}

	.quote-author-mark {
		margin-top: 24px;
	}

	/* ══════════════════════════════════════════════════════ */
	/* FAQ SECTION                                           */
	/* ══════════════════════════════════════════════════════ */
	.faq-section {
		background: var(--dk-bg);
		padding: var(--dk-section-py) var(--dk-section-px);
	}

	.faq-inner {
		max-width: var(--dk-max-width);
		margin: 0 auto;
		display: grid;
		grid-template-columns: 1fr 1.3fr;
		gap: 56px;
		align-items: start;
	}

	.faq-left {
		position: sticky;
		top: 100px;
	}

	.faq-image {
		border-radius: var(--dk-radius);
		overflow: hidden;
		margin-top: 28px;
		aspect-ratio: 4/3;
	}

	.faq-image img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.faq-right {
		display: flex;
		flex-direction: column;
		gap: 0;
	}

	.faq-item {
		width: 100%;
		text-align: left;
		background: none;
		border: none;
		border-top: 1px solid var(--dk-border);
		padding: 24px 0;
		cursor: pointer;
		color: inherit;
		font-family: inherit;
		transition: background 0.2s ease;
	}

	.faq-item:last-child {
		border-bottom: 1px solid var(--dk-border);
	}

	.faq-question {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 16px;
	}

	.faq-question span {
		font-size: 16px;
		color: var(--dk-cream);
		font-weight: 500;
		letter-spacing: -0.01em;
	}

	.faq-toggle {
		width: 32px;
		height: 32px;
		border-radius: 50%;
		background: var(--dk-copper);
		color: var(--dk-bg);
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
		transition: background 0.2s ease;
	}

	.faq-open .faq-toggle {
		background: var(--dk-copper);
	}

	.faq-answer {
		padding-top: 16px;
	}

	.faq-answer p {
		font-size: 14px;
		color: var(--dk-text-muted);
		line-height: 1.7;
		margin: 0;
		max-width: 56ch;
	}

	/* ══════════════════════════════════════════════════════ */
	/* CTA SECTION                                           */
	/* ══════════════════════════════════════════════════════ */
	.cta-section {
		background: var(--dk-bg);
		padding: 0 var(--dk-section-px) var(--dk-section-py);
	}

	.cta-card {
		max-width: var(--dk-max-width);
		margin: 0 auto;
		display: grid;
		grid-template-columns: 1fr 1.2fr;
		border-radius: var(--dk-radius);
		overflow: hidden;
		background: var(--dk-bg-card);
		border: 1px solid var(--dk-border);
		min-height: 400px;
	}

	.cta-content {
		padding: 48px;
		display: flex;
		flex-direction: column;
		justify-content: space-between;
	}

	.cta-headline {
		font-size: clamp(28px, 4vw, 40px);
		font-weight: 500;
		color: var(--dk-cream);
		line-height: 1.1;
		letter-spacing: -0.03em;
		margin: 0;
	}

	.cta-mini-card {
		background: var(--dk-bg-deep);
		border: 1px solid var(--dk-border);
		border-radius: var(--dk-radius-sm);
		padding: 16px;
		margin-top: 32px;
	}

	.cta-mini-card img {
		width: 100%;
		height: 80px;
		object-fit: cover;
		border-radius: 8px;
		margin-bottom: 12px;
	}

	.cta-mini-card p {
		font-size: 14px;
		color: var(--dk-cream);
		margin: 0 0 14px;
		font-weight: 500;
	}

	.cta-image {
		overflow: hidden;
	}

	.cta-image img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	/* ══════════════════════════════════════════════════════ */
	/* FOOTER                                                */
	/* ══════════════════════════════════════════════════════ */
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
		background: linear-gradient(90deg, transparent, var(--dk-border-strong) 20%, var(--dk-border-strong) 80%, transparent);
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
		letter-spacing: -0.01em;
	}

	.footer-col a {
		display: block;
		text-decoration: none;
		color: var(--dk-text-muted);
		font-size: 14px;
		padding: 4px 0;
		transition: color 0.2s ease;
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
		letter-spacing: -0.01em;
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
		transition: border-color 0.2s ease, color 0.2s ease, background 0.2s ease;
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

	/* ══════════════════════════════════════════════════════ */
	/* RESPONSIVE                                            */
	/* ══════════════════════════════════════════════════════ */
	@media (max-width: 1024px) {
		.about-inner {
			grid-template-columns: 1fr;
			gap: 40px;
		}

		.about-image {
			aspect-ratio: 16/9;
		}

		.about-cards {
			grid-template-columns: repeat(3, 1fr);
		}

		.feature-cards-grid {
			grid-template-columns: 1fr;
		}

		.testimonials-grid {
			grid-template-columns: 1fr;
			gap: 20px;
		}

		.testimonial-names {
			flex-direction: row;
			overflow-x: auto;
			gap: 8px;
			padding-bottom: 8px;
		}

		.testimonial-name-card {
			min-width: 180px;
		}

		.faq-inner {
			grid-template-columns: 1fr;
			gap: 32px;
		}

		.faq-left {
			position: static;
		}

		.faq-image {
			display: none;
		}

		.cta-card {
			grid-template-columns: 1fr;
		}

		.cta-image {
			height: 280px;
		}

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

		.hero-headline {
			font-size: clamp(28px, 8vw, 42px);
		}

		.about-cards {
			grid-template-columns: 1fr;
		}

		.logo-wall {
			grid-template-columns: repeat(3, 1fr);
			gap: 20px;
			padding: 28px 0;
		}

		.logo-item:nth-child(n+4) {
			display: none;
		}

		.testimonial-center-image {
			min-height: 240px;
		}

		.cta-content {
			padding: 32px;
		}

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
		.hero-ctas {
			flex-direction: column;
			align-items: center;
			gap: 10px;
		}

		.hero-ctas .btn-outline,
		.hero-ctas .btn-primary {
			width: 100%;
			justify-content: center;
		}

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
