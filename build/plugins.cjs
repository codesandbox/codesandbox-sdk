module.exports.moduleReplacementPlugin = function moduleReplacementPlugin(
  replacements
) {
  return {
    name: "module-replacement",
    setup(build) {
      for (const [key, value] of Object.entries(replacements)) {
        build.onResolve({ filter: new RegExp(`^${value}$`) }, (args) => {
          return { path: require.resolve(key) };
        });
      }
    },
  };
};

module.exports.forbidImportsPlugin = function forbidImportsPlugin(imports) {
  return {
    name: "forbid-imports",
    setup(build) {
      for (const packageName of imports) {
        // catch `import ... from 'packageName'` **and** sub-paths `packageName/foo`
        const pkgFilter = new RegExp(`^${packageName}($|/)`);
        build.onResolve({ filter: pkgFilter }, (args) => {
          return {
            errors: [
              {
                text: `❌ Importing “${packageName}” is forbidden in this project.`,
                notes: [
                  "If you really need it, talk to your team lead about an exception.",
                ],
              },
            ],
          };
        });
      }
    },
  };
};
