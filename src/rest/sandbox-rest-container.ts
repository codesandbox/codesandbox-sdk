import { Client } from "@hey-api/client-fetch";
import * as container from "../clients/client-rest-container";
import { SessionData } from "../sessions";
import { getSessionUrl } from "../utils/session";

export class SandboxRestContainer {
  constructor(private client: Client) {}

  private createRestParams<T>(session: SessionData, body: T) {
    return {
      baseUrl: getSessionUrl(session),
      client: this.client,
      body,
      throwOnError: true,
    };
  }

  setup(session: SessionData, body: container.ContainerSetupData["body"]) {
    return container.containerSetup(this.createRestParams(session, body));
  }
}
