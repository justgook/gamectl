---
title: Demo Game
summary: The living game design document, production guide, and shared memory for the first real game developed with GAMS.
eyebrow: Knowledge base
status: discovery
---

This wiki will become the source of truth for the game currently living in `examples/demo`. The prototype proved technical ideas; the next step is to define the game those systems will serve.

## Begin the design

Start with [[Design/Game Vision|Game vision]], then turn the intended feeling into a small set of [[Design/Design Pillars|design pillars]]. Every feature should strengthen those pillars or justify why it exists.

## What belongs here

- **Game design:** player experience, loops, rules, content, progression, world, art, and audio.
- **Production knowledge:** scope, milestones, open questions, references, and decisions that affect the game.
- **Prototype evidence:** what was tested, what worked, what failed, and what remains uncertain.

Implementation details for GAMS itself stay in the repository's main documentation system. This wiki documents the **game made with GAMS**.

## Writing model

Every page is an ordinary Markdown file under `content/`. Connect ideas with wiki links such as `[[Gameplay/Core Loop|core loop]]`. The nested sidebar is itself Markdown in `_sidebar.md`; no generated manifest is required. See [[Wiki/Overview|Using this wiki]] for the complete authoring reference and examples.

> This initial content is scaffolding, not a decided game design. We will replace questions and placeholders as the design grilling progresses.
