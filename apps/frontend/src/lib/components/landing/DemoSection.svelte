<script lang="ts">
	import { onDestroy } from 'svelte';

	import ChatInput from '$lib/components/chat/ChatInput.svelte';
	import MxIcon from '$lib/components/icons/MxIcon.svelte';
	import SourceReferences from '$lib/components/chat/SourceReferences.svelte';
	import { renderMarkdown } from '$lib/utils/markdown';
	import freeIcon from '$lib/assets/llm/free.svg';

	interface LlmOption {
		name: string;
		provider: string;
		model: string;
		icon: string;
	}

	interface DemoReference {
		id: string;
		index: number;
		name: string;
		pages: number[];
		snippet: string;
	}

	interface DemoMessage {
		id: string;
		role: 'user' | 'assistant';
		content: string;
		status?: 'processing' | 'complete' | 'stopped';
		references?: DemoReference[];
	}

	type DemoPhase = 'ready' | 'searching' | 'streaming' | 'complete' | 'stopped';

	const DEFAULT_QUERY = 'What is the Q3 EBITDA breakdown in Section 4.2?';
	const DEMO_ANSWER =
		'**Q3 EBITDA totaled $48.2M**, representing a 12.4% YoY increase [Doc 1: Page 47].\n\n' +
		'Operating income contributed $41.7M with D&A add-back of $6.5M [Doc 2: Page 12].\n\n' +
		'Regionally, North America delivered $29.1M and EMEA $19.1M, offset by $2.9M in unallocated corporate overhead [Doc 3: Page 18].';

	const DEMO_REFERENCES: DemoReference[] = [
		{
			id: 'annual-report',
			index: 1,
			name: 'FY2025_Annual_Report.pdf',
			pages: [47],
			snippet: 'Consolidated EBITDA of $48.2M for the third quarter, up 12.4% YoY.'
		},
		{
			id: 'q3-statement',
			index: 2,
			name: 'Q3_10Q_Financial_Statement.pdf',
			pages: [12],
			snippet: 'Operating income of $41.7M before depreciation and amortization of $6.5M.'
		},
		{
			id: 'investor-deck',
			index: 3,
			name: 'Investor_Deck_H2_2025.pdf',
			pages: [18],
			snippet: 'Segmental EBITDA contribution: North America $29.1M, EMEA $19.1M.'
		}
	];

	const FREE_MODEL: LlmOption = {
		name: 'Free Auto',
		provider: 'auto',
		model: 'auto',
		icon: freeIcon
	};

	let inputValue = $state(DEFAULT_QUERY);
	let attachedFiles = $state<File[]>([]);
	let selectedModel = $state(FREE_MODEL);
	let isGenerating = $state(false);
	let phase = $state<DemoPhase>('complete');
	let messages = $state<DemoMessage[]>([
		{ id: 'demo-user', role: 'user', content: DEFAULT_QUERY },
		{
			id: 'demo-assistant',
			role: 'assistant',
			content: DEMO_ANSWER,
			status: 'complete',
			references: DEMO_REFERENCES
		}
	]);

	let activeController: AbortController | null = null;
	let simulationRun = 0;

	const phaseLabel = $derived(
		phase === 'searching'
			? 'hybrid search / retrieving'
			: phase === 'streaming'
				? 'turn_started / streaming sse'
				: phase === 'complete'
					? 'complete / 3 sources cited'
					: phase === 'stopped'
						? 'stopped / partial answer saved'
						: 'ready / circuit closed'
	);

	/**
	 * The public landing page has no authenticated conversation, so it cannot
	 * call the protected RAG endpoint. This local stream mirrors its SSE
	 * contract so the demo exercises the same client-side parsing behavior.
	 */
	function createDemoSseStream(signal: AbortSignal): ReadableStream<Uint8Array> {
		const encoder = new TextEncoder();
		const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
		let cancelled = false;
		const cancel = () => {
			cancelled = true;
		};
		signal.addEventListener('abort', cancel, { once: true });

		return new ReadableStream<Uint8Array>({
			async start(controller) {
				const emit = (event: string, data: unknown) => {
					if (!cancelled) {
						controller.enqueue(
							encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
						);
					}
				};
				const wait = (ms: number) =>
					new Promise<void>((resolve) => setTimeout(resolve, reducedMotion ? 0 : ms));

				try {
					emit('turn_started', { turnId: 'demo-turn' });
					await wait(320);
					if (cancelled) return controller.close();

					emit('references', { references: DEMO_REFERENCES });
					await wait(260);
					if (cancelled) return controller.close();

					const words = DEMO_ANSWER.split(/(\s+)/).filter(Boolean);
					for (const token of words) {
						if (cancelled) return controller.close();
						emit('token', { token });
						await wait(25);
					}
					emit('done', { turnId: 'demo-turn' });
					controller.close();
				} catch {
					if (!cancelled) controller.error(new Error('Demo stream failed'));
				}
			}
		});
	}

	function stopDemo() {
		if (!isGenerating) return;
		activeController?.abort();
		activeController = null;
		isGenerating = false;
		phase = 'stopped';
		const assistant = messages[messages.length - 1];
		if (assistant?.role === 'assistant') assistant.status = 'stopped';
	}

	async function runDemo() {
		const question = inputValue.trim();
		if (!question || isGenerating) return;

		activeController?.abort();
		const controller = new AbortController();
		activeController = controller;
		const runId = ++simulationRun;
		const assistantId = `demo-assistant-${runId}`;
		messages = [
			{ id: `demo-user-${runId}`, role: 'user', content: question },
			{ id: assistantId, role: 'assistant', content: '', status: 'processing', references: [] }
		];
		attachedFiles = [];
		inputValue = '';
		isGenerating = true;
		phase = 'searching';

		try {
			const stream = createDemoSseStream(controller.signal);
			const reader = stream.getReader();
			const decoder = new TextDecoder();
			let buffer = '';

			while (true) {
				const { done, value } = await reader.read();
				if (done) break;
				buffer += decoder.decode(value, { stream: true });
				const blocks = buffer.split('\n\n');
				buffer = blocks.pop() ?? '';

				for (const block of blocks) {
					let eventName = '';
					let data = '';
					for (const line of block.split('\n')) {
						if (line.startsWith('event:')) eventName = line.slice(6).trim();
						if (line.startsWith('data:')) data = line.slice(5).trim();
					}
					if (!data || runId !== simulationRun) continue;

					const parsed = JSON.parse(data) as {
						token?: string;
						references?: DemoReference[];
					};
					const assistant = messages[messages.length - 1];
					if (assistant?.role !== 'assistant') continue;

					if (eventName === 'references' && parsed.references) {
						assistant.references = parsed.references;
						phase = 'streaming';
					} else if (eventName === 'token' && parsed.token) {
						assistant.content += parsed.token;
						phase = 'streaming';
					} else if (eventName === 'done') {
						assistant.status = 'complete';
						phase = 'complete';
					}
				}
			}
		} catch (error) {
			if (!controller.signal.aborted) {
				console.error('[Landing Demo] SSE simulation failed:', error);
				phase = 'stopped';
			}
		} finally {
			if (runId === simulationRun) {
				isGenerating = false;
				activeController = null;
				if (controller.signal.aborted && phase !== 'stopped') {
					phase = 'stopped';
					const assistant = messages[messages.length - 1];
					if (assistant?.role === 'assistant') assistant.status = 'stopped';
				}
			}
		}
	}

	onDestroy(() => activeController?.abort());
</script>

<section class="section section--white demo-section" id="demo">
	<div class="container">
		<div class="shead" data-reveal>
			<h2 class="t-h2">Ask a document. See the evidence.</h2>
			<p class="t-b1 shead__lead">
				A working preview of the chat surface: hybrid retrieval finds the context, then citations
				arrive with the streamed answer.
			</p>
		</div>

		<div class="demo-chat" data-reveal>
			<div class="demo-chat__head">
				<div class="demo-chat__identity">
					<span class="demo-chat__mark"><MxIcon name="book1-outline" class="size-4" /></span>
					<div>
						<p class="demo-chat__title">Financial review</p>
						<p class="demo-chat__subtitle">A tenant-isolated RAG conversation</p>
					</div>
				</div>
				<div class:demo-chat__status--active={isGenerating} class="demo-chat__status">
					<span class="demo-chat__status-dot"></span>
					<span>{phaseLabel}</span>
				</div>
			</div>

			<div class="demo-chat__body" aria-live="polite">
				{#each messages as message (message.id)}
					{#if message.role === 'user'}
						<div class="demo-message demo-message--user">
							<div class="demo-message__bubble">{message.content}</div>
						</div>
					{:else}
						<div class="demo-message demo-message--assistant">
							<div class="demo-message__trace" aria-label="Retrieval pipeline">
								<span class:demo-trace__item--active={phase !== 'ready'} class="demo-trace__item">
									<MxIcon name="receipt-search-outline" class="size-3.5" />
									Hybrid search
								</span>
								<span class="demo-trace__arrow">/</span>
								<span
									class:demo-trace__item--active={phase === 'streaming' || phase === 'complete'}
									class="demo-trace__item"
								>
									<MxIcon name="database-outline" class="size-3.5" />
									Context fused
								</span>
								<span class="demo-trace__arrow">/</span>
								<span
									class:demo-trace__item--active={phase === 'streaming' || phase === 'complete'}
									class="demo-trace__item"
								>
									<MxIcon name="send1-outline" class="size-3.5" />
									SSE answer
								</span>
							</div>

							<div
								class="demo-message__content prose prose-sm max-w-none text-white/90 prose-invert prose-headings:font-semibold prose-headings:text-white prose-p:leading-relaxed prose-code:rounded prose-code:bg-white/10 prose-code:px-1.5 prose-code:py-0.5 prose-code:text-white/90 prose-code:before:content-none prose-code:after:content-none"
							>
								{#if message.content}
									<!-- eslint-disable-next-line svelte/no-at-html-tags -->
									{@html renderMarkdown(message.content, message.references, false)}
								{:else}
									<div class="demo-thinking">
										<span></span><span></span><span></span><em>Searching your documents...</em>
									</div>
								{/if}
							</div>

							{#if message.status === 'complete' && message.references?.length}
								<SourceReferences references={message.references} />
							{/if}
						</div>
					{/if}
				{/each}
			</div>

			<div class="demo-chat__input-area">
				<ChatInput
					bind:value={inputValue}
					bind:attachedFiles
					bind:selectedModel
					llmOptions={[FREE_MODEL]}
					placeholder="Ask a follow-up about your documents..."
					{isGenerating}
					transparent
					onsend={runDemo}
					onstop={stopDemo}
				/>
				<div class="demo-chat__foot">
					<span>Free Auto routes across the available model pool</span>
					<span>Try a different question</span>
				</div>
			</div>
		</div>
	</div>
</section>

<style>
	.demo-section {
		background: var(--color-white);
	}

	.demo-chat {
		position: relative;
		max-width: 920px;
		margin: 0 auto;
		overflow: hidden;
		background: #1f1e1d;
		border: 1px solid rgba(31, 30, 29, 0.86);
		border-radius: 18px;
		box-shadow: 0 24px 60px rgba(31, 30, 29, 0.16);
		color: #fafafa;
	}

	.demo-chat__head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 20px;
		padding: 18px 22px;
		border-bottom: 1px solid rgba(255, 255, 255, 0.1);
	}

	.demo-chat__identity,
	.demo-chat__status,
	.demo-message__trace,
	.demo-chat__foot {
		display: flex;
		align-items: center;
	}

	.demo-chat__identity {
		gap: 11px;
	}

	.demo-chat__mark {
		display: grid;
		width: 34px;
		height: 34px;
		place-items: center;
		border: 1px solid rgba(255, 255, 255, 0.16);
		border-radius: 10px;
		color: rgba(255, 255, 255, 0.72);
	}

	.demo-chat__title {
		font: 500 0.88rem/1.2 var(--font-interface);
		letter-spacing: 0.01em;
	}

	.demo-chat__subtitle,
	.demo-chat__status,
	.demo-chat__foot {
		color: rgba(255, 255, 255, 0.42);
		font: 500 0.66rem/1.2 var(--font-interface);
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}

	.demo-chat__subtitle {
		margin-top: 4px;
		font-size: 0.68rem;
		letter-spacing: 0;
		text-transform: none;
	}

	.demo-chat__status {
		gap: 8px;
		white-space: nowrap;
	}

	.demo-chat__status-dot {
		width: 7px;
		height: 7px;
		border-radius: 50%;
		background: #8f9189;
	}

	.demo-chat__status--active {
		color: #f07b51;
	}

	.demo-chat__status--active .demo-chat__status-dot {
		background: #f07b51;
		animation: demo-pulse 1.2s ease-in-out infinite;
	}

	.demo-chat__body {
		display: flex;
		min-height: 330px;
		max-height: 560px;
		flex-direction: column;
		gap: 24px;
		overflow-y: auto;
		padding: 28px clamp(18px, 6vw, 70px) 32px;
		background:
			radial-gradient(circle at 15% 0%, rgba(255, 255, 255, 0.035), transparent 32%), #1f1e1d;
	}

	.demo-message {
		display: flex;
		width: 100%;
	}

	.demo-message--user {
		justify-content: flex-end;
	}

	.demo-message__bubble {
		max-width: min(78%, 580px);
		padding: 12px 16px;
		border: 1px solid rgba(255, 255, 255, 0.14);
		border-radius: 16px;
		background: rgba(0, 0, 0, 0.26);
		color: rgba(255, 255, 255, 0.9);
		font: 400 0.9rem/1.55 var(--font-interface);
	}

	.demo-message--assistant {
		flex-direction: column;
		gap: 12px;
	}

	.demo-message__trace {
		gap: 8px;
		color: rgba(255, 255, 255, 0.35);
		font: 500 0.63rem/1 var(--font-interface);
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}

	.demo-trace__item {
		display: inline-flex;
		align-items: center;
		gap: 5px;
		transition: color 180ms ease;
	}

	.demo-trace__item--active {
		color: rgba(255, 255, 255, 0.72);
	}

	.demo-trace__arrow {
		color: rgba(255, 255, 255, 0.2);
	}

	.demo-message__content {
		min-height: 86px;
	}

	.demo-thinking {
		display: flex;
		align-items: center;
		gap: 5px;
		padding: 8px 0;
		color: rgba(255, 255, 255, 0.52);
		font: italic 500 0.78rem/1.2 var(--font-interface);
	}

	.demo-thinking span {
		width: 5px;
		height: 5px;
		border-radius: 50%;
		background: #f07b51;
		animation: demo-bounce 900ms ease-in-out infinite;
	}

	.demo-thinking span:nth-child(2) {
		animation-delay: 120ms;
	}

	.demo-thinking span:nth-child(3) {
		animation-delay: 240ms;
	}

	.demo-thinking em {
		margin-left: 4px;
	}

	.demo-chat__input-area {
		padding: 0 clamp(16px, 5vw, 48px) 18px;
		background: linear-gradient(to top, #1f1e1d 72%, transparent);
	}

	.demo-chat__foot {
		justify-content: space-between;
		gap: 12px;
		padding: 9px 8px 0;
		font-size: 0.6rem;
		letter-spacing: 0.03em;
		text-transform: none;
	}

	@keyframes demo-pulse {
		50% {
			opacity: 0.35;
		}
	}

	@keyframes demo-bounce {
		0%,
		100% {
			transform: translateY(0);
			opacity: 0.42;
		}
		50% {
			transform: translateY(-3px);
			opacity: 1;
		}
	}

	@media (max-width: 640px) {
		.demo-chat__head {
			align-items: flex-start;
			flex-direction: column;
			gap: 12px;
		}

		.demo-chat__status {
			padding-left: 45px;
		}

		.demo-chat__body {
			min-height: 360px;
			padding-inline: 16px;
		}

		.demo-message__bubble {
			max-width: 92%;
		}

		.demo-message__trace {
			flex-wrap: wrap;
			line-height: 1.5;
		}

		.demo-chat__foot {
			align-items: flex-start;
			flex-direction: column;
			gap: 5px;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.demo-chat__status--active .demo-chat__status-dot,
		.demo-thinking span {
			animation: none;
		}
	}
</style>
