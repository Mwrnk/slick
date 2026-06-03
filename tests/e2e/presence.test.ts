import { describe, it, expect, afterEach } from "bun:test";
import { createTestServer } from "../helpers";

async function register(base: string, username: string) {
  const res = await fetch(`${base}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password: "pw" }),
  });
  return res.json() as Promise<{ token: string }>;
}

function collect(ws: WebSocket, count: number, timeout = 2000): Promise<any[]> {
  return new Promise((resolve, reject) => {
    const msgs: any[] = [];
    const timer = setTimeout(() => resolve(msgs), timeout);
    ws.onmessage = (e) => {
      msgs.push(JSON.parse(e.data));
      if (msgs.length >= count) { clearTimeout(timer); resolve(msgs); }
    };
    ws.onerror = () => { clearTimeout(timer); reject(new Error("ws error")); };
  });
}

describe("WS presence + typing E2E", () => {
  let server: ReturnType<typeof createTestServer>["server"];

  afterEach(() => server?.stop(true));

  it("broadcasts joined event when user joins a channel", async () => {
    ({ server } = createTestServer());
    const base = `http://localhost:${server.port}`;
    const wsBase = `ws://localhost:${server.port}`;

    const { token: aliceToken } = await register(base, "alice");
    const { token: bobToken } = await register(base, "bob");

    const wsRes = await fetch(`${base}/workspaces`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${aliceToken}` },
      body: JSON.stringify({ name: "acme" }),
    });
    const workspace = await wsRes.json();
    const chRes = await fetch(`${base}/channels/${workspace.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${aliceToken}` },
      body: JSON.stringify({ name: "general" }),
    });
    const channel = await chRes.json();

    const alice = new WebSocket(`${wsBase}/ws?token=${aliceToken}`);
    await new Promise<void>((r) => { alice.onopen = () => r(); });
    alice.send(JSON.stringify({ type: "join", channelId: channel.id }));
    await new Promise((r) => setTimeout(r, 50));

    const aliceMsgs = collect(alice, 1);
    const bob = new WebSocket(`${wsBase}/ws?token=${bobToken}`);
    await new Promise<void>((r) => { bob.onopen = () => r(); });
    bob.send(JSON.stringify({ type: "join", channelId: channel.id }));

    const received = await aliceMsgs;
    const joinedMsg = received.find((m) => m.type === "joined");
    expect(joinedMsg).toBeDefined();
    expect(joinedMsg.username).toBe("bob");

    alice.close();
    bob.close();
    await new Promise((r) => setTimeout(r, 50));
  });

  it("broadcasts typing and stopped_typing events", async () => {
    ({ server } = createTestServer());
    const base = `http://localhost:${server.port}`;
    const wsBase = `ws://localhost:${server.port}`;

    const { token: aliceToken } = await register(base, "alice2");
    const { token: bobToken } = await register(base, "bob2");

    const wsRes = await fetch(`${base}/workspaces`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${aliceToken}` },
      body: JSON.stringify({ name: "acme" }),
    });
    const workspace = await wsRes.json();
    const chRes = await fetch(`${base}/channels/${workspace.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${aliceToken}` },
      body: JSON.stringify({ name: "general" }),
    });
    const channel = await chRes.json();

    const alice = new WebSocket(`${wsBase}/ws?token=${aliceToken}`);
    await new Promise<void>((r) => { alice.onopen = () => r(); });
    alice.send(JSON.stringify({ type: "join", channelId: channel.id }));

    const bob = new WebSocket(`${wsBase}/ws?token=${bobToken}`);
    await new Promise<void>((r) => { bob.onopen = () => r(); });
    bob.send(JSON.stringify({ type: "join", channelId: channel.id }));
    await new Promise((r) => setTimeout(r, 100));

    // alice listens for typing events; bob sends typing
    const aliceMsgs = collect(alice, 2, 5000);
    bob.send(JSON.stringify({ type: "typing", channelId: channel.id }));

    const received = await aliceMsgs;
    expect(received.some((m) => m.type === "typing" && m.username === "bob2")).toBe(true);
    expect(received.some((m) => m.type === "stopped_typing" && m.username === "bob2")).toBe(true);

    alice.close();
    bob.close();
    await new Promise((r) => setTimeout(r, 50));
  });

  it("GET /workspaces/:id/presence shows online user after WS connect", async () => {
    ({ server } = createTestServer());
    const base = `http://localhost:${server.port}`;
    const wsBase = `ws://localhost:${server.port}`;

    const { token } = await register(base, "alice3");

    const wsRes = await fetch(`${base}/workspaces`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ name: "acme" }),
    });
    const workspace = await wsRes.json();

    const ws = new WebSocket(`${wsBase}/ws?token=${token}`);
    await new Promise<void>((r) => { ws.onopen = () => r(); });
    await new Promise((r) => setTimeout(r, 50));

    const presRes = await fetch(`${base}/workspaces/${workspace.id}/presence`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(presRes.status).toBe(200);
    const online = await presRes.json();
    expect(online.some((u: any) => u.username === "alice3")).toBe(true);

    ws.close();
    await new Promise((r) => setTimeout(r, 300));

    const afterRes = await fetch(`${base}/workspaces/${workspace.id}/presence`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const afterOnline = await afterRes.json();
    expect(afterOnline.some((u: any) => u.username === "alice3")).toBe(false);
  });
});
