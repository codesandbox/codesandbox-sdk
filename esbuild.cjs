const esbuild = require("esbuild");

// Common plugin for module replacements
const browserifyPlugin = {
  name: "alias",
  setup(build) {
    // Handle os module replacement
    build.onResolve({ filter: /^os$/ }, (args) => {
      return { path: require.resolve("os-browserify/browser") };
    });

    // Handle path module replacement
    build.onResolve({ filter: /^path$/ }, (args) => {
      return { path: require.resolve("path-browserify") };
    });
  },
};

// Build both CJS and ESM versions
Promise.all([
  // Browser builds:
  // CommonJS build
  esbuild.build({
    entryPoints: ["src/browser.ts"],
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
    plugins: [browserifyPlugin],
  }),

  // ESM build
  esbuild.build({
    entryPoints: ["src/browser.ts"],
    bundle: true,
    format: "esm",
    outdir: "dist/esm",
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
    plugins: [browserifyPlugin],
  }),

  // Index builds:
  // Node:
  // CommonJS build
  esbuild.build({
    entryPoints: ["src/index.ts"],
    bundle: true,
    format: "cjs",
    platform: "node",
    // .cjs extension is required because "type": "module" is set in package.json
    outfile: "dist/cjs/index.cjs",
    plugins: [browserifyPlugin],
  }),

  // ESM build
  esbuild.build({
    entryPoints: ["src/index.ts"],
    bundle: true,
    format: "esm",
    platform: "node",
    banner: {
      js: `
import { fileURLToPath } from 'url';
import { createRequire as topLevelCreateRequire } from 'module';
const require = topLevelCreateRequire(import.meta.url);
      `.trim(),
    },
    outfile: "dist/esm/index.js",
    plugins: [browserifyPlugin],
  }),

  // Edge:
  // CommonJS build
  esbuild.build({
    entryPoints: ["src/index.ts"],
    // .cjs extension is required because "type": "module" is set in package.json
    outfile: "dist/cjs/index.edge.cjs",
    bundle: true,
    format: "cjs",
    platform: "browser",
    plugins: [browserifyPlugin],
  }),

  // ESM build
  esbuild.build({
    entryPoints: ["src/index.ts"],
    outfile: "dist/esm/index.edge.js",
    bundle: true,
    format: "esm",
    platform: "browser",
    plugins: [browserifyPlugin],
  }),

  // Bin builds:
  esbuild.build({
    entryPoints: ["src/bin/main.tsx"],
    outfile: "dist/bin/codesandbox.mjs",
    bundle: true,
    format: "esm",
    platform: "node",
    banner: {
      js: `#!/usr/bin/env node\n\n`,
    },
    external: [
      ...Object.keys(require("./package.json").dependencies || {}),
      ...Object.keys(require("./package.json").devDependencies || {}),
      ...require("module").builtinModules,
      "@codesandbox/sdk",
    ],
  }),
]).catch(() => {
  process.exit(1);
});
