export class MobileHeaderState {
	type = $state<'default' | 'error'>('default');
	message = $state<string | null>(null);
	private timeoutId: ReturnType<typeof setTimeout> | null = null;

	showError(msg: string, duration = 4000) {
		this.type = 'error';
		this.message = msg;

		if (this.timeoutId) {
			clearTimeout(this.timeoutId);
		}

		this.timeoutId = setTimeout(() => {
			this.type = 'default';
			this.message = null;
		}, duration);
	}
}

// Export a singleton instance to be used across the app
export const mobileHeaderState = new MobileHeaderState();
