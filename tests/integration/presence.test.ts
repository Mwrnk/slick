import { describe, it, expect } from "bun:test";
import { createTestApp, createTestDb } from "../helpers";
import { RoomManager } from "../../src/ws/room";

describe("GET /workspaces/:id/presence", () => {
  it("requires auth", async () => {
    const db = createTestDb();
    const app = createTestApp(db);
    const res = await app.request("/workspaces/some-id/presence");
    expect(res.status).toBe(401);
  });

  it("returns empty array when no online users", async () => {
    const db = createTestDb();
    const rooms = new RoomManager();
    const app = createTestApp(db, rooms);

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

    const res = await app.request(`/workspaces/${workspace.id}/presence`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual([]);
  });

  it("returns online users in workspace channels", async () => {
    const db = createTestDb();
    const rooms = new RoomManager();
    const app = createTestApp(db, rooms);

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

    // simulate user joining channel and being online
    const mockWs = { data: { userId: "u-123", username: "bob" }, send: () => {} } as any;
    rooms.join(channel.id, mockWs);
    rooms.markOnline("u-123", "bob");

    const res = await app.request(`/workspaces/${workspace.id}/presence`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.some((u: any) => u.userId === "u-123" && u.username === "bob")).toBe(true);
  });

  it("does not return users outside workspace channels", async () => {
    const db = createTestDb();
    const rooms = new RoomManager();
    const app = createTestApp(db, rooms);

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

    // user is online but NOT in any channel of this workspace
    rooms.markOnline("u-999", "outsider");

    const res = await app.request(`/workspaces/${workspace.id}/presence`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.some((u: any) => u.userId === "u-999")).toBe(false);
  });

  it("returns 403 for non-owner", async () => {
    const db = createTestDb();
    const rooms = new RoomManager();
    const app = createTestApp(db, rooms);

    // alice creates workspace
    const aliceReg = await app.request("/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "alice_403", password: "pw" }),
    });
    const { token: aliceToken } = await aliceReg.json();

    const wsRes = await app.request("/workspaces", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${aliceToken}` },
      body: JSON.stringify({ name: "acme" }),
    });
    const workspace = await wsRes.json();

    // bob tries to query alice's workspace presence
    const bobReg = await app.request("/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "bob_403", password: "pw" }),
    });
    const { token: bobToken } = await bobReg.json();

    const res = await app.request(`/workspaces/${workspace.id}/presence`, {
      headers: { Authorization: `Bearer ${bobToken}` },
    });
    expect(res.status).toBe(403);
  });
});
