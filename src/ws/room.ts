import type { ServerWebSocket } from "bun";

export type WsData = { userId: string; username: string };

export class RoomManager {
  private channels = new Map<string, Set<ServerWebSocket<WsData>>>();

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
}
