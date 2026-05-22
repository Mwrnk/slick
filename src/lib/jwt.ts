const SECRET = process.env.JWT_SECRET ?? "dev-secret-change-in-prod";
const ALG = { name: "HMAC", hash: "SHA-256" };

export type JwtPayload = { sub: string; username: string; exp: number };

async function importKey() {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(SECRET),
    ALG,
    false,
    ["sign", "verify"]
  );
}

function b64url(data: ArrayBuffer | string): string {
  const bytes =
    typeof data === "string"
      ? new TextEncoder().encode(data)
      : new Uint8Array(data);
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function b64urlDecode(str: string): Uint8Array {
  const base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
}

export async function sign(payload: { sub: string; username: string }): Promise<string> {
  const header = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = b64url(
    JSON.stringify({ ...payload, exp: Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60 })
  );
  const key = await importKey();
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(`${header}.${body}`)
  );
  return `${header}.${body}.${b64url(sig)}`;
}

export async function verify(token: string): Promise<JwtPayload | null> {
  const parts = token.split(".");
  if (parts.length !== 3) return null;

  const [header, body, sig] = parts;
  const key = await importKey();
  const valid = await crypto.subtle.verify(
    "HMAC",
    key,
    b64urlDecode(sig),
    new TextEncoder().encode(`${header}.${body}`)
  );
  if (!valid) return null;

  const payload: JwtPayload = JSON.parse(
    new TextDecoder().decode(b64urlDecode(body))
  );
  if (payload.exp < Math.floor(Date.now() / 1000)) return null;

  return payload;
}
