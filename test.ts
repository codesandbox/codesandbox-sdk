import { CodeSandbox } from "@codesandbox/sdk";

const sdk = new CodeSandbox(
  "csb_v1_uv6a0J6nM43YEMkqJ2RE3T8fuFGmPKsnkZEUkhCBbcU",
  {
    baseUrl: "https://api.codesandbox.stream",
  }
);
console.log("Getting sandbox...");
let sandbox = await sdk.sandboxes.resume("37zz6l");

sandbox["pitcherManagerResponse"].pitcherURL = "https://37zz6l-57468.csb.dev";
sandbox["pitcherManagerResponse"].pitcherToken =
  "0085a669aaf703166263c038751432a5fcb5e56a7ededa131a953b253b5bee12";

const client = await sandbox.connect({
  env: {
    FOO: "BAR",
  },
});

console.log(client.commands.run(""));
