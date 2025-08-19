const { join } = require("path");
const esbuild = require("esbuild");
const { externalModules, define } = require("./build/utils.cjs");
const { moduleReplacementPlugin } = require("./build/plugins.cjs");

const devtoolsStubPlugin = {
  name: "stub-react-devtools",
  setup(build) {
    // whenever someone does `import 'react-devtools-core'`, redirect to our empty.js
    build.onResolve({ filter: /^react-devtools-core$/ }, () => ({
      path: join(__dirname, "build/fakeReactDevtoolsCore.js"),
      namespace: "file",
    }));
  },
};

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
  external: externalModules,
});

const nodeClientEsmBuild = esbuild.build({
  entryPoints: ["src/node/index.ts"],
  bundle: true,
  format: "esm",
  outfile: "dist/esm/node.js",
  // Handle dynamic requires (WS)
  banner: {
    js: `import { createRequire } from 'module'; const require = createRequire(import.meta.url);`,
  },
  platform: "node",
  // These has to be optional deps, due to being native and only working in certain envs
  external: externalModules.concat("bufferutil", "utf-8-validate"),
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
  external: externalModules,
});

const sdkEsmBuild = esbuild.build({
  entryPoints: ["src/index.ts"],
  bundle: true,
  format: "esm",
  define,
  platform: "node",
  // Handle dynamic requires (WS)
  banner: {
    js: `import { createRequire } from 'module'; const require = createRequire(import.meta.url);`,
  },
  outfile: "dist/esm/index.js",
  // These has to be optional deps, due to being native and only working in certain envs
  external: externalModules.concat("bufferutil", "utf-8-validate"),
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
    js: `#!/usr/bin/env node\n\nimport { createRequire } from "module";\nconst require = createRequire(import.meta.url);\n`,
  },
  external: [
    // We have to bundle React and Ink into the bundle because Ink supports React 18 in v5 and React 19 in v6,
    // but this breaks when running the CLI in the project folder as it might have either React version and we do not
    // want users to manually install React and correct Ink version as peer dependencies
    ...externalModules.filter(
      (mod) =>
        mod !== "react" && mod !== "ink" && mod !== "@tanstack/react-query"
    ),
    "@codesandbox/sdk",
  ],
  plugins: [devtoolsStubPlugin],
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
