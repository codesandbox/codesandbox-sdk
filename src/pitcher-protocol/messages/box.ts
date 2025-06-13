import { ProtocolError, TMessage } from "../protocol";
import { PitcherErrorCode } from "../errors";

export type CommonError =
  | ProtocolError
  | {
      code: PitcherErrorCode.BOX_NOT_AVAILABLE;
      message: string;
    };

export interface IDependency {
  name: string;
  version: string;
}

export type SupportedManagers = "pnpm";

export type InstallDependenciesMessage = TMessage<
  "box/installDependencies",
  {
    manager: SupportedManagers;
    dependencies: IDependency[];
  },
  {
    result: {
      success: boolean;
    };
    error: CommonError;
  }
>;

export type InstalledDependenciesMessage = TMessage<
  "box/installedDependencies",
  {
    manager: SupportedManagers;
  },
  {
    result: {
      dependencies: IDependency[];
    };
    error: CommonError;
  }
>;

export type BoxMessage =
  | InstallDependenciesMessage
  | InstalledDependenciesMessage;

export type BoxRequest = BoxMessage["request"];

export type BoxResponse = BoxMessage["response"];
