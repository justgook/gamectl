# Default build directory
BUILD_DIR ?= ./build

# Phony target to avoid conflicts with a file named "tokens"
.PHONY: tokens

# Target: tokens
# Description: Builds all design tokens using Style Dictionary.
tokens:
	@echo "--- Building Design Tokens ---"
	@# Create build directories if they don't exist
	@mkdir -p $(BUILD_DIR)/css
	@mkdir -p $(BUILD_DIR)/js
	
	@# Run Style Dictionary. Assumes node_modules/.bin is in path or installed globally.
	@# We pass BUILD_DIR as an env var so it's picked up by config.json
	@BUILD_DIR=$(BUILD_DIR) npx style-dictionary build --verbose --config ./config.js
	
	@echo "--- Design Tokens built successfully in $(BUILD_DIR) ---"

# Phony target for cleaning
.PHONY: clean
clean:
	@echo "--- Cleaning build directory ---"
	@rm -rf $(BUILD_DIR)
