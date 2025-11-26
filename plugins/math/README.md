# Math Plugin

A simple mathematical operations plugin implemented in C that demonstrates the WPM (WebAssembly Plugin Manager) Plugin Development Kit (PDK) for C.

## Functions

### `add`
Adds two numbers.
- **Input**: `"a=5,b=3"`
- **Output**: `"8"`

### `multiply`
Multiplies two numbers.
- **Input**: `"a=4,b=7"`
- **Output**: `"28"`

### `power`
Calculates power (a^b) using simple iteration.
- **Input**: `"a=2,b=3"`
- **Output**: `"8"`

### `random_square`
Demonstrates plugin-to-plugin communication by calling the `random` plugin to get a random number, then squares it.
- **Input**: None
- **Output**: `"42^2 = 1764"` (example)

### `info`
Returns information about the plugin.
- **Input**: None
- **Output**: `"Math plugin v1.0 - provides add, multiply, power, random_square functions"`

## Implementation Details

- **Language**: C
- **Dependencies**: PDK header only (no external libc)
- **Build**: Uses Zig compiler with `wasm32-freestanding` target (bare WASM!)
- **Size**: ~18KB WASM file
- **Features**:
  - Custom number parsing and formatting
  - Simple key-value input parsing
  - Plugin-to-plugin communication
  - Error handling
  - Zero runtime dependencies
  - True bare WebAssembly (no WASI)

## Zig-Compiled C to Bare WASM

This plugin demonstrates C compiled to bare WebAssembly using Zig:

- ✅ **True bare WASM**: No WASI dependencies
- ✅ **Standard toolchain**: Uses Zig (which many projects already have)
- ✅ **Excellent WebAssembly support**: Zig has first-class WASM support
- ✅ **Compatible with PDK**: Works perfectly with WPM Plugin Development Kit
- ✅ **wasm32-freestanding**: Direct WebAssembly target

### Why Zig for C compilation?

1. **Built-in WebAssembly support**: No additional toolchain setup required
2. **Bare WASM output**: Compiles to `wasm32-freestanding` without WASI overhead  
3. **Cross-compilation**: Works consistently across platforms
4. **Simple build process**: Single command, no complex fallback chains
5. **No external dependencies**: Zig includes everything needed

### Build Command
```bash
zig build-exe main.c -target wasm32-freestanding -fno-entry -rdynamic -O ReleaseFast -femit-bin=plugin.wasm
```

## Building

The plugin is automatically built when running `make plugins-release` from the project root. 

**Requirements**: Zig compiler (uses `zig build-exe` with `wasm32-freestanding` target)

```bash
# Install Zig if needed
brew install zig
# or download from https://ziglang.org/download/

# Build all plugins
make plugins-release
```

The build system compiles C plugins directly to bare WebAssembly using Zig's excellent WebAssembly support.

## Input Format

The plugin uses a simple key-value format for input:
```
"a=5,b=3"
```

This format is parsed manually without external dependencies to keep the WASM size minimal.

## Testing

You can test the plugin functions using the GameCtl browser interface or programmatically through the WPM SDK.

Example calls:
```javascript
// Add two numbers
manager.call('math', 'add', 'a=10,b=20') // Returns "30"

// Multiply
manager.call('math', 'multiply', 'a=6,b=7') // Returns "42"

// Power
manager.call('math', 'power', 'a=3,b=4') // Returns "81"

// Random square (no input needed)
manager.call('math', 'random_square', '') // Returns something like "15^2 = 225"

// Plugin info
manager.call('math', 'info', '') // Returns plugin description
```