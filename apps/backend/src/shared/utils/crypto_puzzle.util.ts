export type AgentType = "BROWSER" | "NON_BROWSER";

export function determineAgentType(userAgent: string | undefined): AgentType {
    if (!userAgent) return "NON_BROWSER";
    const ua = userAgent.toLowerCase();
    
    if (ua.includes("mozilla/5.0") || ua.includes("chrome") || ua.includes("safari")) {
        return "BROWSER";
    }
    return "NON_BROWSER";
}

export function validatePuzzleToken(token: string, agent: AgentType): boolean {
    if (!token || token.length !== 52) return false;
    if (!/^[a-zA-Z0-9]{52}$/.test(token)) return false;

    const counts: Record<string, number> = {};
    for (const char of token.toUpperCase()) {
        counts[char] = (counts[char] || 0) + 1;
    }

    const checkRequirement = (base: Record<string, number>, option: Record<string, number>): boolean => {
        const required: Record<string, number> = { ...base };
        for (const [char, count] of Object.entries(option)) {
            required[char] = (required[char] || 0) + count;
        }

        for (const [char, minCount] of Object.entries(required)) {
            if ((counts[char] || 0) < minCount) return false;
        }
        return true;
    };

    if (agent === "BROWSER") {
        const base = { K: 2, I: 2, N: 1, S: 1, Y: 2, J: 1, H: 1, O: 1, '2': 1, '1': 2, '3': 1 };
        const optA = { A: 1, N: 3, T: 1, O: 1, I: 1 };
        const optB = { P: 1, A: 1, R: 1, K: 1 };
        return checkRequirement(base, optA) || checkRequirement(base, optB);
    } else {
        const base = { A: 2, N: 3, T: 1, O: 1, I: 1, P: 1, R: 1, K: 1, '3': 1, '1': 2, '2': 1 };
        const optA = { K: 2, I: 1, N: 1, S: 1, Y: 1 };
        const optB = { J: 1, I: 1, H: 1, Y: 1, O: 1 };
        return checkRequirement(base, optA) || checkRequirement(base, optB);
    }
}
