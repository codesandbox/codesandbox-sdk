import { Client } from "@hey-api/client-fetch";
import * as container from "../../api-clients/client-rest-container";

export class SandboxRestContainer {
  constructor(private client: Client) {}
  setup(body: container.ContainerSetupData["body"]) {
    return container.containerSetup({
      body,
      client: this.client,
    });
  }
}
