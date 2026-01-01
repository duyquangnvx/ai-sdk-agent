class_name InteractionHandler
extends RefCounted
## Handles built-in interaction RPCs (ask_user, submit_plan)

## Reference to the Assistant singleton (set during init)
var _assistant: Node

## Pending ask_user requests: request_id -> { signal_awaiter, timeout_timer }
var _pending_asks: Dictionary = {}

## Pending submit_plan requests: request_id -> { signal_awaiter, timeout_timer }
var _pending_plans: Dictionary = {}


func _init(assistant: Node) -> void:
	_assistant = assistant


## Handle game.askUser RPC from server
## This emits a signal and waits for the game UI to respond
func handle_ask_user(params: Dictionary) -> Dictionary:
	var request_id := _generate_request_id()
	var title: String = params.get("title", "Questions from Assistant")
	var questions_data: Array = params.get("questions", [])

	# Parse questions
	var questions: Array[AssistantQuestion] = []
	for q_data in questions_data:
		if q_data is Dictionary:
			questions.append(AssistantQuestion.from_dict(q_data))

	# Create a signal awaiter
	var result_holder := { "answered": false, "answers": [] }
	var completed := false

	# Setup timeout
	var timeout_ms: int = _assistant.interaction_timeout_ms
	var tree: SceneTree = _assistant.get_tree()
	var timeout_timer: SceneTreeTimer = tree.create_timer(timeout_ms / 1000.0)

	# Store pending request
	_pending_asks[request_id] = {
		"result_holder": result_holder,
		"completed": false,
	}

	# Emit signal for game UI to handle
	# Pass questions as Array for simpler UI handling
	var questions_array: Array = []
	for q in questions:
		questions_array.append(q.to_dict())

	_assistant.ask_user_requested.emit(request_id, title, questions_array)

	# Wait for response or timeout
	while not _pending_asks[request_id]["completed"]:
		if timeout_timer.time_left <= 0:
			# Timeout - treat as cancelled
			_pending_asks[request_id]["result_holder"]["answered"] = false
			break
		await tree.process_frame

	# Get result
	result_holder = _pending_asks[request_id]["result_holder"]
	_pending_asks.erase(request_id)

	return {
		"answered": result_holder["answered"],
		"answers": result_holder["answers"],
	}


## Called when user responds to ask_user
func respond_ask(request_id: String, answers: Array[Dictionary]) -> void:
	if not _pending_asks.has(request_id):
		push_warning("InteractionHandler: No pending ask_user request with ID '%s'" % request_id)
		return

	var pending := _pending_asks[request_id] as Dictionary
	pending["result_holder"]["answered"] = true
	pending["result_holder"]["answers"] = answers
	pending["completed"] = true


## Called when user cancels ask_user
func cancel_ask(request_id: String) -> void:
	if not _pending_asks.has(request_id):
		push_warning("InteractionHandler: No pending ask_user request with ID '%s'" % request_id)
		return

	var pending := _pending_asks[request_id] as Dictionary
	pending["result_holder"]["answered"] = false
	pending["result_holder"]["answers"] = []
	pending["completed"] = true


## Handle game.submitPlan RPC from server
func handle_submit_plan(params: Dictionary) -> Dictionary:
	var request_id := _generate_request_id()
	var todos: Array = params.get("todos", [])

	# Create result holder
	var result_holder := { "approved": false }

	# Setup timeout
	var timeout_ms: int = _assistant.interaction_timeout_ms
	var tree: SceneTree = _assistant.get_tree()
	var timeout_timer: SceneTreeTimer = tree.create_timer(timeout_ms / 1000.0)

	# Store pending request
	_pending_plans[request_id] = {
		"result_holder": result_holder,
		"completed": false,
	}

	# Emit signal for game UI to handle
	_assistant.plan_submitted.emit(request_id, todos)

	# Wait for response or timeout
	while not _pending_plans[request_id]["completed"]:
		if timeout_timer.time_left <= 0:
			# Timeout - treat as rejected
			_pending_plans[request_id]["result_holder"]["approved"] = false
			break
		await tree.process_frame

	# Get result
	result_holder = _pending_plans[request_id]["result_holder"]
	_pending_plans.erase(request_id)

	return {
		"approved": result_holder["approved"],
	}


## Called when user responds to plan
func respond_plan(request_id: String, approved: bool) -> void:
	if not _pending_plans.has(request_id):
		push_warning("InteractionHandler: No pending plan request with ID '%s'" % request_id)
		return

	var pending := _pending_plans[request_id] as Dictionary
	pending["result_holder"]["approved"] = approved
	pending["completed"] = true


## Generate a unique request ID
func _generate_request_id() -> String:
	return "%d-%s" % [Time.get_ticks_msec(), str(randi()).substr(0, 8)]


## Check if there are pending interactions
func has_pending() -> bool:
	return _pending_asks.size() > 0 or _pending_plans.size() > 0


## Cancel all pending interactions
func cancel_all() -> void:
	for request_id in _pending_asks.keys():
		cancel_ask(request_id)
	for request_id in _pending_plans.keys():
		respond_plan(request_id, false)
