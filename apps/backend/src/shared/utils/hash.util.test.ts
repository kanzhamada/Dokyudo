import { describe, it } from "jsr:@std/testing/bdd";
import { assertEquals, assertNotEquals } from "jsr:@std/assert";
import { hashUserEmail } from "./hash.util.ts";

describe("hashUserEmail", () => {
  it("produces identical hashes for identical emails", async () => {
    const hash1 = await hashUserEmail("user@example.com");
    const hash2 = await hashUserEmail("user@example.com");
    assertEquals(hash1, hash2);
    assertEquals(hash1.length, 64);
  });

  it("normalizes case and surrounding whitespace", async () => {
    const hash1 = await hashUserEmail("User@Example.COM");
    const hash2 = await hashUserEmail("  user@example.com  ");
    assertEquals(hash1, hash2);
  });

  it("produces different hashes for different emails", async () => {
    const hash1 = await hashUserEmail("user1@example.com");
    const hash2 = await hashUserEmail("user2@example.com");
    assertNotEquals(hash1, hash2);
  });
});
