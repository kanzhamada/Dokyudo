export type AccountPanelTab = 'settings' | 'billing' | 'shared-links' | 'byok';

/**
 * Shared state for the account panel dialog. Lives outside the component tree so
 * any page (e.g. /app/chat) can open the dialog with a specific tab active.
 * `byokSavedAt` bumps every time a BYOK key is saved/reset so callers can refresh
 * their model lists without holding a callback.
 */
export const accountPanel = $state<{
	open: boolean;
	tab: AccountPanelTab;
	byokSavedAt: number;
}>({
	open: false,
	tab: 'settings',
	byokSavedAt: 0
});

export function openAccountPanel(tab: AccountPanelTab = 'settings') {
	accountPanel.open = true;
	accountPanel.tab = tab;
}

export function closeAccountPanel() {
	accountPanel.open = false;
}

export function markByokSaved() {
	accountPanel.byokSavedAt = Date.now();
}
