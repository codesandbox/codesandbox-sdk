## QUESTIONS

- Should we always require a `gitAccessToken` for git sandboxes?
- If `gitAccessToken` should we create a temp session to clone and then still require
  a `createSession` to interact with the repo?
- Should we allow `gitAccessToken` with global user on `vm/{id}/start`?

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

const session = await sandbox.createBrowserSession();
const client = sandbox.connect();
const client = sandbox.createRestClient();
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
