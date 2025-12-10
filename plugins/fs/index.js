import { FsaNodeFs, FsaNodeSyncAdapterWorker, } from 'memfs/lib/fsa-to-node'


let fs = null
let adapter = null

export async function create(dir) {
  if (!adapter) {
    adapter = await FsaNodeSyncAdapterWorker.start('/plugins/fs/worker.js', dir)
  }
  fs = new FsaNodeFs(dir, adapter)

  return fs
}

export function mkdir(name) {
  fs.mkdirSync(name)
  return { returnCode: 0, output: new Uint8Array() }
}
export function foo() {
  return 123
}

export function bar(x) {
  return x * 2
}
