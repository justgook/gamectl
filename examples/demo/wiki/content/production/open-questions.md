---
title: Open Questions
summary: The ordered decision queue; unresolved matters stay here until moved into their canonical design page.
eyebrow: Production
status: in-progress
---

This page contains questions, not design truth. When a question is resolved, update its canonical page immediately and remove it from the active queue.

## One Pager status

> **Accepted** — The first internal One Pager is complete enough to guide deeper design. Remaining uncertainties are explicitly marked and should be resolved through focused design work rather than adding more high-level concepts.

## Current validation step

> **Needs evidence** — Build the flat freight-terminal blockout and tune movement, jump, camera, projectile timing, enemy spacing, integrity values, and encounter duration through play.

## Current production constraint

> **Accepted** — CraftPix originals and modified derivatives stay under `examples/demo/game/assets.private/craftpix/`, which is ignored by Git. They must not be copied elsewhere in the public repository or provided to AI tools.

> **TODO** — Confirm that the intended packaged browser distribution complies with the license before publishing extractable art files.

## Parked detail decisions

These remain important but should not interrupt completion of the One Pager:

- What immediate consequence follows individual mission failure?
- Where exactly does the player return after death?
- Which shared resources can be lost or recovered?
- How do shortcuts reduce repetition without erasing spatial meaning?
- What baseline and contrasting characters prove gameplay variation?
- What platform and input assumptions constrain the action?
- What detailed upgrade economy supports the campaign?

## Required artifacts

> **Needs example** — One representative encounter solved by two different characters.

> **Needs diagram** — The death cycle after ownership and persistence rules are resolved.

> **Needs image** — A character silhouette comparison and cyberpunk visual-direction board after gameplay roles are defined.

## Recently resolved

- **Private asset workflow:** licensed CraftPix source and derivatives stay under the git-ignored `examples/demo/game/assets.private/craftpix/` directory. See [[Design/Art Direction|Art direction]].
- **Baseline camera:** smooth side-follow with dead zones, gradual movement-based look-ahead, vertical bias, authored bounds, backward support, and no forced scrolling.
- **Baseline encounter sequence:** safe arrival, low-fire sentry, high-fire sentry, Shield Enforcer, brief reset, crane-plus-sentry, then rail-control terminal.
- **Baseline advancing enemy:** the Shield Enforcer's frontal armour completely blocks rifle fire; a committed charge exposes its rear and forces repositioning.
- **Enemy aiming vocabulary:** enemies use the same eight-direction lattice but receive authored firing envelopes; the baseline horizontal sentry teaches deterministic low and high lanes.
- **Baseline movement:** one digital run speed, quick acceleration, immediate or near-immediate reversal, no walk, sprint, or stamina state.
- **Baseline jump:** one variable-height jump, moderate air control, faster fall, short coyote time and input buffering; no double jump, wall jump, ledge grab, or air dash.
- **Baseline health:** provisional five-segment integrity; standard attacks remove one, heavy hazards may remove two, and ordinary threats do not one-hit kill.
- **Baseline rifle ammunition:** unlimited, with no reload or heat mechanic; special weapons may introduce resource constraints later.
- **Baseline rifle cadence:** continuous medium-cadence fire while directional input is active; releasing input stops fire immediately.
- **Aiming model:** eight gameplay directions; the primary gamepad binding quantizes right-stick direction and fires while active. Optional grounded aim-lock supports directional fire without movement; continuous-angle aiming is rejected.
- **Rifle Marine capability:** a committed combat slide passes beneath high threats without invulnerability or contact damage.
- **Freight hazard:** a telegraphed overhead crane cycles a cargo container that alternately blocks the lane and the sentry's line of sight.
- **Baseline threat sequence:** teach a ranged sentry, then an advancing enemy, then combine the sentry with one timed freight hazard.
- **Encounter build order:** begin with a flat single path; add one fork only after the action baseline works, then add a Memory-gated route as a third pass. See [[Gameplay/Representative Encounter|Representative encounter]].
- **Representative setting:** the first validation slice is an industrial freight terminal built from a constrained threat and route vocabulary. See [[Gameplay/Representative Encounter|Representative encounter]].
- **Baseline character:** a balanced Rifle Marine serves as the control case for movement, shooting, evasion, and route discovery. See [[Design/Characters|Characters]].
- **Title and tagline:** **Imprint Zero** — *You know how to fight. Not who you are.* See [[Design/Game Vision|Game vision]].
- **Campaign premise:** a conditioned recovery crew knows its missions and operational skills but lacks reliable autobiographical identity and knowledge of its true controller. See [[Design/World|World]].
- **Opening knowledge:** the crew and player know immediately that personal identity is missing or unreliable; whether the crew members are originals, clones, or manufactured people remains a central mystery. See [[Design/Characters|Characters]].
- **Initial obedience:** soldiering is the crew's only stable identity; refusal is physically possible, but conditioning makes doubt feel improper and unsafe. See [[Design/Player Experience|Player experience]].
- **Mission morality:** early operations create genuine local benefits while secretly advancing the controller's larger purpose. See [[Design/World|World]].
- **Concealed project:** the controller is rebuilding an industrial system for extracting, editing, copying, and deploying human identity. See [[Design/World|World]].
- **Memory Imprints:** recovered memories reveal truth and grant capability; they expand rather than replace character identity. See [[Gameplay/Mechanics|Mechanics]].
- **Intended audience:** players seeking readable but demanding authored 2D action, character-specific replay, consequential discovery, and atmospheric mystery delivered through play. See [[Design/Game Vision|Game vision]].
- **Design pillars:** familiarity without repetition, character choice transforms play, and discovery changes understanding and action. See [[Design/Design Pillars|Design pillars]].
- **Release mode:** strictly single-player, with one locally controlled character per deployment and no multiplayer requirement. See [[Production/Scope|Scope and non-goals]].
- **Campaign size:** target a compact 3–5 hour first successful completion, with replay extending engagement through character and discovery variation. See [[Production/Scope|Scope and non-goals]].
- **Platform and input:** PC first; gamepad defines action design; fully remappable keyboard controls are required. See [[Production/Scope|Scope and non-goals]].
- **Macro structure:** authored campaign with selective exploration and death-cycle elements. See [[Gameplay/Progression|Progression]].
- **Procedural generation:** not part of the current direction. See [[Production/Scope|Scope and non-goals]].
- **Character death:** unlocked authored characters remain available for free reselection. See [[Design/Characters|Characters]].
- **Crew model:** all playable characters coexist at a shared hub and participate in one persistent campaign. See [[Design/Characters|Characters]].
- **Deployment model:** one selected character is controlled per deployment; switching occurs only at the hub after death or voluntary return. See [[Design/Characters|Characters]].
- **Ownership model:** equipment and ordinary inventory are shared; item upgrades stay with the item; innate abilities and mastery stay with the character. See [[Design/Characters|Characters]].
