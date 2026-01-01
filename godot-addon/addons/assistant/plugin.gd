@tool
extends EditorPlugin


func _enter_tree() -> void:
	add_autoload_singleton("Assistant", "res://addons/assistant/assistant.gd")


func _exit_tree() -> void:
	remove_autoload_singleton("Assistant")
