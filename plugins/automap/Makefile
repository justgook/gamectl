SHELL := /bin/bash

AUTOMAP_DIR := $(CURDIR)
TILED_EXTENSIONS_DIR ?= $(HOME)/Library/Preferences/Tiled/extensions
EXTENSION_NAME := gamectl-automap-fixtures
EXTENSION_SOURCE := $(AUTOMAP_DIR)/tiled-extension
EXTENSION_TARGET := $(TILED_EXTENSIONS_DIR)/$(EXTENSION_NAME)

.PHONY: install-tiled-extension uninstall-tiled-extension open-tiled generate-fixtures

install-tiled-extension:
	@mkdir -p "$(TILED_EXTENSIONS_DIR)"
	@rm -rf "$(EXTENSION_TARGET)"
	@ln -s "$(EXTENSION_SOURCE)" "$(EXTENSION_TARGET)"
	@printf 'Installed Tiled extension at %s\n' "$(EXTENSION_TARGET)"

uninstall-tiled-extension:
	@rm -rf "$(EXTENSION_TARGET)"
	@printf 'Removed Tiled extension at %s\n' "$(EXTENSION_TARGET)"

open-tiled: install-tiled-extension
	@open -a "/Applications/Tiled.app"
	@printf 'Tiled opened. Use Map -> Generate Automap Fixtures to refresh output.json files.\n'

generate-fixtures: install-tiled-extension
	@"$(AUTOMAP_DIR)/generate_testdata.sh" $(CASES)
