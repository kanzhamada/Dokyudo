import { createApp } from "../config/hono.ts";
import { authRoutes } from "../modules/auth/mod.ts";
import { authMiddleware } from "../shared/middlewares/auth.middleware.ts";
import { documentsRoutes } from "../modules/documents/mod.ts";
import { searchRoutes } from "../modules/search/mod.ts";
import { ragRoutes } from "../modules/rag/mod.ts";
import { paymentsRoutes } from "../modules/payments/mod.ts";
import { keysRoutes } from "../modules/keys/mod.ts";
import { activitiesRoutes } from "../modules/activities/mod.ts";
import { meRoutes } from "../modules/me/mod.ts";
// import { pocRoutes } from "../modules/poc/poc_routes.ts";

const router = createApp();

// Apply auth middleware to all API routes EXCEPT the auth module
router.use("*", async (c, next) => {
    // Bypass auth middleware for public endpoints
    if (c.req.path.startsWith("/api/auth") || c.req.path === "/api/payments/webhook") {
        return await next();
    }
    return await authMiddleware(c, next);
});

router.route("/auth", authRoutes);
router.route("/me", meRoutes);
router.route("/documents", documentsRoutes);
router.route("/search", searchRoutes);
router.route("/rag", ragRoutes);
router.route("/payments", paymentsRoutes);
router.route("/keys", keysRoutes);
router.route("/activities", activitiesRoutes);
// router.route("/poc", pocRoutes);

export default router;
