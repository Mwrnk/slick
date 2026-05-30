const BASE = `http://localhost:${process.env.PORT ?? 3000}`;

export type Workspace = { id: string; name: string };
export type Channel = { id: string; name: string };

async function req<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE}${path}`, init);
  if (!res.ok) throw new Error(`${path} → ${res.status}: ${await res.text()}`);
  return res.json() as Promise<T>;
}

const jsonInit = (body: object, token?: string): RequestInit => ({
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  },
  body: JSON.stringify(body),
});

const authInit = (token: string): RequestInit => ({
  headers: { Authorization: `Bearer ${token}` },
});

export const register = (u: string, p: string) =>
  req<{ token: string }>('/auth/register', jsonInit({ username: u, password: p }));

export const login = (u: string, p: string) =>
  req<{ token: string }>('/auth/login', jsonInit({ username: u, password: p }));

export const listWorkspaces = (token: string) =>
  req<Workspace[]>('/workspaces', authInit(token));

export const createWorkspace = (token: string, name: string) =>
  req<Workspace>('/workspaces', jsonInit({ name }, token));

export const listChannels = (token: string, workspaceId: string) =>
  req<Channel[]>(`/channels/${workspaceId}`, authInit(token));

export const createChannel = (token: string, workspaceId: string, name: string) =>
  req<Channel>(`/channels/${workspaceId}`, jsonInit({ name }, token));
