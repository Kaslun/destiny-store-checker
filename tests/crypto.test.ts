import { describe, it, expect, beforeAll } from "vitest";
import { randomBytes } from "node:crypto";

beforeAll(() => {
  process.env.TOKEN_ENC_KEY = randomBytes(32).toString("base64");
});

describe("token encryption", () => {
  it("round-trips a token", async () => {
    const { encryptToken, decryptToken } = await import("../lib/crypto");
    const secret = "refresh-" + randomBytes(24).toString("hex");
    const enc = encryptToken(secret);
    expect(enc).not.toContain(secret);            // ciphertext, not plaintext
    expect(enc.split(":")).toHaveLength(3);        // iv:tag:ct
    expect(decryptToken(enc)).toBe(secret);
  });

  it("fails to decrypt a tampered payload", async () => {
    const { encryptToken, decryptToken } = await import("../lib/crypto");
    const enc = encryptToken("hello");
    const [iv, tag, ct] = enc.split(":");
    const tampered = [iv, tag, Buffer.from("zzzz").toString("base64")].join(":");
    expect(() => decryptToken(tampered)).toThrow();
  });
});
