import { describe, it } from "jsr:@std/testing/bdd";
import { assertRejects } from "jsr:@std/assert";
import { MeService } from "./me.service.ts";

describe("MeService Isolated Tests", () => {
    describe("getProfile", () => {
        it("negative: rejects when user or tenant does not exist", async () => {
            const nonExistentId = crypto.randomUUID();
            await assertRejects(
                () =>
                    MeService.getProfile({
                        userId: nonExistentId,
                        tenantId: nonExistentId,
                    }),
            );
        });
    });

    describe("getUsage", () => {
        it("negative: rejects when subscription does not exist", async () => {
            const fakeUserId = crypto.randomUUID();
            const fakeTenantId = crypto.randomUUID();
            await assertRejects(
                () =>
                    MeService.getUsage({
                        userId: fakeUserId,
                        tenantId: fakeTenantId,
                    }),
            );
        });
    });
});
