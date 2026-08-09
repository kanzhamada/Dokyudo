import { marked } from 'marked';

/**
 * Shared markdown rendering for chat messages — used by both the private
 * chat page and the public share page. Citation tags ([Doc N: Page X]) are
 * transformed into chip spans.
 */

/** Minimal reference shape accepted by the citation transformer. */
export interface CitationRef {
	index?: number;
	id?: string;
	name?: string;
	title?: string;
	snippet?: string | null;
	pages?: number[];
	page?: string | number;
}

const customRenderer = new marked.Renderer();
customRenderer.code = ({ text, lang }: { text: string; lang?: string }) => {
	const cleanLang = (lang || '').trim().toLowerCase();
	const encodedCode = encodeURIComponent(text);
	return `<div class="code-block-embed my-3" data-code="${encodedCode}" data-lang="${cleanLang}"></div>`;
};

marked.setOptions({
	gfm: true,
	breaks: true,
	renderer: customRenderer
});

export function formatPageNumbers(raw: string): string {
	if (!raw) return '';
	const expanded = raw.replace(/(\d+)\s*-\s*(\d+)/g, (_m, startStr, endStr) => {
		const start = Number(startStr);
		const end = Number(endStr);
		if (end > start && end - start < 30) {
			const arr: number[] = [];
			for (let i = start; i <= end; i++) {
				arr.push(i);
			}
			return arr.join(', ');
		}
		return `${startStr}, ${endStr}`;
	});

	const matches = expanded.match(/\d+/g);
	if (!matches || matches.length === 0) return raw.trim();

	const uniqueNums = Array.from(new Set(matches.map(Number))).sort((a, b) => a - b);
	return uniqueNums.join(', ');
}

function escapeHtml(value: string): string {
	return value
		.replace(/&/g, '&amp;')
		.replace(/"/g, '&quot;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;');
}

function transformCitationTags(
	html: string,
	references?: CitationRef[] | null,
	interactive = true
): string {
	if (!html) return '';

	const isNegativeAnswer =
		/(Mohon maaf|tidak mengandung informasi|tidak ditemukan|tidak ada informasi|does not contain|cannot answer|no information available)/i.test(
			html
		);
	if (isNegativeAnswer) {
		return html.replace(/\s*\[Doc [^\]]+\]/gi, '');
	}

	const cleanHtml = html.replace(/\[Doc \d+:[^\]]*;[^\]]*\]/gi, '');

	const result = cleanHtml.replace(
		/\[Doc (\d+)(?::\s*(?:Hlm\.|Pages?|Page)?\s*([^\]]+))?\]/gi,
		(_match, docIdxStr, rawPageInfo) => {
			const docIdx = Number(docIdxStr);
			let docDisplayName = `Doc ${docIdx}`;
			let docId = '';
			let docFullName = '';
			let snippet = '';

			if (references && references.length > 0) {
				const refDoc =
					references.find((r) => r.index === docIdx || r.id === docIdxStr) ??
					references[docIdx - 1];
				if (refDoc && (refDoc.name || refDoc.title)) {
					docId = refDoc.id ?? '';
					docFullName = refDoc.name || refDoc.title || '';
					snippet = refDoc.snippet ?? '';
					const cleanName = docFullName.replace(/\.[^/.]+$/, '');
					docDisplayName = cleanName.length > 22 ? cleanName.slice(0, 22) + '...' : cleanName;
				}
			}

			const pageFormatted = rawPageInfo ? formatPageNumbers(rawPageInfo) : '';
			const label = pageFormatted
				? `${escapeHtml(docDisplayName)} <span class="text-white/40 font-normal">• ${escapeHtml(pageFormatted)}</span>`
				: escapeHtml(docDisplayName);

			const dataAttrs = interactive
				? ` data-doc-id="${escapeHtml(docId)}" data-doc-title="${escapeHtml(docFullName)}" data-snippet="${escapeHtml(snippet)}" data-pages="${escapeHtml(pageFormatted)}"`
				: '';
			const chipClass = interactive
				? 'relative inline-flex cursor-pointer items-center align-middle gap-1 rounded-full border border-white/15 bg-[#2B2A29] px-2.5 py-0.5 text-[11px] font-medium text-white/80 transition-colors hover:border-white/30 hover:bg-[#383736] hover:text-white mx-0.5 my-0.5 whitespace-nowrap'
				: 'relative inline-flex items-center align-middle gap-1 rounded-full border border-white/15 bg-[#2B2A29] px-2.5 py-0.5 text-[11px] font-medium text-white/80 mx-0.5 my-0.5 whitespace-nowrap';

			return `<span${dataAttrs} class="${chipClass}">${label}</span>`;
		}
	);

	return result.replace(/\s*\[Doc [^\]]+\]/gi, '');
}

/**
 * Renders markdown with GFM + code-block embeds + citation chips.
 *
 * @param interactive  true = chips carry doc metadata + hover/click affordance
 *                     (private chat page, mounts CitationTooltip on them);
 *                     false = static chips (public share page, no doc access)
 */
export function renderMarkdown(
	text: string,
	references?: CitationRef[] | null,
	interactive = true
): string {
	if (!text) return '';
	try {
		const rawHtml = marked.parse(text) as string;
		return transformCitationTags(rawHtml, references, interactive);
	} catch {
		return text;
	}
}
