import { Client } from "@hey-api/client-fetch";
import * as system from "../../clients/client-rest-system";

export class SandboxRestSystem {
  constructor(private client: Client) {}

  update(body: system.SystemUpdateData["body"]) {
    return system.systemUpdate({ client: this.client, body });
  }

  hibernate(body: system.SystemHibernateData["body"]) {
    return system.systemHibernate({ client: this.client, body });
  }

  metrics(body: system.SystemMetricsData["body"]) {
    return system.systemMetrics({ client: this.client, body });
  }
}
