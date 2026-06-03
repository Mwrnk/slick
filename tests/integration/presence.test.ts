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

  it("returns online users", async () => {
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

    rooms.markOnline("u-123", "bob");

    const res = await app.request(`/workspaces/${workspace.id}/presence`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const body = await res.json();
    expect(body.some((u: any) => u.userId === "u-123" && u.username === "bob")).toBe(true);
  });
});
