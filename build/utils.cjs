module.exports.externalModules = [
  ...Object.keys(require("../package.json").dependencies),
  ...require("module").builtinModules,
  ...require("module").builtinModules.map((mod) => `node:${mod}`),
];

module.exports.define = {
  CSB_SDK_VERSION: `"${require("../package.json").version}"`,
};
