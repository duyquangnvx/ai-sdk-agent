class_name AssistantQuestion
extends RefCounted
## Question type for ask_user interactions

enum Type {
	SINGLE_CHOICE,   ## Radio buttons - pick one
	MULTIPLE_CHOICE, ## Checkboxes - pick many
	TEXT,            ## Free text input
	NUMBER,          ## Number input
	CONFIRM,         ## Yes/No confirmation
}

## Unique ID for this question
var id: String

## Type of question
var type: Type

## The question text
var question: String

## Additional context/description
var description: String = ""

## Whether answer is required
var required: bool = true

## Options for choice questions (single_choice, multiple_choice)
## Each option: { label: String, value: String, description?: String }
var options: Array[Dictionary] = []

## Placeholder text for text input
var placeholder: String = ""

## Maximum text length (-1 for no limit)
var max_length: int = -1

## Minimum value for number input
var min_value: float = -INF

## Maximum value for number input
var max_value: float = INF

## Step increment for number input
var step: float = 1.0


## Create a Question from a Dictionary (from RPC params)
static func from_dict(data: Dictionary) -> AssistantQuestion:
	var q := AssistantQuestion.new()

	q.id = data.get("id", "")
	q.question = data.get("question", "")
	q.description = data.get("description", "")
	q.required = data.get("required", true)

	# Parse type
	var type_str: String = data.get("type", "text")
	match type_str:
		"single_choice":
			q.type = Type.SINGLE_CHOICE
		"multiple_choice":
			q.type = Type.MULTIPLE_CHOICE
		"text":
			q.type = Type.TEXT
		"number":
			q.type = Type.NUMBER
		"confirm":
			q.type = Type.CONFIRM
		_:
			q.type = Type.TEXT

	# Parse options
	var opts: Array = data.get("options", [])
	for opt in opts:
		if opt is Dictionary:
			q.options.append(opt)

	# Text options
	q.placeholder = data.get("placeholder", "")
	q.max_length = data.get("maxLength", -1)

	# Number options
	if data.has("min"):
		q.min_value = float(data["min"])
	if data.has("max"):
		q.max_value = float(data["max"])
	if data.has("step"):
		q.step = float(data["step"])

	return q


## Convert to Dictionary (for serialization)
func to_dict() -> Dictionary:
	var type_str: String
	match type:
		Type.SINGLE_CHOICE:
			type_str = "single_choice"
		Type.MULTIPLE_CHOICE:
			type_str = "multiple_choice"
		Type.TEXT:
			type_str = "text"
		Type.NUMBER:
			type_str = "number"
		Type.CONFIRM:
			type_str = "confirm"

	var result := {
		"id": id,
		"type": type_str,
		"question": question,
		"required": required,
	}

	if not description.is_empty():
		result["description"] = description

	if options.size() > 0:
		result["options"] = options

	if not placeholder.is_empty():
		result["placeholder"] = placeholder

	if max_length >= 0:
		result["maxLength"] = max_length

	if min_value != -INF:
		result["min"] = min_value

	if max_value != INF:
		result["max"] = max_value

	if step != 1.0:
		result["step"] = step

	return result
