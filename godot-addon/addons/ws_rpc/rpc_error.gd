class_name RpcError
extends RefCounted
## RPC Error class with standard JSON-RPC 2.0 error codes

# Standard JSON-RPC 2.0 error codes
const PARSE_ERROR := -32700       ## Invalid JSON was received
const INVALID_REQUEST := -32600   ## The JSON sent is not a valid Request object
const METHOD_NOT_FOUND := -32601  ## The method does not exist / is not available
const INVALID_PARAMS := -32602    ## Invalid method parameter(s)
const INTERNAL_ERROR := -32603    ## Internal JSON-RPC error

# Custom error codes (-32000 to -32099)
const TIMEOUT := -32000           ## Request timed out
const CONNECTION_CLOSED := -32001 ## Connection was closed
const UNAUTHORIZED := -32002      ## Unauthorized access
const RATE_LIMITED := -32003      ## Rate limited

## Error code
var code: int

## Error message
var message: String

## Additional error data (optional)
var data: Variant


func _init(p_code: int, p_message: String, p_data: Variant = null) -> void:
	code = p_code
	message = p_message
	data = p_data


## Convert to Dictionary for JSON serialization
func to_dict() -> Dictionary:
	var result := {
		"code": code,
		"message": message,
	}
	if data != null:
		result["data"] = data
	return result


## Create RpcError from Dictionary
static func from_dict(dict: Dictionary) -> RpcError:
	return RpcError.new(
		dict.get("code", INTERNAL_ERROR),
		dict.get("message", "Unknown error"),
		dict.get("data")
	)


## Human-readable string representation
func _to_string() -> String:
	return "RpcError(%d): %s" % [code, message]


# Factory methods for common errors
static func parse_error(p_data: Variant = null) -> RpcError:
	return RpcError.new(PARSE_ERROR, "Parse error", p_data)


static func invalid_request(p_data: Variant = null) -> RpcError:
	return RpcError.new(INVALID_REQUEST, "Invalid request", p_data)


static func method_not_found(method: String) -> RpcError:
	return RpcError.new(METHOD_NOT_FOUND, "Method not found: %s" % method)


static func invalid_params(p_data: Variant = null) -> RpcError:
	return RpcError.new(INVALID_PARAMS, "Invalid params", p_data)


static func internal_error(p_message: String = "Internal error", p_data: Variant = null) -> RpcError:
	return RpcError.new(INTERNAL_ERROR, p_message, p_data)


static func timeout_error(timeout_ms: int) -> RpcError:
	return RpcError.new(TIMEOUT, "Request timed out after %dms" % timeout_ms)


static func connection_closed() -> RpcError:
	return RpcError.new(CONNECTION_CLOSED, "Connection closed")


static func unauthorized(p_message: String = "Unauthorized") -> RpcError:
	return RpcError.new(UNAUTHORIZED, p_message)


static func rate_limited() -> RpcError:
	return RpcError.new(RATE_LIMITED, "Rate limited")
