---
title: Mechanics
summary: The baseline action verbs and the decisions they must create.
eyebrow: Gameplay
status: in-progress
---

## Baseline verbs

> **In progress** — The shared action foundation currently requires:

- **Move:** control spacing, approach threats, and navigate terrain.
- **Jump:** cross geometry, evade, reach routes, and maintain momentum.
- **Aim and shoot:** apply pressure while managing position and exposure.
- **Evade:** respond to enemies, hazards, and projectile patterns.
- **Explore:** notice and reach optional routes, secrets, or later opportunities.

These describe intended capabilities, not final controls. A verb survives only if it creates decisions and consequences in representative encounters.

## Character-specific play

> **Accepted** — One character is controlled per deployment. Character switching occurs only at the hub after death or voluntary return.

> **Accepted** — The baseline Rifle Marine is a generalist with balanced movement, range, and survivability. The role exists to prove the shared action fundamentals before unusual character mechanics are introduced.

> **Accepted** — Its innate capability is a combat slide: a fast, low horizontal commitment that passes beneath high projectiles and low obstacles. It has no invulnerability frames, deals no contact damage, and cannot reverse direction during its brief commitment. Other characters reinterpret the same ability input.

Each playable character must transform the shared verbs in a way the player can feel immediately. Possible dimensions include mobility, attack geometry, range, risk, defence, resource use, and access to routes.

Designing a large roster before one complete Rifle Marine and representative encounter would hide weaknesses in the core game.

## Memory Imprints

> **Accepted** — Recovered Memory Imprints are both narrative evidence and progression artifacts. Each provides truth about an identity, institution, or place and grants a technique, tactical understanding, interaction, or route permission.

> **Accepted** — Imprints expand the selected character's possibilities without replacing innate movement and combat identity.

> **TODO** — Define acquisition, assignment, capacity, compatibility, persistence, and whether an imprint can be transferred between crew members.

## Ground movement

> **Accepted** — Baseline ground movement uses one digital run speed. Directional input beyond the dead zone means full run; there is no analogue walk speed, sprint state, sprint button, or stamina cost.

> **Accepted** — Acceleration is very quick and reversal is immediate or near-immediate. Aim-lock supplies stationary precision, while combat slide supplies the short movement burst. Exact speed and acceleration values require playtesting.

Keyboard and gamepad must produce equivalent movement timing.

## Jump and air control

> **Accepted** — The Rifle Marine has one variable-height jump. Holding jump extends ascent; releasing it cuts ascent short. There is no baseline double jump, wall jump, ledge grab, or air dash.

> **Accepted** — Horizontal air control is moderate, falling is faster than rising, and short coyote-time and jump-buffer windows provide modern responsiveness. Exact acceleration, gravity, and timing values require playtesting.

> **Accepted** — Combat slide is ground-only.

## Aiming and firing

> **Accepted** — Baseline weapons use eight-direction digital aiming: horizontal, vertical, and diagonal. Threats can attack from above and below while aim, enemy placement, and projectile patterns remain discretely readable.

> **Accepted** — The primary gamepad binding uses the right analogue stick as an eight-direction firing control. Crossing the stick threshold quantizes its direction and begins firing; returning it to neutral stops the firing input. The weapon determines its own cadence, so automatic, burst, charged, and single-shot weapons can share the same directional input model.

This is twin-stick **control**, not continuous-angle analogue aiming. Arbitrary firing angles remain rejected.

> **Accepted** — The Rifle Marine's baseline rifle fires continuously at a fixed medium cadence while directional firing input remains active. Returning the stick to neutral stops fire immediately. Other weapons may interpret held input as burst, charge, or single-shot behavior.

> **Accepted** — The baseline rifle has unlimited ammunition with no reload or heat mechanic. It remains available after failure and tests movement, aiming, and positioning rather than resource management. Special weapons may later use ammunition, energy, heat, charge, or another constraint.

> **Accepted** — Aim-lock is an optional alternative, not a required action. While grounded, holding aim-lock plants the character in place and lets directional input change firing direction without movement.

> **In progress** — Keyboard may support dedicated directional-fire keys, quantized mouse-directed fire, and aim-lock with ordinary movement keys. Every scheme must produce the same eight gameplay directions; mouse precision must not change balance.

> **Open question** — How does optional aim-lock behave while airborne, and which keyboard schemes ship by default?

## Camera

> **Accepted** — Baseline play uses a smooth side-follow camera with horizontal and vertical dead zones. Sustained movement gradually shifts look-ahead so the character sits slightly behind centre toward the direction of travel; aiming alone does not move the camera.

> **Accepted** — Vertical movement begins only after leaving its dead zone, with a slight upward framing bias for platforms and overhead threats. The camera remains inside authored level bounds, supports backward repositioning, and does not force-scroll during the representative encounter.

> **Needs evidence** — Tune dead-zone sizes, look-ahead distance, vertical bias, and smoothing through the freight-terminal blockout.

## Enemy firing directions

> **Accepted** — Enemy fire uses the same eight-direction gameplay lattice as player fire, but each enemy receives a deliberately constrained firing envelope that defines its role.

Examples:

- horizontal sentries control lanes;
- flying enemies fire vertically downward;
- diagonal attackers control slopes or crossing spaces;
- advanced enemies may select from several or all eight directions.

Not every enemy tracks the player or fires in every direction. Directional limitation creates readable safe spaces and makes enemy combinations meaningful.

> **Accepted** — High and low shots are two horizontal firing lanes, not separate aim directions. An enemy may support one lane or use a clearly telegraphed fixed sequence across both.

## Baseline advancing enemy

> **Accepted** — The Shield Enforcer advances steadily with frontal armour that completely blocks baseline rifle fire. Blocked rounds produce immediate ricochet feedback and deal no damage or stagger. Its rear remains vulnerable.

At close range it telegraphs a committed horizontal charge, cannot turn during the charge, and pauses after missing. The player must jump over or otherwise reposition, reverse aim, and attack the exposed rear. Contact or a melee strike removes one integrity segment.

Special weapons may later interact differently with armour, but the baseline rifle cannot break it.

## Health and baseline failure

> **Accepted** — The Rifle Marine uses a small segmented integrity bar, provisionally five segments. Standard attacks remove one segment; heavy environmental hazards may remove two. Ordinary threats do not cause one-hit deaths.

> **Accepted** — Taking damage produces an immediate visual and audio response, a brief hit reaction, and short post-hit invulnerability to prevent accidental damage stacking. Reaching zero integrity restarts the representative encounter during baseline validation.

> **Needs evidence** — Tune segment count, invulnerability duration, and heavy-hazard damage through playtesting. The segmented model is accepted; exact values are provisional.

## Encounter rules

> **TODO** — Define enemy pressure, damage model, aiming model, weapon constraints, recovery, and route gating through one representative encounter.

## Resources

> **Accepted** — Weapons, armour, consumables, currencies, and key items use a shared crew stash. Item upgrades remain attached to the item; innate abilities and personal mastery remain character-owned.

> **TODO** — Define which health, ammunition, energy, and upgrade resources the representative encounter actually needs.
