import { createContext, useContext } from "react";
import { Client, createClient, createConfig } from "@hey-api/client-fetch";
import { getApiKey } from "../utils/constants";
import { sandboxGet, vmListRunningVms } from "../../api-clients/client";

const apiClient = createClient(
  createConfig({
    baseUrl: process.env.BASE_URL || "https://api.codesandbox.io",
    headers: {
      Authorization: `Bearer ${getApiKey()}`,
    },
  })
);

function getResponse<T>(resp: { data?: { data?: T }; error: unknown }) {
  if (resp.error) {
    throw resp.error;
  }

  if (!resp.data || !resp.data.data) {
    return null;
  }

  return resp.data.data;
}

export async function getSandbox(sandboxId: string) {
  const resp = await sandboxGet({ client: apiClient, path: { id: sandboxId } });

  return getResponse(resp);
}

export async function getRunningVms() {
  const resp = await vmListRunningVms({ client: apiClient });

  return getResponse(resp);
}
