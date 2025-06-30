import { Client } from "@hey-api/client-fetch";
import { sandboxGet, vmListRunningVms } from "../../api-clients/client";

function getResponse<T>(resp: { data?: { data?: T }; error: unknown }) {
  if (resp.error) {
    throw resp.error;
  }

  if (!resp.data || !resp.data.data) {
    return null;
  }

  return resp.data.data;
}

export async function getSandbox(apiClient: Client, sandboxId: string) {
  const resp = await sandboxGet({ client: apiClient, path: { id: sandboxId } });

  return getResponse(resp);
}

export async function getRunningVms(apiClient: Client) {
  const resp = await vmListRunningVms({ client: apiClient });

  return getResponse(resp);
}
