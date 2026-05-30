import * as readline from "readline";

const BASE = `http://localhost:${process.env.PORT ?? 3000}`;

// ── HTTP helpers ──────────────────────────────────────────────────
async function post(path: string, body: object, token?: string) {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${path} → ${res.status}: ${await res.text()}`);
  return res.json() as Promise<any>;
}

async function get(path: string, token: string) {
  const res = await fetch(`${BASE}${path}`, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`${path} → ${res.status}`);
  return res.json() as Promise<any>;
}

function ask(rl: readline.Interface, q: string): Promise<string> {
  return new Promise((res) => rl.question(q, res));
}

// ── Setup flow ────────────────────────────────────────────────────
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

console.log("\x1b[1mSlick\x1b[0m\n");
const username = await ask(rl, "Username: ");
const password = await ask(rl, "Password: ");

let token: string;
try {
  token = (await post("/auth/register", { username, password })).token;
  console.log("✓ Registered");
} catch {
  try {
    token = (await post("/auth/login", { username, password })).token;
    console.log("✓ Logged in");
  } catch {
    console.error("Auth failed — wrong password or server down.");
    process.exit(1);
  }
}

const workspaces = await get("/workspaces", token);
let workspace: any;
if (workspaces.length === 0) {
  const name = await ask(rl, "No workspaces. Create one: ");
  workspace = await post("/workspaces", { name }, token);
  console.log(`✓ Created workspace: ${workspace.name}`);
} else if (workspaces.length === 1) {
  workspace = workspaces[0];
  console.log(`✓ Workspace: ${workspace.name}`);
} else {
  workspaces.forEach((w: any, i: number) => console.log(`  ${i + 1}. ${w.name}`));
  const idx = parseInt(await ask(rl, "Pick workspace #: ")) - 1;
  workspace = workspaces[idx];
}

const channels = await get(`/channels/${workspace.id}`, token);
let channel: any;
if (channels.length === 0) {
  const name = await ask(rl, "No channels. Create one: ");
  channel = await post(`/channels/${workspace.id}`, { name }, token);
  console.log(`✓ Created channel: #${channel.name}`);
} else if (channels.length === 1) {
  channel = channels[0];
  console.log(`✓ Channel: #${channel.name}`);
} else {
  channels.forEach((c: any, i: number) => console.log(`  ${i + 1}. #${c.name}`));
  const idx = parseInt(await ask(rl, "Pick channel #: ")) - 1;
  channel = channels[idx];
}

rl.close();

// ── TUI layout ────────────────────────────────────────────────────
const COLS = process.stdout.columns || 80;
const ROWS = process.stdout.rows || 24;
const MSG_TOP = 2;
const MSG_BOT = ROWS - 3;
const SEP_ROW = ROWS - 2;
const IN_ROW  = ROWS - 1;
const PROMPT  = `\x1b[32m${username}\x1b[0m > `;

const w = (s: string) => process.stdout.write(s);
const move = (r: number, c = 1) => w(`\x1b[${r};${c}H`);
const clrLine = () => w("\x1b[2K");

// clear + scroll region + static chrome
w("\x1b[2J");
w(`\x1b[${MSG_TOP};${MSG_BOT}r`);          // scroll region
move(1);
w(`\x1b[2m  #${channel.name}  @${workspace.name}  (Ctrl+C to quit)\x1b[0m`);
move(SEP_ROW);
w("─".repeat(COLS));
move(IN_ROW);
w(PROMPT);

// ── message printer ───────────────────────────────────────────────
let inputBuf = "";

function printLine(label: string, text: string, dim = false) {
  w("\x1b[s");
  move(MSG_BOT);
  w("\n");
  clrLine();
  w(dim ? `\x1b[2m${label} ${text}\x1b[0m` : `${label} ${text}`);
  w("\x1b[u");
  clrLine();
  w("\r" + PROMPT + inputBuf);
}

// ── WebSocket ────────────────────────────────────────────────────
const ws = new WebSocket(`ws://localhost:${process.env.PORT ?? 3000}/ws?token=${token}`);

ws.onopen = () => ws.send(JSON.stringify({ type: "join", channelId: channel.id }));

ws.onmessage = (e) => {
  const msg = JSON.parse(e.data as string);
  if (msg.type === "message") {
    const self = msg.username === username;
    const label = self ? "\x1b[2m[you]\x1b[0m" : `\x1b[36m[${msg.username}]\x1b[0m`;
    printLine(label, msg.text);
  } else if (msg.type === "joined" && msg.username !== username) {
    printLine("·", `${msg.username} joined`, true);
  } else if (msg.type === "left") {
    printLine("·", `${msg.username} left`, true);
  } else if (msg.type === "error") {
    printLine("\x1b[31m[error]\x1b[0m", msg.message);
  }
};

ws.onclose = () => { printLine("·", "disconnected", true); setTimeout(() => process.exit(0), 500); };
ws.onerror = () => printLine("\x1b[31m[error]\x1b[0m", "connection lost");

// ── Raw input ────────────────────────────────────────────────────
process.stdin.setRawMode(true);
process.stdin.resume();
process.stdin.setEncoding("utf8");

process.stdin.on("data", (key: string) => {
  if (key === "\x03") {                         // Ctrl+C
    w("\x1b[r\x1b[2J\x1b[H");
    ws.close();
    process.exit(0);
  }

  if (key === "\r") {                           // Enter
    const text = inputBuf.trim();
    inputBuf = "";
    move(IN_ROW); clrLine(); w("\r" + PROMPT);
    if (text) ws.send(JSON.stringify({ type: "message", channelId: channel.id, text }));
    return;
  }

  if (key === "\x7f" || key === "\b") {         // Backspace
    if (inputBuf.length > 0) {
      inputBuf = inputBuf.slice(0, -1);
      move(IN_ROW); clrLine(); w("\r" + PROMPT + inputBuf);
    }
    return;
  }

  if (key.charCodeAt(0) < 32) return;           // ignore other control chars

  inputBuf += key;
  w(key);
});
