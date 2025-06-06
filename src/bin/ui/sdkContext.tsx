import * as React from "react";
import { createContext, useContext } from "react";
import { CodeSandbox } from "@codesandbox/sdk";

const sdk = new CodeSandbox();

export const SDKContext = createContext<CodeSandbox>(sdk);

export const SDKProvider = ({ children }: { children: React.ReactNode }) => {
  return <SDKContext.Provider value={sdk}>{children}</SDKContext.Provider>;
};

export function useSDK() {
  return useContext(SDKContext);
}
