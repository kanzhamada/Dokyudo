import katex from 'katex';

/**
 * Renders LaTeX math segments ($...$ inline, $$...$$ display) to HTML with
 * KaTeX. Non-math segments are returned raw so the surrounding markdown is
 * still parsed by `marked` afterwards.
 *
 * Safety: KaTeX escapes everything it renders (it is designed for untrusted
 * input), so the math segments cannot smuggle HTML. Text inside fenced code
 * blocks is never scanned for `$`, so shell/Python snippets stay untouched.
 */

const MAX_INLINE_LEN = 500;

function renderTex(tex: string, displayMode: boolean): string {
	try {
		return katex.renderToString(tex, {
			displayMode,
			throwOnError: false
		});
	} catch {
		// Last-resort fallback: show the raw tex (escaped) instead of breaking
		// the whole message. throwOnError:false already covers most failures.
		return tex.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
	}
}

function renderMathInSegment(segment: string): string {
	if (!segment.includes('$')) return segment;

	let out = '';
	let i = 0;
	while (i < segment.length) {
		const start = segment.indexOf('$', i);
		if (start === -1) {
			out += segment.slice(i);
			break;
		}
		out += segment.slice(i, start);

		// Display math: $$ ... $$
		if (segment[start + 1] === '$') {
			const end = segment.indexOf('$$', start + 2);
			if (end === -1) {
				out += segment.slice(start);
				break;
			}
			out += renderTex(segment.slice(start + 2, end), true);
			i = end + 2;
			continue;
		}

		// Inline math: $ ... $ — refuse to start when followed by whitespace
		// (avoids treating things like "$ 5.000" or "Rp $ ..." as math), and
		// refuse to close when the '$' is preceded by whitespace or followed
		// by a digit (price-range style "$5–$10").
		if (/\s/.test(segment[start + 1] ?? '')) {
			out += '$';
			i = start + 1;
			continue;
		}

		let end = -1;
		const scanLimit = Math.min(segment.length, start + 1 + MAX_INLINE_LEN);
		for (let j = start + 1; j < scanLimit; j++) {
			if (
				segment[j] === '$' &&
				!/\s/.test(segment[j - 1] ?? '') &&
				!/\d/.test(segment[j + 1] ?? '')
			) {
				end = j;
				break;
			}
		}

		if (end === -1) {
			out += segment.slice(start);
			break;
		}

		const tex = segment.slice(start + 1, end);
		if (tex.trim() === '') {
			out += '$';
			i = start + 1;
			continue;
		}

		out += renderTex(tex, false);
		i = end + 1;
	}
	return out;
}

/**
 * Renders all LaTeX math in a markdown string to KaTeX HTML. Fenced code
 * blocks (``` ... ```) are skipped entirely.
 */
export function renderMathHtml(input: string): string {
	if (!input || !input.includes('$')) return input;

	const segments = input.split('```');
	let out = '';
	for (let idx = 0; idx < segments.length; idx++) {
		// Odd segments sit inside a fenced code block.
		out += idx % 2 === 1 ? segments[idx] : renderMathInSegment(segments[idx]);
	}
	return out;
}
