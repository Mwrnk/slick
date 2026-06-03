import { Database } from "bun:sqlite";

export type User = {
  id: string;
  username: string;
  password_hash: string;
  created_at: number;
};

export type Workspace = {
  id: string;
  name: string;
  owner_id: string;
  created_at: number;
};

export type Channel = {
  id: string;
  name: string;
  workspace_id: string;
  created_at: number;
};

export type Message = {
  id: string;
  channel_id: string;
  user_id: string;
  username: string;
  text: string;
  created_at: number;
};

export function createUser(db: Database, username: string, passwordHash: string): User {
  const user: User = {
    id: crypto.randomUUID(),
    username,
    password_hash: passwordHash,
    created_at: Date.now(),
  };
  db.run(
    "INSERT INTO users (id, username, password_hash, created_at) VALUES (?, ?, ?, ?)",
    [user.id, user.username, user.password_hash, user.created_at]
  );
  return user;
}

export function findUserByUsername(db: Database, username: string): User | null {
  return db.query("SELECT * FROM users WHERE username = ?").get(username) as User | null;
}

export function createWorkspace(db: Database, name: string, ownerId: string): Workspace {
  const ws: Workspace = {
    id: crypto.randomUUID(),
    name,
    owner_id: ownerId,
    created_at: Date.now(),
  };
  db.run(
    "INSERT INTO workspaces (id, name, owner_id, created_at) VALUES (?, ?, ?, ?)",
    [ws.id, ws.name, ws.owner_id, ws.created_at]
  );
  return ws;
}

export function listWorkspaces(db: Database): Pick<Workspace, "id" | "name">[] {
  return db.query("SELECT id, name FROM workspaces").all() as Pick<Workspace, "id" | "name">[];
}

export function createChannel(db: Database, name: string, workspaceId: string): Channel {
  const ch: Channel = {
    id: crypto.randomUUID(),
    name,
    workspace_id: workspaceId,
    created_at: Date.now(),
  };
  db.run(
    "INSERT INTO channels (id, name, workspace_id, created_at) VALUES (?, ?, ?, ?)",
    [ch.id, ch.name, ch.workspace_id, ch.created_at]
  );
  return ch;
}

export function listChannels(db: Database, workspaceId: string): Pick<Channel, "id" | "name">[] {
  return db
    .query("SELECT id, name FROM channels WHERE workspace_id = ?")
    .all(workspaceId) as Pick<Channel, "id" | "name">[];
}

export function createMessage(
  db: Database,
  channelId: string,
  userId: string,
  text: string
): void {
  db.run(
    "INSERT INTO messages (id, channel_id, user_id, text, created_at) VALUES (?, ?, ?, ?, ?)",
    [crypto.randomUUID(), channelId, userId, text, Date.now()]
  );
}

export function getMessages(
  db: Database,
  channelId: string,
  before: string | null,
  limit: number
): { messages: Message[]; hasMore: boolean } {
  const cap = Math.min(limit, 100);
  let rows: Message[];
  if (before) {
    rows = db.query(`
      SELECT m.id, m.channel_id, m.user_id, u.username, m.text, m.created_at
      FROM messages m
      JOIN users u ON u.id = m.user_id
      WHERE m.channel_id = ?
        AND m.created_at < (SELECT created_at FROM messages WHERE id = ?)
      ORDER BY m.created_at DESC
      LIMIT ?
    `).all(channelId, before, cap + 1) as Message[];
  } else {
    rows = db.query(`
      SELECT m.id, m.channel_id, m.user_id, u.username, m.text, m.created_at
      FROM messages m
      JOIN users u ON u.id = m.user_id
      WHERE m.channel_id = ?
      ORDER BY m.created_at DESC
      LIMIT ?
    `).all(channelId, cap + 1) as Message[];
  }
  const hasMore = rows.length > cap;
  return { messages: rows.slice(0, cap), hasMore };
}
