import { Index } from "npm:@upstash/vector";
import { getEnv } from "./env.ts";

export const vectorIndex = new Index({
    url: getEnv("UPSTASH_VECTOR_REST_URL"),
    token: getEnv("UPSTASH_VECTOR_REST_TOKEN"),
});
