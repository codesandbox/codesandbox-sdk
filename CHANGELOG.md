# Changelog

## [0.10.0](https://github.com/codesandbox/codesandbox-sdk/compare/v0.9.0...v0.10.0) (2025-02-28)


### Features

* allow defining timeout when waiting for port ([#70](https://github.com/codesandbox/codesandbox-sdk/issues/70)) ([27c559c](https://github.com/codesandbox/codesandbox-sdk/commit/27c559cb36839ba08b8a2518a45a5ede26b44f8b))

## [0.9.0](https://github.com/codesandbox/codesandbox-sdk/compare/v0.8.1...v0.9.0) (2025-02-26)


### Features

* add support for `--since` when listing sandboxes ([#68](https://github.com/codesandbox/codesandbox-sdk/issues/68)) ([f054205](https://github.com/codesandbox/codesandbox-sdk/commit/f0542057345aa0d11251bba24b9420f1b7ae2574))

## [0.8.1](https://github.com/codesandbox/codesandbox-sdk/compare/v0.8.0...v0.8.1) (2025-02-21)


### Bug Fixes

* don't use env if not env vars are set ([#66](https://github.com/codesandbox/codesandbox-sdk/issues/66)) ([7b61dcc](https://github.com/codesandbox/codesandbox-sdk/commit/7b61dcc2ba6aa183fb2597674bccd264dbb8615c))

## [0.8.0](https://github.com/codesandbox/codesandbox-sdk/compare/v0.7.0...v0.8.0) (2025-02-18)


### Features

* support for private previews and preview tokens ([#63](https://github.com/codesandbox/codesandbox-sdk/issues/63)) ([993e509](https://github.com/codesandbox/codesandbox-sdk/commit/993e50981f907f3a2ccf7421a2fd8e4aba96e9cf))

## [0.7.0](https://github.com/codesandbox/codesandbox-sdk/compare/v0.6.2...v0.7.0) (2025-02-15)


### Features

* add support for passing name and path to cli ([#60](https://github.com/codesandbox/codesandbox-sdk/issues/60)) ([00e8c20](https://github.com/codesandbox/codesandbox-sdk/commit/00e8c201b4dcd55f9ce15fc3bd7db09b7c88a103))

## [0.6.2](https://github.com/codesandbox/codesandbox-sdk/compare/v0.6.1...v0.6.2) (2025-02-10)


### Bug Fixes

* CommonJS build requires .cjs extension for ESM package ([#56](https://github.com/codesandbox/codesandbox-sdk/issues/56)) ([528022e](https://github.com/codesandbox/codesandbox-sdk/commit/528022e1e6beabd7e91ea755e544bffec02f265e))

## [0.6.1](https://github.com/codesandbox/codesandbox-sdk/compare/v0.6.0...v0.6.1) (2025-02-08)


### Performance Improvements

* do hibernation and shutdown in parallel ([#54](https://github.com/codesandbox/codesandbox-sdk/issues/54)) ([d8e4c6f](https://github.com/codesandbox/codesandbox-sdk/commit/d8e4c6f54ac91aef526af7ac8207f62f084b159d))

## [0.6.0](https://github.com/codesandbox/codesandbox-sdk/compare/v0.5.3...v0.6.0) (2025-02-06)


### Features

* allow sandbox to keep active while connected ([#53](https://github.com/codesandbox/codesandbox-sdk/issues/53)) ([7ad63d7](https://github.com/codesandbox/codesandbox-sdk/commit/7ad63d73926a13c7c1d4c23568901f7fd418c899))
* support env and cwd in shell api ([#52](https://github.com/codesandbox/codesandbox-sdk/issues/52)) ([7bf1e35](https://github.com/codesandbox/codesandbox-sdk/commit/7bf1e35c79b347e1b85dc557236c601aa0f455a9))


### Bug Fixes

* **snapshot:** don't include ignorefiles when building snapshots ([#50](https://github.com/codesandbox/codesandbox-sdk/issues/50)) ([64abff8](https://github.com/codesandbox/codesandbox-sdk/commit/64abff88deec9bf2ccac0a857be48b7de1ee6205))

## [0.5.3](https://github.com/codesandbox/codesandbox-sdk/compare/v0.5.2...v0.5.3) (2025-01-30)


### Bug Fixes

* use cjs for binary ([#47](https://github.com/codesandbox/codesandbox-sdk/issues/47)) ([7fc76a5](https://github.com/codesandbox/codesandbox-sdk/commit/7fc76a5648f1f2665dfda7c39d1432ca2ae2f768))

## [0.5.2](https://github.com/codesandbox/codesandbox-sdk/compare/v0.5.1...v0.5.2) (2025-01-30)


### Bug Fixes

* esm node build ([#36](https://github.com/codesandbox/codesandbox-sdk/issues/36)) ([4691813](https://github.com/codesandbox/codesandbox-sdk/commit/46918131508bcf56bde7b0d3f2afb07ae710fec5))

## [0.5.1](https://github.com/codesandbox/codesandbox-sdk/compare/v0.5.0...v0.5.1) (2025-01-30)


### Bug Fixes

* uploads of big files ([#44](https://github.com/codesandbox/codesandbox-sdk/issues/44)) ([c8e6f46](https://github.com/codesandbox/codesandbox-sdk/commit/c8e6f46299f51f9f8ac3acc5934d34a16e7db051))

## [0.5.0](https://github.com/codesandbox/codesandbox-sdk/compare/v0.4.0...v0.5.0) (2025-01-28)


### Features

* add more advanced pagination options ([#39](https://github.com/codesandbox/codesandbox-sdk/issues/39)) ([f086bb8](https://github.com/codesandbox/codesandbox-sdk/commit/f086bb88be2cb92848c8b8eae411408028978791))
* list sandboxes by running status ([#37](https://github.com/codesandbox/codesandbox-sdk/issues/37)) ([1e9e19c](https://github.com/codesandbox/codesandbox-sdk/commit/1e9e19c7df09ea15025873e8557cbed031d2e9d0))

## [0.4.0](https://github.com/codesandbox/codesandbox-sdk/compare/v0.3.0...v0.4.0) (2025-01-22)


### Features

* support for creating sessions ([#32](https://github.com/codesandbox/codesandbox-sdk/issues/32)) ([491d13d](https://github.com/codesandbox/codesandbox-sdk/commit/491d13db77992df5e3ab3fefb5b9de7e8edbd1c9))

## [0.3.0](https://github.com/codesandbox/codesandbox-sdk/compare/v0.2.0...v0.3.0) (2025-01-14)


### Features

* add support for listing sandboxes ([#33](https://github.com/codesandbox/codesandbox-sdk/issues/33)) ([6771396](https://github.com/codesandbox/codesandbox-sdk/commit/677139624f95431ec97e12ec985c3545bfe43678))

## [0.2.0](https://github.com/codesandbox/codesandbox-sdk/compare/v0.1.0...v0.2.0) (2025-01-10)


### Features

* add support for updating hibernation timeout ([#31](https://github.com/codesandbox/codesandbox-sdk/issues/31)) ([efd2051](https://github.com/codesandbox/codesandbox-sdk/commit/efd20510512cfeacc776d47cb0cf5d5563ba2914))


### Performance Improvements

* **build:** precreate files inside sandbox ([#16](https://github.com/codesandbox/codesandbox-sdk/issues/16)) ([6cd070e](https://github.com/codesandbox/codesandbox-sdk/commit/6cd070ed1c0c8fc81eba21fcd990bf145489cf91))

## 0.1.0 (2025-01-09)


### Features

* add support for together-ai api token ([af3a023](https://github.com/codesandbox/codesandbox-sdk/commit/af3a0233f1ac8dfae0a0d7cab6b206b4fe1dea5c))


### Bug Fixes

* don't keep VMs alive with polling ([#10](https://github.com/codesandbox/codesandbox-sdk/issues/10)) ([393d53c](https://github.com/codesandbox/codesandbox-sdk/commit/393d53c68bc4ea33983302fc2056727126124fc8))
* include sandbox id in build command ([9a737ea](https://github.com/codesandbox/codesandbox-sdk/commit/9a737ea3f6b3a26d6dd7953f7742494bae9d68a7))
* remove require banner for esm builds ([#15](https://github.com/codesandbox/codesandbox-sdk/issues/15)) ([6995957](https://github.com/codesandbox/codesandbox-sdk/commit/6995957220a3cc0da61f84d472a4e64d9bda0ebc))


### Performance Improvements

* start a vm while forking ([9b1774c](https://github.com/codesandbox/codesandbox-sdk/commit/9b1774c5d55ef802c069481a10e317e96d618f70))


### Miscellaneous Chores

* force release as 0.1.0 ([#28](https://github.com/codesandbox/codesandbox-sdk/issues/28)) ([352d049](https://github.com/codesandbox/codesandbox-sdk/commit/352d0492f78f508089d77750b7d5b4f773da797e))
