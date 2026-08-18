export class MobileHeaderState {
	type = $state<'default' | 'error' | 'success' | 'info'>('default');
	title = $state<string | null>(null);
	message = $state<string | null>(null);
	private timeoutId: ReturnType<typeof setTimeout> | null = null;

	showError(msg: string, duration = 4000) {
		this.type = 'error';
		this.title = 'Error';
		this.message = msg;

		if (this.timeoutId) {
			clearTimeout(this.timeoutId);
		}

		this.timeoutId = setTimeout(() => {
			this.type = 'default';
			this.title = null;
			this.message = null;
		}, duration);
	}

	showSuccess(title: string, msg: string, duration = 4000) {
		this.type = 'success';
		this.title = title;
		this.message = msg;

		if (this.timeoutId) {
			clearTimeout(this.timeoutId);
		}

		this.timeoutId = setTimeout(() => {
			this.type = 'default';
			this.title = null;
			this.message = null;
		}, duration);
	}

	showInfo(title: string, msg: string, duration = 4000) {
		this.type = 'info';
		this.title = title;
		this.message = msg;

		if (this.timeoutId) {
			clearTimeout(this.timeoutId);
		}

		this.timeoutId = setTimeout(() => {
			this.type = 'default';
			this.title = null;
			this.message = null;
		}, duration);
	}
}

// Export a singleton instance to be used across the app
export const mobileHeaderState = new MobileHeaderState();
