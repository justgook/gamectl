---
title: Progression Map
summary: Unlock, deployment, return, and revisit relationships across the accepted campaign.
eyebrow: World progression
status: in-progress
---

This graph represents campaign progression, not physical geography.

## Early campaign graph

```mermaid
flowchart LR
    Start([New game]) --> Preset[Preselected ROOK + Baseline Rifle]

    subgraph Freight[Freight Terminal]
        M01[01 · Restore the Cargo Line]
    end

    subgraph Flood[Flood-Control Works]
        M02[02 · Open the Floodgates]
        M03[03 · Restart the Deep Pumps]
        Boss2[Second boss stabilization]
    end

    subgraph Factory[Automated Fabrication Plant]
        M04[04 · Breach the Lockdown]
        M05[05 · Lift the Governor]
    end

    Preset --> M01
    M01 -->|First success| Hub1[Hub · VECTOR available]
    Hub1 -->|ROOK or VECTOR| M02
    M02 -->|First boss defeated| Hub2[Hub]
    Hub2 -->|ROOK or VECTOR| M03
    M03 --> Boss2
    Boss2 -->|RAM intervenes; player wins| Hub3[Hub · RAM available]
    Hub3 -->|RAM / Breacher required| M04
    M04 -->|RELAY extracted| Hub4[Hub · RELAY available]
    Hub4 -->|Deploy as RELAY| M05
    M05 -->|Four trials complete| Hub5[Hub · Overdrive available]
    Hub5 --> Future[Future campaign Mission]

    M01 -->|Introduction failure| M01
    M02 -. Failure or withdrawal .-> Hub1
    M03 -. Failure or withdrawal .-> Hub2
    M04 -. Failure or withdrawal .-> Hub3
    M05 -. Failure or withdrawal .-> Hub4
```

## Opening path

1. Start a new game with no Hub or loadout menu.
2. Deploy immediately as [[Characters/Rook|ROOK]] with the [[Equipment/Baseline Rifle|Baseline Rifle]].
3. Complete [[Missions/Restore the Cargo Line|Restore the Cargo Line]] in the [[World/Freight Terminal|Freight Terminal]].
4. Restart inside the introduction on failure; the Hub is not available yet.
5. Reach the [[World/Hub|Hub]] after first success.
6. Unlock [[Characters/Vector|VECTOR]] as the second selectable Character.

## Flood-Control Works path

1. Select ROOK or VECTOR, one unlocked Specialization, and compatible equipment at the Hub.
2. Complete [[Missions/Open the Floodgates|Open the Floodgates]] and defeat the first boss.
3. Return to the Hub with the deeper [[World/Flood Control Works|Flood-Control Works]] Mission available.
4. Complete [[Missions/Restart the Deep Pumps|Restart the Deep Pumps]] as ROOK or VECTOR.
5. Reach the second boss's repair/stabilization state.
6. RAM breaks the stabilizer; the player completes the boss victory.
7. Return to the Hub with [[Characters/Ram|RAM]] available.

## Automated Fabrication Plant path

1. Receive RAM's report that RELAY is sealed inside a hostile factory bunker.
2. Deploy as RAM's default Breacher Specialization for [[Missions/Breach the Lockdown|Breach the Lockdown]].
3. Enter the [[World/Automated Fabrication Plant|Automated Fabrication Plant]], open the bunker, and extract [[Characters/Relay|RELAY]].
4. Return to the Hub with RELAY available.
5. Deploy primarily as RELAY for [[Missions/Lift the Governor|Lift the Governor]].
6. Complete the four character-specific trial rooms in any order.
7. Unlock [[Gameplay/Overdrive|Overdrive]] globally and return to the Hub.

## Standard deployment and return

Ordinary Missions use the standard Hub loop:

1. Select an available Character, unlocked Specialization, compatible loadout, and Mission.
2. Deploy into its Zone.
3. Complete Encounters, routes, discoveries, and the objective.
4. Return to the Hub after success, death, or voluntary withdrawal.

Breach the Lockdown and Lift the Governor are explicit Special Mission exceptions with advertised Character and Specialization requirements.

## Accepted persistence

- World discoveries, shortcuts, restored machinery, and unlocked routes belong to the shared campaign.
- Equipment and ordinary inventory belong to the shared crew stash.
- Item upgrades remain attached to the item.
- Innate abilities and character mastery remain character-owned.
- Changing Character does not create another world state.
- Character unlocks persist: ROOK → VECTOR → RAM → RELAY.
- Completing Lift the Governor unlocks Overdrive for every acquired Specialization; later Specializations include their unique Overdrive.

## Unknown progression

> **Open question** — Which Mission and destination follow Lift the Governor.

> **Open question** — Whether later Zones are selected directly from the Hub, connected physically, or use a limited hybrid.

> **Open question** — Exact death-cycle resource loss, Mission checkpoint behavior, and partial persistence inside Special Missions.
