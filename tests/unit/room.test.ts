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
