extends KinematicBody2D

#BufferZone is needed so when I round the position(lines 20-21)
#the crate does not get rounded into a wall and get "locked"
onready var buffer_start_position = $BufferZone.position
onready var player = false setget set_player

var input_velocity = Vector2.ZERO
var velocity = Vector2.ZERO
var moving_direction = Vector2.ZERO

#sent to player to let him know crate cant move
signal blocked

func _physics_process(_delta) -> void:
	if player == true:
		check_is_blocked(input_velocity)
		velocity = move_and_slide(input_velocity)
	else:
		#Rounding to avoid jitter with pixel graphics
		global_position.x = round(global_position.x)
		global_position.y = round(global_position.y)


func check_is_blocked(vector):
	var check_vector = vector.normalized()
	#move_and_collide() can do a "test" move to see if it would collide
	#move_and_collide(rel_vec, infinite_inertia, exclude_raycast_shapes, test_only)
	var blocked = move_and_collide(check_vector,false, true, true)
	if blocked != null:
		emit_signal("blocked") #sent to Player
		return true #Used by Player

#called from setget
func set_player(newplayer):
	player = newplayer
	if player == true:
		$BufferZone.disabled = false
		$BufferZone.position = buffer_start_position + moving_direction
	else:
		$BufferZone.disabled = true
