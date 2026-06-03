import { Hono } from "hono";
import { Database } from "bun:sqlite";
import { createChannel, listChannels, getMessages } from "../db/queries";

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

  app.get("/:channelId/messages", (c) => {
    const { channelId } = c.req.param();
    const before = c.req.query("before") ?? null;
    const rawLimit = parseInt(c.req.query("limit") ?? "50", 10);
    const limit = isNaN(rawLimit) || rawLimit <= 0 ? 50 : rawLimit;
    const { messages, hasMore } = getMessages(db, channelId, before, limit);
    const mapped = messages.map((m) => ({
      id: m.id,
      channelId: m.channel_id,
      userId: m.user_id,
      username: m.username,
      text: m.text,
      createdAt: m.created_at,
    }));
    return c.json({ messages: mapped, hasMore });
  });

  return app;
}
