import type { ConversationItem } from '$lib/types/rag.types';

function createConversationsStore() {
	let items = $state<ConversationItem[]>([]);

	return {
		get list() {
			return items;
		},
		set(newList: ConversationItem[]) {
			items = newList;
		},
		addOrUpdate(id: string, title?: string) {
			const index = items.findIndex((c) => c.id === id);
			const now = new Date().toISOString();
			if (index !== -1) {
				const existing = items[index];
				const updated: ConversationItem = {
					...existing,
					title: title || existing.title,
					updatedAt: now
				};
				items = [updated, ...items.filter((_, i) => i !== index)];
			} else {
				items = [
					{ id, title: title || 'New Conversation', createdAt: now, updatedAt: now },
					...items
				];
			}
		},
		remove(id: string) {
			items = items.filter((conversation) => conversation.id !== id);
		}
	};
}

export const conversationsStore = createConversationsStore();
