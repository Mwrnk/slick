# Slick — Project Notes

## Stack
Bun, Hono v4, `bun:sqlite`, Web Crypto JWT, `bun test`

## Test runner
Uses `bun test` (NOT vitest — bun:sqlite not compatible with vitest workers).
Test imports: `from "bun:test"`, not `from "vitest"`.

## Progress

- [x] Task 1: Project scaffold
- [x] Task 2: DB schema + queries
- [x] Task 3: JWT sign/verify (`src/lib/jwt.ts`)
- [x] Task 4: RoomManager (`src/ws/room.ts`)
- [x] Task 5: Server + middleware + test helpers
- [x] Task 6: Auth routes (`src/routes/auth.ts`)
- [x] Task 7: Workspace + Channel routes
- [x] Task 8: WS event handler
- [ ] **Task 9: E2E WebSocket test** ← NEXT

## Collaboration rules
- `[U]` tasks: guide user step by step, let them write
- `[C]` tasks: write files directly with tools
- Never run tests — user does it
- Never commit — user does it (remind with exact command after each task)
- Write files directly, never paste code for user to copy
- Caveman full mode every response
