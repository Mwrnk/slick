import type { ServerWebSocket } from "bun";

export type WsData = { userId: string; username: string };

export class RoomManager {
  private channels = new Map<string, Set<ServerWebSocket<WsData>>>();
  private onlineUsers = new Map<string, string>(); // userId -> username
  private typingTimers = new Map<string, Map<string, ReturnType<typeof setTimeout>>>();

  join(channelId: string, ws: ServerWebSocket<WsData>) {
    if (!this.channels.has(channelId)) this.channels.set(channelId, new Set());
    this.channels.get(channelId)!.add(ws);
  }

  leave(channelId: string, ws: ServerWebSocket<WsData>) {
    this.channels.get(channelId)?.delete(ws);
  }

  leaveAll(ws: ServerWebSocket<WsData>) {
    for (const members of this.channels.values()) members.delete(ws);
  }

  broadcast(channelId: string, data: object, except?: ServerWebSocket<WsData>) {
    const members = this.channels.get(channelId);
    if (!members) return;
    const msg = JSON.stringify(data);
    for (const ws of members) {
      if (ws !== except) ws.send(msg);
    }
  }

  isInChannel(channelId: string, ws: ServerWebSocket<WsData>): boolean {
    return this.channels.get(channelId)?.has(ws) ?? false;
  }

  markOnline(userId: string, username: string): void {
    this.onlineUsers.set(userId, username);
  }

  markOffline(userId: string): void {
    this.onlineUsers.delete(userId);
  }

  getOnlineUsers(): { userId: string; username: string }[] {
    return Array.from(this.onlineUsers.entries()).map(([userId, username]) => ({ userId, username }));
  }

  disconnectUser(ws: ServerWebSocket<WsData>): void {
    const { userId, username } = ws.data;
    for (const [channelId, userTimers] of this.typingTimers) {
      const timer = userTimers.get(userId);
      if (timer) {
        clearTimeout(timer);
        userTimers.delete(userId);
        if (userTimers.size === 0) this.typingTimers.delete(channelId);
      }
    }
    for (const [channelId, members] of this.channels) {
      if (members.has(ws)) {
        members.delete(ws);
        this.broadcast(channelId, { type: "presence", userId, username, status: "offline" });
      }
    }
    this.markOffline(userId);
  }

  startTyping(channelId: string, userId: string, username: string): void {
    if (!this.typingTimers.has(channelId)) this.typingTimers.set(channelId, new Map());
    const existing = this.typingTimers.get(channelId)!.get(userId);
    if (existing) clearTimeout(existing);
    const timer = setTimeout(() => {
      this.broadcast(channelId, { type: "stopped_typing", channelId, userId, username });
      const userTimers = this.typingTimers.get(channelId);
      if (userTimers) {
        userTimers.delete(userId);
        if (userTimers.size === 0) this.typingTimers.delete(channelId);
      }
    }, 3000);
    this.typingTimers.get(channelId)!.set(userId, timer);
    this.broadcast(channelId, { type: "typing", channelId, userId, username });
  }
}
