import { Database } from "bun:sqlite";
import { Hono } from "hono";
import type { ServerWebSocket } from "bun";
import { runMigrations } from "./db/schema";
import { authMiddleware } from "./middleware/auth";
import { authRoutes } from "./routes/auth";
import { workspaceRoutes } from "./routes/workspaces";
import { channelRoutes } from "./routes/channels";
import { RoomManager } from "./ws/room";
import type { WsData } from "./ws/room";
import { handleMessage } from "./ws/handler";
import { verify } from "./lib/jwt";

const db = new Database(process.env.DB_PATH ?? "slick.db");
runMigrations(db);

const rooms = new RoomManager();

const app = new Hono();
app.route("/auth", authRoutes(db));
app.use("/workspaces/*", authMiddleware);
app.use("/channels/*", authMiddleware);
app.route("/workspaces", workspaceRoutes(db, rooms));
app.route("/channels", channelRoutes(db));

app.get("/ws", async (c) => {
  const token = c.req.query("token");
  if (!token) return c.json({ error: "unauthorized" }, 401);
  const payload = await verify(token);
  if (!payload) return c.json({ error: "unauthorized" }, 401);

  const upgraded = c.env.upgrade(c.req.raw, { data: { userId: payload.sub, username: payload.username } });
  if (!upgraded) return c.json({ error: "upgrade failed" }, 500);
  return new Response(null, { status: 101 });
});

export default {
  port: Number(process.env.PORT ?? 3000),
  fetch: app.fetch,
  websocket: {
    open(ws: ServerWebSocket<WsData>) {
      rooms.markOnline(ws.data.userId, ws.data.username);
    },
    message(ws: ServerWebSocket<WsData>, raw: string) {
      handleMessage(ws, raw, rooms, db);
    },
    close(ws: ServerWebSocket<WsData>) {
      rooms.disconnectUser(ws);
    },
  },
};
