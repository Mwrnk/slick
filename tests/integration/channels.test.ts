import { describe, it, expect } from "bun:test";
import { createTestApp, createTestDb } from "../helpers";

const app = createTestApp(createTestDb());

describe("Workspaces + Channels API", () => {
  it("no token -> 401", async () => {
    const res = await app.request("/workspaces");
    expect(res.status).toBe(401);
  });

  it("create + list workspaces", async () => {
    const reg = await app.request("/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "alice", password: "password" }),
    });
    const { token } = await reg.json();

    const createRes = await app.request("/workspaces", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ name: "acme" }),
    });
    expect(createRes.status).toBe(201);
    const workspace = await createRes.json();
    expect(workspace.name).toBe("acme");

    const listRes = await app.request("/workspaces", {
      headers: { Authorization: `Bearer ${token}` },
    });
    const body = await listRes.json();
    expect(body.some((w: any) => w.name === "acme")).toBe(true);
  });

  it("create channel + list channels", async () => {
    const reg = await app.request("/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "bob", password: "password" }),
    });
    const { token } = await reg.json();

    const workspaceRes = await app.request("/workspaces", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ name: "acme" }),
    });
    const workspace = await workspaceRes.json();

    const createRes = await app.request(`/channels/${workspace.id}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ name: "general" }),
    });
    expect(createRes.status).toBe(201);
    const channel = await createRes.json();
    expect(channel.name).toBe("general");

    const listRes = await app.request(`/channels/${workspace.id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const body = await listRes.json();
    expect(body.some((c: any) => c.name === "general")).toBe(true);
  });

  it("channel isolation", async () => {
    const reg = await app.request("/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "charlie", password: "password" }),
    });
    const { token } = await reg.json();

    const res1 = await app.request("/workspaces", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ name: "acme" }),
    });
    expect(res1.status).toBe(201);

    const res2 = await app.request("/workspaces", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ name: "acme" }),
    });
    expect(res2.status).toBe(201);

    const ws1 = await res1.json();
    const ws2 = await res2.json();

    await app.request(`/channels/${ws1.id}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ name: "general" }),
    });

    await app.request(`/channels/${ws2.id}`, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
    });

    const channels2 = await (
      await app.request(`/channels/${ws2.id}`, {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` },
      })
    ).json();
    expect(channels2.some((c: any) => c.name === "general")).toBe(false);
  });
});
