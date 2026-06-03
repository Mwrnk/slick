import { describe, it, expect } from "bun:test";
import type { Database } from "bun:sqlite";
import { createTestApp, createTestDb } from "../helpers";

async function setup() {
  const db = createTestDb();
  const app = createTestApp(db);

  const regRes = await app.request("/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "alice", password: "pw" }),
  });
  const { token } = await regRes.json();

  const wsRes = await app.request("/workspaces", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ name: "acme" }),
  });
  const workspace = await wsRes.json();

  const chRes = await app.request(`/channels/${workspace.id}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ name: "general" }),
  });
  const channel = await chRes.json();

  return { app, db, token, channel };
}

describe("GET /channels/:channelId/messages", () => {
  it("requires auth", async () => {
    const { app, channel } = await setup();
    const res = await app.request(`/channels/${channel.id}/messages`);
    expect(res.status).toBe(401);
  });

  it("returns empty when no messages", async () => {
    const { app, token, channel } = await setup();
    const res = await app.request(`/channels/${channel.id}/messages`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ messages: [], hasMore: false });
  });

  it("returns messages with username, newest first", async () => {
    const { app, db, token, channel } = await setup();
    const user = db.query("SELECT id FROM users WHERE username = 'alice'").get() as { id: string };
    const base = Date.now();
    db.run("INSERT INTO messages (id, channel_id, user_id, text, created_at) VALUES (?, ?, ?, ?, ?)",
      [crypto.randomUUID(), channel.id, user.id, "first", base]);
    db.run("INSERT INTO messages (id, channel_id, user_id, text, created_at) VALUES (?, ?, ?, ?, ?)",
      [crypto.randomUUID(), channel.id, user.id, "second", base + 1]);

    const res = await app.request(`/channels/${channel.id}/messages`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const body = await res.json();
    expect(body.messages).toHaveLength(2);
    expect(body.messages[0].username).toBe("alice");
    expect(body.messages[0].text).toBe("second"); // newest first
    expect(body.messages[0]).toHaveProperty("createdAt");
    expect(body.messages[0]).toHaveProperty("channelId");
    expect(body.messages[0]).toHaveProperty("userId");
  });

  it("paginates with before cursor", async () => {
    const { app, db, token, channel } = await setup();
    const user = db.query("SELECT id FROM users WHERE username = 'alice'").get() as { id: string };
    const base = Date.now();
    for (let i = 0; i < 5; i++) {
      db.run("INSERT INTO messages (id, channel_id, user_id, text, created_at) VALUES (?, ?, ?, ?, ?)",
        [crypto.randomUUID(), channel.id, user.id, `msg-${i}`, base + i]);
    }

    const first = await (await app.request(`/channels/${channel.id}/messages?limit=3`, {
      headers: { Authorization: `Bearer ${token}` },
    })).json();
    expect(first.messages).toHaveLength(3);
    expect(first.hasMore).toBe(true);

    const cursor = first.messages[2].id;
    const second = await (await app.request(`/channels/${channel.id}/messages?before=${cursor}&limit=50`, {
      headers: { Authorization: `Bearer ${token}` },
    })).json();
    expect(second.messages).toHaveLength(2);
    expect(second.hasMore).toBe(false);
  });
});
