import { describe, it, expect } from "bun:test";
import { createTestDb } from "../helpers";
import { createMessage, getMessages, createUser, createWorkspace, createChannel } from "../../src/db/queries";

function seedMessages(db: ReturnType<typeof createTestDb>, channelId: string, userId: string, count: number) {
  for (let i = 0; i < count; i++) {
    createMessage(db, channelId, userId, `msg-${i}`);
    // Small delay to ensure different timestamps
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 1);
  }
}

describe("getMessages", () => {
  it("returns empty array when no messages", () => {
    const db = createTestDb();
    const result = getMessages(db, "ch-1", null, 50);
    expect(result).toEqual({ messages: [], hasMore: false });
  });

  it("returns messages newest first", () => {
    const db = createTestDb();
    const user = createUser(db, "alice", "hash");
    const ws = createWorkspace(db, "acme", user.id);
    const ch = createChannel(db, "general", ws.id);
    seedMessages(db, ch.id, user.id, 3);
    const result = getMessages(db, ch.id, null, 50);
    expect(result.messages).toHaveLength(3);
    expect(result.hasMore).toBe(false);
    expect(result.messages[0].created_at).toBeGreaterThanOrEqual(result.messages[1].created_at);
  });

  it("caps at limit and sets hasMore", () => {
    const db = createTestDb();
    const user = createUser(db, "bob", "hash");
    const ws = createWorkspace(db, "acme", user.id);
    const ch = createChannel(db, "general", ws.id);
    seedMessages(db, ch.id, user.id, 5);
    const result = getMessages(db, ch.id, null, 3);
    expect(result.messages).toHaveLength(3);
    expect(result.hasMore).toBe(true);
  });

  it("respects before cursor", () => {
    const db = createTestDb();
    const user = createUser(db, "carol", "hash");
    const ws = createWorkspace(db, "acme", user.id);
    const ch = createChannel(db, "general", ws.id);
    seedMessages(db, ch.id, user.id, 5);
    const first = getMessages(db, ch.id, null, 3);
    const cursor = first.messages[2].id;
    const second = getMessages(db, ch.id, cursor, 50);
    expect(second.messages).toHaveLength(2);
    expect(second.hasMore).toBe(false);
  });

  it("includes username in response", () => {
    const db = createTestDb();
    const user = createUser(db, "dave", "hash");
    const ws = createWorkspace(db, "acme", user.id);
    const ch = createChannel(db, "general", ws.id);
    createMessage(db, ch.id, user.id, "hello");
    const result = getMessages(db, ch.id, null, 50);
    expect(result.messages[0].username).toBe("dave");
  });
});
