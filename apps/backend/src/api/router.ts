import { createApp } from "../config/hono.ts";
import { authRoutes } from "../modules/auth/auth.routes.ts";

const router = createApp();

// Mount all feature routes here
router.route("/auth", authRoutes);

export default router;
