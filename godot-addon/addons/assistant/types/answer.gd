class_name AssistantAnswer
extends RefCounted
## Answer for a question from ask_user interaction

## ID of the answered question
var question_id: String

## The user's answer
## Can be: String (single_choice, text), Array[String] (multiple_choice), float (number), bool (confirm)
var value: Variant


## Create an Answer from a Dictionary (from RPC params)
static func from_dict(data: Dictionary) -> AssistantAnswer:
	var a := AssistantAnswer.new()
	a.question_id = data.get("questionId", "")
	a.value = data.get("value")
	return a


## Convert to Dictionary (for serialization)
func to_dict() -> Dictionary:
	return {
		"questionId": question_id,
		"value": value,
	}


## Create an Answer with values
static func create(qid: String, val: Variant) -> AssistantAnswer:
	var a := AssistantAnswer.new()
	a.question_id = qid
	a.value = val
	return a
