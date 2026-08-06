/**
 * A document referenced by an assistant answer, together with the pages
 * cited in the conversation.
 */
export interface DocReference {
	id: string;
	index?: number;
	name: string;
	page?: number;
	pages?: number[];
	snippet?: string;
}

/**
 * Merges per-message reference lists into a single de-duplicated list keyed
 * by document id, unioning cited pages across turns (sorted ascending).
 * `null`/`undefined` lists are skipped. The first occurrence of a document
 * wins for all fields except `pages`, which are accumulated.
 */
export function mergeConversationReferences(
	referenceLists: (DocReference[] | null | undefined)[]
): DocReference[] {
	const merged = new Map<string, DocReference>();

	for (const references of referenceLists) {
		if (!references) continue;

		for (const reference of references) {
			const existing = merged.get(reference.id);
			if (!existing) {
				merged.set(reference.id, { ...reference, pages: [...(reference.pages ?? [])] });
				continue;
			}

			existing.pages = Array.from(
				new Set([...(existing.pages ?? []), ...(reference.pages ?? [])])
			).sort((a, b) => a - b);
		}
	}

	return Array.from(merged.values());
}
