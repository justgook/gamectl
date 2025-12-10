import { FsaNodeFs, FsaNodeSyncAdapterWorker, } from 'memfs/lib/fsa-to-node'
import { FsaNodeSyncWorker } from 'memfs/lib/fsa-to-node/worker/FsaNodeSyncWorker'
import { vol } from 'memfs'

vol.writeFileSync('/hello.txt', 'hello world');
console.log(vol.readFileSync('/hello.txt', 'utf8'));
console.log(FsaNodeFs)
console.log(FsaNodeSyncAdapterWorker)
console.log(FsaNodeSyncWorker)

