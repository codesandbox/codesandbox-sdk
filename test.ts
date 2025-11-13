import { CodeSandbox } from "@codesandbox/sdk";

const sdk = new CodeSandbox(
  "csb_v1_uv6a0J6nM43YEMkqJ2RE3T8fuFGmPKsnkZEUkhCBbcU",
  {
    baseUrl: "https://api.codesandbox.stream",
  }
);
console.log("Getting sandbox...");
let sandbox = await sdk.sandboxes.resume("kf55nx");

sandbox["pitcherManagerResponse"].pitcherURL = "https://kf55nx-57468.csb.dev";
sandbox["pitcherManagerResponse"].pitcherToken =
  "4b1d4b53771541daf9280b085774bb8f401e881f999b9cb700ab40b0c6b6a55d";

console.log("Connecting...");

const client = await sandbox.connect();

//console.log("Running command...");
//console.log(await client.commands.run("echo 'Hello World'"));

console.log("creating directory...");
console.log(await client.fs.mkdir("/workspace/newdir"));
console.log("creating file in new dir...");
console.log(await client.fs.writeFile("/workspace/newdir/text.txt", new TextEncoder().encode("Hello World")));
console.log("read file...");
console.log(await client.fs.readTextFile("/workspace/newdir/text.txt"));

console.log("Reading directory after adding newdir and new file...");
console.log(await client.fs.readdir("/workspace"));
console.log("rename file.....");
console.log(await client.fs.rename("/workspace/newdir/text.txt", "/workspace/newdir2/renamed.txt"));

console.log("Reading directory after adding newdir and new file...");
console.log(await client.fs.readdir("/workspace"));
console.log("Removing directory...");
console.log(await client.fs.remove("/workspace/newdir2"));
console.log("Reading directory after deleting newdir...");
console.log(await client.fs.readdir("/workspace"));