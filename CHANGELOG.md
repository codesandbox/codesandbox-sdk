# Changelog

## [2.4.2](https://github.com/codesandbox/codesandbox-sdk/compare/v2.4.1...v2.4.2) (2025-12-04)


### Bug Fixes

* send params to restart correctly ([#232](https://github.com/codesandbox/codesandbox-sdk/issues/232)) ([c9775c4](https://github.com/codesandbox/codesandbox-sdk/commit/c9775c43eecdda38b3c7ea309e03610edeb73b0f))

## [2.4.1](https://github.com/codesandbox/codesandbox-sdk/compare/v2.4.0...v2.4.1) (2025-10-23)


### Bug Fixes

* reconnect issue ([#216](https://github.com/codesandbox/codesandbox-sdk/issues/216)) ([2dfa670](https://github.com/codesandbox/codesandbox-sdk/commit/2dfa670a62d320ffe9b50831e212ede5ae90732d))

## [2.4.0](https://github.com/codesandbox/codesandbox-sdk/compare/v2.3.0...v2.4.0) (2025-10-16)


### Features

* batch writes in template build ([#205](https://github.com/codesandbox/codesandbox-sdk/issues/205)) ([9b2f3f6](https://github.com/codesandbox/codesandbox-sdk/commit/9b2f3f66c4a0b3fa7c9b2f29c456875bea807ead))
* command error with exit code ([#203](https://github.com/codesandbox/codesandbox-sdk/issues/203)) ([652c2ef](https://github.com/codesandbox/codesandbox-sdk/commit/652c2efb900ce36081f0a1dca6919b288508116b))


### Bug Fixes

* batch session initialization commands ([#207](https://github.com/codesandbox/codesandbox-sdk/issues/207)) ([363faca](https://github.com/codesandbox/codesandbox-sdk/commit/363faca904324d3daecbde8990555dfa3a5eb577))
* handle spacing in env variables of commands ([#202](https://github.com/codesandbox/codesandbox-sdk/issues/202)) ([da5a772](https://github.com/codesandbox/codesandbox-sdk/commit/da5a7724d0d264c8088747c137a45f3cb6c534d6))

## [2.3.0](https://github.com/codesandbox/codesandbox-sdk/compare/v2.2.1...v2.3.0) (2025-09-29)


### Features

* trigger release after squash merge ([#195](https://github.com/codesandbox/codesandbox-sdk/issues/195)) ([93e65b3](https://github.com/codesandbox/codesandbox-sdk/commit/93e65b3ae1754db43f72ae223feecb8e912ae7ee))


### Bug Fixes

* allow --help without api key ([#190](https://github.com/codesandbox/codesandbox-sdk/issues/190)) ([3f14843](https://github.com/codesandbox/codesandbox-sdk/commit/3f14843c2ea354cb9ba0c1b9137ca9ca92c2ee60))
* Remove devcontainer folder when .codesandbox/Dockerfile identified ([#196](https://github.com/codesandbox/codesandbox-sdk/issues/196)) ([b5c6df9](https://github.com/codesandbox/codesandbox-sdk/commit/b5c6df9cd6b4c43859e85635c5fde4de50674b3d))

## [2.2.1](https://github.com/codesandbox/codesandbox-sdk/compare/v2.2.0...v2.2.1) (2025-09-16)


### Bug Fixes

* Throw error when invalid port is used ([#188](https://github.com/codesandbox/codesandbox-sdk/issues/188)) ([d0bdf31](https://github.com/codesandbox/codesandbox-sdk/commit/d0bdf3128787cdea22ea7e18c5af63594c303402))

## [2.2.0](https://github.com/codesandbox/codesandbox-sdk/compare/v2.1.0...v2.2.0) (2025-09-02)

### Features

- Add traceparent for all requests to API ([#180](https://github.com/codesandbox/codesandbox-sdk/issues/180)) ([b6f4846](https://github.com/codesandbox/codesandbox-sdk/commit/b6f484665de0bf0533127e098ff0ef1aa641a84b))
- batch writes ([#175](https://github.com/codesandbox/codesandbox-sdk/issues/175)) ([493c5d5](https://github.com/codesandbox/codesandbox-sdk/commit/493c5d52d1eaa527d099b0270a5b0e78a694abbd))

### Bug Fixes

- ensure private preview on private sandbox ([#179](https://github.com/codesandbox/codesandbox-sdk/issues/179)) ([04381a0](https://github.com/codesandbox/codesandbox-sdk/commit/04381a071fb54aa385ad40ed7ff6d489945565ef))
- prevent api config overrides ([#177](https://github.com/codesandbox/codesandbox-sdk/issues/177)) ([a9ec1a7](https://github.com/codesandbox/codesandbox-sdk/commit/a9ec1a78c2c83a53dfd0649dfa1764589b9fa671))
- Queue messages on lost connection and reconnect also on hibernation ([#176](https://github.com/codesandbox/codesandbox-sdk/issues/176)) ([c5a8ffd](https://github.com/codesandbox/codesandbox-sdk/commit/c5a8ffdf4bcba321c4d3c9581f752c5e72a3bc8f))

## [2.1.0](https://github.com/codesandbox/codesandbox-sdk/compare/v2.0.7...v2.1.0) (2025-08-22)

### Features

- add fetching single sandbox ([#142](https://github.com/codesandbox/codesandbox-sdk/issues/142)) ([2f58d43](https://github.com/codesandbox/codesandbox-sdk/commit/2f58d43ee44c98eeb7d0e917c8b423a80d202585))
- add listRunning method to sandboxes namespace ([#145](https://github.com/codesandbox/codesandbox-sdk/issues/145)) ([6050dbd](https://github.com/codesandbox/codesandbox-sdk/commit/6050dbd289058c782e634a7ce9e25d9cf5921276))
- add open telemetry for sandboxes methods ([#147](https://github.com/codesandbox/codesandbox-sdk/issues/147)) ([b331315](https://github.com/codesandbox/codesandbox-sdk/commit/b3313153b357dfda0d666a6a56ea79f6aa3dbbdf))
- add tracing to Sandbox and SandboxClient, also allow passing to browser and node connectors ([#150](https://github.com/codesandbox/codesandbox-sdk/issues/150)) ([6ef2bf5](https://github.com/codesandbox/codesandbox-sdk/commit/6ef2bf51120068e35ff43607e3353a69d8fbf070))
- Debug Sandboxes through CLI ([#163](https://github.com/codesandbox/codesandbox-sdk/issues/163)) ([9af1cdd](https://github.com/codesandbox/codesandbox-sdk/commit/9af1cdd0657c1a74572dc473ac6e04f6e1a40cd5))
- enhance container setup logging in build command ([836a7a6](https://github.com/codesandbox/codesandbox-sdk/commit/836a7a6ed1dc7c73d737e04475083faf8d6d8fc4))
- enhance container setup logging in build command ([a6f9fe7](https://github.com/codesandbox/codesandbox-sdk/commit/a6f9fe7c93450cfeded21048f62a6a2f0b842091))
- private sandbox, public hosts with public-hosts privacy ([#154](https://github.com/codesandbox/codesandbox-sdk/issues/154)) ([dce7caf](https://github.com/codesandbox/codesandbox-sdk/commit/dce7cafd719e398b1f1421776bd55fa5601eccd0))

### Bug Fixes

- Add custom retry delay support for startVM API calls ([#156](https://github.com/codesandbox/codesandbox-sdk/issues/156)) ([ce3a282](https://github.com/codesandbox/codesandbox-sdk/commit/ce3a2823e66198f453d257a68757226d50e3bf17))
- Decouple pitcher-client ([#148](https://github.com/codesandbox/codesandbox-sdk/issues/148)) ([3a6f9ea](https://github.com/codesandbox/codesandbox-sdk/commit/3a6f9ea213d978dc5a896bfc4d275deae6608abe))
- friendly 503 error for overloaded Sandbox ([#172](https://github.com/codesandbox/codesandbox-sdk/issues/172)) ([f9987b1](https://github.com/codesandbox/codesandbox-sdk/commit/f9987b1a0b625bd580b94b6035c17d09d561cbbc))
- include response handling in retries and dispose clients in build to avoid reconnecst ([#162](https://github.com/codesandbox/codesandbox-sdk/issues/162)) ([f70903a](https://github.com/codesandbox/codesandbox-sdk/commit/f70903a593c51bdfcdbf49d86b7b7bdce7cfe4a4))
- properly dispose and prevent wakeups ([#170](https://github.com/codesandbox/codesandbox-sdk/issues/170)) ([029e3a5](https://github.com/codesandbox/codesandbox-sdk/commit/029e3a554010fe278eaeb6632f9df45264cbdc29))
- Stabilize websocket connection ([#166](https://github.com/codesandbox/codesandbox-sdk/issues/166)) ([cb2f330](https://github.com/codesandbox/codesandbox-sdk/commit/cb2f330897c5e4c26637bc39a85d0e28dc4331d6))
- update log line length to be smaller ([9a3099f](https://github.com/codesandbox/codesandbox-sdk/commit/9a3099fc3984c6ff01fa901ac1616cbc7b883119))

## [2.0.7](https://github.com/codesandbox/codesandbox-sdk/compare/v2.0.6...v2.0.7) (2025-08-06)

### Bug Fixes

- also retry resume ([#143](https://github.com/codesandbox/codesandbox-sdk/issues/143)) ([8b69036](https://github.com/codesandbox/codesandbox-sdk/commit/8b69036d0b586917db05f9c51046ae8b26660835))

## [2.0.6](https://github.com/codesandbox/codesandbox-sdk/compare/v2.0.5...v2.0.6) (2025-08-06)

### Bug Fixes

- Add retries to all idempotent endpoints and added parallel file writing ([#140](https://github.com/codesandbox/codesandbox-sdk/issues/140)) ([db8aded](https://github.com/codesandbox/codesandbox-sdk/commit/db8aded97e1844cc31f70b08b6a294b458069656))
- Fix broken authorization in preview hosts ([20a4e53](https://github.com/codesandbox/codesandbox-sdk/commit/20a4e538e3b473007783831c7592670cf99c8a96))
- Fix broken authorization in preview hosts ([71b38b4](https://github.com/codesandbox/codesandbox-sdk/commit/71b38b4b12a9438864296fb599d20760c6b0a728))
- Update to latest Ink and React 19 and bundle React and Ink into CLI ([#138](https://github.com/codesandbox/codesandbox-sdk/issues/138)) ([62da4fe](https://github.com/codesandbox/codesandbox-sdk/commit/62da4fef50a3497b84c71413b1c0e3337c73e59f))

## [2.0.5](https://github.com/codesandbox/codesandbox-sdk/compare/v2.0.4...v2.0.5) (2025-07-29)

### Bug Fixes

- timeout errors on keepActiveWhileConnected ([a519bcf](https://github.com/codesandbox/codesandbox-sdk/commit/a519bcfe86abe2f978718169490a54d9977a9d88))

## [2.0.4](https://github.com/codesandbox/codesandbox-sdk/compare/v2.0.3...v2.0.4) (2025-07-16)

### Bug Fixes

- fix dependencies ([0211660](https://github.com/codesandbox/codesandbox-sdk/commit/02116601a6f33aa56c465eff63f3d44e2220ccf4))
- move some devdependencies to dependencies ([77f74f1](https://github.com/codesandbox/codesandbox-sdk/commit/77f74f1c81f35c9f9ccd3d159b51857df0b3fc81))

## [2.0.3](https://github.com/codesandbox/codesandbox-sdk/compare/v2.0.2...v2.0.3) (2025-07-08)

### Bug Fixes

- disable sentry by default, make it optional ([#126](https://github.com/codesandbox/codesandbox-sdk/issues/126)) ([09d9e8a](https://github.com/codesandbox/codesandbox-sdk/commit/09d9e8a9a678c35169f8ff98b6e283fb45e23ed1))

## [2.0.2](https://github.com/codesandbox/codesandbox-sdk/compare/v2.0.1...v2.0.2) (2025-07-02)

### Bug Fixes

- add api client to runningvms query fn ([0119379](https://github.com/codesandbox/codesandbox-sdk/commit/0119379482320dd1142366838ec0679380800909))
- add apiClient to context and pass to query fn ([75f56da](https://github.com/codesandbox/codesandbox-sdk/commit/75f56dafb1fe93ad395d9727ebab39425875de5d))
- Template resolve files fixes ([#121](https://github.com/codesandbox/codesandbox-sdk/issues/121)) ([6d455ad](https://github.com/codesandbox/codesandbox-sdk/commit/6d455ad7eefe69f70b8ff4f20efb18d929e57613))

## [0.12.0](https://github.com/codesandbox/codesandbox-sdk/compare/v0.11.2...v0.12.0) (2025-04-24)

### Features

- add property to check if VM is up to date ([a44c842](https://github.com/codesandbox/codesandbox-sdk/commit/a44c8424dedee731b172ea2cdbbb6fe3ade0f2f5))
- Rest client ([ec8f5eb](https://github.com/codesandbox/codesandbox-sdk/commit/ec8f5ebc8ab5d4e3540b1985a3a98ecfb64b0c7f))

## [0.11.2](https://github.com/codesandbox/codesandbox-sdk/compare/v0.11.1...v0.11.2) (2025-04-15)

### Bug Fixes

- **build:** consider port opened for faulty status codes ([#84](https://github.com/codesandbox/codesandbox-sdk/issues/84)) ([c5a2469](https://github.com/codesandbox/codesandbox-sdk/commit/c5a246997a07834fe86a73e15762c1e76d552d58))

## [0.11.1](https://github.com/codesandbox/codesandbox-sdk/compare/v0.11.0...v0.11.1) (2025-03-13)

### Bug Fixes

- support `keepActiveWhileConnected` for browser sessions ([#81](https://github.com/codesandbox/codesandbox-sdk/issues/81)) ([ca1f825](https://github.com/codesandbox/codesandbox-sdk/commit/ca1f82582d2f12b84cdf379902c596e6d5bfed52))

## [0.11.0](https://github.com/codesandbox/codesandbox-sdk/compare/v0.10.0...v0.11.0) (2025-03-11)

### Features

- add support for configuring auto-wake behaviour ([#79](https://github.com/codesandbox/codesandbox-sdk/issues/79)) ([8c2ef89](https://github.com/codesandbox/codesandbox-sdk/commit/8c2ef897b03ce2d3f4865f6e68e2c2f07824852c))

## [0.10.0](https://github.com/codesandbox/codesandbox-sdk/compare/v0.9.0...v0.10.0) (2025-02-28)

### Features

- allow defining timeout when waiting for port ([#70](https://github.com/codesandbox/codesandbox-sdk/issues/70)) ([27c559c](https://github.com/codesandbox/codesandbox-sdk/commit/27c559cb36839ba08b8a2518a45a5ede26b44f8b))

## [0.9.0](https://github.com/codesandbox/codesandbox-sdk/compare/v0.8.1...v0.9.0) (2025-02-26)

### Features

- add support for `--since` when listing sandboxes ([#68](https://github.com/codesandbox/codesandbox-sdk/issues/68)) ([f054205](https://github.com/codesandbox/codesandbox-sdk/commit/f0542057345aa0d11251bba24b9420f1b7ae2574))

## [0.8.1](https://github.com/codesandbox/codesandbox-sdk/compare/v0.8.0...v0.8.1) (2025-02-21)

### Bug Fixes

- don't use env if not env vars are set ([#66](https://github.com/codesandbox/codesandbox-sdk/issues/66)) ([7b61dcc](https://github.com/codesandbox/codesandbox-sdk/commit/7b61dcc2ba6aa183fb2597674bccd264dbb8615c))

## [0.8.0](https://github.com/codesandbox/codesandbox-sdk/compare/v0.7.0...v0.8.0) (2025-02-18)

### Features

- support for private previews and preview tokens ([#63](https://github.com/codesandbox/codesandbox-sdk/issues/63)) ([993e509](https://github.com/codesandbox/codesandbox-sdk/commit/993e50981f907f3a2ccf7421a2fd8e4aba96e9cf))

## [0.7.0](https://github.com/codesandbox/codesandbox-sdk/compare/v0.6.2...v0.7.0) (2025-02-15)

### Features

- add support for passing name and path to cli ([#60](https://github.com/codesandbox/codesandbox-sdk/issues/60)) ([00e8c20](https://github.com/codesandbox/codesandbox-sdk/commit/00e8c201b4dcd55f9ce15fc3bd7db09b7c88a103))

## [0.6.2](https://github.com/codesandbox/codesandbox-sdk/compare/v0.6.1...v0.6.2) (2025-02-10)

### Bug Fixes

- CommonJS build requires .cjs extension for ESM package ([#56](https://github.com/codesandbox/codesandbox-sdk/issues/56)) ([528022e](https://github.com/codesandbox/codesandbox-sdk/commit/528022e1e6beabd7e91ea755e544bffec02f265e))

## [0.6.1](https://github.com/codesandbox/codesandbox-sdk/compare/v0.6.0...v0.6.1) (2025-02-08)

### Performance Improvements

- do hibernation and shutdown in parallel ([#54](https://github.com/codesandbox/codesandbox-sdk/issues/54)) ([d8e4c6f](https://github.com/codesandbox/codesandbox-sdk/commit/d8e4c6f54ac91aef526af7ac8207f62f084b159d))

## [0.6.0](https://github.com/codesandbox/codesandbox-sdk/compare/v0.5.3...v0.6.0) (2025-02-06)

### Features

- allow sandbox to keep active while connected ([#53](https://github.com/codesandbox/codesandbox-sdk/issues/53)) ([7ad63d7](https://github.com/codesandbox/codesandbox-sdk/commit/7ad63d73926a13c7c1d4c23568901f7fd418c899))
- support env and cwd in shell api ([#52](https://github.com/codesandbox/codesandbox-sdk/issues/52)) ([7bf1e35](https://github.com/codesandbox/codesandbox-sdk/commit/7bf1e35c79b347e1b85dc557236c601aa0f455a9))

### Bug Fixes

- **snapshot:** don't include ignorefiles when building snapshots ([#50](https://github.com/codesandbox/codesandbox-sdk/issues/50)) ([64abff8](https://github.com/codesandbox/codesandbox-sdk/commit/64abff88deec9bf2ccac0a857be48b7de1ee6205))

## [0.5.3](https://github.com/codesandbox/codesandbox-sdk/compare/v0.5.2...v0.5.3) (2025-01-30)

### Bug Fixes

- use cjs for binary ([#47](https://github.com/codesandbox/codesandbox-sdk/issues/47)) ([7fc76a5](https://github.com/codesandbox/codesandbox-sdk/commit/7fc76a5648f1f2665dfda7c39d1432ca2ae2f768))

## [0.5.2](https://github.com/codesandbox/codesandbox-sdk/compare/v0.5.1...v0.5.2) (2025-01-30)

### Bug Fixes

- esm node build ([#36](https://github.com/codesandbox/codesandbox-sdk/issues/36)) ([4691813](https://github.com/codesandbox/codesandbox-sdk/commit/46918131508bcf56bde7b0d3f2afb07ae710fec5))

## [0.5.1](https://github.com/codesandbox/codesandbox-sdk/compare/v0.5.0...v0.5.1) (2025-01-30)

### Bug Fixes

- uploads of big files ([#44](https://github.com/codesandbox/codesandbox-sdk/issues/44)) ([c8e6f46](https://github.com/codesandbox/codesandbox-sdk/commit/c8e6f46299f51f9f8ac3acc5934d34a16e7db051))

## [0.5.0](https://github.com/codesandbox/codesandbox-sdk/compare/v0.4.0...v0.5.0) (2025-01-28)

### Features

- add more advanced pagination options ([#39](https://github.com/codesandbox/codesandbox-sdk/issues/39)) ([f086bb8](https://github.com/codesandbox/codesandbox-sdk/commit/f086bb88be2cb92848c8b8eae411408028978791))
- list sandboxes by running status ([#37](https://github.com/codesandbox/codesandbox-sdk/issues/37)) ([1e9e19c](https://github.com/codesandbox/codesandbox-sdk/commit/1e9e19c7df09ea15025873e8557cbed031d2e9d0))

## [0.4.0](https://github.com/codesandbox/codesandbox-sdk/compare/v0.3.0...v0.4.0) (2025-01-22)

### Features

- support for creating sessions ([#32](https://github.com/codesandbox/codesandbox-sdk/issues/32)) ([491d13d](https://github.com/codesandbox/codesandbox-sdk/commit/491d13db77992df5e3ab3fefb5b9de7e8edbd1c9))

## [0.3.0](https://github.com/codesandbox/codesandbox-sdk/compare/v0.2.0...v0.3.0) (2025-01-14)

### Features

- add support for listing sandboxes ([#33](https://github.com/codesandbox/codesandbox-sdk/issues/33)) ([6771396](https://github.com/codesandbox/codesandbox-sdk/commit/677139624f95431ec97e12ec985c3545bfe43678))

## [0.2.0](https://github.com/codesandbox/codesandbox-sdk/compare/v0.1.0...v0.2.0) (2025-01-10)

### Features

- add support for updating hibernation timeout ([#31](https://github.com/codesandbox/codesandbox-sdk/issues/31)) ([efd2051](https://github.com/codesandbox/codesandbox-sdk/commit/efd20510512cfeacc776d47cb0cf5d5563ba2914))

### Performance Improvements

- **build:** precreate files inside sandbox ([#16](https://github.com/codesandbox/codesandbox-sdk/issues/16)) ([6cd070e](https://github.com/codesandbox/codesandbox-sdk/commit/6cd070ed1c0c8fc81eba21fcd990bf145489cf91))

## 0.1.0 (2025-01-09)

### Features

- add support for together-ai api token ([af3a023](https://github.com/codesandbox/codesandbox-sdk/commit/af3a0233f1ac8dfae0a0d7cab6b206b4fe1dea5c))

### Bug Fixes

- don't keep VMs alive with polling ([#10](https://github.com/codesandbox/codesandbox-sdk/issues/10)) ([393d53c](https://github.com/codesandbox/codesandbox-sdk/commit/393d53c68bc4ea33983302fc2056727126124fc8))
- include sandbox id in build command ([9a737ea](https://github.com/codesandbox/codesandbox-sdk/commit/9a737ea3f6b3a26d6dd7953f7742494bae9d68a7))
- remove require banner for esm builds ([#15](https://github.com/codesandbox/codesandbox-sdk/issues/15)) ([6995957](https://github.com/codesandbox/codesandbox-sdk/commit/6995957220a3cc0da61f84d472a4e64d9bda0ebc))

### Performance Improvements

- start a vm while forking ([9b1774c](https://github.com/codesandbox/codesandbox-sdk/commit/9b1774c5d55ef802c069481a10e317e96d618f70))

### Miscellaneous Chores

- force release as 0.1.0 ([#28](https://github.com/codesandbox/codesandbox-sdk/issues/28)) ([352d049](https://github.com/codesandbox/codesandbox-sdk/commit/352d0492f78f508089d77750b7d5b4f773da797e))
