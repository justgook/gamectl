# Freight Terminal implementation stages

The browser prototype is evidence for behavior, not production code. Reimplement each accepted behavior in the Odin ECS and keep tuning values provisional until playtested.

## Stage 1 — Rifle Marine sandbox

- [x] Expand brain-level `Input` with a four-axis second stick (`TargetNorth/East/South/West`).
- [x] Add `Target` component and `sys_target` to produce a persistent eight-direction world-space target.
- [x] Draw target points and rays in the collision debug renderer.
- [x] Feed actor targets into BulletML aimed directions.
- [ ] Add native and web gamepad right-stick input with dead-zone handling.
- [ ] Make held second-stick input command firing; settle its relationship with `Action3`.
- [ ] Add muzzle position and ensure bullets originate from the weapon rather than actor center.
- [ ] Create the Rifle Marine platformer configuration.
- [ ] Add dedicated ground slide state and collider transition.
- [ ] Add player integrity, damage invulnerability, knockback, death, and encounter restart.
- [ ] Add Freight Terminal camera look-ahead and bounds profile.
- [ ] Add temporary movement/combat tuning overlay and timing capture.

## Stage 2 — Basic combat teaching

- [ ] Add sentry prefab and activation behavior.
- [ ] Add visible shot telegraph state.
- [ ] Add low-lane shot pattern.
- [ ] Add high-lane shot pattern.
- [ ] Add alternating final-sentry pattern.
- [ ] Add non-modal radio/subtitle messages for encounter teaching.

## Stage 3 — Shield Enforcer

- [ ] Add advance, charge-telegraph, charge, and recovery states.
- [ ] Add directional frontal shield filtering.
- [ ] Add rear vulnerability.
- [ ] Add actor contact damage.
- [ ] Add charge and blocked-hit feedback.

## Stage 4 — Crane encounter

- [ ] Add timed moving-crane hazard.
- [ ] Add dynamic player obstruction while the crane is down.
- [ ] Make the crane obstruct player and enemy projectiles.
- [ ] Add crane warning telegraph.
- [ ] Compose crane timing with the alternating sentry.

## Stage 5 — Encounter orchestration

- [ ] Author the seven Freight Terminal beat triggers through Director.
- [ ] Add proximity interaction and prompt support.
- [ ] Add rail-control terminal prefab and objective completion state.
- [ ] Add completion and delayed follow-up radio sequence.
- [ ] Add deterministic encounter reset/checkpoint restoration.
- [ ] Author Freight Terminal level geometry, entities, triggers, and objective data.
- [ ] Connect final animations, visual feedback, HUD, and completion presentation.
