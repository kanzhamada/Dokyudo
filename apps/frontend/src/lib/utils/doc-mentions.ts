import { documentsStore } from '$lib/state/documents.store.svelte';
import type { DocumentItem } from '$lib/api/documents';

/**
 * Inline document mention tokens — `@[title](doc_id)` or `@[title]`.
 * In the DB and backend payload, `@[title](doc_id)` is stored verbatim.
 * In the input editor, `@[title]` is used to keep badge width matching caret position.
 */
const MENTION_TOKEN_RE = /@\[([^\]]+)\](?:\(([^)\s]+)\))?/g;

/**
 * Builds the inline token for a mention. Titles are sanitized so the token
 * always round-trips through the parser.
 */
export function mentionToken(title: string, id?: string): string {
	const safeTitle = title.replace(/]/g, '');
	return id ? `@[${safeTitle}](${id})` : `@[${safeTitle}]`;
}

/** Unique document ids referenced by mention tokens, in order of appearance. */
export function parseMentionIds(text: string, docsList?: DocumentItem[]): string[] {
	const ids: string[] = [];
	const seen = new Set<string>();
	const list = docsList ?? documentsStore.list;
	for (const match of text.matchAll(MENTION_TOKEN_RE)) {
		const title = match[1];
		let id = match[2];
		if (!id && list) {
			const found = list.find((d) => d.title === title || d.title.replace(/]/g, '') === title);
			if (found) id = found.id;
		}
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

/** Splits text into plain-text and mention-token segments for rendering. */
export function splitMentionSegments(text: string, docsList?: DocumentItem[]): MentionSegment[] {
	const segments: MentionSegment[] = [];
	let lastIndex = 0;
	const list = docsList ?? documentsStore.list;
	for (const match of text.matchAll(MENTION_TOKEN_RE)) {
		const index = match.index ?? 0;
		if (index > lastIndex) {
			segments.push({ type: 'text', text: text.slice(lastIndex, index) });
		}
		const title = match[1];
		let id = match[2];
		if (!id && list) {
			const found = list.find((d) => d.title === title || d.title.replace(/]/g, '') === title);
			if (found) id = found.id;
		}
		segments.push({ type: 'mention', text: match[0], title, id });
		lastIndex = index + match[0].length;
	}
	if (lastIndex < text.length) {
		segments.push({ type: 'text', text: text.slice(lastIndex) });
	}
	return segments;
}

/** Converts any clean `@[title]` tokens in `text` to canonical `@[title](id)` for backend storage. */
export function formatMentionsForPayload(text: string, docsList?: DocumentItem[]): string {
	const list = docsList ?? documentsStore.list;
	return text.replace(MENTION_TOKEN_RE, (fullMatch, title, id) => {
		if (id) return fullMatch;
		if (list) {
			const found = list.find((d) => d.title === title || d.title.replace(/]/g, '') === title);
			if (found) return `@[${title}](${found.id})`;
		}
		return fullMatch;
	});
}
