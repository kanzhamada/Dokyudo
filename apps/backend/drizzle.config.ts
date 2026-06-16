import { defineConfig } from "drizzle-kit";
import "npm:dotenv/config";

export default defineConfig({
    dialect: "postgresql",
    schema: "./src/models/schema.ts",
    out: "./supabase/migrations",
    dbCredentials: {
        url: process.env.DATABASE_URL!,
    },
});
