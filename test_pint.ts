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

// ports testing
console.log("Getting ports...");
console.log(await client.ports.getAll());