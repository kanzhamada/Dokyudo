import { createApp } from "../config/hono.ts";
import { authRoutes } from "../modules/auth/auth.routes.ts";
import { authMiddleware } from "../shared/middlewares/auth.middleware.ts";
// import { pocRoutes } from "../modules/poc/poc_routes.ts";

const router = createApp();

// Apply auth middleware to all API routes EXCEPT the auth module
router.use("*", async (c, next) => {
    if (c.req.path.startsWith("/api/auth")) {
        return await next();
    }
    return await authMiddleware(c, next);
});

// Mount all feature routes here
router.route("/auth", authRoutes);
// router.route("/poc", pocRoutes);

export default router;
