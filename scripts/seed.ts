const BASE = `http://localhost:${process.env.PORT ?? 3000}`;

async function post(path: string, body: object, token?: string) {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${path} → ${res.status}: ${await res.text()}`);
  return res.json();
}

console.log("🔧 Seeding Slick...\n");

const { token: tokenA } = await post("/auth/register", { username: "alice", password: "password" });
const { token: tokenB } = await post("/auth/register", { username: "bob", password: "password" });
console.log("✓ Registered alice + bob");

const workspace = await post("/workspaces", { name: "slick-hq" }, tokenA);
console.log(`✓ Workspace: ${workspace.name} (${workspace.id})`);

const channel = await post(`/channels/${workspace.id}`, { name: "general" }, tokenA);
console.log(`✓ Channel:   #${channel.name} (${channel.id})\n`);

console.log("── Connect as alice ──────────────────────────────────────");
console.log(`npx wscat -c "ws://localhost:3000/ws?token=${tokenA}"`);
console.log("\n── Connect as bob ────────────────────────────────────────");
console.log(`npx wscat -c "ws://localhost:3000/ws?token=${tokenB}"`);
console.log("\n── Join channel (paste after connecting) ─────────────────");
console.log(JSON.stringify({ type: "join", channelId: channel.id }));
console.log("\n── Send a message ────────────────────────────────────────");
console.log(JSON.stringify({ type: "message", channelId: channel.id, text: "hello!" }));
