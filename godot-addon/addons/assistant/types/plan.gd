class_name AssistantPlan
extends RefCounted
## Plan for submit_plan interaction

## List of todo items
## Each todo: { content: String, status: String }
## Status can be: "pending", "in_progress", "completed"
var todos: Array[Dictionary] = []

## Optional summary of the plan
var summary: String = ""


## Create a Plan from a Dictionary (from RPC params)
static func from_dict(data: Dictionary) -> AssistantPlan:
	var p := AssistantPlan.new()
	p.summary = data.get("summary", "")

	var todo_list: Array = data.get("todos", [])
	for todo in todo_list:
		if todo is Dictionary:
			p.todos.append(todo)

	return p


## Convert to Dictionary (for serialization)
func to_dict() -> Dictionary:
	var result := {
		"todos": todos,
	}

	if not summary.is_empty():
		result["summary"] = summary

	return result


## Get the number of todos
func get_count() -> int:
	return todos.size()


## Get pending todos count
func get_pending_count() -> int:
	var count := 0
	for todo in todos:
		if todo.get("status", "pending") == "pending":
			count += 1
	return count


## Get completed todos count
func get_completed_count() -> int:
	var count := 0
	for todo in todos:
		if todo.get("status") == "completed":
			count += 1
	return count
