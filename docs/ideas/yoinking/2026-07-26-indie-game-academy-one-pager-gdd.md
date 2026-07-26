# Yoinking: Indie Game Academy One Pager GDD

Status: discussed
Date: 2026-07-26
Source: https://indiegameacademy.com/free-game-design-document-template-how-to-guide/

## Source summary

Indie Game Academy presents a traditional game design document outline and a condensed One Pager Design Document. The One Pager communicates the concept, objectives, gameplay pillars, narrative, visuals, audience, comparable games, and production timeline before those subjects grow into detailed documentation.

## What we like

- A concise One Pager as the starting point for a larger living GDD.
- Progressive disclosure from a readable game overview into detailed design knowledge.
- Internal alignment around the game concept, player experience, pillars, objectives, audience, and scope.
- Plain language, visuals, and short summaries rather than a monolithic specification.
- Treating the GDD as living documentation that changes with prototype and playtest evidence.

## What we dislike / should avoid

- Treating the One Pager as primarily promotional material.
- Demographic stereotypes that do not produce actionable design guidance.
- Premature release dates, monetization plans, or production detail during design discovery.
- Duplicating detailed rules in both the One Pager and deeper pages.
- Creating empty documentation sections merely because a generic template lists them.
- Enforcing a literal printed-page layout at the expense of internal usefulness.

## GAMS adaptation hypotheses

- The demo game's wiki home could become an internal-first Game One Pager.
- The One Pager could provide a concise design compass with links into focused game-design, content, presentation, production, and evidence pages.
- The One Pager could be maintained as a one-screen-ish overview: approximately 500–800 words, readable in under three minutes.
- The current placeholder game documentation can be replaced during a live grilling process while the Wiki Guide remains intact.

## Possible use in GAMS

- The immediate user is the internal team designing the real game under `examples/demo`.
- The immediate workflow is progressive game-design discovery recorded directly in `examples/demo/wiki/content/`.
- The resulting structure may later provide evidence for a reusable GAMS game-documentation workflow, but this record does not decide such a product feature.

## Risks / mismatches

- A concise summary can drift from detailed pages if ownership of each statement is unclear.
- The team can over-invest in documentation structure instead of validating the game through play.
- A generic GDD taxonomy may not fit the game that emerges.
- Internal design truth and an external publisher pitch have different audiences and should not be forced into one document.

## Open questions for grilling

- Which concepts must be visible on the internal One Pager from the first design session?
- Which deeper pages should exist immediately, and which should be created only when needed?
- How should hypotheses, evidence, decisions, and unresolved questions be distinguished?
- What rules keep the One Pager concise and synchronized with deeper documentation?

## Conversion outcome

- Live conversion is being grilled into the game wiki under `examples/demo/wiki/content/`.
- No GAMS PRD or ADR has been created from this inspiration.
