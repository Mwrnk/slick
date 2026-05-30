import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import type { Server } from "bun";
import { createTestServer } from "../helpers";

let server: Server;
let base: string;
let wsBase: string;

beforeAll(() => {
  ({ server } = createTestServer());
  base = `http://localhost:${server.port}`;
  wsBase = `ws://localhost:${server.port}`;
});

afterAll(() => server.stop(true));

async function register(username: string): Promise<string> {
  const res = await fetch(`${base}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password: "password" }),
  });
  const { token } = await res.json();
  return token;
}

function connect(token: string): Promise<{ ws: WebSocket; next(): Promise<any> }> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`${wsBase}/ws?token=${token}`);
    const queue: any[] = [];
    let pending: ((v: any) => void) | null = null;

    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data as string);
      if (pending) { pending(msg); pending = null; }
      else queue.push(msg);
    };

    function next(timeout = 1000): Promise<any> {
      if (queue.length) return Promise.resolve(queue.shift());
      return new Promise((res, rej) => {
        const t = setTimeout(() => rej(new Error("ws message timeout")), timeout);
        pending = (v) => { clearTimeout(t); res(v); };
      });
    }

    ws.onopen = () => resolve({ ws, next });
    ws.onerror = reject;
  });
}

describe("WebSocket", () => {
  it("no token → HTTP 401", async () => {
    const res = await fetch(`${base}/ws`);
    expect(res.status).toBe(401);
  });

  it("join channel → receives joined event", async () => {
    const token = await register("ws_alice");
    const { ws, next } = await connect(token);

    ws.send(JSON.stringify({ type: "join", channelId: "ch-1" }));
    const msg = await next();

    expect(msg.type).toBe("joined");
    expect(msg.channelId).toBe("ch-1");
    expect(msg.username).toBe("ws_alice");
    ws.close();
  });

  it("message without join → error", async () => {
    const token = await register("ws_bob");
    const { ws, next } = await connect(token);

    ws.send(JSON.stringify({ type: "message", channelId: "ch-1", text: "hello" }));
    const msg = await next();

    expect(msg.type).toBe("error");
    ws.close();
  });

  it("two clients: sender message broadcast to receiver", async () => {
    const [tokenA, tokenB] = await Promise.all([
      register("ws_sender"),
      register("ws_receiver"),
    ]);

    const [clientA, clientB] = await Promise.all([connect(tokenA), connect(tokenB)]);

    const channelId = "ch-broadcast";

    clientA.ws.send(JSON.stringify({ type: "join", channelId }));
    await clientA.next(); // joined for A

    clientB.ws.send(JSON.stringify({ type: "join", channelId }));
    await clientB.next(); // joined for B
    await clientA.next(); // A sees B join

    clientA.ws.send(JSON.stringify({ type: "message", channelId, text: "hey" }));

    const [msgA, msgB] = await Promise.all([clientA.next(), clientB.next()]);

    expect(msgA.type).toBe("message");
    expect(msgA.text).toBe("hey");
    expect(msgA.username).toBe("ws_sender");

    expect(msgB.type).toBe("message");
    expect(msgB.text).toBe("hey");
    expect(msgB.username).toBe("ws_sender");

    clientA.ws.close();
    clientB.ws.close();
  });

  it("leave channel → no longer receives messages", async () => {
    const [tokenA, tokenB] = await Promise.all([
      register("ws_leaver"),
      register("ws_stayer"),
    ]);

    const [clientA, clientB] = await Promise.all([connect(tokenA), connect(tokenB)]);

    const channelId = "ch-leave";

    clientA.ws.send(JSON.stringify({ type: "join", channelId }));
    await clientA.next();

    clientB.ws.send(JSON.stringify({ type: "join", channelId }));
    await clientB.next();
    await clientA.next(); // A sees B join

    clientA.ws.send(JSON.stringify({ type: "leave", channelId }));
    await clientB.next(); // B gets left broadcast; A already removed before broadcast

    clientB.ws.send(JSON.stringify({ type: "message", channelId, text: "after leave" }));
    const msgB = await clientB.next(); // B sees own message
    expect(msgB.text).toBe("after leave");

    // A should NOT receive the message (it left)
    const timeout = await clientA.next(300).catch(() => "timeout");
    expect(timeout).toBe("timeout");

    clientA.ws.close();
    clientB.ws.close();
  });
});
