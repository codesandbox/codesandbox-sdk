import * as React from "react";
import { createContext, useContext } from "react";
import { CodeSandbox } from "@codesandbox/sdk";
import { createApiClient } from "../../utils/api";
import { Client } from "@hey-api/client-fetch";
import { getInferredApiKey } from "../../utils/constants";
import { instrumentedFetch } from "../utils/sentry";

const sdk = new CodeSandbox();

const apiKey = getInferredApiKey();
const apiClient: Client = createApiClient(apiKey, {}, instrumentedFetch);

export const SDKContext = createContext<{ sdk: CodeSandbox; apiClient: Client }>({
  sdk,
  apiClient,
});


export const SDKProvider = ({ children }: { children: React.ReactNode }) => {
  return (
    <SDKContext.Provider value={{ sdk, apiClient }}>
      {children}
    </SDKContext.Provider>
  );
};

export function useSDK() {
  return useContext(SDKContext);
}
