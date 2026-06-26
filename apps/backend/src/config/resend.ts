import { Resend } from "resend";

const apiKey = Deno.env.get("RESEND_API_KEY");

if (!apiKey) {
    console.warn("RESEND_API_KEY is missing. Email sending will fail.");
}

export const resend = new Resend(apiKey || "re_dummy123");
