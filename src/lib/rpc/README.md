# WebSocket RPC Library

A type-safe, bidirectional WebSocket RPC library for Node.js/Fastify with Zod schema validation.

## Features

- **Bidirectional RPC**: Server and client can call methods on each other
- **Type-safe**: Full TypeScript inference from Zod schemas
- **Fastify Integration**: First-class Fastify plugin support
- **Request Timeout**: Automatic timeout handling for pending requests
- **Lifecycle Hooks**: Hook into connection, request, response, and error events
- **Connection Management**: Track connections, broadcast, and target specific clients
- **Auto-reconnect**: Client-side reconnection with exponential backoff

## Installation

The library is part of the project. Import from:

```typescript
import { rpcPlugin, defineMethod, RpcClient } from "@/lib/rpc";
```

## Quick Start

### 1. Define Methods (Shared)

```typescript
// src/rpc/methods.ts
import { z } from "zod";
import { defineMethod } from "@/lib/rpc";

export const methods = {
  "user.get": defineMethod({
    input: z.object({ id: z.string() }),
    output: z.object({ id: z.string(), name: z.string(), email: z.string() }),
  }),
  "chat.send": defineMethod({
    input: z.object({ roomId: z.string(), message: z.string() }),
    output: z.object({ messageId: z.string(), timestamp: z.string() }),
  }),
} as const;

export type Methods = typeof methods;
```

### 2. Server Setup

```typescript
// src/app.ts
import Fastify from "fastify";
import { rpcPlugin } from "@/lib/rpc";
import { methods } from "./rpc/methods";

const app = Fastify({ logger: true });

// Register RPC plugin
await app.register(rpcPlugin, {
  path: "/ws",
  timeout: 30000,
  hooks: {
    onConnection: (conn) => app.log.info(`Connected: ${conn.id}`),
    onDisconnect: (conn) => app.log.info(`Disconnected: ${conn.id}`),
  },
});

// Register method handlers
app.rpc.router
  .method("user.get", methods["user.get"], async (ctx) => {
    // ctx.params is typed as { id: string }
    const user = await db.users.findById(ctx.params.id);
    return { id: user.id, name: user.name, email: user.email };
  })
  .method("chat.send", methods["chat.send"], async (ctx) => {
    const { roomId, message } = ctx.params;
    const saved = await db.messages.create({ roomId, message });

    // Broadcast to other users in room
    ctx.connections.broadcastTo(
      (conn) => conn.metadata.roomId === roomId,
      "chat.message",
      { roomId, message, sender: ctx.connection.metadata.userId }
    );

    return { messageId: saved.id, timestamp: saved.createdAt };
  });

await app.listen({ port: 3000 });
```

### 3. Server Calling Client

```typescript
// Server can call methods on connected clients
const result = await app.rpc.connections.call<{ status: string }>(
  connectionId,
  "client.getStatus",
  { requestId: "123" }
);

// Or send notifications (no response expected)
app.rpc.connections.notify(connectionId, "game.event", { type: "spawn" });

// Broadcast to all
app.rpc.connections.broadcast("server.announcement", { message: "Hello!" });
```

### 4. Client Setup (TypeScript)

```typescript
import { RpcClient } from "@/lib/rpc";
import type { Methods } from "./rpc/methods";

const client = new RpcClient<Methods>({
  url: "ws://localhost:3000/ws",
  timeout: 30000,
  autoReconnect: true,
});

// Handle server-to-client calls
client.handle("client.getStatus", async (params) => {
  return { status: "online", timestamp: Date.now() };
});

// Events
client.on("connect", () => console.log("Connected!"));
client.on("disconnect", (code, reason) => console.log(`Disconnected: ${reason}`));
client.on("notification", (method, params) => console.log(`Event: ${method}`));

// Connect
await client.connect();

// Call server methods (fully typed!)
const user = await client.call["user.get"]({ id: "123" });
// TypeScript knows: user is { id: string, name: string, email: string }
```

## API Reference

### Server

#### `rpcPlugin(options)`

Fastify plugin that sets up WebSocket RPC.

```typescript
interface RpcPluginOptions {
  path?: string;              // WebSocket endpoint (default: "/ws")
  timeout?: number;           // Request timeout in ms (default: 30000)
  heartbeatInterval?: number; // Heartbeat interval in ms (default: 30000)
  maxPayloadLength?: number;  // Max message size (default: 1MB)
  hooks?: RpcHooks;           // Lifecycle hooks
}
```

#### `app.rpc.router`

Method router for registering handlers.

```typescript
app.rpc.router.method(
  name: string,
  definition: RpcMethodDef,
  handler: (ctx: RpcContext) => Promise<Output>
);
```

#### `app.rpc.connections`

Connection manager for server-to-client communication.

```typescript
// Get connection
connections.get(id: string): RpcConnection | undefined

// Get all connections
connections.getAll(): RpcConnection[]

// Find by predicate
connections.find((conn) => conn.metadata.userId === "123"): RpcConnection[]

// Call client method
connections.call<T>(connId, method, params, options?): Promise<T>

// Send notification
connections.notify(connId, method, params): void

// Broadcast to all
connections.broadcast(method, params): void

// Broadcast to matching connections
connections.broadcastTo(predicate, method, params): void
```

#### Lifecycle Hooks

```typescript
interface RpcHooks {
  onConnection?: (connection: RpcConnection) => void | Promise<void>;
  onDisconnect?: (connection: RpcConnection, code: number, reason: string) => void | Promise<void>;
  onRequest?: (ctx: RpcContext, method: string) => void | Promise<void>;
  onResponse?: (ctx: RpcContext, method: string, result: unknown) => void | Promise<void>;
  onError?: (ctx: RpcContext | null, error: Error, method?: string) => void | Promise<void>;
}
```

### Client

#### `RpcClient<TServerMethods>`

```typescript
interface RpcClientOptions {
  url: string;                    // WebSocket URL
  timeout?: number;               // Request timeout (default: 30000)
  autoReconnect?: boolean;        // Auto-reconnect (default: true)
  reconnectDelay?: number;        // Initial delay (default: 1000)
  maxReconnectDelay?: number;     // Max delay (default: 30000)
  maxReconnectAttempts?: number;  // Max attempts, 0=infinite (default: 0)
}

const client = new RpcClient<Methods>(options);

// Connection
client.connect(): Promise<void>
client.disconnect(): void
client.connected: boolean

// Call server (typed from Methods)
client.call["method.name"](params, options?): Promise<Result>

// Handle server-to-client calls
client.handle(method, handler): void

// Send notification
client.notify(method, params): void

// Events
client.on("connect", () => {})
client.on("disconnect", (code, reason) => {})
client.on("reconnecting", (attempt) => {})
client.on("error", (error) => {})
client.on("notification", (method, params) => {})
```

## Protocol

The library uses a JSON-RPC 2.0 inspired protocol:

### Request
```json
{ "jsonrpc": "2.0", "id": "abc123", "method": "user.get", "params": { "id": "1" } }
```

### Response
```json
{ "jsonrpc": "2.0", "id": "abc123", "result": { "id": "1", "name": "John" } }
```

### Error Response
```json
{ "jsonrpc": "2.0", "id": "abc123", "error": { "code": -32601, "message": "Method not found" } }
```

### Notification (no response)
```json
{ "jsonrpc": "2.0", "method": "chat.message", "params": { "text": "Hello" } }
```

## Error Codes

| Code | Name | Description |
|------|------|-------------|
| -32700 | PARSE_ERROR | Invalid JSON |
| -32600 | INVALID_REQUEST | Invalid request object |
| -32601 | METHOD_NOT_FOUND | Method not found |
| -32602 | INVALID_PARAMS | Invalid parameters |
| -32603 | INTERNAL_ERROR | Internal error |
| -32000 | TIMEOUT | Request timed out |
| -32001 | CONNECTION_CLOSED | Connection closed |
| -32002 | UNAUTHORIZED | Unauthorized |
| -32003 | RATE_LIMITED | Rate limited |

## Use Case: AI Tool Execution

This library was designed for AI-powered applications where an LLM needs to execute tools on the client:

```
┌─────────────────────────────────────────────────────────┐
│                     AI Server                            │
│  ┌─────────┐    ┌─────────────┐    ┌────────────────┐  │
│  │   LLM   │───▶│ Tool calls  │───▶│ WebSocket RPC  │  │
│  │         │    │ move_player │    │                │  │
│  └─────────┘    │ get_inventory    └───────┬────────┘  │
└────────────────────────────────────────────│────────────┘
                                             │
                                    WebSocket Connection
                                             │
┌────────────────────────────────────────────▼────────────┐
│                    Game Client                           │
│  ┌──────────────────────────────────────────────────┐  │
│  │  client.handle("tool.move_player", handler)      │  │
│  │  client.handle("tool.get_inventory", handler)    │  │
│  └──────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

## File Structure

```
src/lib/rpc/
├── index.ts          # Main exports
├── types.ts          # TypeScript types and interfaces
├── protocol.ts       # Message schemas (Zod) and helpers
├── errors.ts         # RpcError class and error codes
├── server/
│   ├── plugin.ts     # Fastify plugin
│   ├── router.ts     # Method router
│   ├── connection.ts # Connection manager
│   └── handler.ts    # Message handler
└── client/
    └── index.ts      # RpcClient class
```

## License

MIT
