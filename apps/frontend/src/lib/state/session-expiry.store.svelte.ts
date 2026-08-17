function createSessionExpiryStore() {
	let expired = $state(false);

	return {
		get value() {
			return expired;
		},
		trigger() {
			expired = true;
		},
		clear() {
			expired = false;
		}
	};
}

export const sessionExpiryStore = createSessionExpiryStore();
