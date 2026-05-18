# Reference and Styleguides

This directory contains canonical operational reference material for GAMS.

## Styleguides

Styleguides define supported development patterns for official GAMS Project Units. They are normative for first-party code: when creating or changing a Project Unit covered by a styleguide, follow the relevant guide before adding new local patterns.

Current styleguides:

- [GAMS View Development Guide](./gams-view-development-guide.md) — Core View UI vocabulary, structure, and reusable widget rules.

## Protected edits

Styleguides are part of the styling and behavior contract for official GAMS Project Units. Do not edit, append, rename, or loosen a styleguide unless the user explicitly approves that styleguide change in the current task.

If implementation work needs a pattern not covered by a styleguide:

1. stop before adding the new pattern to production code;
2. ask whether the styleguide should be extended;
3. include the exact proposed styleguide addition;
4. apply the styleguide edit only after explicit approval;
5. then implement the code using the approved vocabulary.
