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

> **Needs evidence** — Playtest the geometric freight-terminal prototype and tune movement, jump, camera, projectile timing, enemy spacing, integrity values, and encounter duration. Then test VECTOR against the same space before implementing broader roster content.

## Current production constraint

> **Accepted** — CraftPix originals and modified derivatives stay under `examples/demo/game/assets.private/craftpix/`, which is ignored by Git. They must not be copied elsewhere in the public repository or provided to AI tools.

> **TODO** — Confirm that the intended packaged browser distribution complies with the license before publishing extractable art files.

## Parked detail decisions

These remain important but should not interrupt the flat-baseline validation pass:

- What immediate consequence follows individual mission failure?
- Where exactly does the player return after death?
- Which shared resources can be lost or recovered?
- How do shortcuts reduce repetition without erasing spatial meaning?
- Which ROOK and VECTOR Specializations best prove gameplay variation in the representative Encounter?
- What platform and input assumptions constrain the action?
- What detailed upgrade economy supports the campaign?

## Required artifacts

> **Needs example** — One representative encounter solved by two different characters.

> **Needs diagram** — The death cycle after ownership and persistence rules are resolved.

> **Needs image** — A character silhouette comparison and cyberpunk visual-direction board after gameplay roles are defined.

## Recently resolved

- **Operational voice:** [[NPCs/Operator|OPERATOR]] is the crew's consistent Mission-coordination entity; whether OPERATOR authors orders or relays another authority remains unresolved.
- **Opening dismissal:** OPERATOR labels ROOK's killed-in-action match legacy corruption and an archive ghost while VECTOR leaves doubt audible.
- **RELAY default Specialization:** **Wire** replaces Operator, keeping OPERATOR unambiguous as the NPC designation.
- **Configuration vocabulary:** a Character is the persistent person, a Specialization is one of three Hub-selected normal play styles, and Overdrive is the temporary transformation unique to the selected Specialization. See [[Gameplay/Overdrive|Specializations and Overdrive]].
- **Specialization count:** four Characters each have three Specializations; the baseline is the default Specialization, producing twelve selectable play styles.
- **Overdrive reveal:** the player does not initially know Overdrive exists; [[Missions/Lift the Governor|Lift the Governor]] later reveals and unlocks the system for the entire crew.
- **Overdrive activation Mission:** deploy as RELAY, choose branching activation rooms in any order, temporarily control each room's crew member, and complete an unlimited-Overdrive trial before returning to RELAY.
- **Later Specializations:** after the global reveal, every newly unlocked Specialization includes its unique Overdrive by default.
- **Mission compatibility:** ordinary main Missions must be completable with all twelve Specializations and cannot require charged Overdrive; explicit optional and Special Mission requirements are allowed.
- **Equipment compatibility:** the crew shares equipment, while Specializations define compatible weapon and armour classes; equipment alters but does not replace specialization identity.
- **Initial Hub roster:** ROOK and VECTOR are immediately selectable; VECTOR is the crew member who questions the archive record.
- **First Hub arrival:** remains player-controlled; physically reveals the radio crew; immediately exposes selection interfaces and direct shortcuts without a forced tour.
- **Immediate response:** [[NPCs/Operator|OPERATOR]] calmly calls the record legacy corruption and an archive ghost while VECTOR leaves doubt audible.
- **First contradiction:** the rail-control system recognizes ROOK under an unknown designation officially recorded as killed in action; OPERATOR suppresses the connection.
- **Opening delivery:** control begins immediately; objective and crew familiarity arrive through operational radio dialogue during the safe-arrival beat.
- **Opening progression:** new game deploys directly into Restore the Cargo Line with preselected ROOK and the Baseline Rifle; first success unlocks the Hub.
- **Hub presentation:** compact navigable side-view Zone with direct shortcuts to character, equipment, Mission, and Memory interfaces.
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
- **ROOK capability:** a committed combat slide passes beneath high threats without invulnerability or contact damage.
- **Freight hazard:** a telegraphed overhead crane cycles a cargo container that alternately blocks the lane and the sentry's line of sight.
- **Baseline threat sequence:** teach a ranged sentry, then an advancing enemy, then combine the sentry with one timed freight hazard.
- **Encounter build order:** begin with a flat single path; add one fork only after the action baseline works, then add a Memory-gated route as a third pass. See [[Gameplay/Representative Encounter|Representative encounter]].
- **Representative setting:** the first validation slice is an industrial freight terminal built from a constrained threat and route vocabulary. See [[Gameplay/Representative Encounter|Representative encounter]].
- **Playable roster:** [[Characters/Rook|ROOK]], [[Characters/Vector|VECTOR]], [[Characters/Ram|RAM]], and [[Characters/Relay|RELAY]] provide twelve Specializations across four persistent Characters.
- **Baseline character:** ROOK, the balanced Rifle Marine, serves as the control case for movement, shooting, evasion, and route discovery. See [[Characters/Rook|ROOK]].
- **Title and tagline:** **Imprint Zero** — *You know how to fight. Not who you are.* See [[Design/Game Vision|Game vision]].
- **Campaign premise:** a conditioned recovery crew knows its missions and operational skills but lacks reliable autobiographical identity and knowledge of OPERATOR's true nature or command authority. See [[World/Overview|World]].
- **Opening knowledge:** the crew and player know immediately that personal identity is missing or unreliable; whether the crew members are originals, clones, or manufactured people remains a central mystery. See [[Characters/Overview|Playable crew]].
- **Initial obedience:** soldiering is the crew's only stable identity; refusal is physically possible, but conditioning makes doubt feel improper and unsafe. See [[Design/Player Experience|Player experience]].
- **Mission morality:** early operations create genuine local benefits while secretly advancing the command authority's larger purpose. See [[Missions/Restore the Cargo Line|Restore the Cargo Line]].
- **Concealed project:** the authority behind the Missions is rebuilding an industrial system for extracting, editing, copying, and deploying human identity. See [[World/Overview|World]].
- **Memory Imprints:** recovered memories reveal truth and grant capability; they expand rather than replace character identity. See [[Equipment/Memory Imprints|Memory Imprints]].
- **Intended audience:** players seeking readable but demanding authored 2D action, character-specific replay, consequential discovery, and atmospheric mystery delivered through play. See [[Design/Game Vision|Game vision]].
- **Design pillars:** familiarity without repetition, character choice transforms play, and discovery changes understanding and action. See [[Design/Design Pillars|Design pillars]].
- **Release mode:** strictly single-player, with one locally controlled character per deployment and no multiplayer requirement. See [[Production/Scope|Scope and non-goals]].
- **Campaign size:** target a compact 3–5 hour first successful completion, with replay extending engagement through character and discovery variation. See [[Production/Scope|Scope and non-goals]].
- **Platform and input:** PC first; gamepad defines action design; fully remappable keyboard controls are required. See [[Production/Scope|Scope and non-goals]].
- **Macro structure:** authored campaign with selective exploration and death-cycle elements. See [[Gameplay/Progression|Progression]].
- **Procedural generation:** not part of the current direction. See [[Production/Scope|Scope and non-goals]].
- **Character death:** unlocked authored characters remain available for free reselection. See [[Characters/Overview|Playable crew]].
- **Crew model:** all playable characters coexist at a shared Hub and participate in one persistent campaign. See [[Characters/Overview|Playable crew]].
- **Deployment model:** one selected character is controlled per deployment; switching occurs only at the Hub after death or voluntary return. See [[Characters/Overview|Playable crew]].
- **Ownership model:** equipment and ordinary inventory are shared; item upgrades stay with the item; innate abilities and mastery stay with the character. See [[Equipment/Overview|Equipment]].
