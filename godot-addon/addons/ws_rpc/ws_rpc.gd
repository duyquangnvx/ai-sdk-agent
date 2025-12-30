extends Node
## WebSocket RPC Client - Bidirectional RPC over WebSocket
##
## This client implements a JSON-RPC 2.0 inspired protocol for bidirectional
## communication between Godot and a server. Supports both client-to-server
## and server-to-client method calls.
##
## Usage:
## [codeblock]
## # Connect to server
## RPC.connect_to_server("ws://localhost:3000/ws")
##
## # Register handler for server-to-client calls
## RPC.register_handler("tool.move_player", _handle_move_player)
##
## # Call server method
## var result = await RPC.call_method("game.get_state", {"id": "123"})
## [/codeblock]

const JSONRPC_VERSION := "2.0"

#region Signals
## Emitted when successfully connected to server
signal connected()

## Emitted when disconnected from server
signal disconnected(code: int, reason: String)

## Emitted when attempting to reconnect
signal reconnecting(attempt: int)

## Emitted when an error occurs
signal error(err: RpcError)

## Emitted when a notification is received from server
signal notification_received(method: String, params: Variant)
#endregion

#region Configuration
## Default timeout for RPC calls in milliseconds
@export var timeout_ms: int = 30000

## Whether to automatically reconnect on disconnect
@export var auto_reconnect: bool = true

## Initial delay before first reconnect attempt (ms)
@export var reconnect_delay_ms: int = 1000

## Maximum delay between reconnect attempts (ms)
@export var max_reconnect_delay_ms: int = 30000

## Maximum number of reconnect attempts (0 = infinite)
@export var max_reconnect_attempts: int = 0
#endregion

#region Private Variables
var _socket: WebSocketPeer
var _url: String
var _pending_requests: Dictionary = {}  # id -> RpcPendingRequest
var _handlers: Dictionary = {}  # method -> Callable
var _reconnect_attempts: int = 0
var _is_closing: bool = false
var _reconnect_timer: SceneTreeTimer
var _last_state: WebSocketPeer.State = WebSocketPeer.STATE_CLOSED
#endregion


func _ready() -> void:
	set_process(false)


func _process(_delta: float) -> void:
	if _socket == null:
		return

	_socket.poll()

	var state := _socket.get_ready_state()

	# Handle state transitions
	if state != _last_state:
		_handle_state_change(_last_state, state)
		_last_state = state

	# Process incoming messages when connected
	if state == WebSocketPeer.STATE_OPEN:
		while _socket.get_available_packet_count() > 0:
			var packet := _socket.get_packet()
			_handle_message(packet.get_string_from_utf8())


#region Public Methods
## Connect to a WebSocket server
func connect_to_server(url: String) -> Error:
	if _socket != null and _socket.get_ready_state() == WebSocketPeer.STATE_OPEN:
		push_warning("RPC: Already connected. Disconnect first.")
		return ERR_ALREADY_IN_USE

	_url = url
	_is_closing = false
	_reconnect_attempts = 0

	_socket = WebSocketPeer.new()
	var err := _socket.connect_to_url(url)

	if err != OK:
		push_error("RPC: Failed to connect to %s: %s" % [url, error_string(err)])
		error.emit(RpcError.new(RpcError.CONNECTION_CLOSED, "Failed to connect: %s" % error_string(err)))
		return err

	_last_state = WebSocketPeer.STATE_CONNECTING
	set_process(true)
	return OK


## Disconnect from the server
func disconnect_from_server() -> void:
	_is_closing = true
	_cancel_reconnect()

	if _socket != null:
		_socket.close(1000, "Client disconnect")

	_reject_all_pending(RpcError.connection_closed())
	set_process(false)


## Check if currently connected
func is_connected_to_server() -> bool:
	return _socket != null and _socket.get_ready_state() == WebSocketPeer.STATE_OPEN


## Call a method on the server and await the response
func call_method(method: String, params: Variant = null, custom_timeout: int = -1) -> Variant:
	if not is_connected_to_server():
		push_error("RPC: Not connected to server")
		return null

	var id := _generate_id()
	var request := RpcPendingRequest.new(id, method)

	# Set up timeout
	var effective_timeout := custom_timeout if custom_timeout > 0 else timeout_ms
	request.setup_timeout(get_tree(), effective_timeout)

	_pending_requests[id] = request

	# Send request
	var message := {
		"jsonrpc": JSONRPC_VERSION,
		"id": id,
		"method": method,
	}
	if params != null:
		message["params"] = params

	_send(message)

	# Wait for response
	var result_array: Array = await request.completed

	# Clean up
	_pending_requests.erase(id)

	# Check for error
	var err: RpcError = result_array[1]
	if err != null:
		error.emit(err)
		push_error("RPC: Call to '%s' failed: %s" % [method, err])
		return null

	return result_array[0]


## Send a notification to the server (no response expected)
func notify_server(method: String, params: Variant = null) -> void:
	if not is_connected_to_server():
		push_error("RPC: Not connected to server")
		return

	var message := {
		"jsonrpc": JSONRPC_VERSION,
		"method": method,
	}
	if params != null:
		message["params"] = params

	_send(message)


## Register a handler for server-to-client method calls
func register_handler(method: String, handler: Callable) -> void:
	_handlers[method] = handler


## Unregister a handler
func unregister_handler(method: String) -> void:
	_handlers.erase(method)


## Check if a handler is registered
func has_handler(method: String) -> bool:
	return _handlers.has(method)


## Get list of registered handler methods
func get_registered_methods() -> Array[String]:
	var methods: Array[String] = []
	for key in _handlers.keys():
		methods.append(key)
	return methods
#endregion


#region Private Methods
func _handle_state_change(old_state: WebSocketPeer.State, new_state: WebSocketPeer.State) -> void:
	match new_state:
		WebSocketPeer.STATE_OPEN:
			_reconnect_attempts = 0
			print("RPC: Connected to %s" % _url)
			connected.emit()

		WebSocketPeer.STATE_CLOSED:
			var code := _socket.get_close_code()
			var reason := _socket.get_close_reason()
			print("RPC: Disconnected (code: %d, reason: %s)" % [code, reason])

			_reject_all_pending(RpcError.connection_closed())
			disconnected.emit(code, reason)

			if auto_reconnect and not _is_closing:
				_schedule_reconnect()
			else:
				set_process(false)

		WebSocketPeer.STATE_CLOSING:
			pass  # Wait for CLOSED


func _handle_message(text: String) -> void:
	var json := JSON.new()
	var parse_result := json.parse(text)

	if parse_result != OK:
		push_error("RPC: Failed to parse message: %s" % json.get_error_message())
		error.emit(RpcError.parse_error(text))
		return

	var message: Dictionary = json.data

	if not message.has("jsonrpc") or message["jsonrpc"] != JSONRPC_VERSION:
		push_error("RPC: Invalid JSON-RPC version")
		error.emit(RpcError.invalid_request())
		return

	# Determine message type
	var has_id := message.has("id")
	var has_method := message.has("method")

	if has_id and has_method:
		# Request from server
		_handle_server_request(message)
	elif has_id and not has_method:
		# Response to our request
		_handle_response(message)
	elif not has_id and has_method:
		# Notification from server
		_handle_notification(message)
	else:
		push_error("RPC: Unknown message type")
		error.emit(RpcError.invalid_request(message))


func _handle_response(message: Dictionary) -> void:
	var id: String = str(message["id"])

	if not _pending_requests.has(id):
		push_warning("RPC: Received response for unknown request ID: %s" % id)
		return

	var request: RpcPendingRequest = _pending_requests[id]

	if message.has("error"):
		var err_data: Dictionary = message["error"]
		request.reject(RpcError.from_dict(err_data))
	else:
		request.resolve(message.get("result"))


func _handle_server_request(message: Dictionary) -> void:
	var id: String = str(message["id"])
	var method: String = message["method"]
	var params: Variant = message.get("params")

	if not _handlers.has(method):
		_send_error_response(id, RpcError.method_not_found(method))
		return

	var handler: Callable = _handlers[method]

	# Execute handler (may be async)
	var result: Variant
	if handler.is_valid():
		result = await handler.call(params)

	# Send response
	_send_response(id, result)


func _handle_notification(message: Dictionary) -> void:
	var method: String = message["method"]
	var params: Variant = message.get("params")
	notification_received.emit(method, params)


func _send(message: Dictionary) -> void:
	if _socket == null or _socket.get_ready_state() != WebSocketPeer.STATE_OPEN:
		return

	var text := JSON.stringify(message)
	_socket.send_text(text)


func _send_response(id: String, result: Variant) -> void:
	_send({
		"jsonrpc": JSONRPC_VERSION,
		"id": id,
		"result": result,
	})


func _send_error_response(id: String, err: RpcError) -> void:
	_send({
		"jsonrpc": JSONRPC_VERSION,
		"id": id,
		"error": err.to_dict(),
	})


func _generate_id() -> String:
	return "%d-%s" % [Time.get_ticks_msec(), str(randi()).substr(0, 8)]


func _reject_all_pending(err: RpcError) -> void:
	for request: RpcPendingRequest in _pending_requests.values():
		request.reject(err)
	_pending_requests.clear()


func _schedule_reconnect() -> void:
	if max_reconnect_attempts > 0 and _reconnect_attempts >= max_reconnect_attempts:
		push_warning("RPC: Max reconnect attempts reached")
		set_process(false)
		return

	# Calculate delay with exponential backoff
	var delay := mini(
		reconnect_delay_ms * int(pow(2, _reconnect_attempts)),
		max_reconnect_delay_ms
	)

	_reconnect_attempts += 1
	reconnecting.emit(_reconnect_attempts)

	print("RPC: Reconnecting in %dms (attempt %d)" % [delay, _reconnect_attempts])

	_reconnect_timer = get_tree().create_timer(delay / 1000.0)
	_reconnect_timer.timeout.connect(_do_reconnect)


func _do_reconnect() -> void:
	if _is_closing:
		return

	_socket = WebSocketPeer.new()
	var err := _socket.connect_to_url(_url)

	if err != OK:
		push_error("RPC: Reconnect failed: %s" % error_string(err))
		_schedule_reconnect()
	else:
		_last_state = WebSocketPeer.STATE_CONNECTING
		set_process(true)


func _cancel_reconnect() -> void:
	if _reconnect_timer and _reconnect_timer.timeout.is_connected(_do_reconnect):
		_reconnect_timer.timeout.disconnect(_do_reconnect)
	_reconnect_timer = null
#endregion
