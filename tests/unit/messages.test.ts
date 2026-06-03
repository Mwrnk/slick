import { describe, it, expect } from "bun:test";
import type { Database } from "bun:sqlite";
import { createTestDb } from "../helpers";
import { createUser, createWorkspace, createChannel, createMessage, getMessages } from "../../src/db/queries";

function seedMessages(db: Database, channelId: string, userId: string, count: number) {
  const base = Date.now();
  for (let i = 0; i < count; i++) {
    db.run(
      "INSERT INTO messages (id, channel_id, user_id, text, created_at) VALUES (?, ?, ?, ?, ?)",
      [crypto.randomUUID(), channelId, userId, `msg-${i}`, base + i]
    );
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
    for (let i = 0; i < result.messages.length - 1; i++) {
      expect(result.messages[i].created_at).toBeGreaterThan(result.messages[i + 1].created_at);
    }
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
