import { describe, it, beforeAll, afterAll } from "jsr:@std/testing/bdd";
import { assertEquals } from "jsr:@std/assert";
import { Hono } from "hono";
import { loggerMiddleware } from "./logger.middleware.ts";
import { AppError } from "../utils/errors.util.ts";

describe("Logger Middleware", () => {
    let app: Hono;
    let originalConsoleLog: typeof console.log;
    let loggedMessages: string[] = [];

    beforeAll(() => {
        originalConsoleLog = console.log;
        console.log = (...args: any[]) => {
            loggedMessages.push(args[0]);
        };

        app = new Hono();
        app.use("*", loggerMiddleware);

        app.get("/success", (c) => c.json({ message: "OK" }));
        
        app.get("/app-error", () => {
            throw new AppError({ code: "VALIDATION_ERROR", message: "Bad input", status: 400 });
        });

        app.get("/unhandled-error", () => {
            throw new Error("Unexpected crash");
        });
        
        // Setup app error handler to catch errors thrown inside routes for proper response status
        app.onError((err, c) => {
            if (err instanceof AppError) {
                return c.json(err.toJSON("req-123"), err.status as any);
            }
            return c.json({ error: "Internal error" }, 500);
        });
    });

    afterAll(() => {
        console.log = originalConsoleLog;
    });

    it("positive: logs successful request with duration and status", async () => {
        loggedMessages = []; // reset
        const req = new Request("http://localhost/success", {
            headers: { "X-Forwarded-For": "192.168.1.1" }
        });
        const res = await app.fetch(req);
        assertEquals(res.status, 200);
        
        assertEquals(loggedMessages.length, 1);
        const log = JSON.parse(loggedMessages[0]);
        
        assertEquals(log.event, "http_request");
        assertEquals(log.method, "GET");
        assertEquals(log.path, "/success");
        assertEquals(log.ip, "192.168.1.1");
        assertEquals(log.status, 200);
        assertEquals(typeof log.durationMs, "number");
        assertEquals(typeof log.requestId, "string");
        assertEquals(log.error, undefined);
    });

    it("negative: logs AppError without stack trace", async () => {
        loggedMessages = []; // reset
        const req = new Request("http://localhost/app-error");
        const res = await app.fetch(req);
        assertEquals(res.status, 400);

        assertEquals(loggedMessages.length, 1);
        const log = JSON.parse(loggedMessages[0]);

        assertEquals(log.status, 400);
        assertEquals(log.error, "Bad input");
        assertEquals(log.stack, undefined);
    });

    it("negative: logs unexpected Error with stack trace", async () => {
        loggedMessages = []; // reset
        const req = new Request("http://localhost/unhandled-error");
        const res = await app.fetch(req);
        assertEquals(res.status, 500);

        assertEquals(loggedMessages.length, 1);
        const log = JSON.parse(loggedMessages[0]);

        assertEquals(log.status, 500);
        assertEquals(log.error, "Unexpected crash");
        assertEquals(typeof log.stack, "string");
    });
});
