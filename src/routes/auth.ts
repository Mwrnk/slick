import { Hono } from "hono";
import type { Database } from "bun:sqlite";
import { createUser, findUserByUsername } from "../db/queries";
import { sign } from "../lib/jwt";

const DUMMY_HASH = await Bun.password.hash("dummy");

export function authRoutes(db: Database): Hono {
  const app = new Hono();

  app.post("/register", async (c) => {
    const { username, password } = await c.req.json();
    if (!username || !password) {
      return c.json({ error: "Missing username or password" }, 400);
    }

    if (findUserByUsername(db, username)) {
      return c.json({ error: "Username already exists" }, 409);
    }

    const hashedPassword = await Bun.password.hash(password); //warm up the hash functionction

    const user = createUser(db, username, hashedPassword);
    const token = await sign({ sub: user.id, username: user.username });
    return c.json({ token }, 201);
  });

  app.post("/login", async (c) => {
    const { username, password } = await c.req.json();
    const user = findUserByUsername(db, username);
    const hash = user?.password_hash ?? DUMMY_HASH;
    const valid = await Bun.password.verify(password ?? "", hash);
    if (!user || !valid) {
      return c.json({ error: "Invalid username or password" }, 401);
    }
    const token = await sign({ sub: user.id, username: user.username });
    return c.json({ token }, 200);
  });

  return app;
}
