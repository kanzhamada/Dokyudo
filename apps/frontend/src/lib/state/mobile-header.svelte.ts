export class MobileHeaderState {
	type = $state<'default' | 'error' | 'success' | 'info'>('default');
	title = $state<string | null>(null);
	message = $state<string | null>(null);
	hidden = $state(false);
	private timeoutId: ReturnType<typeof setTimeout> | null = null;

	setHidden(value: boolean) {
		this.hidden = value;
	}

	showError(title: string, msg: string = '', duration = 4000) {
		this.type = 'error';
		if (msg) {
			this.title = title;
			this.message = msg;
		} else {
			this.title = title;
			this.message = null;
		}

		if (this.timeoutId) {
			clearTimeout(this.timeoutId);
		}

		this.timeoutId = setTimeout(() => {
			this.reset();
		}, duration);
	}

	showSuccess(title: string, msg: string = '', duration = 4000) {
		this.type = 'success';
		this.title = title;
		this.message = msg || null;

		if (this.timeoutId) {
			clearTimeout(this.timeoutId);
		}

		this.timeoutId = setTimeout(() => {
			this.reset();
		}, duration);
	}

	showInfo(title: string, msg: string = '', duration = 4000) {
		this.type = 'info';
		this.title = title;
		this.message = msg || null;

		if (this.timeoutId) {
			clearTimeout(this.timeoutId);
		}

		this.timeoutId = setTimeout(() => {
			this.reset();
		}, duration);
	}

	reset() {
		this.type = 'default';
		this.title = null;
		this.message = null;
		if (this.timeoutId) {
			clearTimeout(this.timeoutId);
			this.timeoutId = null;
		}
	}
}

// Export a singleton instance to be used across the app
export const mobileHeaderState = new MobileHeaderState();
