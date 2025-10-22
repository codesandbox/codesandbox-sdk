import { CodeSandbox } from "@codesandbox/sdk";

const sdk = new CodeSandbox();

const sandbox = await sdk.sandboxes.create();
const client = await sandbox.connect();
console.log(await client.commands.run('echo "Hello World"'));

/*
const sdk = new CodeSandbox(
  "csb_v1_uv6a0J6nM43YEMkqJ2RE3T8fuFGmPKsnkZEUkhCBbcU",
  {
    baseUrl: "https://api.codesandbox.stream",
  }
);
console.log("Getting sandbox...");
let sandbox = await sdk.sandboxes.resume("cyshxw");

sandbox["pitcherManagerResponse"].pitcherURL = "https://cyshxw-57468.csb.dev";
sandbox["pitcherManagerResponse"].pitcherToken =
  "1ee18f9b607570eedfe4f809f2f66511fb4ba0a9c1008e60a769a3e9d81496d5";

console.log("Connecting...");

const client = await sandbox.connect();

console.log("Running command...");

console.log(await client.commands.run("echo Hello World"));
*/
