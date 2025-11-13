# gamectl (Go, JavaScript, HTML, CSS, Zig)

`gamectl` is a game building tool for procedural generation, designed to allow users to generate games with minimal effort (a few clicks) or deep customization. It features a world progression graph that evolves into a minimap and then a full map, enabling procedural generation of all game elements. The system supports intersecting or 'hardcoding' any generation step to precisely control the outcome.

The project consists of a browser-based client, a Go backend, and a plugin-based architecture. It leverages Go for core logic and plugins, and a custom JavaScript frontend for the user interface, supported by a design system.

## Project Structure

- `cmd/browser/`: Contains the browser-based client application, including JavaScript for UI systems and views, HTML, CSS, and a Go server to serve these assets.
- `design/`: Houses design assets, scripts for generating showcases, and a comprehensive design token system (JSON). The `design/build` directory (generated) contains compiled design tokens (CSS, JS) and the design system showcase HTML.
- `pkg/`: Core Go packages providing shared functionalities like graph, minimap, tilemap, and tree structures.
- `plugins/`: A modular directory for various plugins (Go and Zig) that extend the system's procedural generation capabilities. These plugins are responsible for specific generation steps, including storing data, generating code, and generating assets, with the ability to intersect or override generation logic.

## Code Standards

- **Go**: Follows standard Go conventions and module practices.
- **JavaScript**: Structured into `systems` and `views` within the browser client.
- **Design Tokens**: JSON-based design tokens ensure consistent styling across the application.

## Technology-Specific Conventions

### Go Backend/Plugins
- Plugins are organized in `plugins/` with `main.go` as entry points.
- Core utilities are in `pkg/`.

### Browser Frontend
- UI logic is separated into `systems/` (for application logic) and `views/` (for rendering components).
- Styling is managed via `app.css` and `reset.css`, likely informed by the `design/` tokens.

### Design System
- Design tokens are defined in `design/tokens/` using JSON files, categorized by global, semantic, and component-specific values.
- Scripts in `design/script/` are used for generating design showcases and potentially processing design tokens.
- The `design/build` directory is generated and contains the compiled design tokens and showcase.

### Makefiles
- The **root `Makefile`** orchestrates the entire project build, including Go and Zig plugins, the Go browser server, and integrates the design token generation from the `design/` directory.
- The **`design/Makefile`** is specialized for the design system, handling the generation of design tokens (CSS, JS) and the design system showcase HTML.

## Specialized Agents Available

For different types of work, use these agents:
- **@coder-agent**: Implementation work and step-by-step coding tasks
- **@tester**: Test creation, TDD, and comprehensive coverage
- **@reviewer**: Code review, security analysis, and quality assurance
- **@documentation**: Writing, docs, and technical communication

## Development Workflow

- **Build**: The project uses `Makefile` for its build process. Refer to the `Makefile` for specific build commands.
- **Plugin Development**: When developing new plugins, adhere to the existing structure and conventions found in the `plugins/` directory. Plugins are central to the procedural generation process, handling data storage, code generation, and asset generation, with support for custom intersection logic.
- **Frontend Development**: When working on the browser frontend, ensure new features and components align with the `systems/` and `views/` separation of concerns.

## External Guidelines

- Refer to `go.mod` for Go module dependencies.
- Refer to `design/package.json` for design-related script dependencies.
