import { describe, it, expect, mock } from "bun:test";
import { RoomManager } from "../../src/ws/room";
import type { WsData } from "../../src/ws/room";

function makeWs(userId: string, username: string) {
  return { data: { userId, username } as WsData, send: mock() } as any;
}

describe("RoomManager", () => {
  it("join → isInChannel true", () => {
    const rooms = new RoomManager();
    const ws = makeWs("1", "alice");
    rooms.join("ch-1", ws);
    expect(rooms.isInChannel("ch-1", ws)).toBe(true);
  });

  it("leave → isInChannel false", () => {
    const rooms = new RoomManager();
    const ws = makeWs("1", "alice");
    rooms.join("ch-1", ws);
    rooms.leave("ch-1", ws);
    expect(rooms.isInChannel("ch-1", ws)).toBe(false);
  });

  it("broadcast → send called on all members", () => {
    const rooms = new RoomManager();
    const alice = makeWs("1", "alice");
    const bob = makeWs("2", "bob");
    rooms.join("ch-1", alice);
    rooms.join("ch-1", bob);
    const data = { type: "message", text: "hi" };
    rooms.broadcast("ch-1", data);
    expect(alice.send).toHaveBeenCalledWith(JSON.stringify(data));
    expect(bob.send).toHaveBeenCalledWith(JSON.stringify(data));
  });

  it("broadcast with except → skips that ws", () => {
    const rooms = new RoomManager();
    const alice = makeWs("1", "alice");
    const bob = makeWs("2", "bob");
    rooms.join("ch-1", alice);
    rooms.join("ch-1", bob);
    rooms.broadcast("ch-1", { type: "message" }, alice);
    expect(alice.send).not.toHaveBeenCalled();
    expect(bob.send).toHaveBeenCalled();
  });

  it("broadcast on unknown channel → no throw", () => {
    const rooms = new RoomManager();
    expect(() => rooms.broadcast("nonexistent", { type: "ping" })).not.toThrow();
  });

  it("leaveAll → isInChannel false on every channel", () => {
    const rooms = new RoomManager();
    const ws = makeWs("1", "alice");
    rooms.join("ch-1", ws);
    rooms.join("ch-2", ws);
    rooms.leaveAll(ws);
    expect(rooms.isInChannel("ch-1", ws)).toBe(false);
    expect(rooms.isInChannel("ch-2", ws)).toBe(false);
  });
});

describe("RoomManager — presence", () => {
  it("markOnline / getOnlineUsers", () => {
    const rooms = new RoomManager();
    rooms.markOnline("u1", "alice");
    rooms.markOnline("u2", "bob");
    const online = rooms.getOnlineUsers();
    expect(online).toHaveLength(2);
    expect(online.some((u) => u.userId === "u1" && u.username === "alice")).toBe(true);
  });

  it("markOffline removes user", () => {
    const rooms = new RoomManager();
    rooms.markOnline("u1", "alice");
    rooms.markOffline("u1");
    expect(rooms.getOnlineUsers()).toHaveLength(0);
  });

  it("disconnectUser broadcasts presence offline then removes", () => {
    const rooms = new RoomManager();
    const ws = makeWs("u1", "alice");
    const observer = makeWs("u2", "bob");
    rooms.join("ch-1", ws);
    rooms.join("ch-1", observer);
    rooms.markOnline("u1", "alice");
    rooms.disconnectUser(ws);
    expect(rooms.isInChannel("ch-1", ws)).toBe(false);
    expect(rooms.getOnlineUsers().some((u) => u.userId === "u1")).toBe(false);
    const calls = (observer.send as ReturnType<typeof mock>).mock.calls;
    const msgs = calls.map((c: any[]) => JSON.parse(c[0]));
    expect(msgs.some((m: any) => m.type === "presence" && m.status === "offline" && m.userId === "u1")).toBe(true);
  });
});

describe("RoomManager — typing", () => {
  it("startTyping broadcasts typing event to channel", () => {
    const rooms = new RoomManager();
    const alice = makeWs("u1", "alice");
    const bob = makeWs("u2", "bob");
    rooms.join("ch-1", alice);
    rooms.join("ch-1", bob);
    rooms.startTyping("ch-1", "u1", "alice");
    const msgs = (bob.send as ReturnType<typeof mock>).mock.calls.map((c: any[]) => JSON.parse(c[0]));
    expect(msgs.some((m: any) => m.type === "typing" && m.userId === "u1")).toBe(true);
  });
});
