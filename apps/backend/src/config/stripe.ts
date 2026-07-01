import Stripe from "npm:stripe@^15.5.0";

const apiKey = Deno.env.get("STRIPE_SECRET_KEY");
const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");

if (!apiKey) {
    console.warn("STRIPE_SECRET_KEY is missing. Payment features will fail.");
}

export const stripe = new Stripe(apiKey || "", {
    apiVersion: "2024-04-10", // Using a stable recent API version
    httpClient: Stripe.createFetchHttpClient(), // Important for Deno
});

export const getStripeWebhookSecret = () => {
    if (!webhookSecret) {
        throw new Error("STRIPE_WEBHOOK_SECRET is not configured");
    }
    return webhookSecret;
};
