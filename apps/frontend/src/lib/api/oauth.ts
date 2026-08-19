import { PUBLIC_API_URL } from '$env/static/public';

/** Initiates the Google OAuth flow via a full-page redirect. */
export function initiateGoogleOAuth(): void {
	const url = `${PUBLIC_API_URL}/api/oauth/google`;
	console.log(`[OAuthDebug] Initiating Google OAuth -> ${url}`);
	window.location.href = url;
}

/** Initiates the GitHub OAuth flow via a full-page redirect. */
export function initiateGithubOAuth(): void {
	const url = `${PUBLIC_API_URL}/api/oauth/github`;
	console.log(`[OAuthDebug] Initiating GitHub OAuth -> ${url}`);
	window.location.href = url;
}
