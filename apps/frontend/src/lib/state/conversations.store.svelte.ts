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
		addOrUpdate(id: string, title: string) {
			const index = items.findIndex((c) => c.id === id);
			const now = new Date().toISOString();
			if (index !== -1) {
				items[index] = {
					...items[index],
					title,
					updatedAt: now
				};
			} else {
				items = [
					{ id, title, createdAt: now, updatedAt: now },
					...items
				];
			}
		}
	};
}

export const conversationsStore = createConversationsStore();
