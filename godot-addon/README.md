# WebSocket RPC Client for Godot 4.x

Bidirectional WebSocket RPC client addon for Godot 4.x. Designed for AI-powered games where the server (AI) needs to call functions on the game client.

## Features

- **Bidirectional RPC**: Both client and server can call methods on each other
- **JSON-RPC 2.0** inspired protocol
- **Auto-reconnect** with exponential backoff
- **Request timeout** handling
- **Signal-based API** for Godot integration
- **Async/await** support for method calls

## Installation

1. Copy the `addons/ws_rpc` folder into your project's `addons/` directory
2. Enable the plugin in Project Settings → Plugins
3. The `RPC` autoload singleton will be automatically available

## Quick Start

```gdscript
extends Node

func _ready():
    # Connect signals
    RPC.connected.connect(_on_connected)
    RPC.disconnected.connect(_on_disconnected)

    # Register handlers for server-to-client calls
    RPC.register_handler("tool.move_player", _handle_move)

    # Connect to server
    RPC.connect_to_server("ws://localhost:3000/ws")

func _on_connected():
    print("Connected!")

func _on_disconnected(code: int, reason: String):
    print("Disconnected: %s" % reason)

# Server calls this function on the client
func _handle_move(params: Dictionary) -> Dictionary:
    var target = Vector2(params.x, params.y)
    $Player.position = target
    return {"success": true}
```

## API Reference

### Connection

```gdscript
# Connect to a WebSocket server
RPC.connect_to_server(url: String) -> Error

# Disconnect from server
RPC.disconnect_from_server() -> void

# Check if connected
RPC.is_connected_to_server() -> bool
```

### Client → Server Calls

```gdscript
# Call a method and await response
var result = await RPC.call_method("method.name", {"param": "value"})

# Send notification (no response)
RPC.notify_server("event.name", {"data": 123})
```

### Server → Client Handlers

```gdscript
# Register a handler
RPC.register_handler("tool.action", _my_handler)

# Handler function (can be async)
func _my_handler(params: Dictionary) -> Dictionary:
    # Do something...
    return {"result": "value"}

# Unregister handler
RPC.unregister_handler("tool.action")
```

### Signals

| Signal | Parameters | Description |
|--------|------------|-------------|
| `connected` | - | Successfully connected to server |
| `disconnected` | `code: int, reason: String` | Disconnected from server |
| `reconnecting` | `attempt: int` | Attempting to reconnect |
| `error` | `err: RpcError` | An error occurred |
| `notification_received` | `method: String, params: Variant` | Server sent a notification |

### Configuration

```gdscript
# All configurable via @export or code
RPC.timeout_ms = 30000           # Request timeout (ms)
RPC.auto_reconnect = true        # Auto-reconnect on disconnect
RPC.reconnect_delay_ms = 1000    # Initial reconnect delay
RPC.max_reconnect_delay_ms = 30000  # Max reconnect delay
RPC.max_reconnect_attempts = 0   # 0 = infinite
```

## Protocol

The addon uses a JSON-RPC 2.0 inspired protocol:

### Request
```json
{
  "jsonrpc": "2.0",
  "id": "unique-id",
  "method": "method.name",
  "params": { "key": "value" }
}
```

### Response
```json
{
  "jsonrpc": "2.0",
  "id": "unique-id",
  "result": { "key": "value" }
}
```

### Error Response
```json
{
  "jsonrpc": "2.0",
  "id": "unique-id",
  "error": {
    "code": -32600,
    "message": "Invalid request",
    "data": null
  }
}
```

### Notification (no response expected)
```json
{
  "jsonrpc": "2.0",
  "method": "event.name",
  "params": { "data": 123 }
}
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
| -32001 | CONNECTION_CLOSED | Connection was closed |

## Use Case: AI Tool Execution

This addon is designed for AI-powered games where an AI server (using LLMs) needs to execute actions in the game:

```
┌─────────────────────────────────────────────────────┐
│                    AI Server                         │
│  ┌─────────┐    ┌─────────────┐    ┌────────────┐  │
│  │   LLM   │───▶│ Tool: move  │───▶│  WebSocket │  │
│  │ (GPT-4) │    │ Tool: attack│    │    RPC     │  │
│  └─────────┘    └─────────────┘    └─────┬──────┘  │
└──────────────────────────────────────────│──────────┘
                                           │
                                   WebSocket Connection
                                           │
┌──────────────────────────────────────────▼──────────┐
│                  Godot Game Client                   │
│  ┌──────────────────────────────────────────────┐  │
│  │  RPC.register_handler("tool.move", _move)    │  │
│  │  RPC.register_handler("tool.attack", _atk)   │  │
│  └──────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
```

See `examples/example_usage.gd` for a complete example.

## License

MIT
