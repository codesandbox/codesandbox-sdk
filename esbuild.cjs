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

const nodeExternals = [
  ...Object.keys(require("./package.json").dependencies),
  ...require("module").builtinModules,
];

// Build both CJS and ESM versions
Promise.all([
  // Browser builds:
  // CommonJS build
  esbuild.build({
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
    plugins: [browserifyPlugin],
  }),

  // ESM build
  esbuild.build({
    entryPoints: ["src/browser/index.ts"],
    bundle: true,
    format: "esm",
    outfile: "dist/esm/browser.js",
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
    external: nodeExternals,
  }),

  // ESM build
  esbuild.build({
    entryPoints: ["src/index.ts"],
    bundle: true,
    format: "esm",
    platform: "node",
    outfile: "dist/esm/index.js",
    external: nodeExternals,
  }),

  // Bin builds:
  esbuild.build({
    entryPoints: ["src/bin/main.ts"],
    outfile: "dist/bin/codesandbox.cjs",
    bundle: true,
    format: "cjs",
    platform: "node",
    banner: {
      js: `#!/usr/bin/env node\n\n`,
    },
    // ORA is an ESM module so we have to include it in the build
    external: [...nodeExternals, "@codesandbox/sdk"].filter(
      (mod) => mod !== "ora"
    ),
  }),
]).catch(() => {
  process.exit(1);
});
