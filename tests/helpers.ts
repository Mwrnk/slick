import { Database } from "bun:sqlite";
import { Hono } from "hono";
import { runMigrations } from "../src/db/schema";
import { authMiddleware } from "../src/middleware/auth";
import { authRoutes } from "../src/routes/auth";
import { workspaceRoutes } from "../src/routes/workspaces";
import { channelRoutes } from "../src/routes/channels";
import { RoomManager } from "../src/ws/room";
import { handleMessage } from "../src/ws/handler";
import { verify } from "../src/lib/jwt";

export function createTestDb(): Database {
  const db = new Database(":memory:");
  runMigrations(db);
  return db;
}

export function createTestApp(db: Database, rooms?: RoomManager): Hono {
  const r = rooms ?? new RoomManager();
  const app = new Hono();
  app.route("/auth", authRoutes(db));
  app.use("/workspaces/*", authMiddleware);
  app.use("/channels/*", authMiddleware);
  app.route("/workspaces", workspaceRoutes(db, r));
  app.route("/channels", channelRoutes(db));
  return app;
}

export function createTestServer() {
  const db = createTestDb();
  const rooms = new RoomManager();
  const app = createTestApp(db, rooms);

  app.get("/ws", async (c) => {
    const token = c.req.query("token");
    if (!token) return c.json({ error: "unauthorized" }, 401);
    const payload = await verify(token);
    if (!payload) return c.json({ error: "unauthorized" }, 401);
    const upgraded = c.env.upgrade(c.req.raw, { data: { userId: payload.sub, username: payload.username } });
    if (!upgraded) return c.json({ error: "upgrade failed" }, 500);
    return new Response(null, { status: 101 });
  });

  const server = Bun.serve({
    port: 0,
    fetch: app.fetch,
    websocket: {
      open(ws) { rooms.markOnline(ws.data.userId, ws.data.username); },
      message(ws, raw) { handleMessage(ws, raw as string, rooms, db); },
      close(ws) { rooms.disconnectUser(ws); },
    },
  });

  return { server, db, rooms };
}
