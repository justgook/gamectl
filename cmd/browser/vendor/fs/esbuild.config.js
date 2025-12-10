import { build } from 'esbuild';
import { nodeModulesPolyfillPlugin } from 'esbuild-plugins-node-modules-polyfill';

build({
  entryPoints: ['src/index.js'],  // your entry point
  bundle: true,
  minify: true,
  format: 'esm',
  platform: 'browser',
  outfile: 'cmd/browser/vendor/memfs.bundle.js',
  plugins: [
    nodeModulesPolyfillPlugin({
      // optionally enable global polyfills
      globals: { process: true, Buffer: true },
    })
  ],
}).catch(() => process.exit(1));
