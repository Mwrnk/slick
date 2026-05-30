import { Database } from "bun:sqlite";
import { Hono } from "hono";
import { runMigrations } from "../src/db/schema";
import { authMiddleware } from "../src/middleware/auth";
import { authRoutes } from "../src/routes/auth";
import { workspaceRoutes } from "../src/routes/workspaces";
import { channelRoutes } from "../src/routes/channels";

export function createTestDb(): Database {
  const db = new Database(":memory:");
  runMigrations(db);
  return db;
}

export function createTestApp(db: Database): Hono {
  const app = new Hono();
  app.route("/auth", authRoutes(db));
  app.use("/workspaces/*", authMiddleware);
  app.use("/channels/*", authMiddleware);
  app.route("/workspaces", workspaceRoutes(db));
  app.route("/channels", channelRoutes(db));
  return app;
}
