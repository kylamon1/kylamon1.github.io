extends KinematicBody2D

#constants
const SPEED = 100
const PUSH_SPEED = 50
const RAYLENGTH = 12

#hold the crate object...used to set the variables of the crate
var crate = null
var crate_offset = Vector2.ZERO

#changed in each STATE
var velocity = Vector2.ZERO

#Used to see the "forward" direction when pushing.  Also send to crate.
var stored_velocity = Vector2.ZERO

#comes from player input
var input_vector = Vector2.ZERO

onready var raycast = $RayCast

var STATE = WALK
enum {PUSH, PUSH_IDLE, WALK}

func _physics_process(delta):
	#set velocity to the input_vector.  It will be multiplied by the various speeds
	#in each state
	velocity = input_vector
	
	#small state machine
	match STATE:
		WALK:
			velocity = input_vector * SPEED
		PUSH_IDLE:
			#If player velocity is not going the same as the stored "forward" direction
			#dont allow player to move by setting velocity to 0
			if velocity != stored_velocity:
				velocity=Vector2.ZERO
			
			#if player is moving check to see if the crate is blocked.
			#if it is not blocked go to PUSH state
			if velocity != Vector2.ZERO:
				if !crate.check_is_blocked(input_vector):
					STATE = PUSH
					continue
			
			#in idle state player velocity and crate velocity =0
			velocity = Vector2.ZERO
			crate.input_velocity = velocity
			
			#fix crate offset
			if ((global_position-crate.global_position) != crate_offset) and input_vector == Vector2.ZERO:
				crate.global_position -= crate_offset-(global_position-crate.global_position)
		
		PUSH:
			#If player velocity is not going the same as the stored "forward" direction
			#dont allow player to move by setting velocity to 0
			if velocity != stored_velocity:
				velocity=Vector2.ZERO
			
			#if crate is blocked in the "forward" direction
			#-dont move player
			#-dont move crate
			#-go into idle state
			if crate.check_is_blocked(input_vector):
				velocity = Vector2.ZERO
				crate.input_velocity = velocity
				STATE=PUSH_IDLE
			
			#if player is not moving
			#-Make crate not move
			#-go to push_idle state
			if velocity == Vector2.ZERO:
				crate.input_velocity = velocity
				STATE=PUSH_IDLE
			#Since player is moving set velocity to push_speed
			#set crate velocity to push_speed too
			else:
				velocity *= PUSH_SPEED
				crate.input_velocity = velocity
	
	#finally move player
	move_and_slide(velocity)

func _input(event):
	#get input vector
	#WASD keys for motion
	input_vector.x = Input.get_action_strength("right")-Input.get_action_strength("left")
	input_vector.y = Input.get_action_strength("down")-Input.get_action_strength("up")
	
	#normalize vector to make it a length of 1
	input_vector = input_vector.normalized()
	
	#set the raycast to always face "forward"
	#stor the "forward" vector in stored_velocity
	if input_vector != Vector2.ZERO:
		raycast.cast_to = input_vector * RAYLENGTH
		if STATE==WALK:
			stored_velocity = input_vector
	
	#If you hit "push"...spacebar key
	if Input.is_action_just_pressed("push"):
		#if I am already pushing then stop
		if STATE==PUSH or STATE==PUSH_IDLE:
			stop_pushing()
			
		#else if I am walking, and the raycast hits a crate start pushing
		elif STATE==WALK and raycast.get_collider() != null:
			start_pushing()

func start_pushing():
	#set the correct state
	STATE = PUSH
	
	#saves the crate to a variable.  Makes it easier to pass it info
	crate = raycast.get_collider()
	
	#record offset to make sure player/crate stay the same distance appart
	crate_offset = global_position-crate.global_position
	
	#connect signal from crate
	crate.connect("blocked", self, "crate_blocked")
	
	#let crate know which way is "forward"
	crate.moving_direction = stored_velocity
	
	#sets the crate's player variable.  This makes it process_physics()
	crate.player = true
	
	#Makes it so player and crate dont collide. it avoids weird collision jitters
	add_collision_exception_with(crate)
	
func stop_pushing():
	#Catch for errors
	if crate != null:
		#disconnect signal
		disconnect("blocked", crate, "crate_blocked")
		
		#set crate velocity to 0 so it wont move
		crate.input_velocity = Vector2.ZERO
		
		#remove collision exemption so player/crate can collide again
		remove_collision_exception_with(crate)
		
		#remove the crates "player" variable.  It wont process_physics() anymore
		crate.player = false
	
	#Sets my crate to null so I could grab a different crate if I wanted to
	crate = null
	
	#sets the state to WALK from PUSH
	STATE = WALK
