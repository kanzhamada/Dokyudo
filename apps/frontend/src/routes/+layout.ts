import { suppressConsole } from '$lib/utils/logger';

// Silence console.debug/log/info in production builds before any page renders.
suppressConsole();
