# Yoinking: CraftPix Cyberpunk Platformer assets

Status: discussed
Date: 2026-07-26
Source: https://craftpix.net/sets/cyberpunk-platformer-asset-pixel-art/

## Source summary

CraftPix offers a collection of free, paid, and premium pixel-art assets for cyberpunk platformers, including tilesets, characters, enemies, bosses, items, backgrounds, and parallax layers across locations such as sewers, cities, laboratories, bars, and other industrial environments.

CraftPix's published license permits licensed assets to be used, adapted, and modified in commercial games without royalties. It forbids redistribution of source files or modified artwork in a form usable by another end user. See https://craftpix.net/file-licenses/.

## What we like

- A coherent starting library for rapidly building Imprint Zero's first representative encounter.
- Existing platformer tiles, characters, enemies, objects, and backgrounds reduce the cost of testing gameplay.
- Industrial and cyberpunk components fit the proposed freight-terminal encounter.
- Editable pixel art can be recoloured, recomposed, replaced, or extended as production needs become concrete.
- The collection can establish practical scale, animation, palette, and content-budget constraints earlier than bespoke final art.

## What we dislike / should avoid

- Letting a generic asset catalogue define the fiction, locations, characters, or mechanics.
- Treating bright neon cyberpunk as the final visual thesis when the GDD calls for industrial late-20th-century cyberpunk atmosphere.
- Assuming every available asset belongs in the game.
- Postponing visual authorship indefinitely because acceptable placeholder art exists.
- Committing licensed source or modified files to a public repository in violation of the redistribution restriction.
- Providing licensed art to AI tools; CraftPix explicitly forbids using assets and derivatives for AI training, testing, validation, or improvement.

## GAMS adaptation hypotheses

- The assets may serve as local production inputs for Imprint Zero while authored gameplay and art direction determine which files survive.
- The first freight-terminal slice can reveal which sprites need modification or replacement instead of commissioning a complete art set before gameplay is proven.
- A private or ignored asset-source workflow may be required, with only legally distributable packaged game output and original replacement art entering the public repository.

## Possible use in GAMS

- Immediate workflow: create the representative freight-terminal encounter for the game in `examples/demo`.
- Possible asset roles: environment tiles, props, parallax backgrounds, baseline character animation, enemies, effects, and UI placeholders.
- This is a game-production input, not a GAMS product requirement or architecture decision.

## Risks / mismatches

- The repository is public, while the CraftPix license forbids redistributing usable source and modified asset files.
- The AI-use prohibition means coding agents must not inspect or transform the licensed visual files.
- A browser game's packaged assets may remain extractable; the exact planned packaging should be checked against the license or confirmed with CraftPix support.
- Asset dimensions, animation sets, and visual density may constrain mechanics before those constraints are consciously accepted.
- A catalogue assembled from multiple packs may lack a distinctive visual identity without palette, silhouette, composition, and animation changes.
- The collection's neon emphasis may conflict with the accepted art direction.

## Open questions for grilling

- Is the collection a shippable licensed base, a prototype-only scaffold, or both?
- Which exact packs and license tier will be acquired?
- What local/private source-asset workflow prevents public redistribution?
- Which visual changes are mandatory before an asset is accepted for release?
- How will license provenance and purchase evidence be recorded?

## Conversion outcome

- Converted into the Imprint Zero art-direction, reference, and representative-encounter planning under `examples/demo/wiki/content/`.
- No GAMS PRD or ADR has been created.
