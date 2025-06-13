import { ProtocolError, TMessage, TNotification } from "../protocol";
import { TaskDTO } from "./task";

export type SetupContainer = TMessage<
  "container/setup",
  {
    templateId: string;
    templateArgs: Record<string, string>;
    features?: { id: string; options: Record<string, string> }[];
  },
  {
    result: TaskDTO;
    error: ProtocolError;
  }
>;

export type ContainerNotification = TNotification<
  "container/openSetupDevtool",
  { dependencies: string[] }
>;

export type ContainerMessages = SetupContainer;

export type ContainerRequest = ContainerMessages["request"];
export type ContainerResponse = ContainerMessages["response"];
