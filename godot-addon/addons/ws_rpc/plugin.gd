@tool
extends EditorPlugin


func _enter_tree() -> void:
	add_autoload_singleton("RPC", "res://addons/ws_rpc/ws_rpc.gd")


func _exit_tree() -> void:
	remove_autoload_singleton("RPC")
