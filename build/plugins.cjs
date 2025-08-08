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
