/**
 * WASM Plugin SDK for JavaScript (Browser)
 * 
 * This SDK allows you to load and manage WebAssembly plugins in the browser,
 * compatible with plugins built using the Go PDK (pdk/pdk.go) or C PDK (pdk/pdk.h).
 * 
 * Usage:
 *   const manager = await PluginManager.create({
 *     modules: [
 *       { name: 'logger', url: '/plugins/logger.wasm' },
 *       { name: 'greet', data: wasmBytesArrayBuffer }
 *     ],
 *     hostFunctions: [
 *       {
 *         module: 'host',
 *         function: 'print',
 *         handler: (input) => {
 *           console.log(new TextDecoder().decode(input));
 *           return { returnCode: 0, output: new Uint8Array() };
 *         }
 *       }
 *     ]
 *   });
 *   
 *   const { returnCode, output } = await manager.call('greet', 'greet', 'World');
 */

class PluginManager {
  constructor() {
    this.wasmModules = new Map();
    this.hostModules = new Map();
    this.hostFunctionDefs = new Map();
    this.memoryOffsets = new Map();
    this.config = {
      envModuleName: 'env',
      maxCallDepth: 10
    };

    // Current call state
    this.currentInputPtr = 0;
    this.currentInputLen = 0;
    this.currentOutputPtr = 0;
    this.currentOutputLen = 0;

    // Plugin-to-plugin call state
    this.callStack = [];
    this.lastCallReturn = 0;
    this.lastCallOutputPtr = 0;
    this.lastCallOutputLen = 0;

    // Text encoding/decoding
    this.textEncoder = new TextEncoder();
    this.textDecoder = new TextDecoder();
  }

  /**
   * Create a new PluginManager instance
   * @param {Object} options
   * @param {Array<{name: string, url?: string, data?: ArrayBuffer}>} options.modules
   * @param {Array<{module: string, function: string, handler: Function}>} options.hostFunctions
   * @param {Object} options.config
   * @returns {Promise<PluginManager>}
   */
  static async create(options = {}) {
    const manager = new PluginManager();

    if (options.config) {
      Object.assign(manager.config, options.config);
    }

    // Setup host functions first
    await manager.setupHostFunctions(options.hostFunctions || []);

    // Load WASM modules
    for (const module of options.modules || []) {
      await manager.loadWasmModule(module);
    }

    return manager;
  }

  /**
   * Setup host functions (both native JS and WASM imports)
   */
  async setupHostFunctions(hostFunctions) {
    // Group by module name
    const hostModuleGroups = new Map();

    for (const fn of hostFunctions) {
      if (!hostModuleGroups.has(fn.module)) {
        hostModuleGroups.set(fn.module, []);
        this.hostFunctionDefs.set(fn.module, new Map());
      }
      hostModuleGroups.get(fn.module).push(fn);
      this.hostFunctionDefs.get(fn.module).set(fn.function, fn);
    }

    // Always create the env module
    if (!hostModuleGroups.has(this.config.envModuleName)) {
      hostModuleGroups.set(this.config.envModuleName, []);
    }

    // Store host modules (we don't instantiate them in JS like Go does)
    for (const [moduleName, functions] of hostModuleGroups) {
      this.hostModules.set(moduleName, { name: moduleName, functions });
    }
  }

  /**
   * Load a WASM module
   * @param {Object} module
   * @param {string} module.name
   * @param {string} [module.url]
   * @param {ArrayBuffer} [module.data]
   */
  async loadWasmModule(module) {
    let wasmBytes;

    if (module.data) {
      wasmBytes = module.data;
    } else if (module.url) {
      const response = await fetch(module.url);
      wasmBytes = await response.arrayBuffer();
    } else {
      throw new Error(`Module ${module.name} must have either url or data`);
    }

    const providedMemory = this.createModuleMemory(module);

    // Create import object with env functions
    const importObject = this.createImportObject(module.name, module, providedMemory);

    // Instantiate the WASM module
    const wasmModule = await WebAssembly.instantiate(wasmBytes, importObject);

    // Initialize if _initialize exists (TinyGo compatibility)
    if (wasmModule.instance.exports._initialize) {
      wasmModule.instance.exports._initialize();
    }

    const moduleMemory = providedMemory || wasmModule.instance.exports.memory;
    const heapBase = moduleMemory.buffer.byteLength;
    this.wasmModules.set(module.name, {
      name: module.name,
      instance: wasmModule.instance,
      memory: moduleMemory,
      memoryConfig: module.memory || null,
      heapBase,
      heapEnd: heapBase,
      allocations: new Map(),
      freeList: [],
      callFrames: [],
    });
  }

  /**
   * Create import object for WASM instantiation
   */
  createModuleMemory(module) {
    const config = module?.memory;
    if (!config?.import) return null;
    if (config.memory) return config.memory;

    const initial = Number(config.initialPages || 256);
    const maximum = Number(config.maximumPages || initial);
    const shared = config.shared !== false;

    return new WebAssembly.Memory({ initial, maximum, shared });
  }

  createImportObject(moduleName, moduleConfig = {}, providedMemory = null) {
    const importObject = {};

    // Add env module (always present)
    importObject[this.config.envModuleName] = {
      ...(providedMemory ? { memory: providedMemory } : {}),
      alloc: (size) => this.allocFunc(moduleName, Number(size)),
      free: (ptr) => this.freeFunc(moduleName, ptr),
      input_ptr: () => this.inputPtrFunc(),
      input_len: () => this.inputLenFunc(),
      set_output: (ptr, len) => this.setOutputFunc(ptr, len),

      // Plugin-to-plugin call functions
      plugin_call: (modulePtr, moduleLen, funcPtr, funcLen, inputPtr, inputLen) =>
        this.pluginCallFunc(moduleName, modulePtr, moduleLen, funcPtr, funcLen, inputPtr, inputLen),
      plugin_call_return: () => this.pluginCallReturnFunc(),
      plugin_call_output_ptr: () => this.pluginCallOutputPtrFunc(),
      plugin_call_output_len: () => this.pluginCallOutputLenFunc(),

      // Temporary ng host stubs, matching the CLI/runtime env surface
      ng_on_node_changed: (_nodeId, _statePtr) => {},
      ng_on_run_event: (_runId, _eventPtr, _eventLen) => {},
      ng_on_goal_reached: (_runId, _goalPtr, _goalLen) => {},
      ng_host_resolve: (_graphPtr, _graphLen, _nodePtr, _nodeLen, _keyPtr, _keyLen, _outPtr) => 7,
      ng_host_request: (_graphPtr, _graphLen, _nodePtr, _nodeLen, _reqPtr, _reqLen, _outPtr, _outLen) => 7
    };

    // Add WASI support (comprehensive polyfill for WASI plugins like SQLite3)
    importObject.wasi_snapshot_preview1 = {
      // File descriptor operations
      fd_close: () => 0,
      fd_write: (fd, iovs, iovsLen, nwritten) => {
        // Minimal console.log support for stdout/stderr
        if (fd === 1 || fd === 2) {
          // fd 1 = stdout, fd 2 = stderr
          // For now, just return success
          return 0;
        }
        return 0;
      },
      fd_read: () => 0,
      fd_seek: () => 0,
      fd_sync: () => 0,
      fd_fdstat_get: (fd, stat) => {
        // Return minimal fdstat structure
        // For in-memory operations, we can return success
        return 0;
      },
      fd_fdstat_set_flags: () => 0,
      fd_filestat_get: (fd, buf) => {
        // Return minimal filestat structure
        // SQLite3 uses this to check file properties
        const module = this.wasmModules.get(moduleName);
        if (module && buf) {
          const memory = new Uint8Array(module.memory.buffer);
          // Fill with zeros (minimal valid filestat)
          for (let i = 0; i < 64; i++) {
            memory[buf + i] = 0;
          }
        }
        return 0;
      },
      fd_filestat_set_size: () => 0,
      fd_filestat_set_times: () => 0,
      fd_pread: () => 0,
      fd_pwrite: () => 0,
      fd_readdir: () => 0,
      fd_renumber: () => 0,
      fd_tell: () => 0,
      fd_advise: () => 0,
      fd_allocate: () => 0,
      fd_datasync: () => 0,

      // Prestat operations
      fd_prestat_get: () => 8, // Return EBADF (bad file descriptor)
      fd_prestat_dir_name: () => 0,

      // Path operations (return EBADF for all)
      path_create_directory: () => 8,
      path_filestat_get: () => 8,
      path_filestat_set_times: () => 8,
      path_link: () => 8,
      path_open: () => 8,
      path_readlink: () => 8,
      path_remove_directory: () => 8,
      path_rename: () => 8,
      path_symlink: () => 8,
      path_unlink_file: () => 8,

      // Environment
      environ_sizes_get: (environCount, environBufSize) => {
        // No environment variables
        const module = this.wasmModules.get(moduleName);
        if (module && environCount && environBufSize) {
          const memory = new DataView(module.memory.buffer);
          memory.setUint32(environCount, 0, true);
          memory.setUint32(environBufSize, 0, true);
        }
        return 0;
      },
      environ_get: () => 0,

      // Arguments
      args_sizes_get: (argc, argvBufSize) => {
        // No command line arguments
        const module = this.wasmModules.get(moduleName);
        if (module && argc && argvBufSize) {
          const memory = new DataView(module.memory.buffer);
          memory.setUint32(argc, 0, true);
          memory.setUint32(argvBufSize, 0, true);
        }
        return 0;
      },
      args_get: () => 0,

      // Clock
      clock_res_get: (clockId, resolution) => {
        // Return 1 nanosecond resolution
        const module = this.wasmModules.get(moduleName);
        if (module && resolution) {
          const memory = new DataView(module.memory.buffer);
          memory.setBigUint64(resolution, BigInt(1), true);
        }
        return 0;
      },
      clock_time_get: (clockId, precision, timestamp) => {
        // Return current time in nanoseconds
        const module = this.wasmModules.get(moduleName);
        if (module && timestamp) {
          const memory = new DataView(module.memory.buffer);
          const now = BigInt(Date.now()) * BigInt(1000000); // Convert ms to ns
          memory.setBigUint64(timestamp, now, true);
        }
        return 0;
      },

      // Random
      random_get: (buf, bufLen) => {
        // Fill with random bytes using crypto API
        if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
          const module = this.wasmModules.get(moduleName);
          if (module) {
            const memory = new Uint8Array(module.memory.buffer);
            const randomBytes = new Uint8Array(bufLen);
            crypto.getRandomValues(randomBytes);
            memory.set(randomBytes, buf);
          }
        }
        return 0;
      },

      // Process
      proc_exit: (code) => {
        console.warn(`WASI proc_exit called with code ${code}`);
        throw new Error(`WASI proc_exit: ${code}`);
      },
      proc_raise: (sig) => {
        console.warn(`WASI proc_raise called with signal ${sig}`);
        return 0;
      },
      sched_yield: () => 0,

      // Poll (no-op)
      poll_oneoff: () => 0,

      // Socket operations (return EBADF for all)
      sock_accept: () => 8,
      sock_recv: () => 8,
      sock_send: () => 8,
      sock_shutdown: () => 8
    };

    // Add exports from already-loaded WASM modules (for cross-module imports)
    for (const [wasmModuleName, wasmModule] of this.wasmModules) {
      // Skip if it's the module we're currently loading
      if (wasmModuleName === moduleName) continue;

      importObject[wasmModuleName] = {};

      // Export all functions from this module
      const exports = wasmModule.instance.exports;
      for (const [exportName, exportValue] of Object.entries(exports)) {
        // Only export functions, not memory or other exports
        if (typeof exportValue === 'function') {
          importObject[wasmModuleName][exportName] = exportValue;
        }
      }
    }

    // Add other host modules
    for (const [hostModuleName, hostModule] of this.hostModules) {
      if (hostModuleName === this.config.envModuleName) continue;

      importObject[hostModuleName] = {};
      const functionMap = this.hostFunctionDefs.get(hostModuleName);

      if (functionMap) {
        for (const [funcName, funcDef] of functionMap) {
          importObject[hostModuleName][funcName] = (...args) => {
            return this.callHostFunctionFromWasm(moduleName, funcDef, args);
          };
        }
      }
    }

    return importObject;
  }

  /**
   * Allocate host-managed linear memory for a module.
   *
   * Important: PDK alloc/free must behave like a real allocator, not a
   * per-call scratch arena. Plugins such as sql keep pointers returned from
   * pdk_alloc across calls (for example SQLite's long-lived heap configured in
   * sql.open()).
   *
   * We still track temporary call-scoped allocations separately via callFrames
   * so buffers created only for a single host/plugin exchange can be released
   * automatically when the exported wasm call returns.
   */
  allocFunc(moduleName, size) {
    const module = this.wasmModules.get(moduleName);
    if (!module) return 0;

    if (size === 0) size = 1;
    const alignedSize = (Number(size) + 7) & ~7;

    let ptr = 0;
    const freeIndex = module.freeList.findIndex((block) => block.size >= alignedSize);
    if (freeIndex >= 0) {
      const block = module.freeList[freeIndex];
      ptr = block.ptr;
      if (block.size === alignedSize) {
        module.freeList.splice(freeIndex, 1);
      } else {
        block.ptr += alignedSize;
        block.size -= alignedSize;
      }
    } else {
      ptr = module.heapEnd;
      const nextEnd = ptr + alignedSize;
      if (nextEnd > module.memory.buffer.byteLength) {
        const bytesNeeded = nextEnd - module.memory.buffer.byteLength;
        const pagesNeeded = Math.max(1, Math.ceil(bytesNeeded / 65536));
        try {
          module.memory.grow(pagesNeeded);
        } catch (e) {
          console.error(`Failed to grow memory for ${moduleName}: tried to add ${pagesNeeded} pages (${size} bytes requested)`, e);
          throw new Error(`Out of memory in ${moduleName}`);
        }
      }
      module.heapEnd = nextEnd;
    }

    module.allocations.set(ptr, alignedSize);
    new Uint8Array(module.memory.buffer, ptr, alignedSize).fill(0);
    return ptr;
  }

  /**
   * Free a persistent host-managed allocation.
   *
   * Freed regions are merged and reused for later allocations so browser2 wasm
   * plugins can mix long-lived heaps with transient PDK buffers without
   * unbounded linear-memory growth.
   */
  freeFunc(moduleName, ptr) {
    const module = this.wasmModules.get(moduleName);
    if (!module || !ptr) return;

    const size = module.allocations.get(ptr);
    if (!size) return;
    module.allocations.delete(ptr);
    module.freeList.push({ ptr, size });
    module.freeList.sort((a, b) => a.ptr - b.ptr);

    const merged = [];
    for (const block of module.freeList) {
      const last = merged[merged.length - 1];
      if (last && last.ptr + last.size === block.ptr) {
        last.size += block.size;
      } else {
        merged.push({ ptr: block.ptr, size: block.size });
      }
    }
    module.freeList = merged;
  }

  // Call frames track temporary allocations that are safe to release once the
  // current exported wasm call unwinds. This must never include persistent
  // plugin-owned allocations unless the plugin explicitly called free().
  currentCallFrame(moduleName) {
    const module = this.wasmModules.get(moduleName);
    if (!module) return null;
    return module.callFrames[module.callFrames.length - 1] || null;
  }

  trackTempAlloc(moduleName, ptr) {
    const frame = this.currentCallFrame(moduleName);
    if (!frame || !ptr) return;
    frame.tempPtrs.push(ptr);
  }

  releaseTempAllocs(moduleName, frame) {
    if (!frame) return;
    for (let i = frame.tempPtrs.length - 1; i >= 0; i--) {
      this.freeFunc(moduleName, frame.tempPtrs[i]);
    }
    frame.tempPtrs.length = 0;
  }

  inputPtrFunc() {
    return this.currentInputPtr;
  }

  inputLenFunc() {
    return this.currentInputLen;
  }

  setOutputFunc(ptr, len) {
    this.currentOutputPtr = ptr;
    this.currentOutputLen = len;
  }

  /**
   * Plugin-to-plugin call implementation
   */
  pluginCallFunc(callerModuleName, modulePtr, moduleLen, funcPtr, funcLen, inputPtr, inputLen) {
    try {
      // Get caller's memory
      const callerModule = this.wasmModules.get(callerModuleName);
      if (!callerModule) return 1;

      const memory = new Uint8Array(callerModule.memory.buffer);

      // Read module and function names
      const moduleName = this.textDecoder.decode(
        memory.slice(modulePtr, modulePtr + moduleLen)
      );
      const funcName = this.textDecoder.decode(
        memory.slice(funcPtr, funcPtr + funcLen)
      );

      // Read input
      const input = inputLen > 0
        ? memory.slice(inputPtr, inputPtr + inputLen)
        : new Uint8Array(0);

      // Check call depth
      if (this.callStack.length >= this.config.maxCallDepth) {
        return 4; // max depth exceeded
      }

      // Save current context
      const currentCtx = {
        moduleName: callerModuleName,
        inputPtr: this.currentInputPtr,
        inputLen: this.currentInputLen,
        outputPtr: this.currentOutputPtr,
        outputLen: this.currentOutputLen
      };
      this.callStack.push(currentCtx);

      // Make the call (synchronous)
      const result = this.callSync(moduleName, funcName, input);

      // Restore context
      this.callStack.pop();
      this.currentInputPtr = currentCtx.inputPtr;
      this.currentInputLen = currentCtx.inputLen;
      this.currentOutputPtr = currentCtx.outputPtr;
      this.currentOutputLen = currentCtx.outputLen;

      // Store results
      this.lastCallReturn = result.returnCode;

      if (result.output.length > 0) {
        // Allocate in caller's memory
        const outputPtr = this.allocFunc(callerModuleName, result.output.length);
        const callerMemory = new Uint8Array(callerModule.memory.buffer);
        callerMemory.set(result.output, outputPtr);
        this.trackTempAlloc(callerModuleName, outputPtr);

        this.lastCallOutputPtr = outputPtr;
        this.lastCallOutputLen = result.output.length;
      } else {
        this.lastCallOutputPtr = 0;
        this.lastCallOutputLen = 0;
      }

      return 0; // success
    } catch (error) {
      console.error('Plugin call failed:', error);
      return 5; // call failed
    }
  }

  pluginCallReturnFunc() {
    return this.lastCallReturn;
  }

  pluginCallOutputPtrFunc() {
    return this.lastCallOutputPtr;
  }

  pluginCallOutputLenFunc() {
    return this.lastCallOutputLen;
  }

  /**
   * Call a host function from WASM
   */
  callHostFunctionFromWasm(callerModuleName, funcDef, args) {
    // For ByteHandler-style functions
    if (funcDef.isByteHandler !== false) {
      const callerModule = this.wasmModules.get(callerModuleName);
      if (!callerModule) return 0;

      // Read input from current state
      let input = new Uint8Array(0);
      if (this.currentInputLen > 0) {
        const memory = new Uint8Array(callerModule.memory.buffer);
        input = memory.slice(this.currentInputPtr, this.currentInputPtr + this.currentInputLen);
      }

      // Call the handler
      const result = funcDef.handler(input);
      const returnCode = result.returnCode || 0;
      const output = result.output || new Uint8Array(0);

      // Write output back to caller's memory
      if (output.length > 0) {
        const outputPtr = this.allocFunc(callerModuleName, output.length);
        const memory = new Uint8Array(callerModule.memory.buffer);
        memory.set(output, outputPtr);
        this.trackTempAlloc(callerModuleName, outputPtr);
        this.currentOutputPtr = outputPtr;
        this.currentOutputLen = output.length;
      }

      return returnCode;
    } else {
      // For primitive functions, just call directly
      return funcDef.handler(...args);
    }
  }

  /**
   * Synchronous call (used internally by plugin_call)
   */
  callSync(moduleName, functionName, input) {
    // Try WASM modules first
    if (this.wasmModules.has(moduleName)) {
      return this.callWasmFunction(moduleName, functionName, input);
    }

    // Try host modules
    if (this.hostModules.has(moduleName)) {
      return this.callHostFunction(moduleName, functionName, input);
    }

    throw new Error(`Module ${moduleName} not found`);
  }

  /**
   * Call a WASM function
   */
  /**
   * Call an exported wasm function.
   *
   * Only transient transport buffers are auto-released at the end of the call.
   * Persistent allocations remain live until the plugin frees them.
   */
  callWasmFunction(moduleName, functionName, input) {
    const module = this.wasmModules.get(moduleName);
    if (!module) {
      throw new Error(`WASM module ${moduleName} not found`);
    }

    const frame = { tempPtrs: [] };
    module.callFrames.push(frame);

    try {
      const inputPtr = this.allocFunc(moduleName, input.length);
      this.trackTempAlloc(moduleName, inputPtr);
      const currentMemory = new Uint8Array(module.memory.buffer);
      currentMemory.set(input, inputPtr);
      this.currentInputPtr = inputPtr;
      this.currentInputLen = input.length;

      this.currentOutputPtr = 0;
      this.currentOutputLen = 0;

      const fn = module.instance.exports[functionName];
      if (!fn) {
        throw new Error(`Function ${functionName} not found in module ${moduleName}`);
      }

      const returnValue = fn() || 0;

      let output = new Uint8Array(0);
      if (this.currentOutputPtr !== 0 && this.currentOutputLen > 0) {
        const updatedMemory = new Uint8Array(module.memory.buffer);
        output = updatedMemory.slice(this.currentOutputPtr, this.currentOutputPtr + this.currentOutputLen);
        this.trackTempAlloc(moduleName, this.currentOutputPtr);
      }

      return {
        returnCode: returnValue,
        output: output
      };
    } finally {
      module.callFrames.pop();
      this.releaseTempAllocs(moduleName, frame);
    }
  }

  /**
   * Call a host function
   */
  callHostFunction(moduleName, functionName, input) {
    const functionMap = this.hostFunctionDefs.get(moduleName);
    if (!functionMap) {
      throw new Error(`Host module ${moduleName} not found`);
    }

    let funcDef = functionMap.get(functionName);
    let result;

    if (!funcDef) {
      funcDef = functionMap.get('*');
      if (!funcDef) {
        throw new Error(`Function ${functionName} not found in host module ${moduleName}`);
      }
      result = funcDef.handler(functionName, input);
    } else {
      result = funcDef.handler(input);
    }

    return {
      returnCode: result.returnCode || 0,
      output: result.output || new Uint8Array(0)
    };
  }

  /**
   * Public API: Call a function in any module
   * @param {string} moduleName
   * @param {string} functionName
   * @param {string|Uint8Array} input
   * @returns {Promise<{returnCode: number, output: Uint8Array}>}
   */
  async call(moduleName, functionName, input) {
    // Convert string input to Uint8Array
    if (typeof input === 'string') {
      input = this.textEncoder.encode(input);
    } else if (!(input instanceof Uint8Array)) {
      input = new Uint8Array(input);
    }

    return this.callSync(moduleName, functionName, input);
  }

  rawCall(moduleName, functionName, input) {
    const module = this.wasmModules.get(moduleName)
    if (!module) {
      throw new Error(`WASM module ${moduleName} not found`)
    }

    const fn = module.instance.exports[functionName]
    if (!fn) {
      throw new Error(`Function ${functionName} not found in module ${moduleName}`)
    }

    return fn(input)
  }

  hasMethod(moduleName, functionName) {
    const module = this.wasmModules.get(moduleName)
    if (!module) return false
    return typeof module.instance.exports?.[functionName] === 'function'
  }

  /**
   * Load additional WASM modules after initial creation
   * Used by the two-phase boot: phase 2 loads plugins from the DB registry
   * 
   * @param {Array<{name: string, url?: string, data?: ArrayBuffer}>} modules
   */
  async loadAdditionalModules(modules) {
    for (const module of modules) {
      await this.loadWasmModule(module);
    }
  }

  /**
   * Get list of currently loaded module names
   * @returns {string[]}
   */
  getLoadedModules() {
    return [...this.wasmModules.keys()];
  }

  memory(moduleName) {
    return this.wasmModules.get(moduleName)?.memory || null;
  }

  /**
   * Close and cleanup
   */
  close() {
    this.wasmModules.clear();
    this.hostModules.clear();
    this.hostFunctionDefs.clear();
    this.memoryOffsets.clear();
  }
}

// Export for both browser and module environments
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { PluginManager };
} else if (typeof window !== 'undefined') {
  window.PluginManager = PluginManager;
} else if (typeof self !== 'undefined') {
  self.PluginManager = PluginManager;
}

// ES module export
export { PluginManager }
