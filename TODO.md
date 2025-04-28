## QUESTIONS

- Please explain again why we always start the VM from "forkSandbox", but we also handle non start_response... how do we handle actually correct cluster? Is it not by always using the `start` method?
- You say sessions allows users to edit files without affecting each other, but above you state that all files are shared?
- Should we really call it GIT, it only supports GitHub?
- Can we pass custom session to `vmStart`?
- Using start options is not reliable

## TODO

# 1 New API

```ts
const sdk = new CodeSandbox(apiToken);

const sandbox = sdk.sandbox.create(SandboxOptions & StartOptions);
const sandbox = sdk.sandbox.fork(
  id,
  Omit<SandboxOptions, "template"> & StartOptions
);

sandbox.restart(StartOptions);
sandbox.hibernate();
sandbox.shutdown();
sandbox.isUpToDate();
sandbox.resume();
sandbox.updateTier();

sandbox.session({
  username: "anonymous",
  permission: "read",
  gitAccessToken: "",
});
sandbox.connect({
  username: "anonymous",
  permission: "read",
});
sandbox.rest({
  username: "anonymous",
  permission: "read",
});
sandbox.ssh({
  username: "anonymous",
  permission: "read",
});
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
