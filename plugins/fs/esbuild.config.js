import { build } from 'esbuild';
import { nodeModulesPolyfillPlugin } from 'esbuild-plugins-node-modules-polyfill';

build({
  entryPoints: ['fs/index.js', 'fs/worker.js'],  // your entry point
  bundle: true,
  minify: true,
  format: 'iife',
  platform: 'browser',
  outdir: 'plugins/fs',
  globalName: "PluginFileSystem",
  plugins: [
    nodeModulesPolyfillPlugin({
      //     globals: { Buffer: true },
    })
  ],
}).catch(() => process.exit(1));
