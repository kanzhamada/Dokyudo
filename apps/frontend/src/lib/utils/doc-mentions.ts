import { documentsStore } from '$lib/state/documents.store.svelte';
import type { DocumentItem } from '$lib/api/documents';

/**
 * Inline document mention tokens — `@[title](doc_id)` or `@[title]`.
 * In the DB and backend payload, `@[title](doc_id)` is stored verbatim.
 * In the input editor, `@[title]` is used to keep badge width matching caret position.
 *
 * Only the first MAX_DOCUMENT_MENTIONS tokens are treated as mentions — the
 * 6th+ token is plain text: not rendered as a badge, not scoped to a document,
 * not stripped from the prompt, and it counts toward the 690-character limit.
 */
export const MAX_DOCUMENT_MENTIONS = 5;

const MENTION_TOKEN_RE = /@\[([^\]]+)\](?:\(([^)\s]+)\))?/g;

/**
 * Builds the inline token for a mention. Titles are sanitized so the token
 * always round-trips through the parser.
 */
export function mentionToken(title: string, id?: string): string {
	const safeTitle = title.replace(/]/g, '');
	return id ? `@[${safeTitle}](${id})` : `@[${safeTitle}]`;
}

interface TokenMatch {
	title: string;
	id?: string;
	start: number;
	end: number;
}

/** All token matches in order — only the first MAX_DOCUMENT_MENTIONS are mentions. */
function tokenMatches(text: string): TokenMatch[] {
	const matches: TokenMatch[] = [];
	for (const m of text.matchAll(MENTION_TOKEN_RE)) {
		const start = m.index ?? 0;
		matches.push({ title: m[1], id: m[2], start, end: start + m[0].length });
	}
	return matches;
}

function resolveId(match: TokenMatch, list: DocumentItem[] | undefined): string | undefined {
	if (match.id) return match.id;
	if (!list) return undefined;
	const found = list.find(
		(d) => d.title === match.title || d.title.replace(/]/g, '') === match.title
	);
	return found?.id;
}

/** Unique document ids of the first MAX_DOCUMENT_MENTIONS tokens, in order of appearance. */
export function parseMentionIds(text: string, docsList?: DocumentItem[]): string[] {
	const ids: string[] = [];
	const seen = new Set<string>();
	const list = docsList ?? documentsStore.list;
	for (const match of tokenMatches(text)) {
		if (ids.length >= MAX_DOCUMENT_MENTIONS) break;
		const id = resolveId(match, list);
		if (id && !seen.has(id)) {
			seen.add(id);
			ids.push(id);
		}
	}
	return ids;
}

export interface MentionSegment {
	type: 'text' | 'mention';
	text: string;
	title?: string;
	id?: string;
}

/**
 * Splits text into plain-text and mention-token segments for rendering.
 * Only the first MAX_DOCUMENT_MENTIONS tokens become mention segments — any
 * token beyond the limit stays inside a plain-text segment.
 */
export function splitMentionSegments(text: string, docsList?: DocumentItem[]): MentionSegment[] {
	const segments: MentionSegment[] = [];
	const list = docsList ?? documentsStore.list;
	let lastIndex = 0;
	let mentionCount = 0;
	for (const match of tokenMatches(text)) {
		if (mentionCount >= MAX_DOCUMENT_MENTIONS) break;
		if (match.start > lastIndex) {
			segments.push({ type: 'text', text: text.slice(lastIndex, match.start) });
		}
		segments.push({
			type: 'mention',
			text: text.slice(match.start, match.end),
			title: match.title,
			id: resolveId(match, list)
		});
		lastIndex = match.end;
		mentionCount++;
	}
	if (lastIndex < text.length) {
		segments.push({ type: 'text', text: text.slice(lastIndex) });
	}
	return segments;
}

/** Removes only the first MAX_DOCUMENT_MENTIONS mention tokens from the text. */
export function stripMentionTokens(text: string): string {
	const matches = tokenMatches(text).slice(0, MAX_DOCUMENT_MENTIONS);
	if (matches.length === 0) return text;
	let result = '';
	let last = 0;
	for (const m of matches) {
		result += text.slice(last, m.start);
		last = m.end;
	}
	result += text.slice(last);
	return result;
}

/** Character count excluding the first MAX_DOCUMENT_MENTIONS mention tokens. */
export function mentionStrippedLength(text: string): number {
	return stripMentionTokens(text).length;
}

/**
 * Converts clean `@[title]` tokens to canonical `@[title](id)` for backend
 * storage — only within the first MAX_DOCUMENT_MENTIONS tokens; anything
 * beyond the limit is left untouched (plain text).
 */
export function formatMentionsForPayload(text: string, docsList?: DocumentItem[]): string {
	const list = docsList ?? documentsStore.list;
	const matches = tokenMatches(text).slice(0, MAX_DOCUMENT_MENTIONS);
	if (matches.length === 0) return text;
	let result = '';
	let last = 0;
	for (const m of matches) {
		result += text.slice(last, m.start);
		const id = resolveId(m, list);
		result += id && !m.id ? `@[${m.title}](${id})` : text.slice(m.start, m.end);
		last = m.end;
	}
	result += text.slice(last);
	return result;
}
