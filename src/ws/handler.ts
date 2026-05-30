import type { Database } from "bun:sqlite";
import type { ServerWebSocket } from "bun";
import { createMessage } from "../db/queries";
import type { RoomManager, WsData } from "./room";

type IncomingEvent =
  | { type: "join"; channelId: string }
  | { type: "leave"; channelId: string }
  | { type: "message"; channelId: string; text: string };

function send(ws: ServerWebSocket<WsData>, data: object) {
  ws.send(JSON.stringify(data));
}

export function handleMessage(
  ws: ServerWebSocket<WsData>,
  raw: string,
  rooms: RoomManager,
  db: Database
) {
  let event: IncomingEvent;
  try {
    event = JSON.parse(raw) as IncomingEvent;
  } catch {
    send(ws, { type: "error", message: "invalid json" });
    return;
  }

  const { userId, username } = ws.data;

  switch (event.type) {
    case "join": {
      const { channelId } = event;
      if (!channelId) { send(ws, { type: "error", message: "channelId required" }); return; }
      rooms.join(channelId, ws);
      rooms.broadcast(channelId, { type: "joined", channelId, userId, username });
      break;
    }
    case "leave": {
      const { channelId } = event;
      if (!channelId) { send(ws, { type: "error", message: "channelId required" }); return; }
      rooms.leave(channelId, ws);
      rooms.broadcast(channelId, { type: "left", channelId, userId, username });
      break;
    }
    case "message": {
      const { channelId, text } = event;
      if (!channelId || !text) { send(ws, { type: "error", message: "channelId and text required" }); return; }
      if (!rooms.isInChannel(channelId, ws)) { send(ws, { type: "error", message: "not in channel" }); return; }
      const createdAt = Date.now();
      createMessage(db, channelId, userId, text);
      rooms.broadcast(channelId, { type: "message", channelId, userId, username, text, createdAt });
      break;
    }
    default: {
      send(ws, { type: "error", message: "unknown event type" });
    }
  }
}
