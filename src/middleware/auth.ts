import { createMiddleware } from "hono/factory";
import { verify, type JwtPayload } from "../lib/jwt";

declare module "hono" {
  interface ContextVariableMap {
    user: JwtPayload;
  }
}

export const authMiddleware = createMiddleware(async (c, next) => {
  const header = c.req.header("Authorization");
  if (!header?.startsWith("Bearer ")) return c.json({ error: "unauthorized" }, 401);

  const payload = await verify(header.slice(7));
  if (!payload) return c.json({ error: "unauthorized" }, 401);

  c.set("user", payload);
  await next();
});
