import { createApp } from "../config/hono.ts";
import { authRoutes } from "../modules/auth/auth.routes.ts";
import { pocRoutes } from "../modules/poc/poc.routes.ts";

const router = createApp();

// Mount all feature routes here
router.route("/auth", authRoutes);
router.route("/poc", pocRoutes);

export default router;
