extends Node
class_name AssistantCore
## AI Assistant integration singleton
##
## Provides:
## - Connection management (wraps ws_rpc)
## - Tool registration for game-specific handlers
## - Built-in interaction handlers (ask_user, submit_plan)
## - Signals for UI integration
##
## Usage:
## [codeblock]
## # Register game-specific tools
## Assistant.register_tool("game.listBlocks", _handle_list_blocks)
## Assistant.register_tool("game.createBlock", _handle_create_block)
##
## # Connect to interaction signals
## Assistant.ask_user_requested.connect(_on_ask_user_requested)
## Assistant.plan_submitted.connect(_on_plan_submitted)
##
## # Connect to server
## Assistant.connect_to_server("ws://localhost:3000/ws")
## [/codeblock]

#region Signals
## Emitted when successfully connected to server
signal connected()

## Emitted when disconnected from server
signal disconnected(code: int, reason: String)

## Emitted when attempting to reconnect
signal reconnecting(attempt: int)

## Emitted when an error occurs
signal error(err: RpcError)

## Emitted when ask_user RPC is received - game should show UI
## request_id: Unique ID for this request (used when responding)
## title: Modal/dialog title
## questions: Array of question dictionaries
signal ask_user_requested(request_id: String, title: String, questions: Array)

## Emitted when submit_plan RPC is received - game should show plan approval UI
## request_id: Unique ID for this request (used when responding)
## todos: Array of todo dictionaries { content, status }
signal plan_submitted(request_id: String, todos: Array)

## Emitted when a tool is called (for debugging/logging)
signal tool_called(method: String, params: Dictionary)

## Emitted when a tool execution completes (for debugging/logging)
signal tool_completed(method: String, result: Dictionary)
#endregion


#region Configuration
## Default server URL
@export var server_url: String = "ws://localhost:3000/ws"

## Whether to auto-connect on _ready
@export var auto_connect: bool = false

## Timeout for user interactions (ask_user, submit_plan) in milliseconds
@export var interaction_timeout_ms: int = 300000  # 5 minutes
#endregion


#region Session State
## Current session ID (generated on connect)
var session_id: String = ""

## Session creation timestamp
var session_created_at: int = 0

## Session metadata (can be set by game)
var session_metadata: Dictionary = {}
#endregion


#region Internal State
var _tool_registry: ToolRegistry
var _interaction_handler: InteractionHandler
var _rpc: Node  # Reference to RPC singleton
var _is_initialized: bool = false
#endregion


func _ready() -> void:
	_initialize()

	if auto_connect and not server_url.is_empty():
		connect_to_server(server_url)


func _initialize() -> void:
	if _is_initialized:
		return

	# Get RPC singleton
	_rpc = get_node_or_null("/root/RPC")
	if _rpc == null:
		push_error("Assistant: RPC singleton not found. Make sure ws_rpc addon is enabled.")
		return

	# Initialize components
	_tool_registry = ToolRegistry.new()
	_interaction_handler = InteractionHandler.new(self)

	# Connect to RPC signals
	_rpc.connected.connect(_on_rpc_connected)
	_rpc.disconnected.connect(_on_rpc_disconnected)
	_rpc.reconnecting.connect(_on_rpc_reconnecting)
	_rpc.error.connect(_on_rpc_error)

	_is_initialized = true


#region Connection API
## Connect to the AI server
func connect_to_server(url: String = "") -> Error:
	if not _is_initialized:
		_initialize()

	if _rpc == null:
		push_error("Assistant: Cannot connect - RPC not available")
		return ERR_UNAVAILABLE

	var target_url := url if not url.is_empty() else server_url
	if target_url.is_empty():
		push_error("Assistant: No server URL provided")
		return ERR_INVALID_PARAMETER

	return _rpc.connect_to_server(target_url)


## Disconnect from the server
func disconnect_from_server() -> void:
	if _rpc != null:
		_rpc.disconnect_from_server()

	# Cancel pending interactions
	if _interaction_handler != null:
		_interaction_handler.cancel_all()

	# Clear session
	session_id = ""
	session_created_at = 0


## Check if currently connected
func is_connected() -> bool:
	return _rpc != null and _rpc.is_connected_to_server()
#endregion


#region Tool Registration API
## Register a game-specific tool handler
## The handler should be: func(params: Dictionary) -> Dictionary
func register_tool(method: String, handler: Callable) -> void:
	if _tool_registry == null:
		_initialize()
	_tool_registry.register(method, handler)

	# Also register with RPC if connected
	if is_connected():
		_register_rpc_handler(method)


## Unregister a tool handler
func unregister_tool(method: String) -> void:
	if _tool_registry != null:
		_tool_registry.unregister(method)

	# Also unregister from RPC
	if _rpc != null and _rpc.has_handler(method):
		_rpc.unregister_handler(method)


## Check if a tool is registered
func has_tool(method: String) -> bool:
	return _tool_registry != null and _tool_registry.has(method)


## Get list of registered tool methods
func get_registered_tools() -> Array[String]:
	if _tool_registry == null:
		return []
	return _tool_registry.get_all_methods()
#endregion


#region Interaction Response API
## Respond to an ask_user request
## answers: Array of { questionId: String, value: Variant }
func respond_ask_user(request_id: String, answers: Array[Dictionary]) -> void:
	if _interaction_handler != null:
		_interaction_handler.respond_ask(request_id, answers)


## Cancel an ask_user request (user closed dialog without answering)
func cancel_ask_user(request_id: String) -> void:
	if _interaction_handler != null:
		_interaction_handler.cancel_ask(request_id)


## Respond to a plan submission
func respond_plan(request_id: String, approved: bool) -> void:
	if _interaction_handler != null:
		_interaction_handler.respond_plan(request_id, approved)
#endregion


#region RPC Signal Handlers
func _on_rpc_connected() -> void:
	# Generate session ID
	session_id = _generate_session_id()
	session_created_at = Time.get_unix_time_from_system()

	# Register built-in handlers
	_setup_builtin_handlers()

	# Register game tool handlers
	_setup_tool_handlers()

	# Notify server about available tools
	_notify_client_ready()

	connected.emit()


func _on_rpc_disconnected(code: int, reason: String) -> void:
	disconnected.emit(code, reason)


func _on_rpc_reconnecting(attempt: int) -> void:
	reconnecting.emit(attempt)


func _on_rpc_error(err: RpcError) -> void:
	error.emit(err)
#endregion


#region Internal Methods
func _generate_session_id() -> String:
	return "%d-%s" % [Time.get_ticks_msec(), str(randi()).substr(0, 8)]


func _setup_builtin_handlers() -> void:
	# Register ask_user handler
	_rpc.register_handler("game.askUser", _handle_ask_user)

	# Register submit_plan handler
	_rpc.register_handler("game.submitPlan", _handle_submit_plan)


func _setup_tool_handlers() -> void:
	# Register all game tools with RPC
	for method in _tool_registry.get_all_methods():
		_register_rpc_handler(method)


func _register_rpc_handler(method: String) -> void:
	# Create a wrapper that emits signals and calls the tool
	var handler := func(params: Variant) -> Dictionary:
		var dict_params: Dictionary = params if params is Dictionary else {}
		tool_called.emit(method, dict_params)

		var result: Variant = await _tool_registry.execute(method, dict_params)

		var dict_result: Dictionary = result if result is Dictionary else {}
		tool_completed.emit(method, dict_result)

		return dict_result

	_rpc.register_handler(method, handler)


func _notify_client_ready() -> void:
	# Get all available tools (built-in + game)
	var all_tools: Array[String] = []
	all_tools.append("game.askUser")
	all_tools.append("game.submitPlan")
	all_tools.append_array(_tool_registry.get_all_methods())

	# Notify server
	_rpc.notify_server("client.ready", {
		"session_id": session_id,
		"available_tools": all_tools,
	})


## Handle ask_user RPC
func _handle_ask_user(params: Variant) -> Dictionary:
	var dict_params: Dictionary = params if params is Dictionary else {}
	return await _interaction_handler.handle_ask_user(dict_params)


## Handle submit_plan RPC
func _handle_submit_plan(params: Variant) -> Dictionary:
	var dict_params: Dictionary = params if params is Dictionary else {}
	return await _interaction_handler.handle_submit_plan(dict_params)
#endregion
