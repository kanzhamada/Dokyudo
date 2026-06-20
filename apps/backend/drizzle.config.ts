import { defineConfig } from "drizzle-kit";


export default defineConfig({
    dialect: "postgresql",
    schema: "./src/shared/models/db.model.ts",
    out: "./drizzle/migrations",
    dbCredentials: {
        url: process.env.DATABASE_URL!,
    },
});
