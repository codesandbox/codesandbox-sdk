import { Client } from "@hey-api/client-fetch";
import * as system from "../clients/client-rest-system";
import { SandboxSessionData } from "../sessions";
import { getSessionUrl } from "../utils/session";

export class SandboxRestSystem {
  constructor(private client: Client) {}

  private createRestParams<T>(session: SandboxSessionData, body: T) {
    return {
      baseUrl: getSessionUrl(session),
      client: this.client,
      body,
      throwOnError: true,
    };
  }

  update(session: SandboxSessionData, body: system.SystemUpdateData["body"]) {
    return system.systemUpdate(this.createRestParams(session, body));
  }

  hibernate(
    session: SandboxSessionData,
    body: system.SystemHibernateData["body"]
  ) {
    return system.systemHibernate(this.createRestParams(session, body));
  }

  metrics(session: SandboxSessionData, body: system.SystemMetricsData["body"]) {
    return system.systemMetrics(this.createRestParams(session, body));
  }
}
