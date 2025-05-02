## QUESTIONS

- Have we removed the "This phishing overlay for SDK users?" https://github.com/codesandbox/codesandbox-sdk/issues/5"
- What you mean about "Dynamically resize terminal"? You can not really do that?
- Python SDK priority?
- Have we added Bun to default template? https://github.com/codesandbox/codesandbox-sdk/issues/62
- Do we allow deleting sandboxes? https://github.com/codesandbox/codesandbox-sdk/issues/86
- State of env var? https://github.com/codesandbox/codesandbox-sdk/issues/90

## USER QUESTIONS

## TODO

- Highlight snapshot building in docs

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
