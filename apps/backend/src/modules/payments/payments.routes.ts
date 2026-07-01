import { createApp } from "../../config/hono.ts";
import { createRoute } from "@hono/zod-openapi";
import * as paymentsController from "./payments.controller.ts";
import { ErrorResponseSchema } from "../../shared/schemas/shared.schema.ts";
import * as PaymentsSchema from "./payments.schema.ts";

export const paymentsRoutes = createApp();

// 1. POST /checkout (Protected by Auth)
paymentsRoutes.openapi(
    createRoute({
        method: "post",
        path: "/checkout",
        tags: ["Payments"],
        summary: "Create a Stripe Checkout Session",
        description: "Creates a Stripe subscription session for the specified tier.",
        request: {
            body: {
                content: {
                    "application/json": {
                        schema: PaymentsSchema.CreateCheckoutBodySchema,
                    },
                },
                required: true,
            },
        },
        responses: {
            201: {
                description: "Checkout session created",
                content: {
                    "application/json": {
                        schema: PaymentsSchema.CheckoutResponseSchema,
                    },
                },
            },
            400: {
                description: "Validation error",
                content: { "application/json": { schema: ErrorResponseSchema } },
            },
            404: {
                description: "Tenant not found",
                content: { "application/json": { schema: ErrorResponseSchema } },
            },
            502: {
                description: "Payment Gateway Error",
                content: { "application/json": { schema: ErrorResponseSchema } },
            },
        },
    }),
    paymentsController.handleCheckout as any,
);

// 2. POST /webhook (Public, Protected by Webhook Secret)
paymentsRoutes.openapi(
    createRoute({
        method: "post",
        path: "/webhook",
        tags: ["Payments"],
        summary: "Stripe Webhook Listener",
        description: "Listens for Stripe events. Must provide a valid stripe-signature header.",
        request: {
            // Strip validation since we read raw body for crypto signatures
        },
        responses: {
            200: {
                description: "Webhook processed or ignored securely",
                // We use standard SuccessResponse schema which usually has { message: string } or loosely defined
                // But let's just make it generic or use our custom return.
                // For simplicity, we just use {} or a simple object, Xendit doesn't care about the response body, only the 2xx status code.
            },
            400: {
                description: "Validation Error",
                content: { "application/json": { schema: ErrorResponseSchema } },
            },
            401: {
                description: "Unauthorized Token",
                content: { "application/json": { schema: ErrorResponseSchema } },
            },
        },
    }),
    paymentsController.handleWebhook,
);

// 3. POST /portal (Protected by Auth)
paymentsRoutes.openapi(
    createRoute({
        method: "post",
        path: "/portal",
        tags: ["Payments"],
        summary: "Create Stripe Customer Portal Session",
        description: "Creates a session for the user to manage their subscription (cancel, update, etc).",
        request: {
            // Empty body
        },
        responses: {
            201: {
                description: "Portal session created",
                content: {
                    "application/json": {
                        schema: PaymentsSchema.PortalResponseSchema,
                    },
                },
            },
            400: {
                description: "No active Stripe customer found",
                content: { "application/json": { schema: ErrorResponseSchema } },
            },
            502: {
                description: "Stripe error",
                content: { "application/json": { schema: ErrorResponseSchema } },
            },
        },
    }),
    paymentsController.handlePortal as any,
);
