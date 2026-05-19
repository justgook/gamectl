import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '../../..');
process.env.GAMS_SQL_PROVIDER = join(repoRoot, 'build.nosync/plugins/sql-vec.comp.wasm');
process.env.GAMS_SQL_E2E_DIR = join(here, 'e2e');
await import('../../sql.comp/test/e2e-runner.mjs');
