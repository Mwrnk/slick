import { Hono } from "hono";
import { Database } from "bun:sqlite";
import { createChannel, listChannels } from "../db/queries";

export function channelRoutes(db: Database): Hono {
  const app = new Hono();

  app.post("/:workspaceId", async (c) => {
    const { name } = await c.req.json();

    if (!name) {
      return c.json({ error: "Missing channel name" }, 400);
    }
    const { sub: userId } = c.get("user");
    const { workspaceId } = c.req.param();

    const channel = {
      id: crypto.randomUUID(),
      name,
      workspace_id: workspaceId,
      created_at: Date.now(),
    };
    db.run(
      "INSERT INTO channels (id, name, workspace_id, created_at) VALUES (?, ?, ?, ?)",
      [channel.id, channel.name, channel.workspace_id, channel.created_at],
    );
    return c.json(channel, 201);
  });

  app.get("/:workspaceId", (c) => {
    const { workspaceId } = c.req.param();
    const channels = db
      .query("SELECT id, name FROM channels WHERE workspace_id = ?")
      .all(workspaceId);
    return c.json(channels, 200);
  });

  return app;
}
