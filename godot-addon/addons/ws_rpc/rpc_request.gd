class_name RpcPendingRequest
extends RefCounted
## Represents a pending RPC request waiting for response

## Unique request ID
var id: String

## Method name being called
var method: String

## Signal emitted when response is received
signal completed(result: Variant, error: RpcError)

## Timer reference for timeout
var _timer: SceneTreeTimer

## Whether the request has been completed
var _is_completed := false


func _init(p_id: String, p_method: String) -> void:
	id = p_id
	method = p_method


## Set up timeout timer
func setup_timeout(tree: SceneTree, timeout_ms: int) -> void:
	if timeout_ms <= 0:
		return

	_timer = tree.create_timer(timeout_ms / 1000.0)
	_timer.timeout.connect(_on_timeout)


## Resolve the request with a successful result
func resolve(result: Variant) -> void:
	if _is_completed:
		return

	_is_completed = true
	_cancel_timer()
	completed.emit(result, null)


## Reject the request with an error
func reject(error: RpcError) -> void:
	if _is_completed:
		return

	_is_completed = true
	_cancel_timer()
	completed.emit(null, error)


## Check if request is still pending
func is_pending() -> bool:
	return not _is_completed


## Cancel the timeout timer
func _cancel_timer() -> void:
	if _timer and _timer.timeout.is_connected(_on_timeout):
		_timer.timeout.disconnect(_on_timeout)
	_timer = null


## Handle timeout
func _on_timeout() -> void:
	if _is_completed:
		return

	reject(RpcError.timeout_error(0))
