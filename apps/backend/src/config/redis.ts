import { Redis } from "@upstash/redis";
import { getEnv } from "./env.ts";

export const redis = new Redis({
    url: getEnv("UPSTASH_REDIS_REST_URL"),
    token: getEnv("UPSTASH_REDIS_REST_TOKEN"),
});
