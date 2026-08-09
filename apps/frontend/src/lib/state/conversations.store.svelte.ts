import type { ConversationItem } from '$lib/types/rag.types';

function sortItems(list: ConversationItem[]): ConversationItem[] {
	return [...list].sort((a, b) => {
		if (a.isPinned !== b.isPinned) {
			return b.isPinned ? 1 : -1;
		}
		return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
	});
}

function createConversationsStore() {
	let items = $state<ConversationItem[]>([]);

	return {
		get list() {
			return items;
		},
		set(newList: ConversationItem[]) {
			items = sortItems(newList);
		},
		addOrUpdate(id: string, title?: string, isPinned?: boolean, hasActiveShare?: boolean) {
			const index = items.findIndex((c) => c.id === id);
			const now = new Date().toISOString();
			if (index !== -1) {
				const existing = items[index];
				const updated: ConversationItem = {
					...existing,
					title: title !== undefined ? title : existing.title,
					isPinned: isPinned !== undefined ? isPinned : existing.isPinned,
					hasActiveShare: hasActiveShare !== undefined ? hasActiveShare : existing.hasActiveShare
				};
				items = sortItems([updated, ...items.filter((_, i) => i !== index)]);
			} else {
				items = sortItems([
					{
						id,
						title: title || 'New Conversation',
						isPinned: isPinned ?? false,
						hasActiveShare: hasActiveShare ?? false,
						createdAt: now,
						updatedAt: now
					},
					...items
				]);
			}
		},
		togglePin(id: string, isPinned: boolean) {
			items = sortItems(items.map((c) => (c.id === id ? { ...c, isPinned } : c)));
		},
		setHasActiveShare(id: string, hasActiveShare: boolean) {
			items = items.map((c) => (c.id === id ? { ...c, hasActiveShare } : c));
		},
		remove(id: string) {
			items = items.filter((conversation) => conversation.id !== id);
		}
	};
}

export const conversationsStore = createConversationsStore();
