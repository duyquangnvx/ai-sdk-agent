# Assistant Addon for Godot

A flexible AI Assistant integration addon for Godot 4.x. Works as a generic library where game-specific tools are defined by the game itself.

## Requirements

- Godot 4.x
- **ws_rpc addon** must be enabled (handles WebSocket communication)

## Installation

1. Copy the `addons/assistant` folder to your project's `addons/` directory
2. Enable both addons in Project Settings > Plugins:
   - First enable **WS_RPC**
   - Then enable **Assistant**

## Quick Start

```gdscript
extends Node

func _ready():
    # 1. Register game-specific tools
    Assistant.register_tool("game.getPlayer", _handle_get_player)
    Assistant.register_tool("game.movePlayer", _handle_move_player)

    # 2. Connect to interaction signals (for UI)
    Assistant.ask_user_requested.connect(_on_ask_user)
    Assistant.plan_submitted.connect(_on_plan)

    # 3. Connect to server
    Assistant.connect_to_server("ws://localhost:3000/ws")


# Tool handlers receive Dictionary params and return Dictionary result
func _handle_get_player(_params: Dictionary) -> Dictionary:
    return {
        "name": player.name,
        "position": { "x": player.position.x, "y": player.position.y },
        "health": player.health
    }


func _handle_move_player(params: Dictionary) -> Dictionary:
    var target = Vector2(params.x, params.y)
    await player.move_to(target)
    return { "success": true }
```

## API Reference

### Signals

| Signal | Description |
|--------|-------------|
| `connected()` | Emitted when connected to server |
| `disconnected(code: int, reason: String)` | Emitted when disconnected |
| `reconnecting(attempt: int)` | Emitted during reconnection attempts |
| `error(err: RpcError)` | Emitted on RPC errors |
| `ask_user_requested(request_id, title, questions)` | AI wants to ask user questions |
| `plan_submitted(request_id, todos)` | AI submitted a plan for approval |
| `tool_called(method, params)` | A tool was called (for debugging) |
| `tool_completed(method, result)` | A tool completed (for debugging) |

### Connection Methods

```gdscript
# Connect to AI server
Assistant.connect_to_server("ws://localhost:3000/ws") -> Error

# Disconnect from server
Assistant.disconnect_from_server() -> void

# Check connection status
Assistant.is_connected() -> bool
```

### Tool Registration

```gdscript
# Register a tool handler
Assistant.register_tool("game.myTool", my_handler) -> void

# Unregister a tool
Assistant.unregister_tool("game.myTool") -> void

# Check if tool exists
Assistant.has_tool("game.myTool") -> bool

# Get all registered tools
Assistant.get_registered_tools() -> Array[String]
```

### Interaction Responses

```gdscript
# Respond to ask_user request
Assistant.respond_ask_user(request_id, answers) -> void

# Cancel ask_user request (user closed dialog)
Assistant.cancel_ask_user(request_id) -> void

# Respond to plan submission
Assistant.respond_plan(request_id, approved) -> void
```

### Configuration

```gdscript
# Set via @export in editor or code
Assistant.server_url = "ws://localhost:3000/ws"
Assistant.auto_connect = false
Assistant.interaction_timeout_ms = 300000  # 5 minutes
```

### Session State

```gdscript
# Read-only session info (set on connect)
Assistant.session_id        # Unique session ID
Assistant.session_created_at  # Unix timestamp

# Writable metadata (for game-specific data)
Assistant.session_metadata = { "player_id": "123" }
```

## Handling Interactions

### ask_user

When the AI wants to ask the user questions:

```gdscript
func _on_ask_user(request_id: String, title: String, questions: Array):
    # questions is Array of Dictionary:
    # {
    #   "id": "q1",
    #   "type": "single_choice" | "multiple_choice" | "text" | "number" | "confirm",
    #   "question": "Which option?",
    #   "description": "Optional context",
    #   "required": true,
    #   "options": [{ "label": "Option A", "value": "a" }],  # for choice types
    #   "placeholder": "",     # for text
    #   "maxLength": -1,       # for text
    #   "min": 0, "max": 100,  # for number
    #   "step": 1              # for number
    # }

    # Show your UI dialog...

    # When user submits:
    var answers = [
        { "questionId": "q1", "value": "selected_value" },
        { "questionId": "q2", "value": ["a", "b"] },  # multiple_choice
        { "questionId": "q3", "value": 42 },          # number
        { "questionId": "q4", "value": true },        # confirm
    ]
    Assistant.respond_ask_user(request_id, answers)

    # Or if user cancels:
    Assistant.cancel_ask_user(request_id)
```

### submit_plan

When the AI submits a plan for approval:

```gdscript
func _on_plan(request_id: String, todos: Array):
    # todos is Array of Dictionary:
    # {
    #   "content": "Create player entity",
    #   "status": "pending" | "in_progress" | "completed"
    # }

    # Show plan approval dialog...

    # When user approves:
    Assistant.respond_plan(request_id, true)

    # When user rejects:
    Assistant.respond_plan(request_id, false)
```

## Built-in RPC Methods

The addon automatically registers these handlers:

| RPC Method | Description |
|------------|-------------|
| `game.askUser` | Shows questions, waits for user response |
| `game.submitPlan` | Shows plan, waits for approval |

## Type Classes

### AssistantQuestion

```gdscript
var q = AssistantQuestion.from_dict(data)
q.id           # String
q.type         # AssistantQuestion.Type enum
q.question     # String
q.description  # String
q.required     # bool
q.options      # Array[Dictionary]
q.placeholder  # String (text type)
q.max_length   # int (text type)
q.min_value    # float (number type)
q.max_value    # float (number type)
q.step         # float (number type)
```

### AssistantAnswer

```gdscript
var a = AssistantAnswer.create("question_id", "value")
a.question_id  # String
a.value        # Variant (String, Array, float, or bool)
```

### AssistantPlan

```gdscript
var p = AssistantPlan.from_dict(data)
p.todos              # Array[Dictionary]
p.summary            # String
p.get_count()        # int
p.get_pending_count()    # int
p.get_completed_count()  # int
```

## Architecture

```
┌─────────────────────────────────────────────────┐
│                   GAME CODE                      │
│  - Register tools                                │
│  - Handle UI signals                             │
│  - Provide custom dialogs                        │
├─────────────────────────────────────────────────┤
│                ASSISTANT ADDON                   │
│  - Tool registry                                 │
│  - Built-in interaction handlers                 │
│  - Session management                            │
│  - Signal-based UI integration                   │
├─────────────────────────────────────────────────┤
│                 WS_RPC ADDON                     │
│  - WebSocket connection                          │
│  - JSON-RPC protocol                             │
│  - Auto-reconnect                                │
└─────────────────────────────────────────────────┘
```

## Example: Complete Integration

```gdscript
extends Node

@export var server_url: String = "ws://localhost:3000/ws"

func _ready():
    # Setup signals
    Assistant.connected.connect(_on_connected)
    Assistant.disconnected.connect(_on_disconnected)
    Assistant.ask_user_requested.connect(_on_ask_user)
    Assistant.plan_submitted.connect(_on_plan)

    # Register game tools
    Assistant.register_tool("game.listEntities", _list_entities)
    Assistant.register_tool("game.createEntity", _create_entity)
    Assistant.register_tool("game.deleteEntity", _delete_entity)

    # Connect
    Assistant.connect_to_server(server_url)


func _on_connected():
    print("Connected! Session: ", Assistant.session_id)


func _on_disconnected(code: int, reason: String):
    print("Disconnected: ", reason)


func _list_entities(_params: Dictionary) -> Dictionary:
    var entities = []
    for child in $Entities.get_children():
        entities.append({
            "id": child.name,
            "type": child.get_class(),
            "position": { "x": child.position.x, "y": child.position.y }
        })
    return { "entities": entities }


func _create_entity(params: Dictionary) -> Dictionary:
    var entity = preload("res://entity.tscn").instantiate()
    entity.name = params.get("name", "Entity")
    entity.position = Vector2(params.get("x", 0), params.get("y", 0))
    $Entities.add_child(entity)
    return { "success": true, "id": entity.name }


func _delete_entity(params: Dictionary) -> Dictionary:
    var entity = $Entities.get_node_or_null(params.id)
    if entity:
        entity.queue_free()
        return { "success": true }
    return { "success": false, "error": "Entity not found" }


func _on_ask_user(request_id: String, title: String, questions: Array):
    var dialog = preload("res://ui/ask_dialog.tscn").instantiate()
    dialog.setup(title, questions)
    dialog.submitted.connect(func(answers):
        Assistant.respond_ask_user(request_id, answers)
    )
    dialog.cancelled.connect(func():
        Assistant.cancel_ask_user(request_id)
    )
    add_child(dialog)


func _on_plan(request_id: String, todos: Array):
    var dialog = preload("res://ui/plan_dialog.tscn").instantiate()
    dialog.setup(todos)
    dialog.approved.connect(func():
        Assistant.respond_plan(request_id, true)
    )
    dialog.rejected.connect(func():
        Assistant.respond_plan(request_id, false)
    )
    add_child(dialog)
```

## License

MIT
