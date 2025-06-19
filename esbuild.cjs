const fs = require("fs");
const esbuild = require("esbuild");
const { nodeExternals, define } = require("./build/utils.cjs");
const {
  moduleReplacementPlugin,
  forbidImportsPlugin,
} = require("./build/plugins.cjs");

// Until pitcher-client is part of SDK we need to forbid these imports in
// Node builds
const preventPitcherClientImportsPlugin = forbidImportsPlugin([
  "@codesandbox/pitcher-protocol",
  "@codesandbox/pitcher-common",
]);

/**
 * BROWSER CLIENT BUILD
 */
const browserPlugin = moduleReplacementPlugin({
  "os-browserify/browser": /^os$/,
  "path-browserify": /^path$/,
});

const browserCjsBuild = esbuild.build({
  entryPoints: ["src/browser/index.ts"],
  bundle: true,
  format: "cjs",
  // .cjs extension is required because "type": "module" is set in package.json
  outfile: "dist/cjs/browser.cjs",
  platform: "browser",
  // pitcher-common currently requires this, but breaks the first experience
  banner: {
    js: `if (typeof window !== "undefined" && !window.process) {
window.process = {
  env: {},
};
}
`,
  },
  plugins: [browserPlugin],
  // pitcher-client seems to have some dynamic dependency on @sentry/node
  external: ["@sentry/node"],
});

const browserEsmBuild = esbuild.build({
  entryPoints: ["src/browser/index.ts"],
  bundle: true,
  format: "esm",
  outfile: "dist/esm/browser.js",
  platform: "browser",
  metafile: true,
  // pitcher-common currently requires this, but breaks the first experience
  banner: {
    js: `if (typeof window !== "undefined" && !window.process) {
window.process = {
  env: {},
};
}
`,
  },
  plugins: [browserPlugin],
  // pitcher-client seems to have some dynamic dependency on @sentry/node
  external: ["@sentry/node"],
});

/**
 * NODE CLIENT BUILD
 */

const nodeClientCjsBuild = esbuild.build({
  entryPoints: ["src/node/index.ts"],
  bundle: true,
  format: "cjs",
  // .cjs extension is required because "type": "module" is set in package.json
  outfile: "dist/cjs/node.cjs",
  platform: "node",
  external: nodeExternals,
  plugins: [preventPitcherClientImportsPlugin],
});

const nodeClientEsmBuild = esbuild.build({
  entryPoints: ["src/node/index.ts"],
  bundle: true,
  format: "esm",
  outfile: "dist/esm/node.js",
  platform: "node",
  external: nodeExternals,
  plugins: [preventPitcherClientImportsPlugin],
});

/**
 * SDK BUILD
 */
const sdkCjsBuild = esbuild.build({
  entryPoints: ["src/index.ts"],
  bundle: true,
  format: "cjs",
  define,
  platform: "node",
  // .cjs extension is required because "type": "module" is set in package.json
  outfile: "dist/cjs/index.cjs",
  external: nodeExternals,
});

const sdkEsmBuild = esbuild.build({
  entryPoints: ["src/index.ts"],
  bundle: true,
  format: "esm",
  define,
  platform: "node",
  outfile: "dist/esm/index.js",
  external: nodeExternals,
  plugins: [preventPitcherClientImportsPlugin],
});

/**
 * CLI BUILD
 */
const cliBuild = esbuild.build({
  entryPoints: ["src/bin/main.tsx"],
  outfile: "dist/bin/codesandbox.mjs",
  bundle: true,
  define,
  format: "esm",
  platform: "node",
  banner: {
    js: `#!/usr/bin/env node\n\n`,
  },
  external: [...nodeExternals, "@codesandbox/sdk"],
  plugins: [preventPitcherClientImportsPlugin],
});

Promise.all([
  browserCjsBuild,
  browserEsmBuild,
  nodeClientCjsBuild,
  nodeClientEsmBuild,
  sdkCjsBuild,
  sdkEsmBuild,
  cliBuild,
]).catch(() => {
  process.exit(1);
});
