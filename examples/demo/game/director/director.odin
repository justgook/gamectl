package director

// Director package design notes
// =============================
//
// Purpose:
// The Director is the future data-driven game/narrative logic layer for the
// demo game. It should decide what game events *mean* and return commands for
// the low-level Odin world simulation to execute.
//
// Short version:
//   World systems detect physical facts.
//   Director updates logical game state.
//   Director emits commands.
//   World systems execute commands.
//
// Example:
//   1. world/sys_trigger detects player entered trigger "room_02.start".
//   2. World sends Event{kind = .Trigger_Entered, trigger = "room_02.start"}.
//   3. Director checks flags/room state and returns commands:
//        Close_Door("room_02.left")
//        Close_Door("room_02.right")
//        Spawn_Enemy("room_02.wave_1.crawler_1", "crawler", "room_02.spawn_a")
//   4. World creates physical entities, closes doors, plays sounds, etc.
//
// Inspiration:
//   https://enegames.itch.io/elm-narrative-engine
//
// Long-term GAMS idea:
//   Use a GAMS editor/view to author this data visually, similar in spirit to
//   Elm Narrative Engine's visual authoring flow. GAMS could produce room,
//   narrative, encounter, inventory, skill, loot, and rule data files. The game
//   would load those files at runtime so game logic can be updated without
//   recompiling the Odin executable/wasm.
//
// This file is intentionally an Odin package with comments/examples instead of
// a markdown document, so the idea lives near the game code and can gradually
// become real code.

Logic_Id :: string

// Runtime_Entity is the transient ECS/entity id used by the physical world.
// The concrete world package currently uses logic.Entity, but this package
// should avoid depending on world internals while the boundary is still being
// designed.
Runtime_Entity :: i64

// Stable ids used by the Director should be authored data ids, not raw runtime
// entity ids. Examples:
//   "player"
//   "room.green_hall"
//   "room.green_hall.door.left"
//   "room.green_hall.wave_1.crawler_3"
//   "bullet.player.shot_42"
//
// The world can bridge runtime entities to logical ids with a future component:
//   Logic_Link :: struct { id: director.Logic_Id }

Event_Kind :: enum {
	// Low-level physical/sensor facts from the world to the Director.
	Trigger_Entered,
	Trigger_Left,
	Player_Entered_Room,
	Player_Left_Room,
	Entity_Hit_Entity,
	Entity_Left_World,
	Player_Interacted,
	Timer_Finished,

	// Director-generated synthetic events. These are derived from logical state,
	// not detected directly by physics/collision systems.
	Room_Cleared,
	Encounter_Started,
	Encounter_Cleared,
	Enemy_Killed,
	Item_Collected,
	Skill_Unlocked,
}

Event :: struct {
	kind:           Event_Kind,

	// Generic ids. Not every event uses every field.
	source:         Logic_Id,
	target:         Logic_Id,
	room:           Logic_Id,
	trigger:        Logic_Id,
	item:           Logic_Id,
	skill:          Logic_Id,

	// Optional physical ids for command routing/debugging. Scripts should prefer
	// stable logical ids; runtime ids can be recreated between runs/loads.
	source_runtime: Runtime_Entity,
	target_runtime: Runtime_Entity,

	// Lightweight numeric payloads. Future serialized data can use a richer tagged
	// value format if needed.
	amount:         int,
}

Command_Kind :: enum {
	// World/physics/entity commands.
	Spawn_Enemy,
	Destroy_Entity,
	Close_Door,
	Open_Door,
	Spawn_Loot,
	Play_Effect,
	Play_Sound,
	Apply_Knockback,
	Set_Brain,
	Set_Animation,

	// Director state commands. These may be applied internally by the Director or
	// persisted to save data.
	Set_Flag,
	Set_Room_State,
	Set_Encounter_State,
	Give_Item,
	Remove_Item,
	Unlock_Skill,
	Apply_Damage,
	Start_Timer,
}

Command :: struct {
	kind:       Command_Kind,

	// Stable ids used by command executor.
	target:     Logic_Id,
	room:       Logic_Id,
	spawn:      Logic_Id,
	enemy_kind: Logic_Id,
	item_kind:  Logic_Id,
	skill:      Logic_Id,
	flag:       Logic_Id,
	effect:     Logic_Id,
	sound:      Logic_Id,
	brain:      Logic_Id,
	animation:  Logic_Id,

	// Common numeric payloads.
	amount:     int,
	x:          int,
	y:          int,
}

Room_State :: enum {
	Unknown,
	Inactive,
	Entered,
	Combat,
	Cleared,
	Locked,
}

Encounter_State :: enum {
	Idle,
	Running,
	Cleared,
}

Enemy_State :: enum {
	Alive,
	Dead,
}

Room :: struct {
	id:        Logic_Id,
	state:     Room_State,
	cleared:   bool,
	encounter: Logic_Id,
}

Encounter :: struct {
	id:           Logic_Id,
	room:         Logic_Id,
	state:        Encounter_State,
	current_wave: int,
	live_enemies: int,
}

Enemy :: struct {
	id:      Logic_Id,
	kind:    Logic_Id,
	room:    Logic_Id,
	state:   Enemy_State,
	hp:      int,
	max_hp:  int,
	loot:    Logic_Id,
	runtime: Runtime_Entity,
}

Inventory_Item :: struct {
	id:    Logic_Id,
	count: int,
}

Skill :: struct {
	id:       Logic_Id,
	unlocked: bool,
}

State :: struct {
	// Future runtime state owned by Director.
	// These are intentionally plain data containers so they can later be loaded
	// from/generated by GAMS tools and saved/restored by the game.
	rooms:      []Room,
	encounters: []Encounter,
	enemies:    []Enemy,
	inventory:  []Inventory_Item,
	skills:     []Skill,

	// TODO: flags should probably become a string->bool map or a compact id table.
	// flags: map[Logic_Id]bool,
}

// update is the eventual boundary function.
//
// Input:
//   events from the world, such as Trigger_Entered or Entity_Hit_Entity.
//
// Output:
//   commands for the world command executor, such as Spawn_Enemy or Open_Door.
//
// The first implementation can be tiny and hardcoded. Later this should evaluate
// loaded rule data authored by external tools/GAMS.
update :: proc(state: ^State, events: []Event, commands: ^[dynamic]Command) {
	// TODO: implement rule evaluation.
	// Keep high-level meaning here:
	//   - room clear checks
	//   - encounter wave progression
	//   - damage calculation
	//   - loot selection
	//   - inventory/skill changes
	//   - door lock/open decisions
	//
	// Keep low-level simulation in world systems:
	//   - platformer movement
	//   - bullet movement
	//   - hitbox/hurtbox overlap checks
	//   - tile/grid collision
	//   - rendering and animation frame stepping
}

// Example rule data shape, shown as comments for now.
//
// room "room_02" {
//   kind = "combat"
//   cleared_flag = "room_02.cleared"
//
//   on Trigger_Entered trigger="room_02.start" if !flag("room_02.cleared") {
//     Close_Door target="room_02.door.left"
//     Close_Door target="room_02.door.right"
//     Spawn_Enemy target="room_02.wave_1.crawler_1" enemy_kind="crawler" spawn="room_02.spawn_a"
//     Spawn_Enemy target="room_02.wave_1.crawler_2" enemy_kind="crawler" spawn="room_02.spawn_b"
//     Set_Room_State room="room_02" state="Combat"
//   }
//
//   on Enemy_Killed room="room_02" {
//     // Director decrements live enemy count internally.
//     // If no enemies and no waves remain, Director creates Room_Cleared.
//   }
//
//   on Room_Cleared room="room_02" {
//     Open_Door target="room_02.door.left"
//     Open_Door target="room_02.door.right"
//     Set_Flag flag="room_02.cleared"
//     Spawn_Loot item_kind="minor_health" spawn="room_02.reward"
//   }
// }
//
// Combat example:
//
// World event:
//   Entity_Hit_Entity source="bullet.player.shot_42" target="room_02.wave_1.crawler_1" amount=1
//
// Director reaction:
//   - look up bullet owner/weapon/skills
//   - look up enemy hp/armor/resistance
//   - calculate final damage
//   - reduce Enemy.hp
//   - command Destroy_Entity target="bullet.player.shot_42"
//   - if enemy hp <= 0:
//       command Destroy_Entity target="room_02.wave_1.crawler_1"
//       create synthetic Enemy_Killed
//       maybe command Spawn_Loot
//       maybe create synthetic Room_Cleared
