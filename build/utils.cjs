module.exports.nodeExternals = [
  ...Object.keys(require("../package.json").dependencies),
  ...require("module").builtinModules,
];

module.exports.define = {
  CSB_SDK_VERSION: `"${require("../package.json").version}"`,
};
