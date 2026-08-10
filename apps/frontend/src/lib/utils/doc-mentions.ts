/**
 * Inline document mention tokens — `@[title](doc_id)` — embedded directly in
 * the chat question text. The question (with tokens) is what gets stored in
 * the database; the ids are parsed out on send to scope RAG retrieval to the
 * mentioned documents (main context).
 */

const MENTION_TOKEN_RE = /@\[([^\]]+)\]\(([^)\s]+)\)/g;

/** Builds the inline token for a mention. */
export function mentionToken(title: string, id: string): string {
	return `@[${title}](${id})`;
}

/** Unique document ids referenced by mention tokens, in order of appearance. */
export function parseMentionIds(text: string): string[] {
	const ids: string[] = [];
	const seen = new Set<string>();
	for (const match of text.matchAll(MENTION_TOKEN_RE)) {
		const id = match[2];
		if (!seen.has(id)) {
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
export function splitMentionSegments(text: string): MentionSegment[] {
	const segments: MentionSegment[] = [];
	let lastIndex = 0;
	for (const match of text.matchAll(MENTION_TOKEN_RE)) {
		const index = match.index ?? 0;
		if (index > lastIndex) {
			segments.push({ type: 'text', text: text.slice(lastIndex, index) });
		}
		segments.push({ type: 'mention', text: match[0], title: match[1], id: match[2] });
		lastIndex = index + match[0].length;
	}
	if (lastIndex < text.length) {
		segments.push({ type: 'text', text: text.slice(lastIndex) });
	}
	return segments;
}
