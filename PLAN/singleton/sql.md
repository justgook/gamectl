# sql

- kind: `singleton`
- status: `requires-clarification`
- source: `plugins/sql`

## Description
Core storage/service candidate and an important baseline for the preferred singleton model. Likely to remain a central routed plugin regardless of host environment.

## Notes
- This is a good reference plugin for the intended `singleton` direction.
- Even if implementation details change later, keeping a stable plugin contract here is strategically important.

## Todo
- [ ] confirm whether `sql` already fits the singleton target model closely enough
- [ ] document current API surface and guarantees expected by other plugins/views
- [ ] decide whether browser/main-thread access should be routed only through plugin manager
- [ ] identify any migration needed for project-defined alternative SQL backends
- [ ] requires clarification
