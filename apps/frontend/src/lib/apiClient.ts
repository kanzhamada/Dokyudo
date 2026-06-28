import initWasm, { generate_puzzle_token } from './wasm/puzzle_wasm.js';

let isWasmLoaded = false;

export async function dokyudoFetch(url: string | URL | globalThis.Request, options: RequestInit = {}): Promise<Response> {
    if (!isWasmLoaded) {
        try {
            await initWasm();
            isWasmLoaded = true;
            console.log("[Dokyudo Security] WebAssembly Anti-Bot Module Loaded.");
        } catch (e) {
            console.error("[Dokyudo Security] Failed to load WASM module:", e);
        }
    }

    const puzzleToken = generate_puzzle_token("BROWSER", "A");

    const headers = new Headers(options.headers || {});
    headers.set("X-Dokyudo-Puzzle", puzzleToken);

    return fetch(url, {
        ...options,
        headers
    });
}
