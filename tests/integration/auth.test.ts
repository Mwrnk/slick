import { describe, it, expect } from "bun:test";
import { createTestApp, createTestDb } from "../helpers";

const app = createTestApp(createTestDb());

describe("Auth API", () => {
  it("register valid -> 201 + token", async () => {
    const res = await app.request("/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "alice", password: "secret" }),
    });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.token.split(".")).toHaveLength(3);
  });

  it("duplicate username -> 409", async () => {
    await app.request("/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "bob", password: "secret" }),
    });

    const res = await app.request("/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "bob", password: "another" }),
    });

    expect(res.status).toBe(409);
  });

  it("missing password -> 400", async () => {
    const res = await app.request("/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "charlie" }),
    });

    expect(res.status).toBe(400);
  });

  it("login valid -> 200 + token", async () => {
    await app.request("/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "dave", password: "secret" }),
    });

    const res = await app.request("/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "dave", password: "secret" }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.token.split(".")).toHaveLength(3);
  });

  it("login wrong password -> 401", async () => {
    await app.request("/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "eve", password: "secret" }),
    });

    const res = await app.request("/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "eve", password: "wrong" }),
    });

    expect(res.status).toBe(401);
  });

  it("login unknown username -> 401", async () => {
    const res = await app.request("/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "nonexistent", password: "secret" }),
    });

    expect(res.status).toBe(401);
  });
});
