import * as React from "react";
import { createContext, useContext } from "react";
import { CodeSandbox } from "@codesandbox/sdk";
import { API } from "../../API";
import { getInferredApiKey } from "../../utils/constants";
import { instrumentedFetch } from "../utils/sentry";

export const SDKContext = createContext(
  null as unknown as { sdk: CodeSandbox; api: API }
);

export const SDKProvider = ({ children }: { children: React.ReactNode }) => {
  const apiKey = getInferredApiKey();
  const sdk = new CodeSandbox(apiKey);
  const api = new API({ apiKey, instrumentation: instrumentedFetch });

  return (
    <SDKContext.Provider value={{ sdk, api }}>{children}</SDKContext.Provider>
  );
};

export function useSDK() {
  return useContext(SDKContext);
}
