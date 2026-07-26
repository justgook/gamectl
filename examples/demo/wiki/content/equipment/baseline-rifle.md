---
title: Baseline Rifle
summary: Unlimited-ammunition control weapon for validating movement, aiming, firing, and enemy readability.
eyebrow: Weapon
status: accepted
---

## Role

> **Accepted** — The Baseline Rifle is ROOK's starting control weapon. It tests aiming, positioning, and movement without introducing ammunition or reload management.

It is not necessarily the character's permanent or exclusive weapon.

## Input

- Eight gameplay firing directions
- Primary gamepad input uses the right stick
- Stick direction is quantized rather than continuously aimed
- Directional input begins firing immediately
- Returning the stick to neutral stops firing immediately
- Optional grounded aim-lock supports stationary directional fire

## Cadence

> **Accepted** — Continuous fire at a fixed medium cadence while directional input remains active.

Other weapons may interpret held input as burst, charge, or single-shot behavior.

## Resources

> **Accepted** — Unlimited ammunition, no reload, and no heat mechanic. The rifle remains available after failure.

## Armour interaction

> **Accepted** — Rifle rounds cannot damage or stagger the frontal armour of a [[Enemies/Shield Enforcer|Shield Enforcer]]. They ricochet with immediate visual and audio feedback. The exposed rear remains vulnerable.

## Ownership

The rifle belongs to the shared crew stash under the accepted equipment model. Upgrades applied later would remain attached to the item.

## Unknown values

> **Needs evidence** — Tune projectile speed, medium cadence, damage, enemy time-to-defeat, muzzle feedback, impact feedback, and screen density in the [[Gameplay/Representative Encounter|Representative Encounter]].

> **Needs image** — Define a readable projectile and weapon silhouette without relying on licensed art in AI tools.
