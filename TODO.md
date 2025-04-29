## QUESTIONS

## TODO

- Improve data passed to browser with a BrowserSession, also ensure reconnect token works

# 1 New API

```ts
const sdk = new CodeSandbox(apiToken);

const sandbox = await sdk.sandbox.resume(id);
const sandbox = await sdk.sandbox.create(SandboxOptions & StartOptions);

sandbox.isUpToDate;
sandbox.bootupType;
sandbox.cluster;
sandbox.globalSession;
sandbox.fork(Omit<SandboxOptions, "template"> & StartOptions);
sandbox.restart(StartOptions);
sandbox.hibernate();
sandbox.shutdown();
sandbox.resume();
sandbox.updateTier();

const client = await sandbox.connect();
const client = await sandbox.createRestClient();
const browserSession = await sandbox.globalSession;

const session = await sandbox.createSession({
  id: "some-user-name",
  permission: "write",
});
const client = sandbox.connect(session);
const client = sandbox.createRestClient(session);
const browserSession = session;
```

# 2 Git clone support

```ts
// Factory.ai
// Create base template
// const sbx = await sdk.sandbox.create();
// sbx.git.clone();
// -> /project/sandbox
// git set-remote origin ...
// git pull

// /project/sandbox/.git -> /persisted/.git

/**
 * sdk.sandbox.create({ source: {
 *  type: 'git',
 *  url: 'https://github.com/sandbox-git/sandbox-git.git',
 *  branch: 'main',
 *  gitAccessToken: '...'
 * } })
 * 1. create sandbox
 * 2. ...
 * 3. clone
 *
 * // Source = Dropbox
 * // Source = Zip
 *
 *
 * // API create zip
 *
 * sandbox.create({
 *  source: {
 *    type: 'zip',
 *    url: 'https://example.com/my-zip-file.zip'
 *  }
 * });
 */

await sandbox.git.clone({
  url: "https://github.com/sandbox-git/sandbox-git.git",
  branch: "main",
});

// rm -rf /project/sandbox/*
//

await sandbox.git.pull();
await sandbox.git.checkout("main");

//
```

# 3 Snapshot Tagging

```ts
sdk.sandbox.create({
  files: {},
});
```

# Export types properly
