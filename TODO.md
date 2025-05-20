## QUESTIONS

- Should Snapshot Tags work like NPM?

  - Create Sandbox with no wakeup config
  - Write files
  - Wait for condition
  - Hibernate
  - New endpoint to tag it
  - Sandbox is tagged (Check if hibernated?)
  - BIG QUESTION: Should we force prevent starting the Sandbox? What about TanStack

  - New endpoint to create an alias to any tag

  - Change endpoint for Sandbox creation to allow tags/aliases as id

  - What is Tag / Alias format?

## USER QUESTIONS

## TODO

- Highlight snapshot building in docs
- https://github.com/codesandbox/codesandbox-applications/pull/4645
- Publish browser-static-server

# 1 New API

```ts
const sdk = new CodeSandbox(apiToken);

const sandbox = await sdk.sandbox.resume(id);
const sandbox = await sdk.sandbox.create(SandboxOptions & StartOptions);

sandbox.isUpToDate;
sandbox.bootupType;
sandbox.cluster;
sandbox.connect();
sandbox.createBrowserSession();
sandbox.createRestClient();
sandbox.updateTier();
sandbox.updateHibernationTimeout();

sdk.sandbox.shutdown(id);
sdk.sandbox.previewTokens.create(id);

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
