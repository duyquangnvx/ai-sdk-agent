class_name ToolRegistry
extends RefCounted
## Registry for game-specific tool handlers

## Internal tool storage: method name -> Callable handler
var _tools: Dictionary = {}


## Register a tool handler
## The handler should be: func(params: Dictionary) -> Dictionary
func register(method: String, handler: Callable) -> void:
	if _tools.has(method):
		push_warning("ToolRegistry: Overwriting existing handler for '%s'" % method)
	_tools[method] = handler


## Unregister a tool handler
func unregister(method: String) -> void:
	_tools.erase(method)


## Check if a tool is registered
func has(method: String) -> bool:
	return _tools.has(method)


## Get the handler for a tool
func get_handler(method: String) -> Callable:
	return _tools.get(method, Callable())


## Get all registered method names
func get_all_methods() -> Array[String]:
	var methods: Array[String] = []
	for key in _tools.keys():
		methods.append(key)
	return methods


## Clear all registered tools
func clear() -> void:
	_tools.clear()


## Get the number of registered tools
func size() -> int:
	return _tools.size()


## Execute a tool handler
## Returns the result Dictionary or null if handler not found
func execute(method: String, params: Variant) -> Variant:
	if not _tools.has(method):
		return null

	var handler: Callable = _tools[method]
	if not handler.is_valid():
		push_error("ToolRegistry: Invalid handler for '%s'" % method)
		return null

	# Convert params to Dictionary if needed
	var dict_params: Dictionary = {}
	if params is Dictionary:
		dict_params = params
	elif params != null:
		push_warning("ToolRegistry: Expected Dictionary params for '%s', got %s" % [method, typeof(params)])

	return await handler.call(dict_params)
