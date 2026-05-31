# Slick

Slick is a small chat backend built with Bun, Hono, SQLite, and WebSocket support.
It provides auth, workspaces, channels, and real-time message delivery over a
simple JSON protocol.

## Preview

<img width="832" height="656" alt="Screenshot 2026-05-30 at 21 08 49" src="https://github.com/user-attachments/assets/55110bf4-a5c9-449c-98f5-afc8590999b6" />


## Stack

- Bun
- Hono v4
- `bun:sqlite`
- Web Crypto JWT
- WebSocket server

## Features

- Register and log in users with JWT auth
- Create and list workspaces
- Create and list channels per workspace
- Join channels over WebSocket
- Send and receive real-time channel messages
- Persist users, workspaces, channels, and messages in SQLite

## Requirements

- Bun
- SQLite database file path available to the process

## Setup

1. Install dependencies.
2. Set the environment variables you need.
3. Start the server.

```bash
bun install
```

```bash
PORT=3000 DB_PATH=./slick.db JWT_SECRET=change-me bun run src/server.ts
```

If `DB_PATH` is not set, the app uses `slick.db` in the project root.
If `JWT_SECRET` is not set, the app falls back to a development secret.

## Scripts

- `bun run dev` - start the server
- `bun run test` - run the test suite
- `bun run test:watch` - watch tests
- `bun run chat` - start the chat app in `apps/chat`

## API

### Auth

- `POST /auth/register`
- `POST /auth/login`

Example body:

```json
{
  "username": "alice",
  "password": "secret"
}
```

Successful auth returns:

```json
{
  "token": "jwt-token"
}
```

### Workspaces

- `GET /workspaces`
- `POST /workspaces`

Create workspace body:

```json
{
  "name": "Design"
}
```

### Channels

- `GET /channels/:workspaceId`
- `POST /channels/:workspaceId`

Create channel body:

```json
{
  "name": "general"
}
```

## WebSocket

Connect with a JWT token:

```text
/ws?token=JWT_TOKEN
```

Incoming events:

```json
{ "type": "join", "channelId": "..." }
{ "type": "leave", "channelId": "..." }
{ "type": "message", "channelId": "...", "text": "hello" }
```

Server events:

```json
{ "type": "joined", "channelId": "...", "userId": "...", "username": "..." }
{ "type": "left", "channelId": "...", "userId": "...", "username": "..." }
{ "type": "message", "channelId": "...", "userId": "...", "username": "...", "text": "...", "createdAt": 123 }
{ "type": "error", "message": "..." }
```

## Database

The app creates these tables on startup:

- `users`
- `workspaces`
- `channels`
- `messages`

