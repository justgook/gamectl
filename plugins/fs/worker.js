// (self as any).process = require('process/browser');
// (self as any).Buffer = require('buffer').Buffer;
//
import { FsaNodeSyncWorker } from 'memfs/lib/fsa-to-node/worker/FsaNodeSyncWorker'

if (typeof window === 'undefined') {
  const worker = new FsaNodeSyncWorker();
  worker.start()
}
