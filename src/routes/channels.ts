import { Hono } from "hono";
import type { Database } from "bun:sqlite";

export function channelRoutes(db: Database): Hono {
  const app = new Hono();
  return app;
}
