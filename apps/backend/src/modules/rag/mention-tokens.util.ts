/**
 * Inline document mention tokens — `@[title](doc_id)` — embedded in the
 * question text. Only the first MAX_DOCUMENT_MENTIONS tokens are treated as
 * mentions: they scope retrieval, are stripped from LLM prompts, and are NOT
 * counted toward the 690-character limit. Any token beyond the limit is plain
 * text — kept in prompts, counted as characters, not scoped.
 *
 * The backend only recognizes the canonical id-carrying form (`@[title](id)`);
 * the frontend canonicalizes its mentions before sending. An id-less
 * `@[title]` in the payload is plain text.
 */
export const MAX_DOCUMENT_MENTIONS = 5;

const MENTION_TOKEN_RE = /@\[([^\]]+)\]\(([^)\s]+)\)/g;

/** Ids of the first MAX_DOCUMENT_MENTIONS mention tokens, in order, deduped. */
export function mentionTokenIds(text: string): string[] {
    const ids: string[] = [];
    const seen = new Set<string>();
    for (const m of text.matchAll(MENTION_TOKEN_RE)) {
        if (ids.length >= MAX_DOCUMENT_MENTIONS) break;
        const id = m[2];
        if (!seen.has(id)) {
            seen.add(id);
            ids.push(id);
        }
    }
    return ids;
}

/** Removes only the first MAX_DOCUMENT_MENTIONS mention tokens. */
export function stripMentionTokens(text: string): string {
    const matches: { start: number; end: number }[] = [];
    for (const m of text.matchAll(MENTION_TOKEN_RE)) {
        if (matches.length >= MAX_DOCUMENT_MENTIONS) break;
        const start = m.index ?? 0;
        matches.push({ start, end: start + m[0].length });
    }
    if (matches.length === 0) return text;
    let result = "";
    let last = 0;
    for (const m of matches) {
        result += text.slice(last, m.start);
        last = m.end;
    }
    result += text.slice(last);
    return result;
}
