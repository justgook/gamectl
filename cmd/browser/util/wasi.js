export function createWasiPreview1Imports(getMemory) {
  const WASI_ESUCCESS = 0
  const WASI_ENOSYS = 52
  const WASI_ENOTSUP = 58

  function memory() {
    return typeof getMemory === 'function' ? getMemory() : null
  }

  function writeU32(ptr, value) {
    const mem = memory()
    if (!mem || !ptr) return
    new DataView(mem.buffer).setUint32(ptr, value >>> 0, true)
  }

  function writeU64(ptr, value) {
    const mem = memory()
    if (!mem || !ptr) return
    new DataView(mem.buffer).setBigUint64(ptr, BigInt(value), true)
  }

  return {
    clock_time_get: (_clockId, _precision, outPtr) => {
      writeU64(outPtr, Date.now() * 1000000)
      return WASI_ESUCCESS
    },
    fd_close: () => WASI_ESUCCESS,
    fd_fdstat_get: () => WASI_ENOTSUP,
    fd_fdstat_set_flags: () => WASI_ENOTSUP,
    fd_prestat_get: () => WASI_ENOTSUP,
    fd_prestat_dir_name: () => WASI_ENOTSUP,
    fd_read: () => WASI_ENOSYS,
    fd_renumber: () => WASI_ENOTSUP,
    fd_seek: (_fd, _offsetLow, _offsetHigh, _whence, newOffsetPtr) => {
      writeU64(newOffsetPtr, 0)
      return WASI_ENOSYS
    },
    fd_write: (_fd, _iovs, _iovsLen, nwrittenPtr) => {
      writeU32(nwrittenPtr, 0)
      return WASI_ESUCCESS
    },
    path_open: () => WASI_ENOSYS,
    proc_exit: (code) => {
      throw new Error(`wasi proc_exit(${code})`)
    },
  }
}
