import { Hono } from "hono";
import type { Database } from "bun:sqlite";
import type { RoomManager } from "../ws/room";

export function workspaceRoutes(db: Database, rooms?: RoomManager): Hono {
  const app = new Hono();

  app.get("/", (c) => {
    const workspaces = db.query("SELECT id, name FROM workspaces").all();
    return c.json(workspaces, 200);
  });

  app.post("/", async (c) => {
    const { name } = await c.req.json();
    if (!name) {
      return c.json({ error: "Missing workspace name" }, 400);
    }
    const { sub: userId } = c.get("user");

    const ws = {
      id: crypto.randomUUID(),
      name,
      owner_id: userId,
      created_at: Date.now(),
    };
    db.run(
      "INSERT INTO workspaces (id, name, owner_id, created_at) VALUES (?, ?, ?, ?)",
      [ws.id, ws.name, ws.owner_id, ws.created_at],
    );
    return c.json(ws, 201);
  });

  app.get("/:id/presence", (c) => {
    const { id } = c.req.param();
    const { sub: userId } = c.get("user");
    const workspace = db.query("SELECT owner_id FROM workspaces WHERE id = ?").get(id) as { owner_id: string } | null;
    if (!workspace) return c.json({ error: "not found" }, 404);
    if (workspace.owner_id !== userId) return c.json({ error: "forbidden" }, 403);
    if (!rooms) return c.json([], 200);
    return c.json(rooms.getOnlineUsers());
  });

  return app;
}
