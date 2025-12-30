extends Node
## Example: Using WebSocket RPC with AI Agent
##
## This example demonstrates how to connect to an AI server and register
## tool handlers that the AI can call to control the game.

@export var server_url: String = "ws://localhost:3000/ws"

# Reference to game objects (set these in your scene)
@export var player: CharacterBody2D
@export var enemies_container: Node


func _ready() -> void:
	# Connect to RPC signals
	RPC.connected.connect(_on_connected)
	RPC.disconnected.connect(_on_disconnected)
	RPC.reconnecting.connect(_on_reconnecting)
	RPC.error.connect(_on_error)
	RPC.notification_received.connect(_on_notification)

	# Register AI tool handlers
	_register_ai_tools()

	# Connect to server
	RPC.connect_to_server(server_url)


func _register_ai_tools() -> void:
	# Movement tool - AI can command player to move
	RPC.register_handler("tool.move_player", _tool_move_player)

	# Inventory tool - AI can query player inventory
	RPC.register_handler("tool.get_inventory", _tool_get_inventory)

	# Combat tool - AI can command player to attack
	RPC.register_handler("tool.attack_enemy", _tool_attack_enemy)

	# World query tool - AI can get information about the game world
	RPC.register_handler("tool.get_nearby_entities", _tool_get_nearby_entities)

	# Dialog tool - AI can show dialog to player
	RPC.register_handler("tool.show_dialog", _tool_show_dialog)


#region AI Tool Handlers
## Move player to a target position
## params: { "x": float, "y": float }
## returns: { "success": bool, "position": { "x": float, "y": float } }
func _tool_move_player(params: Dictionary) -> Dictionary:
	if player == null:
		return {"success": false, "error": "Player not found"}

	var target := Vector2(params.get("x", 0), params.get("y", 0))

	# If player has a move_to method that returns when done
	if player.has_method("move_to"):
		await player.move_to(target)
	else:
		# Simple teleport fallback
		player.global_position = target

	return {
		"success": true,
		"position": {
			"x": player.global_position.x,
			"y": player.global_position.y
		}
	}


## Get player inventory
## params: { "category": string? } - optional filter by category
## returns: { "items": Array[{ "id": string, "name": string, "count": int }] }
func _tool_get_inventory(params: Dictionary) -> Dictionary:
	if player == null or not player.has_method("get_inventory"):
		return {"items": []}

	var inventory = player.get_inventory()
	var category: String = params.get("category", "")

	var items := []
	for item in inventory:
		if category.is_empty() or item.get("category") == category:
			items.append({
				"id": item.get("id", ""),
				"name": item.get("name", "Unknown"),
				"count": item.get("count", 1)
			})

	return {"items": items}


## Attack an enemy
## params: { "enemy_id": string }
## returns: { "success": bool, "damage_dealt": int, "enemy_defeated": bool }
func _tool_attack_enemy(params: Dictionary) -> Dictionary:
	var enemy_id: String = params.get("enemy_id", "")

	if enemy_id.is_empty():
		return {"success": false, "error": "No enemy_id provided"}

	# Find enemy by ID
	var enemy: Node = null
	if enemies_container:
		for child in enemies_container.get_children():
			if child.name == enemy_id or (child.has_method("get_id") and child.get_id() == enemy_id):
				enemy = child
				break

	if enemy == null:
		return {"success": false, "error": "Enemy not found: %s" % enemy_id}

	# Perform attack
	var damage := 0
	var defeated := false

	if player.has_method("attack"):
		damage = player.attack(enemy)
		defeated = not enemy.is_inside_tree()  # Check if enemy was freed

	return {
		"success": true,
		"damage_dealt": damage,
		"enemy_defeated": defeated
	}


## Get entities near the player
## params: { "radius": float?, "type": string? }
## returns: { "entities": Array[{ "id": string, "type": string, "distance": float }] }
func _tool_get_nearby_entities(params: Dictionary) -> Dictionary:
	if player == null:
		return {"entities": []}

	var radius: float = params.get("radius", 200.0)
	var type_filter: String = params.get("type", "")

	var entities := []
	var player_pos := player.global_position

	# Get all physics bodies in radius
	var space := player.get_world_2d().direct_space_state
	var query := PhysicsShapeQueryParameters2D.new()
	query.shape = CircleShape2D.new()
	query.shape.radius = radius
	query.transform = Transform2D(0, player_pos)

	var results := space.intersect_shape(query, 32)

	for result in results:
		var collider: Node = result.collider
		if collider == player:
			continue

		var entity_type := _get_entity_type(collider)
		if not type_filter.is_empty() and entity_type != type_filter:
			continue

		var distance := player_pos.distance_to(collider.global_position)

		entities.append({
			"id": collider.name,
			"type": entity_type,
			"distance": distance,
			"position": {
				"x": collider.global_position.x,
				"y": collider.global_position.y
			}
		})

	# Sort by distance
	entities.sort_custom(func(a, b): return a.distance < b.distance)

	return {"entities": entities}


## Show dialog to the player
## params: { "text": string, "speaker": string?, "options": Array[string]? }
## returns: { "acknowledged": bool, "selected_option": int? }
func _tool_show_dialog(params: Dictionary) -> Dictionary:
	var text: String = params.get("text", "")
	var speaker: String = params.get("speaker", "")
	var options: Array = params.get("options", [])

	# You would implement your dialog system here
	# This is a placeholder that just prints
	print("[%s]: %s" % [speaker if speaker else "AI", text])

	if options.size() > 0:
		print("Options: %s" % str(options))
		# In a real implementation, you'd wait for player to select an option
		return {"acknowledged": true, "selected_option": 0}

	return {"acknowledged": true}
#endregion


#region Helper Functions
func _get_entity_type(node: Node) -> String:
	if node.is_in_group("enemies"):
		return "enemy"
	elif node.is_in_group("npcs"):
		return "npc"
	elif node.is_in_group("items"):
		return "item"
	elif node.is_in_group("interactables"):
		return "interactable"
	else:
		return "unknown"
#endregion


#region Signal Handlers
func _on_connected() -> void:
	print("Connected to AI server!")

	# Optionally notify server about client capabilities
	RPC.notify_server("client.ready", {
		"available_tools": RPC.get_registered_methods()
	})


func _on_disconnected(code: int, reason: String) -> void:
	print("Disconnected from AI server (code: %d, reason: %s)" % [code, reason])


func _on_reconnecting(attempt: int) -> void:
	print("Reconnecting to AI server... (attempt %d)" % attempt)


func _on_error(err: RpcError) -> void:
	push_error("RPC Error: %s" % err)


func _on_notification(method: String, params: Variant) -> void:
	print("Received notification: %s" % method)

	match method:
		"game.event":
			# Handle game events from server
			_handle_game_event(params)
		"ai.thinking":
			# AI is thinking, maybe show indicator
			print("AI is thinking...")
		_:
			print("Unknown notification: %s" % method)


func _handle_game_event(params: Variant) -> void:
	if params is Dictionary:
		var event_type: String = params.get("type", "")
		match event_type:
			"spawn_enemy":
				print("Spawning enemy: %s" % params)
			"trigger_cutscene":
				print("Triggering cutscene: %s" % params.get("id"))
#endregion
