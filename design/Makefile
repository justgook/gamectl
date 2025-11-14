# Default build directory
BUILD_DIR ?= ./build

# Phony target to avoid conflicts with a file named "tokens"
.PHONY: tokens showcase build all

# Target: tokens
# Description: Builds all design tokens using Style Dictionary.
tokens:
	@echo "--- Building Design Tokens ---"
	@# Create build directories if they don't exist
	@mkdir -p $(BUILD_DIR)/css
	@mkdir -p $(BUILD_DIR)/js
	
	@# Run Style Dictionary. Assumes node_modules/.bin is in path or installed globally.
	@# We pass BUILD_DIR as an env var so it's picked up by config.json
	@BUILD_DIR=$(BUILD_DIR) bun run style-dictionary build --verbose --config ./config.js
	
	@echo "--- Design Tokens built successfully in $(BUILD_DIR) ---"

# Target: showcase
# Description: Generates the design system showcase HTML
showcase:
	@echo "--- Generating Design System Showcase ---"
	@node script/generate-showcase.js
	@echo "--- Showcase generated successfully ---"

# Target: build
# Description: Builds tokens and generates showcase
build: tokens showcase
	@echo "--- Full build complete ---"

# Target: all (default)
# Description: Alias for build
all: build

# Phony target for cleaning
.PHONY: clean
clean:
	@echo "--- Cleaning build directory ---"
	@rm -rf $(BUILD_DIR)
