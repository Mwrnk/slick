import { describe, it, expect, vi, afterEach } from "vitest";
import { sign, verify } from "../../src/lib/jwt";

describe("JWT", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("round-trip: sign then verify returns payolad", async () => {
    const token = await sign({ sub: "user-123", username: "alice" });
    const payload = await verify(token);

    expect(payload).not.toBeNull();
    expect(payload!.sub).toBe("user-123");
    expect(payload!.username).toBe("alice");
  });

  it("tampered signature -> null", async () => {
    const token = await sign({ sub: "user-123", username: "alice" });
    const tampered = token.slice(0, -5) + "XXXXX";
    expect(await verify(tampered)).toBeNull();
  });

  it("wrong segment count -> null", async () => {
    expect(await verify("only.two")).toBeNull();
    expect(await verify("one")).toBeNull();
  });

  it("expired token -> null", async () => {
    const token = await sign({ sub: "user-123", username: "alice" });

    vi.useFakeTimers();
    vi.setSystemTime(Date.now() + 8 * 24 * 60 * 60 * 1000); //+8 days

    expect(await verify(token)).toBeNull();
  });
});
