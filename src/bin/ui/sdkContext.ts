import { createContext, useContext } from "react";
import { CodeSandbox } from "@codesandbox/sdk";

export const SDKContext = createContext<CodeSandbox | null>(null);

export const SDKProvider = SDKContext.Provider;

export function useSDK() {
  const sdk = useContext(SDKContext);

  if (!sdk) {
    throw new Error("No SDK provided");
  }

  return sdk;
}
