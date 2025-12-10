import { build } from 'esbuild';
import { nodeModulesPolyfillPlugin } from 'esbuild-plugins-node-modules-polyfill';

build({
  entryPoints: ['fs/index.js', 'fs/worker.js'],  // your entry point
  bundle: true,
  minify: true,
  format: 'esm',
  platform: 'browser',
  outdir: 'plugins/fs',
  plugins: [
    nodeModulesPolyfillPlugin({
      //     globals: { Buffer: true },
    })
  ],
}).catch(() => process.exit(1));
