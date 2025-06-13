import { ProtocolError, TMessage, TNotification } from "../protocol";

export type CommonError = ProtocolError;

export type Port = {
  port: number;
  url: string;
};

export type PortList = TMessage<
  "port/list",
  Record<string, never>,
  {
    result: {
      list: Port[];
    };
    error: CommonError;
  }
>;

export type PortMessage = PortList;

export type PortRequest = PortMessage["request"];

export type PortResponse = PortMessage["response"];

export type PortChanged = TNotification<
  "port/changed",
  {
    list: Port[];
  }
>;

export type PortNotification = PortChanged;
