import { Client } from "@hey-api/client-fetch";
import * as system from "../clients/client-rest-system";
import { SessionData } from "../sessions";
import { getSessionUrl } from "../utils/session";

export class SandboxRestSystem {
  constructor(private client: Client) {}

  private createRestParams<T>(session: SessionData, body: T) {
    return {
      baseUrl: getSessionUrl(session),
      client: this.client,
      body,
      throwOnError: true,
    };
  }

  update(session: SessionData, body: system.SystemUpdateData["body"]) {
    return system.systemUpdate(this.createRestParams(session, body));
  }

  hibernate(session: SessionData, body: system.SystemHibernateData["body"]) {
    return system.systemHibernate(this.createRestParams(session, body));
  }

  metrics(session: SessionData, body: system.SystemMetricsData["body"]) {
    return system.systemMetrics(this.createRestParams(session, body));
  }
}
